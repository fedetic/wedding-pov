import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
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

  // ── CSRF check: verify state matches the nonce we set in the connect route ──
  const nonce = request.cookies.get("oauth_nonce")?.value;
  if (!nonce || nonce !== state) {
    console.error("[drive/callback] CSRF check failed — nonce mismatch");
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  // ── Read the actual userId from the session (not from state) ─────────────
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    console.error("[drive/callback] No active session during callback");
    return NextResponse.redirect(new URL("/login", appBase));
  }
  const userId = session.user.id;

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

  // Clear the nonce cookie
  const response = NextResponse.redirect(new URL("/dashboard?drive=connected", appBase));
  response.cookies.set("oauth_nonce", "", { maxAge: 0, path: "/" });
  return response;
}
