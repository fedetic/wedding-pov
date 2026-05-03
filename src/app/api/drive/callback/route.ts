import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // set in connect route
  const error = searchParams.get("error");

  // Use BETTER_AUTH_URL as the base for all redirects — request.url may be an
  // internal Railway IP that the user's browser cannot reach.
  const appBase = process.env.BETTER_AUTH_URL!;

  // Handle user-denied or error from Google
  if (error || !code || !userId) {
    console.error("[drive/callback] OAuth error or missing params:", { error, hasCode: !!code, hasUserId: !!userId });
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`, // must match connect route exactly
  );

  let tokens: { refresh_token?: string | null; access_token?: string | null; expiry_date?: number | null };
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
  } catch (e) {
    console.error("[drive/callback] Token exchange failed:", e);
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  // CRITICAL: assert refresh_token is present
  // Google only issues refresh_token on FIRST consent. If null here, the user previously
  // connected and the token wasn't stored. Re-trigger with forced consent.
  if (!tokens.refresh_token) {
    console.warn("[drive/callback] refresh_token is null — re-triggering consent flow");
    return NextResponse.redirect(new URL("/api/drive/connect", appBase));
  }

  // Encrypt the refresh token before storing — AES-256-GCM via ENCRYPTION_KEY
  const encryptedRefreshToken = encrypt(tokens.refresh_token);

  // UPSERT: one row per organizer (unique constraint on userId)
  await db
    .insert(googleTokens)
    .values({
      id: randomUUID(),
      userId,
      encryptedRefreshToken,
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    })
    .onConflictDoUpdate({
      target: googleTokens.userId,
      set: {
        encryptedRefreshToken,
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        updatedAt: new Date(),
      },
    });

  console.info("[drive/callback] Drive connected for userId:", userId);
  return NextResponse.redirect(new URL("/dashboard?drive=connected", appBase));
}
