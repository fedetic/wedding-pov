# Phase 5: Capacitor Infrastructure - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up the Capacitor native shell so the organizer dashboard loads in iOS and Android, API calls succeed (CORS), organizer sessions persist across app restarts, and Google Drive OAuth completes via the system browser. No native features (share sheet, biometrics) — those are Phase 6.

Requirements in scope: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05.

</domain>

<decisions>
## Implementation Decisions

### Webview architecture
- Use `server.url` in `capacitor.config.ts` pointing to the live Railway URL — not static export
- `output: 'export'` is not viable: Server Actions, Better Auth cookies(), and the auth middleware are all incompatible with static export
- The app binary is a thin native shell; all SSR, server actions, and API calls run on Railway

### Session persistence
- Use the `better-auth-capacitor` plugin (https://github.com/productdevbook/better-auth-capacitor)
- The plugin intercepts Better Auth session requests and stores tokens in native secure storage — bypasses WKWebView ITP cross-origin cookie blocking
- Do NOT rely on `Set-Cookie` from the Railway server reaching the Capacitor webview — iOS blocks these as third-party cookies

### Google Drive OAuth return
- Custom URL scheme deep link: `com.weddingpov.app://`
- Registered in `Info.plist` (CFBundleURLSchemes) and `AndroidManifest.xml` (intent filter with `android:scheme`)
- After the system browser completes the Google OAuth flow and the Railway `/api/drive/callback` runs, the server redirects to `com.weddingpov.app://oauth-callback?success=true`
- `@capacitor/app` catches this via `App.addListener('appUrlOpen', ...)`

### Google Drive OAuth — system browser
- Open `@capacitor/browser` (SFSafariViewController on iOS, Chrome Custom Tabs on Android) for the entire OAuth flow
- The existing `/api/drive/connect` and `/api/drive/callback` server routes are unchanged — only the initiating client side changes
- Never open `accounts.google.com` inside the Capacitor webview — Google blocks it with `disallowed_useragent`

### CORS and trusted origins
- Add `capacitor://localhost` (iOS) and `http://localhost` (Android) to Better Auth `trustedOrigins` in `src/lib/auth.ts`
- Add CORS headers for these two origins in `next.config.ts`
- Remove `X-Frame-Options: DENY` from `next.config.ts` — it blocks the Capacitor webview on Android
- Do NOT open CORS to `*` — keep explicit origin allowlist

### Capacitor version
- Capacitor 8.x (current stable)
- All official plugins must match core major version: `@capacitor/core@8.x`, `@capacitor/cli@8.x`, `@capacitor/ios@8.x`, `@capacitor/android@8.x`
- App ID: `com.weddingpov.app`

### Claude's Discretion
- Exact `WKAppBoundDomains` configuration in `Info.plist` for Railway domain
- CORS header scoping (whether to use middleware vs `next.config.ts` headers for per-request dynamic origin)
- Whether to add `CapacitorCookies: { enabled: true }` to `capacitor.config.ts` as belt-and-suspenders alongside the plugin

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture and stack decisions
- `.planning/research/STACK.md` — Capacitor 8 package list, `server.url` rationale, version compatibility table, `next.config.ts` change required
- `.planning/research/ARCHITECTURE.md` — System architecture diagram, Better Auth cookie behavior in WKWebView, Next.js changes required, build order and commands
- `.planning/research/PITFALLS.md` — Critical pitfalls: Google OAuth `disallowed_useragent`, CORS blocking, cookie persistence, App Store 4.2 risk, recovery strategies

### Requirements
- `.planning/REQUIREMENTS.md` §Capacitor Infrastructure (CAP) — CAP-01 through CAP-05 acceptance criteria and traceability

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/auth.ts`: `betterAuth({ trustedOrigins: [...] })` — add `capacitor://localhost` and `https://localhost` to this array
- `src/lib/auth-client.ts`: `createAuthClient({ baseURL, fetchOptions })` — needs `Capacitor.isNativePlatform()` detection to switch fetch options for mobile
- `next.config.ts`: `async headers()` function — remove `X-Frame-Options: DENY`, add CORS headers for Capacitor origins

### Established Patterns
- Better Auth cookie sessions (HTTP-only) — NOT used for mobile; `better-auth-capacitor` plugin replaces this for native context
- Server-side OAuth brokering for Drive (unchanged — `/api/drive/connect` and `/api/drive/callback` stay the same)
- Railway deployment — `server.url` in `capacitor.config.ts` points here

### Integration Points
- `src/lib/auth.ts` — `trustedOrigins` update
- `src/lib/auth-client.ts` — platform detection for mobile fetch behavior
- `next.config.ts` — header changes (X-Frame-Options removal, CORS)
- `capacitor.config.ts` (new file) — `appId`, `appName`, `webDir`, `server.url`
- `ios/` (generated by `cap add ios`) — `Info.plist`: `CFBundleURLSchemes` for `com.weddingpov.app`, `WKAppBoundDomains` for Railway domain
- `android/` (generated by `cap add android`) — `AndroidManifest.xml`: intent filter for `com.weddingpov.app://` scheme

</code_context>

<specifics>
## Specific Ideas

No specific UI or UX requirements — this is pure infrastructure. All visible UI is the existing web app rendered via `server.url`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-capacitor-infrastructure*
*Context gathered: 2026-05-18*
