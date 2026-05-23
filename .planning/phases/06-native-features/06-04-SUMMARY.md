---
phase: 06-native-features
plan: 04
subsystem: ui
tags: [capacitor, network, offline, biometric, deep-links, native, react, nextjs]

# Dependency graph
requires:
  - phase: 06-native-features/06-02
    provides: DeepLinkHandler component and AASA/assetlinks.json endpoints
  - phase: 06-native-features/06-03
    provides: BiometricLockScreen component and settings page

provides:
  - OfflineOverlay.tsx — reactive fullscreen offline overlay using @capacitor/network
  - NativeShell.tsx — single client wrapper mounting all three native-only components
  - layout.tsx update — NativeShell mounted once at app root

affects:
  - phase 07 (if any)
  - App Store submission (Phase 8)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NativeShell pattern: single root Client Component mounts all native-only effects; each child self-gates with Capacitor.isNativePlatform()"
    - "Reactive offline overlay using Network.addListener + initial getStatus() mount check"
    - "Listener cleanup: listenerPromise.then(l => l.remove()).catch(() => {}) pattern"

key-files:
  created:
    - src/components/native/OfflineOverlay.tsx
    - src/components/native/NativeShell.tsx
  modified:
    - src/app/layout.tsx

key-decisions:
  - "OfflineOverlay retry handler does NOT call window.location.reload() — UI-SPEC §Interaction States is the latest-wins contract; auto-dismiss via reactive Network listener is the correct mechanism"
  - "NativeShell component order: DeepLinkHandler first (listener-only), BiometricLockScreen second, OfflineOverlay last — offline overlay stacks on top so it supersedes biometric gate when device has no network"
  - "layout.tsx remains a Server Component — Next.js App Router permits Server layout to render Client Component children directly (verified in node_modules/next/dist/docs)"

patterns-established:
  - "All native-only side effects consolidated in a single NativeShell root wrapper to minimize layout.tsx complexity"

requirements-completed:
  - NATIVE-03
  - NATIVE-04

# Metrics
duration: 8min
completed: 2026-05-23
---

# Phase 6 Plan 04: Layout Integration and Offline Overlay Summary

**Reactive offline overlay (NATIVE-04) and NativeShell root wrapper consolidating all three native effects — biometric lock, deep link routing, offline detection — mounted once in layout.tsx**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-23T00:00:00Z
- **Completed:** 2026-05-23T00:08:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- OfflineOverlay.tsx uses Network.addListener for reactive connected/disconnected state; auto-dismisses when connectivity returns; supports manual retry with 1s "Checking..." feedback; gated with Capacitor.isNativePlatform() so it is a no-op on web
- NativeShell.tsx wraps all three native-only components (DeepLinkHandler, BiometricLockScreen, OfflineOverlay) in a single Client Component fragment — correct mount order ensures OfflineOverlay stacks visually on top of BiometricLockScreen when both would render simultaneously
- layout.tsx updated with two minimal changes: NativeShell import added, `<NativeShell />` inserted as first body child before `{children}`; layout.tsx remains a Server Component throughout
- TypeScript clean (npx tsc --noEmit: 0 errors), production build passes, all 14 routes generated

## Task Commits

1. **Task 1: Create OfflineOverlay.tsx** — `eb1c050` (feat)
2. **Task 2: Create NativeShell.tsx** — `c4e96d1` (feat)
3. **Task 3: Mount NativeShell in layout.tsx** — `acd51e5` (feat)

## Files Created/Modified

- `src/components/native/OfflineOverlay.tsx` — Reactive fullscreen offline overlay; role=alert aria-live=assertive; "No internet connection" heading; "Check your connection and try again" body; "Try again"/"Checking..." button
- `src/components/native/NativeShell.tsx` — Single client wrapper mounting DeepLinkHandler + BiometricLockScreen + OfflineOverlay in stacking order
- `src/app/layout.tsx` — Added NativeShell import and `<NativeShell />` as first body child

## Decisions Made

- **Retry handler does NOT reload WebView**: UI-SPEC §Interaction States is explicit that the overlay should unmount without reloading — the reactive Network listener handles auto-dismiss. The CONTEXT.md mention of reload was superseded by the UI-SPEC (latest-wins for visual contract).
- **NativeShell mount order**: DeepLinkHandler first (renders null — listener only), BiometricLockScreen second, OfflineOverlay last. OfflineOverlay sits on top visually via later DOM mount; z-50 on both overlays means the later-mounted one wins when both are active. Offline supersedes biometric lock because BiometricAuth itself may be offline-OK but the dashboard it gates requires the network.
- **layout.tsx stays Server Component**: Next.js App Router explicitly allows Server Component layouts to include Client Component children. NativeShell carries `"use client"` internally; no `"use client"` needed in layout.tsx.

## Deviations from Plan

None — plan executed exactly as specified. The EXACT content blocks in the plan were written verbatim. The only note is that pre-existing lint errors in unrelated files (QRModal.tsx, HistoryModal.tsx, EventRow.tsx — all from prior plans) were discovered during `npm run lint` verification; these are documented in deferred-items.md and excluded from this plan's scope.

## Issues Encountered

- `npm run lint` reported 3 pre-existing errors in EventRow.tsx, HistoryModal.tsx, and QRModal.tsx (react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars). All three files were last modified in plan 06-01 or earlier. Documented in `.planning/phases/06-native-features/deferred-items.md`. No action taken per scope boundary rule.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-06-12 | useEffect cleanup removes networkStatusChange listener via `listenerPromise.then(l => l.remove()).catch(() => {})` — same pattern as DeepLinkHandler |
| T-06-14 | Each child in NativeShell internally guards with `Capacitor.isNativePlatform()` — on web all three render null, no native APIs called |

## Phase 6 Completion Status

All four NATIVE requirements now have functional code committed:

| Requirement | Implemented in | Status |
|-------------|---------------|--------|
| NATIVE-01 (Share QR) | Plan 06-01 | Complete |
| NATIVE-02 (Biometrics) | Plans 06-03 + 06-04 | Complete |
| NATIVE-03 (Deep Links) | Plans 06-02 + 06-04 | Complete |
| NATIVE-04 (Offline Overlay) | Plan 06-04 | Complete |

## User Setup Required

None — no new external services or environment variables introduced in this plan.

## Next Phase Readiness

- Phase 6 (Native Features) is functionally complete — all NATIVE-01..04 requirements implemented
- Pre-existing lint errors in QRModal.tsx, HistoryModal.tsx, EventRow.tsx need resolution before App Store submission
- Android App Links verification requires ANDROID_CERT_FINGERPRINT (release keystore not yet generated — deferred to Phase 8)
- Real device testing recommended for: Google OAuth via @capacitor/browser, Better Auth HTTP-only cookie ITP behavior, biometric flow end-to-end

---
*Phase: 06-native-features*
*Completed: 2026-05-23*
