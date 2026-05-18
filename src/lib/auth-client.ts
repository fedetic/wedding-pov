import { createAuthClient } from "better-auth/client";
import { Capacitor } from "@capacitor/core";
import { capacitorClient } from "better-auth-capacitor/client";

// On native (iOS/Android), the better-auth-capacitor plugin intercepts session
// requests and stores tokens in native secure storage, bypassing WKWebView ITP
// cross-origin cookie blocking (per D-02 decision).
// On web, the standard cookie-based session behavior is unchanged.
const plugins = Capacitor.isNativePlatform() ? [capacitorClient()] : [];

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!, // must match BETTER_AUTH_URL (no trailing slash)
  plugins,
});
