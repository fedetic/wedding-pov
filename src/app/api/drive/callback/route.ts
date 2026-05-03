import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appBase = process.env.BETTER_AUTH_URL!;

  if (error || !code || !state) {
    console.error("[drive/callback] OAuth error or missing params:", { error, hasCode: !!code, hasState: !!state });
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  // ── Verify state: decrypt to recover userId (AES-256-GCM — unforgeable) ──
  let userId: string;
  try {
    userId = decrypt(state);
  } catch {
    console.error("[drive/callback] State decryption failed — possible CSRF attempt");
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  if (!userId) {
    console.error("[drive/callback] Decrypted userId is empty");
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );

  let tokens: { refresh_token?: string | null; access_token?: string | null; expiry_date?: number | null };
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens;
  } catch (e) {
    console.error("[drive/callback] Token exchange failed:", e);
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  if (!tokens.refresh_token) {
    console.warn("[drive/callback] refresh_token is null — re-triggering consent flow");
    return NextResponse.redirect(new URL("/api/drive/connect", appBase));
  }

  const encryptedRefreshToken = encrypt(tokens.refresh_token);

  await db
    .insert(googleTokens)
    .values({
      id: randomUUID(),
      userId,
      encryptedRefreshToken,
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    })
    .onConflictDoUpdate({
      target: googleTokens.userId,
      set: {
        encryptedRefreshToken,
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      },
    });

  console.info("[drive/callback] Drive connected for userId:", userId);
  return NextResponse.redirect(new URL("/dashboard?drive=connected", appBase));
}
