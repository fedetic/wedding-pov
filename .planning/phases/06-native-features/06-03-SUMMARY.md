---
phase: 06-native-features
plan: "03"
subsystem: native-biometric
tags: [capacitor, biometric, face-id, settings, native-features]
dependency_graph:
  requires:
    - 06-02  # entitlements wiring must exist before biometric plugin (pbxproj)
  provides:
    - BiometricLockScreen component (checkAndLock helper + React component)
    - /dashboard/settings page with BiometricToggle
    - @aparajita/capacitor-biometric-auth installed and synced
    - NSFaceIDUsageDescription in Info.plist
  affects:
    - ios/App/CapApp-SPM/Package.swift (biometric plugin wired)
    - android/ (biometric plugin synced)
    - src/app/(organizer)/dashboard/page.tsx (Settings nav link added)
tech_stack:
  added:
    - "@aparajita/capacitor-biometric-auth@10.0.0"
  patterns:
    - Capacitor.isNativePlatform() in render (not useState+useEffect) — per canonical ConnectDriveButton.tsx pattern
    - Server Component page with Client Component toggle child
    - eslint-disable-next-line for intentional async cold-launch pattern in BiometricLockScreen
key_files:
  created:
    - src/components/native/BiometricLockScreen.tsx
    - src/app/(organizer)/dashboard/settings/page.tsx
    - src/app/(organizer)/dashboard/settings/BiometricToggle.tsx
  modified:
    - package.json (added @aparajita/capacitor-biometric-auth ^10.0.0)
    - package-lock.json
    - ios/App/App/Info.plist (NSFaceIDUsageDescription added)
    - ios/App/CapApp-SPM/Package.swift (AparajitaCapacitorBiometricAuth entry via cap sync)
    - android/app/capacitor.build.gradle (cap sync update)
    - android/capacitor.settings.gradle (cap sync update)
    - src/app/(organizer)/dashboard/page.tsx (Settings nav link)
    - eslint.config.mjs (added ignores for .claude/, .github/, android/app/build/)
decisions:
  - "BiometricLockScreen uses eslint-disable for react-hooks/set-state-in-effect — async cold-launch attempt() is intentionally fired once from useEffect; setStates inside are async and cannot cascade"
  - "BiometricToggle uses Capacitor.isNativePlatform() directly in render (not useState+useEffect) — matches canonical ConnectDriveButton.tsx pattern per 06-01 decision"
  - "eslint.config.mjs ignores .claude/, .github/, android/app/build/ — GSD tooling and build artifacts use CommonJS require() which triggers @typescript-eslint/no-require-imports"
  - "iOS uses SPM (Package.swift) not CocoaPods — no Podfile.lock; biometric plugin appears in CapApp-SPM/Package.swift as AparajitaCapacitorBiometricAuth"
metrics:
  duration: ~10min
  completed_date: "2026-05-22"
  tasks_completed: 3
  files_created: 3
  files_modified: 8
---

# Phase 6 Plan 03: Biometric Auth Setup Summary

NATIVE-02 core assembled: @aparajita/capacitor-biometric-auth@10.0.0 installed and synced into iOS SPM and Android, NSFaceIDUsageDescription added to Info.plist, Settings page with native-gated toggle, BiometricLockScreen component ready to mount.

## What Was Built

**Task 1** — Package install + Info.plist + cap sync:
- Installed `@aparajita/capacitor-biometric-auth@10.0.0` (NOT `@capacitor-community/biometric-auth` — that does not exist on npm, Pitfall 1 from RESEARCH.md)
- Added `NSFaceIDUsageDescription` to `ios/App/App/Info.plist` with exact UI-SPEC copy: "Wedding POV uses Face ID to protect your account."
- `plutil -lint` confirms plist valid
- `npx cap sync` completed: biometric plugin wired into iOS via SPM (Package.swift, `AparajitaCapacitorBiometricAuth`) and Android
- Plan 02 `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` wiring survived cap sync (2 occurrences preserved — unchanged)

**Task 2** — BiometricLockScreen.tsx:
- `checkAndLock()` async helper: returns `skip` (non-native or disabled), `fallback` (unavailable or auth failed), `unlocked` (success)
- `BiometricLockScreen` React component: fullscreen overlay, `role=dialog aria-modal=true`, "Authenticate" button auto-focused, "Use password instead" appears at `failureCount >= 3`
- Uses `isAvailable` only (NOT `biometryType`) — per RESEARCH.md anti-patterns
- Cold-launch only: `attempt()` fires once from `useEffect` on mount
- NOT mounted in any layout/page in this plan — plan 04 owns `layout.tsx` wiring

**Task 3** — Settings page + dashboard nav:
- `/dashboard/settings` server page: auth-gated (`redirect("/login")`), `metadata.title = "Settings — Wedding POV"`, back link "← Dashboard"
- `BiometricToggle` client component: native-only (returns null on web), enables by first calling `BiometricAuth.authenticate` then persisting `biometricEnabled=true`, disables by `Preferences.remove`
- Dashboard header: added `<Link href="/dashboard/settings">Settings</Link>` beside `<SignOutButton />` in a `flex items-center gap-4` wrapper

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Fixed react-hooks/set-state-in-effect lint error in BiometricLockScreen.tsx**
- **Found during:** Task 3 (when running npm run lint)
- **Issue:** `useEffect(() => { attempt(); }, [attempt])` triggers `react-hooks/set-state-in-effect` lint rule because `attempt` calls `setState()` in its body. The plan's template code has this pattern; it's architecturally correct for a cold-launch async gate.
- **Fix:** Added targeted `// eslint-disable-next-line react-hooks/set-state-in-effect` comment on that specific useEffect line. The setState calls inside `attempt()` are all async (after `await` expressions) so there is no actual cascading render risk.
- **Files modified:** src/components/native/BiometricLockScreen.tsx
- **Commit:** 3cd3f33

**2. [Rule 2 - Missing Critical] Fixed BiometricToggle setState-in-effect via canonical pattern**
- **Found during:** Task 3 (lint)
- **Issue:** Original `BiometricToggle` used `useState(false)` for `isNative` and `setIsNative(true)` inside `useEffect` — same lint rule violation
- **Fix:** Removed `isNative` state, replaced with `Capacitor.isNativePlatform()` called directly in render — the canonical pattern from `ConnectDriveButton.tsx` documented in STATE.md [06-01] decision
- **Files modified:** src/app/(organizer)/dashboard/settings/BiometricToggle.tsx
- **Commit:** 3cd3f33

**3. [Rule 3 - Blocking] ESLint config ignores for GSD tooling and build artifacts**
- **Found during:** Task 3 (npm run lint exit 1 from .claude/ and .github/ directories)
- **Issue:** The `.claude/` and `.github/get-shit-done/` directories contain GSD CommonJS tooling binaries. The `android/app/build/` directory contains Capacitor build intermediates. None of these existed in .eslintignore scope. Lint exited 1 purely from these non-source files.
- **Fix:** Added `.claude/**`, `.github/**`, and `android/app/build/**` to the `globalIgnores` array in `eslint.config.mjs`
- **Files modified:** eslint.config.mjs
- **Commit:** 3cd3f33

### Pre-existing Issues (Out of Scope)

- `HistoryModal.tsx` and `QRModal.tsx` have `react-hooks/set-state-in-effect` errors — pre-existing from Phase 3/4, not introduced by this plan. Not fixed per scope boundary rule. Logged to deferred items.

## Known Stubs

None — all implemented functionality is wired to real native APIs. The `BiometricLockScreen` component is intentionally not mounted in any layout (plan 04 owns that wiring) — this is documented scope, not a stub.

## Threat Flags

No new threat surfaces beyond what the plan's `<threat_model>` covers. The biometric API surface (T-06-08 through T-06-SC) is exactly as designed:
- `allowDeviceCredential: false` on all `BiometricAuth.authenticate()` calls — T-06-08 mitigated
- biometricEnabled flag in Preferences — T-06-09 accepted (controls only UI gate, not API access)

## Self-Check

Verified files exist:
- [x] src/components/native/BiometricLockScreen.tsx — `[ -f src/components/native/BiometricLockScreen.tsx ]` FOUND
- [x] src/app/(organizer)/dashboard/settings/page.tsx — FOUND
- [x] src/app/(organizer)/dashboard/settings/BiometricToggle.tsx — FOUND

Verified commits:
- [x] a134739 — FOUND
- [x] c6a8362 — FOUND
- [x] 3cd3f33 — FOUND

TypeScript: `npx tsc --noEmit` exits 0 — PASS
Build: `npm run build` exits 0, /dashboard/settings listed — PASS
Plist: `plutil -lint ios/App/App/Info.plist` OK — PASS
Entitlements: `CODE_SIGN_ENTITLEMENTS` count = 2 — PASS

## Self-Check: PASSED
