import { createAuthClient } from "better-auth/client";

// With server.url pointing to Railway, the WebView origin and the API origin are
// the same (https://wedding-pov-production.up.railway.app). Cookie-based sessions
// work natively — no capacitorClient plugin needed. That plugin is only needed for
// the local file serving case (capacitor://localhost), where there's a cross-origin
// cookie issue.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!, // must match BETTER_AUTH_URL (no trailing slash)
});
