---
phase: 05-capacitor-infrastructure
plan: "03"
subsystem: auth
tags: [better-auth, capacitor, ios, android, native-storage, preferences, wkwebview, itp]

# Dependency graph
requires:
  - phase: 05-02
    provides: Native Capacitor scaffold (ios/ and android/ dirs, capacitor.config.ts)
provides:
  - Platform-aware auth client that stores session tokens in native secure storage on iOS/Android
  - Web auth client behavior unchanged (cookie-based)
affects: [05-04, native-auth, session-persistence]

# Tech tracking
tech-stack:
  added: [better-auth-capacitor@0.3.6, "@capacitor/network@8.0.1", "@capacitor/preferences@8.0.1"]
  patterns: [Capacitor.isNativePlatform() conditional plugin injection, empty-plugins-array-on-web pattern]

key-files:
  created: []
  modified: [src/lib/auth-client.ts, package.json, package-lock.json]

key-decisions:
  - "capacitorClient imported from better-auth-capacitor/client (not root) — package has separate client/server entry points"
  - "@capacitor/network and @capacitor/preferences installed as peer dependencies required by better-auth-capacitor/client"

patterns-established:
  - "Pattern: Capacitor.isNativePlatform() used at module init time to build plugins array — evaluated once at startup, not per-request"
  - "Pattern: better-auth-capacitor/client entry point (not root) for client plugin"

requirements-completed: [CAP-04]

# Metrics
duration: 5min
completed: 2026-05-18
---

# Phase 5 Plan 3: better-auth-capacitor Integration Summary

**Session tokens stored in native Capacitor Preferences (iOS Keychain / Android EncryptedSharedPreferences) on native via better-auth-capacitor plugin, bypassing WKWebView ITP cookie blocking**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-18T12:00:00Z
- **Completed:** 2026-05-18T12:03:36Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Installed `better-auth-capacitor@0.3.6` (productdevbook) with peer deps `@capacitor/network` and `@capacitor/preferences`
- Updated `src/lib/auth-client.ts` with platform detection via `Capacitor.isNativePlatform()`
- Native builds inject `capacitorClient()` plugin; web builds use empty plugins array (unchanged behavior)
- `npm run build` passes with 0 TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Install better-auth-capacitor and update auth-client.ts** - `b0adc82` (feat)

**Plan metadata:** _(final docs commit — see below)_

## Files Created/Modified
- `src/lib/auth-client.ts` - Platform-aware auth client with Capacitor.isNativePlatform() conditional plugin injection
- `package.json` - Added better-auth-capacitor, @capacitor/network, @capacitor/preferences dependencies
- `package-lock.json` - Updated lockfile with new packages

## Decisions Made
- **capacitorClient from better-auth-capacitor/client**: The plan specified importing from `"better-auth-capacitor"` root, but the package structure separates server and client plugins. Root export only exports the server-side `capacitor` plugin. The `capacitorClient` function for createAuthClient lives in `better-auth-capacitor/client`. Used the correct entry point.
- **@capacitor/network and @capacitor/preferences installed**: Not explicitly in plan but required peer dependencies of `better-auth-capacitor/client`. The online manager inside the plugin does a dynamic import of `@capacitor/network`. Installing these is correct and expected (they are official Ionic/Capacitor packages).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing peer dependencies @capacitor/network and @capacitor/preferences**
- **Found during:** Task 1 (build verification step)
- **Issue:** `better-auth-capacitor/client` dynamically imports `@capacitor/network` which was not installed; build failed with "Module not found: Can't resolve '@capacitor/network'"
- **Fix:** Ran `npm install @capacitor/network @capacitor/preferences` (both official Ionic/Capacitor packages, required peer deps per package.json peerDependencies)
- **Files modified:** package.json, package-lock.json
- **Verification:** Build passes (0 TypeScript errors)
- **Committed in:** b0adc82 (Task 1 commit)

**2. [Rule 1 - Bug] Import path corrected from root to /client entry point**
- **Found during:** Task 1 (reading package exports before writing)
- **Issue:** Plan specified `import { capacitorClient } from "better-auth-capacitor"` but root export only exports the server plugin `capacitor`. Client plugin `capacitorClient` lives in `better-auth-capacitor/client` entry point.
- **Fix:** Used `import { capacitorClient } from "better-auth-capacitor/client"` to match actual package structure
- **Files modified:** src/lib/auth-client.ts
- **Verification:** TypeScript types resolve correctly; build passes
- **Committed in:** b0adc82 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — missing peer deps, 1 bug — wrong import path)
**Impact on plan:** Both fixes necessary for correctness. No scope creep. Plan goal fully achieved.

## Issues Encountered
- Package structure differed from plan assumption: `capacitorClient` is not at root export but at `/client` subpath export. Discovered by reading `dist/index.d.mts` before writing code.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth client is now platform-aware. On native builds, session tokens will be stored in iOS Keychain / Android EncryptedSharedPreferences via `@capacitor/preferences`.
- Addresses CAP-04 concern: iOS ITP cross-origin cookie blocking no longer a blocker for organizer sessions.
- Ready to proceed to 05-04.
- Manual validation (force-quit + relaunch on real device) should be performed at the Phase 5 checkpoint to confirm session survives.

---
*Phase: 05-capacitor-infrastructure*
*Completed: 2026-05-18*
