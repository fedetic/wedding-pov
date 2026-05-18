---
phase: 05-capacitor-infrastructure
plan: "04"
subsystem: mobile-oauth
tags: [capacitor, google-drive, oauth, deep-link, ios, android]
dependency_graph:
  requires: [05-02, 05-03]
  provides: [mobile-oauth-flow, custom-url-scheme]
  affects: [dashboard, drive-connect-route, drive-callback-route]
tech_stack:
  added: []
  patterns:
    - "@capacitor/browser Browser.open for system browser OAuth"
    - "Custom URL scheme com.weddingpov.app:// for deep link return"
    - "AES-256-GCM state with :mobile suffix for platform detection"
key_files:
  created:
    - src/components/ConnectDriveButton.tsx
  modified:
    - src/app/(organizer)/dashboard/page.tsx
    - src/app/api/drive/connect/route.ts
    - src/app/api/drive/callback/route.ts
    - ios/App/App/Info.plist
    - android/app/src/main/AndroidManifest.xml
decisions:
  - "Use new Response(null, { status: 302 }) for custom scheme redirects — NextResponse.redirect() may not accept non-HTTPS URLs in next@16.2.4"
  - "Mobile detection in error path via User-Agent (accepted risk: T-05-04-02) — spoofing causes browser to display can't-open-URL, not a security issue"
  - "No token/code in deep link URL — app reloads from server on appUrlOpen to learn actual Drive state"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-05-18"
  tasks_completed: 2
  files_changed: 6
---

# Phase 05 Plan 04: Google Drive OAuth Deep Link Flow Summary

Google Drive OAuth wired to open in system browser (SFSafariViewController / Chrome Custom Tab) and return to the app via custom URL scheme com.weddingpov.app://, using AES-256-GCM state encoding to distinguish mobile vs web OAuth flows.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Register URL scheme in native manifests | d04c177 | ios/App/App/Info.plist, android/app/src/main/AndroidManifest.xml |
| 2 | ConnectDriveButton + server route updates | 9a9096e | src/components/ConnectDriveButton.tsx, dashboard/page.tsx, drive/connect/route.ts, drive/callback/route.ts |

## What Was Built

### Task 1: Native Manifest URL Scheme Registration

- `ios/App/App/Info.plist`: Added `CFBundleURLTypes` block with `CFBundleURLSchemes` = `com.weddingpov.app`
- `android/app/src/main/AndroidManifest.xml`: Added `intent-filter` inside `MainActivity` for `android:scheme="com.weddingpov.app"`; INTERNET permission was already present

### Task 2: ConnectDriveButton Client Component + Server Routes

**ConnectDriveButton.tsx (new):**
- Web path: renders `<a href="/api/drive/connect">` (identical to previous behavior, no regression)
- Native path: `Browser.open()` call with `?mobile=1` to open OAuth in system browser
- `useEffect` registers `appUrlOpen` listener on native; when `com.weddingpov.app://oauth-callback` deep link fires, closes browser and reloads page

**dashboard/page.tsx:** Import added, raw anchor replaced with `<ConnectDriveButton appUrl={process.env.NEXT_PUBLIC_APP_URL!} />`

**drive/connect/route.ts:** State now encodes `:mobile` suffix when `?mobile=1` is present in the request URL

**drive/callback/route.ts:**
- State decryption now strips `:mobile` suffix and sets `isMobile = true`
- Success path issues `302` to `com.weddingpov.app://oauth-callback?success=true` on mobile
- Error guard uses User-Agent to detect mobile and redirect to custom scheme error URL

## Verification

- `grep "CFBundleURLSchemes" ios/App/App/Info.plist` — present
- `grep "android:scheme" android/app/src/main/AndroidManifest.xml` — present
- `grep "Browser.open" src/components/ConnectDriveButton.tsx` — present
- `grep "com.weddingpov.app://oauth-callback" src/app/api/drive/callback/route.ts` — 2 occurrences (success + error)
- `npm run build` — exits 0

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data or incomplete wiring.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model (T-05-04-01 through T-05-04-SC).

## Self-Check: PASSED

- src/components/ConnectDriveButton.tsx: FOUND
- src/app/(organizer)/dashboard/page.tsx: FOUND (updated)
- src/app/api/drive/connect/route.ts: FOUND (updated)
- src/app/api/drive/callback/route.ts: FOUND (updated)
- ios/App/App/Info.plist: FOUND (updated)
- android/app/src/main/AndroidManifest.xml: FOUND (updated)
- commit d04c177: FOUND
- commit 9a9096e: FOUND
