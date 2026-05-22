import { NextResponse } from "next/server";

// Serves /.well-known/apple-app-site-association
// Required for iOS Universal Links (NATIVE-03). Content-Type MUST be application/json
// — Apple's AASA verifier rejects application/octet-stream (Pitfall 2 in 06-RESEARCH.md).
// Paths scoped to /e/* only — the guest upload route — to avoid intercepting non-app pages
// (Pitfall 7 in 06-RESEARCH.md).
export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? "TEAMID_PLACEHOLDER";
  const bundleId = "com.weddingpov.app";
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.${bundleId}`,
            paths: ["/e/*"],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
