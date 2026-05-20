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
    const ua = request.headers.get("user-agent") ?? "";
    const looksLikeMobile = ua.includes("iPhone") || ua.includes("Android");
    console.error("[drive/callback] OAuth error or missing params:", { error, hasCode: !!code, hasState: !!state });
    if (looksLikeMobile) {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Returning to app…</title></head>
<body>
<script>window.location.href = "com.weddingpov.app://oauth-callback?error=true";</script>
<p><a href="com.weddingpov.app://oauth-callback?error=true">Tap here to return to app.</a></p>
</body>
</html>`;
      return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    return NextResponse.redirect(new URL("/dashboard?drive=error", appBase));
  }

  // ── Verify state: decrypt to recover userId (AES-256-GCM — unforgeable) ──
  let userId: string;
  let isMobile = false;
  try {
    const decrypted = decrypt(state);
    if (decrypted.endsWith(":mobile")) {
      userId = decrypted.slice(0, -7);
      isMobile = true;
    } else {
      userId = decrypted;
    }
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
  if (isMobile) {
    // SFSafariViewController (iOS) and Chrome Custom Tab (Android) cannot follow
    // a server-side 302 to a custom URL scheme — they just show the raw URL.
    // Landing on an HTTPS page first and triggering the scheme via JS is reliable.
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Returning to app…</title></head>
<body>
<script>window.location.href = "com.weddingpov.app://oauth-callback?success=true";</script>
<p>Redirecting back to the app…<br>
<a href="com.weddingpov.app://oauth-callback?success=true">Tap here if not redirected.</a></p>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }
  return NextResponse.redirect(new URL("/dashboard?drive=connected", appBase));
}
