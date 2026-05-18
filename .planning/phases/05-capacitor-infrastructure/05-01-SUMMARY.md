---
phase: 05-capacitor-infrastructure
plan: 01
subsystem: infra
tags: [capacitor, cors, better-auth, next.js, ios, android]

# Dependency graph
requires: []
provides:
  - Better Auth trustedOrigins extended with "capacitor://localhost" (iOS) and "http://localhost" (Android)
  - X-Frame-Options: DENY removed from global HTTP headers to allow Capacitor WebView on Android
affects:
  - 05-02-capacitor-scaffold
  - 05-03-auth-flow
  - 05-04-upload-flow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capacitor origin allowlist: explicit string literals in trustedOrigins, never wildcard"
    - "X-Frame-Options removed for WebView compatibility; clickjacking risk accepted (auth-gated organizer dashboard)"

key-files:
  created: []
  modified:
    - src/lib/auth.ts
    - next.config.ts

key-decisions:
  - "Added capacitor://localhost and http://localhost to Better Auth trustedOrigins — explicit allowlist, never wildcard (T-05-01)"
  - "Removed X-Frame-Options: DENY from next.config.ts — blocks Capacitor WebView on Android; risk accepted per T-05-02"
  - "CORS credential enforcement via Better Auth trustedOrigins, not static response headers — static headers cannot do dynamic origin reflection (T-05-03)"

patterns-established:
  - "Capacitor origin trust: add to trustedOrigins in auth.ts for credential-scoped CORS, not static headers in next.config.ts"

requirements-completed:
  - CAP-03

# Metrics
duration: 2min
completed: 2026-05-18
---

# Phase 5 Plan 01: Capacitor Server CORS Unblock Summary

**Better Auth trustedOrigins extended with Capacitor WebView origins and X-Frame-Options: DENY removed to unblock iOS and Android API calls — Phase 5 blocker resolved**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-18T07:26:43Z
- **Completed:** 2026-05-18T07:28:29Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended Better Auth trustedOrigins with "capacitor://localhost" (iOS WebView) and "http://localhost" (Android WebView) so cross-origin API calls from the native app are no longer rejected
- Removed X-Frame-Options: DENY header from next.config.ts which blocked the Android Capacitor WebView from loading Railway-served pages
- Build passes with no TypeScript or config errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Capacitor origins to Better Auth trustedOrigins** - `85cd2c1` (feat)
2. **Task 2: Remove X-Frame-Options from next.config.ts** - `4d02fcd` (feat)

**Plan metadata:** _(docs commit below)_

## Files Created/Modified
- `src/lib/auth.ts` - Added "capacitor://localhost" and "http://localhost" to trustedOrigins array
- `next.config.ts` - Removed X-Frame-Options: DENY line; kept X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## Decisions Made
- CORS credential enforcement handled via Better Auth trustedOrigins, not static next.config.ts headers. Static headers() cannot do per-request origin reflection — wildcard Access-Control-Allow-Origin is incompatible with credentials: 'include'. Better Auth's trustedOrigins is the correct credential-scoped gate.
- Kept explanatory comment `// X-Frame-Options: DENY removed — blocks Capacitor WebView on Android` in next.config.ts for future maintainers.

## Deviations from Plan

### Minor Discrepancy (Plan Template vs Acceptance Criteria)
- The plan's "exact template" for next.config.ts includes a comment `// X-Frame-Options: DENY removed — blocks Capacitor WebView on Android`
- The acceptance criteria says `grep -c "X-Frame-Options" next.config.ts returns 0`
- These conflict: keeping the comment (which is in the exact template) means grep returns 1, not 0
- Resolution: Kept the explanatory comment as specified in the template — it's documentation value. The *header entry* is removed as required. The `grep -c "X-Frame-Options"` acceptance criterion was likely written before the comment was added to the template.

No other deviations from plan.

## Issues Encountered
None — both file edits applied cleanly, build passed.

## User Setup Required
None — these are source file changes deployed via normal Railway CI. No environment variables or external service configuration required.

## Next Phase Readiness
- Railway server now accepts API calls from Capacitor WebView origins
- Android WebView can load Railway-served pages (X-Frame-Options gate removed)
- Ready for 05-02: Capacitor scaffold (install @capacitor/core, @capacitor/cli, @capacitor/ios, @capacitor/android)
- Blocker CAP-03 resolved; remaining blockers (CAP-04, CAP-05) to be validated in later phases

---
*Phase: 05-capacitor-infrastructure*
*Completed: 2026-05-18*
