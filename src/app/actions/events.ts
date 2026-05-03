"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { google } from "googleapis";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid"; // ESM-only v5 — must use import, not require
import { headers } from "next/headers";

// ── Slug generation ────────────────────────────────────────────────────────────
// Format: "{event-name-slug}-{6-char-nanoid}" e.g. "our-wedding-Kj9mX2"
// nanoid(6) gives ~1 billion combinations — collision rate negligible
function generateSlug(eventName: string): string {
  const base = eventName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric runs with hyphen
    .replace(/^-+|-+$/g, "");     // strip leading/trailing hyphens
  const suffix = nanoid(6);       // 6 URL-safe random chars
  return `${base}-${suffix}`;
}

// ── createEvent Server Action ──────────────────────────────────────────────────
export async function createEvent(formData: {
  name: string;
  photoLimit: number;
  isActive: boolean;
}): Promise<{ success: true; slug: string } | { success: false; error: string }> {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, error: "Unauthorized" };

  // 2. Input validation (server-side — never trust client values)
  const name = formData.name.trim();
  if (!name || name.length === 0) {
    return { success: false, error: "Event name is required." };
  }
  if (name.length > 100) {
    return { success: false, error: "Event name must be 100 characters or fewer." };
  }
  const photoLimit = Math.floor(formData.photoLimit);
  if (!Number.isFinite(photoLimit) || photoLimit < 1 || photoLimit > 100) {
    return { success: false, error: "Photo limit must be between 1 and 100." };
  }

  // 3. Verify Drive is connected — MUST check before Drive API call to give friendly error
  const [tokenRow] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, session.user.id))
    .limit(1);

  if (!tokenRow) {
    return {
      success: false,
      error: "Please connect Google Drive before creating an event.",
    };
  }

  // 4. Create Google Drive folder — decrypt token server-side only, never log plaintext
  const refreshToken = decrypt(tokenRow.encryptedRefreshToken);
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  let driveFolderId: string;
  try {
    const folder = await drive.files.create({
      requestBody: {
        name,                                          // folder name = event name
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id", // REQUIRED — without this, folder.data.id may be undefined
    });
    if (!folder.data.id) {
      throw new Error("Drive returned no folder ID");
    }
    driveFolderId = folder.data.id;
  } catch (e) {
    console.error("[createEvent] Drive folder creation failed:", e);
    return {
      success: false,
      error: "Failed to create Drive folder. Check Drive connection and try again.",
    };
  }

  // 5. Generate slug and insert event row
  const slug = generateSlug(name);
  try {
    await db.insert(events).values({
      id: randomUUID(),
      organizerId: session.user.id,
      name,
      slug,
      photoLimit,
      isActive: formData.isActive,
      driveFolderId,
    });
  } catch (e) {
    console.error("[createEvent] DB insert failed:", e);
    return { success: false, error: "Failed to save event. Please try again." };
  }

  return { success: true, slug };
}
