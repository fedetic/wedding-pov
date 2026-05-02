import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  // Session guard — must be logged in to connect Drive
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    // Redirect URI — must exactly match a URI registered in GCP Console
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",             // request refresh token
    prompt: "select_account consent",  // force consent screen to always get refresh token
    scope: ["https://www.googleapis.com/auth/drive.file"], // ONLY drive.file — never use drive scope
    state: session.user.id,            // carry userId through the OAuth round-trip
  });

  return NextResponse.redirect(authUrl);
}
