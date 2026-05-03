import { google } from "googleapis";
import { Readable } from "stream";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import heicConvert from "heic-convert";

interface UploadParams {
  organizerId: string;
  driveFolderId: string;
  fileName: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

interface UploadResult {
  driveFileId: string;
  /** Final filename after possible HEIC→JPEG conversion */
  finalFileName: string;
  /** Final MIME type after possible HEIC→JPEG conversion */
  finalMimeType: string;
}

/**
 * Uploads a file to the organizer's Google Drive folder using their stored OAuth tokens.
 * - Decrypts the refresh token server-side (never exposed to clients)
 * - Converts HEIC/HEIF images to JPEG before upload
 * - Persists refreshed access tokens back to the database after a token refresh
 */
export async function uploadFileToDrive({
  organizerId,
  driveFolderId,
  fileName,
  mimeType,
  buffer,
}: UploadParams): Promise<UploadResult> {
  // ── 1. Load organizer's Google tokens from DB ─────────────────────────────
  const [tokenRow] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, organizerId))
    .limit(1);

  if (!tokenRow) {
    throw new Error(`No Google tokens found for organizer ${organizerId}`);
  }

  // ── 2. Decrypt refresh token ───────────────────────────────────────────────
  const refreshToken = decrypt(tokenRow.encryptedRefreshToken);

  // ── 3. Build OAuth2 client ─────────────────────────────────────────────────
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: tokenRow.accessToken ?? undefined,
    expiry_date: tokenRow.accessTokenExpiresAt
      ? tokenRow.accessTokenExpiresAt.getTime()
      : undefined,
  });

  // ── 4. Persist refreshed tokens back to DB ─────────────────────────────────
  oauth2Client.on("tokens", async (newTokens) => {
    const updates: Partial<typeof tokenRow> = {
      updatedAt: new Date(),
    };
    if (newTokens.access_token) {
      updates.accessToken = newTokens.access_token;
    }
    if (newTokens.expiry_date) {
      updates.accessTokenExpiresAt = new Date(newTokens.expiry_date);
    }
    await db
      .update(googleTokens)
      .set(updates)
      .where(eq(googleTokens.userId, organizerId));
  });

  // ── 5. HEIC/HEIF detection and conversion ──────────────────────────────────
  const isHeic =
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    fileName.toLowerCase().endsWith(".heic") ||
    fileName.toLowerCase().endsWith(".heif");

  let finalMimeType = mimeType;
  let finalFileName = fileName;
  let uploadBuffer: ArrayBuffer = buffer;

  if (isHeic) {
    const converted = await heicConvert({
      buffer,
      format: "JPEG",
      quality: 0.85,
    });
    uploadBuffer = converted;
    finalMimeType = "image/jpeg";
    // Replace .heic / .heif extension (case-insensitive) with .jpg
    finalFileName = fileName.replace(/\.(heic|heif)$/i, ".jpg");
    // If the file had no recognized extension, just append .jpg
    if (finalFileName === fileName) {
      finalFileName = `${fileName}.jpg`;
    }
  }

  // ── 6. Upload to Google Drive ──────────────────────────────────────────────
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const response = await drive.files.create({
    requestBody: {
      name: finalFileName,
      parents: [driveFolderId],
    },
    media: {
      mimeType: finalMimeType,
      body: Readable.from(Buffer.from(uploadBuffer)),
    },
    fields: "id",
  });

  const driveFileId = response.data.id;
  if (!driveFileId) {
    throw new Error("Drive upload succeeded but returned no file ID");
  }

  return { driveFileId, finalFileName, finalMimeType };
}
