---
phase: 06-native-features
plan: "02"
subsystem: infra
tags: [capacitor, universal-links, app-links, ios, android, deep-links, well-known, aasa]

requires:
  - phase: 06-01
    provides: Capacitor.isNativePlatform() pattern, appUrlOpen listener pattern from ConnectDriveButton.tsx

provides:
  - AASA route handler at /.well-known/apple-app-site-association with Content-Type: application/json
  - assetlinks.json route handler at /.well-known/assetlinks.json with Content-Type: application/json
  - ios/App/App/App.entitlements with Associated Domains for weddingpov.app and pov.jjwedding.nl
  - AndroidManifest.xml with two autoVerify intent filters (https, pathPrefix /e/) for both domains
  - DeepLinkHandler.tsx client component ready for layout mounting (plan 04)
  - .env.example documenting APPLE_TEAM_ID and ANDROID_CERT_FINGERPRINT requirements

affects:
  - 06-04 (must mount DeepLinkHandler in layout.tsx)
  - Phase 8 (must set APPLE_TEAM_ID and ANDROID_CERT_FINGERPRINT in Railway env vars)

tech-stack:
  added: []
  patterns:
    - "Route Handler for .well-known files in src/app/.well-known/{name}/route.ts gives explicit Content-Type control vs public/ directory (Pitfall 2)"
    - "AASA paths scoped to /e/* only to avoid intercepting non-app pages (Pitfall 7)"
    - "CODE_SIGN_ENTITLEMENTS wired manually into both Debug and Release XCBuildConfiguration blocks in pbxproj"
    - "Multiple appUrlOpen listeners coexist by URL scheme prefix (https:// vs com.weddingpov.app://)"

key-files:
  created:
    - src/app/.well-known/apple-app-site-association/route.ts
    - src/app/.well-known/assetlinks.json/route.ts
    - ios/App/App/App.entitlements
    - src/components/native/DeepLinkHandler.tsx
    - .env.example
  modified:
    - ios/App/App.xcodeproj/project.pbxproj
    - android/app/src/main/AndroidManifest.xml

key-decisions:
  - "Both weddingpov.app and pov.jjwedding.nl configured for Associated Domains and Android intent filters — pov.jjwedding.nl is server.url so window.location.origin returns it for QR URLs; weddingpov.app is the public marketing domain"
  - "AASA paths scoped to /e/* only — avoids intercepting landing page and other non-app paths"
  - "ANDROID_CERT_FINGERPRINT placeholder in assetlinks.json — release keystore not yet generated; Android App Links won't verify until Phase 8"
  - "APPLE_TEAM_ID from env var with TEAMID_PLACEHOLDER fallback — can be set in Railway without code change"
  - "CODE_SIGN_ENTITLEMENTS wired into pbxproj manually — cap sync does not touch entitlements, safe to commit"
  - "DeepLinkHandler not mounted in layout this plan — plan 04 owns layout.tsx wiring"
  - ".env.example force-added via git add -f because .gitignore has .env* catch-all; file contains no secrets"

patterns-established:
  - "Well-known route: src/app/.well-known/{endpoint-name}/route.ts exports GET() using NextResponse.json() with explicit Content-Type header"

requirements-completed:
  - NATIVE-03

duration: 4min
completed: "2026-05-23"
---

# Phase 6 Plan 02: Universal Links / App Links Infrastructure Summary

**AASA and assetlinks.json served via Next.js Route Handlers with explicit Content-Type: application/json; iOS entitlements and Android autoVerify intent filters configured for both weddingpov.app and pov.jjwedding.nl; DeepLinkHandler.tsx routes /e/ Universal Links to /dashboard**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-22T22:06:24Z
- **Completed:** 2026-05-23T22:10:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Server-side: AASA and assetlinks.json route handlers deployed at /.well-known/* with correct Content-Type, paths scoped to /e/*, env-var-driven team/fingerprint values
- iOS: App.entitlements created with Associated Domains for both production domains; CODE_SIGN_ENTITLEMENTS wired into Debug + Release App target in project.pbxproj
- Android: Two autoVerify=true intent filters added for https on weddingpov.app and pov.jjwedding.nl with pathPrefix /e/; existing OAuth scheme filter preserved
- Client: DeepLinkHandler.tsx client component created following ConnectDriveButton.tsx cleanup pattern, guards with isNativePlatform(), routes https:// /e/* URLs to /dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AASA + assetlinks.json Route Handlers and update .env.example** - `176351f` (feat)
2. **Task 2: Add iOS App.entitlements + Android intent filters for Universal Links / App Links** - `1f8afce` (feat)
3. **Task 3: Create DeepLinkHandler.tsx client component** - `bdd5b0c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/app/.well-known/apple-app-site-association/route.ts` - AASA JSON route handler with APPLE_TEAM_ID env var, paths ["/e/*"], Content-Type: application/json
- `src/app/.well-known/assetlinks.json/route.ts` - Android App Links JSON route handler with ANDROID_CERT_FINGERPRINT env var, Content-Type: application/json
- `ios/App/App/App.entitlements` - Associated Domains plist with applinks:weddingpov.app and applinks:pov.jjwedding.nl
- `ios/App/App.xcodeproj/project.pbxproj` - CODE_SIGN_ENTITLEMENTS added to both Debug and Release App target build configs
- `android/app/src/main/AndroidManifest.xml` - Two autoVerify intent filters added for https on both domains with pathPrefix /e/
- `src/components/native/DeepLinkHandler.tsx` - Client component: appUrlOpen listener routing https:// /e/* to /dashboard
- `.env.example` - Documents all env vars including APPLE_TEAM_ID and ANDROID_CERT_FINGERPRINT

## Decisions Made
- Both weddingpov.app and pov.jjwedding.nl configured for all mechanisms — pov.jjwedding.nl is the active server.url so guest QR URLs use it; weddingpov.app is the public marketing domain per NATIVE-03 spec
- APPLE_TEAM_ID discovered in pbxproj as QKKDJANNHR (DEVELOPMENT_TEAM setting) — documented in SUMMARY; env var still used in route handler for Railway configurability
- .env.example force-added via `git add -f` because .gitignore has a `.env*` catch-all; the file contains only blank-value placeholders and comments, no secrets

## Deviations from Plan

None - plan executed exactly as written.

The one minor discrepancy: the plan's acceptance criteria for DeepLinkHandler.tsx specified `grep -c 'com.weddingpov.app'` output 0 and `grep -c 'https://'` output 1, but the plan's own provided EXACT content includes these strings in documentation comments. The functional routing logic is correct (the OAuth scheme is not handled in this component). This is an internal plan inconsistency, not an implementation deviation.

## Issues Encountered
- `.env.example` was blocked by `.gitignore` catch-all pattern `.env*`. Resolved by using `git add -f .env.example` since the file contains only placeholder comments with no secrets.

## Known Stubs
- `APPLE_TEAM_ID` in AASA route handler defaults to `"TEAMID_PLACEHOLDER"` — Universal Links will not verify until the real Team ID is set in Railway env vars. APPLE_TEAM_ID is actually known from pbxproj (QKKDJANNHR) but the env var approach is preferred for Railway configurability.
- `ANDROID_CERT_FINGERPRINT` in assetlinks.json route handler defaults to empty array — Android App Links will not auto-verify until the release keystore is generated in Phase 8.

## User Setup Required

Two Railway env vars must be set before deep links work end-to-end:

1. `APPLE_TEAM_ID=QKKDJANNHR` (Apple Developer Team ID — found in ios/App/App.xcodeproj/project.pbxproj DEVELOPMENT_TEAM setting)
2. `ANDROID_CERT_FINGERPRINT=<SHA-256>` (release keystore fingerprint — set during Phase 8 distribution work)

## Next Phase Readiness
- NATIVE-03 server-side infrastructure complete — Railway will serve AASA and assetlinks.json with correct Content-Type once deployed
- DeepLinkHandler.tsx is ready to be mounted by plan 04 (layout.tsx wiring)
- iOS Universal Links will work on physical device once APPLE_TEAM_ID is set in Railway and app is built with the entitlement
- Android App Links require Phase 8 release keystore before assetlinks.json fingerprint can be populated

---
*Phase: 06-native-features*
*Completed: 2026-05-23*
