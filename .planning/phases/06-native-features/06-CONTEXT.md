# Phase 6: Native Features - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add four native capabilities to the Capacitor shell built in Phase 5: QR code sharing via the OS share sheet (NATIVE-01), biometric unlock via Face ID / Touch ID (NATIVE-02), Universal Links / App Links so `weddingpov.app/e/[slug]` opens the native app (NATIVE-03), and a graceful offline error screen (NATIVE-04).

The Phase 5 Capacitor shell (server.url → Railway, better-auth-capacitor sessions, @capacitor/browser for OAuth) is the foundation. No infrastructure changes — only native feature additions.

</domain>

<decisions>
## Implementation Decisions

### QR Share (NATIVE-01)
- Share button lives inside the existing `QRModal.tsx`, alongside the Download button (not on EventRow)
- Share content: QR PNG image + guest URL text (e.g. `pov.jjwedding.nl/e/my-wedding`) — both together so recipient can save the image or tap the link
- Share button only renders when `Capacitor.isNativePlatform()` is true; web keeps the existing Download button
- `QRModal.tsx` already generates the QR as a `dataUrl` (PNG) — the share action converts this to a file for the native share sheet

### Biometric Unlock (NATIVE-02)
- Create a new `/settings` route in the organizer dashboard with the biometric enable/disable toggle
- Settings page is always reachable from the dashboard (not native-only), but the biometric toggle only renders on native
- Lock granularity: app quit / cold launch only — biometric prompt on next cold open after the toggle is enabled; backgrounding and resuming does NOT re-lock
- Fallback per REQUIREMENTS.md: if biometrics hardware is unavailable (not enrolled, not supported), fall back to email/password silently — no error shown for unavailability
- After consecutive biometric failures (e.g. 3×), show a "Use password instead" option — does not auto-logout, just bypasses biometric for that session

### Deep Links / Universal Links (NATIVE-03)
- Pattern intercepted: `weddingpov.app/e/[slug]` (the guest upload URL)
- When app is installed and link is opened: app launches, navigates to dashboard home — the `/e/[slug]` path is guest-only; organizer should land in the dashboard
- If organizer is not logged in: shows login screen; after successful login, lands on dashboard home (no event-specific routing needed)
- Requires serving `apple-app-site-association` (AASA) from Railway at `/.well-known/apple-app-site-association`
- Requires serving `assetlinks.json` from Railway at `/.well-known/assetlinks.json`
- Deep link handling is additive to the existing `appUrlOpen` listener in `ConnectDriveButton.tsx` — the OAuth callback URL scheme (`com.weddingpov.app://`) remains unchanged; Universal Links are a separate mechanism (HTTPS domains, not custom schemes)

### Offline Error Screen (NATIVE-04)
- Show a fullscreen offline overlay when `@capacitor/network` reports no connectivity
- `@capacitor/network` is already installed (peer dep from Phase 5)
- Retry button checks connectivity and reloads the WebView
- Reactive: overlay appears whenever connectivity is lost (not just on launch)
- Overlay sits above the WebView — does not navigate away, so the app resumes correctly when connectivity returns

### Claude's Discretion
- Exact biometric plugin — `@capacitor-community/biometric-auth` is the likely choice; researcher to confirm best Capacitor 8 compatible option
- Offline overlay design (copy, icon, colors) — minimal, on-brand with existing black/white aesthetic
- Settings page design — minimal toggle list; extend if Phase 7 needs to add account deletion here
- How to convert the QR `dataUrl` to a shareable file — Filesystem plugin or Blob URL; researcher to identify cleanest approach for `@capacitor/share`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Native Features (NATIVE) — NATIVE-01 through NATIVE-04 acceptance criteria and traceability

### Architecture and prior phase decisions
- `.planning/phases/05-capacitor-infrastructure/05-CONTEXT.md` — Phase 5 decisions: server.url, URL scheme `com.weddingpov.app://`, Capacitor.isNativePlatform() pattern, @capacitor/app + appUrlOpen listener
- `.planning/research/STACK.md` — Capacitor 8 package versions, installed plugin list
- `.planning/research/PITFALLS.md` — Critical pitfalls for Capacitor native development

### Code to read
- `src/components/events/QRModal.tsx` — existing QR modal; share button goes here alongside Download
- `src/components/ConnectDriveButton.tsx` — established pattern for Capacitor.isNativePlatform() checks, @capacitor/app appUrlOpen listener, @capacitor/browser usage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `QRModal.tsx`: generates QR PNG as `dataUrl` via `qrcode` npm package — the share action reuses this `dataUrl` directly
- `ConnectDriveButton.tsx`: pattern for `Capacitor.isNativePlatform()` guard + `App.addListener('appUrlOpen', ...)` — deep link handler follows the same pattern
- `@capacitor/app`: already installed — used for appUrlOpen; Universal Link intercept uses the same listener
- `@capacitor/network`: already installed — use for offline detection in NATIVE-04

### Established Patterns
- Native-conditional rendering: `if (Capacitor.isNativePlatform()) { ... }` — established in ConnectDriveButton; follow same pattern for Share button and biometric UI
- System browser for external flows: `Browser.open()` from `@capacitor/browser` — established for OAuth; NOT needed for share sheet (share is a native OS sheet)
- URL scheme deep links (`com.weddingpov.app://`) — already registered in Info.plist and AndroidManifest.xml; Universal Links are additive (different mechanism — HTTPS domain association files)

### Integration Points
- `src/components/events/QRModal.tsx` — add Share button
- `src/app/(organizer)/dashboard/` — add `settings/` route
- Railway Next.js app — serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
- `src/app/layout.tsx` or a top-level client component — network listener for offline overlay
- `ios/App/App/` — may need Entitlements update for Associated Domains (Universal Links)
- `android/app/` — `AndroidManifest.xml` may need intent filter for App Links

</code_context>

<specifics>
## Specific Ideas

- Deep link routing is simple: any `weddingpov.app/e/[slug]` link opens the app to dashboard home. No slug-specific routing needed — the organizer knows which event they care about.
- The `/settings` page can start minimal (biometric toggle only) and grow in Phase 7 if account deletion lands there.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-native-features*
*Context gathered: 2026-05-22*
