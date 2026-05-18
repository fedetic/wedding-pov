import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";
import { encrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );

  // Encrypt the userId into the state param using AES-256-GCM.
  // This is unforgeable without the ENCRYPTION_KEY, so it acts as both
  // CSRF protection AND a way to recover the userId in the callback —
  // without relying on a cookie surviving Google's redirect chain.
  const isMobile = new URL(request.url).searchParams.get("mobile") === "1";
  const statePayload = isMobile ? `${session.user.id}:mobile` : session.user.id;
  const state = encrypt(statePayload);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state,
  });

  return NextResponse.redirect(authUrl);
}
