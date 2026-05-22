import { NextResponse } from "next/server";

// Serves /.well-known/assetlinks.json
// Required for Android App Links (NATIVE-03). The SHA-256 fingerprint comes from
// the release keystore — Phase 8 will replace the placeholder with the real value
// (06-RESEARCH.md §Critical Finding + §Open Questions #2). Until then, App Links
// do not auto-verify on Android; iOS Universal Links work independently.
export async function GET() {
  const fingerprint = process.env.ANDROID_CERT_FINGERPRINT ?? "";
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.weddingpov.app",
          sha256_cert_fingerprints: fingerprint ? [fingerprint] : [],
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
