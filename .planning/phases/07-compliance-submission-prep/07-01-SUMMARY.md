---
phase: 07-compliance-submission-prep
plan: "01"
subsystem: compliance
tags: [ios, android, privacy-manifest, next-js, app-store, google-play]

# Dependency graph
requires:
  - phase: 06-native-features
    provides: Capacitor iOS/Android app shell with @capacitor/preferences using NSUserDefaults
provides:
  - Public unauthenticated /privacy route returning HTTP 200
  - ios/App/App/PrivacyInfo.xcprivacy declaring NSPrivacyAccessedAPICategoryUserDefaults / CA92.1
  - PrivacyInfo.xcprivacy referenced in project.pbxproj as App target build file (4 occurrences)
  - REQUIREMENTS.md with COMPLY-02, COMPLY-03, COMPLY-06 marked complete
affects:
  - 07-02-icons-splash (COMPLY-01 plan; no file overlap)
  - 07-03-account-deletion (COMPLY-04 plan; no file overlap)
  - 08-submission (PrivacyInfo.xcprivacy required before App Store Connect upload)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public Next.js App Router page: src/app/privacy/page.tsx outside all route groups — no auth.api.getSession(), no redirect, Server Component"
    - "iOS privacy manifest: ios/App/App/PrivacyInfo.xcprivacy as plist XML; must be in App target build phase, not just on disk"

key-files:
  created:
    - src/app/privacy/page.tsx
    - ios/App/App/PrivacyInfo.xcprivacy
  modified:
    - ios/App/App.xcodeproj/project.pbxproj
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PrivacyInfo.xcprivacy declares only NSPrivacyAccessedAPICategoryUserDefaults / CA92.1 — only @capacitor/preferences uses NSUserDefaults; no other required-reason API in installed plugin set"
  - "Privacy page placed at src/app/privacy/page.tsx (not inside (organizer)/) — falls outside all auth-gated route groups by design"
  - "Android SDK already at 36 (compileSdkVersion=36, targetSdkVersion=36) — COMPLY-06 satisfied without code change"

patterns-established:
  - "Pattern 1: Unauthenticated public page — no 'use client', no auth.api.getSession(), no redirect; located outside all route groups"
  - "Pattern 2: iOS privacy manifest — PrivacyInfo.xcprivacy must exist on disk AND be referenced in project.pbxproj App target; disk-only is insufficient for App Store Connect"

requirements-completed:
  - COMPLY-02
  - COMPLY-03
  - COMPLY-06

# Metrics
duration: ~50min (including human Xcode checkpoint)
completed: 2026-05-23
---

# Phase 7 Plan 01: Privacy Page + iOS Privacy Manifest + Android SDK Verification Summary

**Public /privacy Server Component, iOS PrivacyInfo.xcprivacy declaring UserDefaults/CA92.1 added to Xcode App target, Android SDK 36 confirmed >= 35 requirement; three compliance requirements closed**

## Performance

- **Duration:** ~50min (including human Xcode checkpoint for Task 3)
- **Started:** 2026-05-23T14:14:18+02:00
- **Completed:** 2026-05-23T15:01:41+02:00
- **Tasks:** 4 (3 auto + 1 human checkpoint)
- **Files modified:** 4

## Accomplishments

- Created unauthenticated `src/app/privacy/page.tsx` with 7 sections (what we collect, storage, sharing, Drive scope, account deletion, children, contact) — App Store reviewer can reach it without logging in
- Created `ios/App/App/PrivacyInfo.xcprivacy` with `NSPrivacyAccessedAPICategoryUserDefaults` / `CA92.1` reason code; required by Apple App Store Connect since May 1, 2024
- PrivacyInfo.xcprivacy added to Xcode App target via pbxproj (4 references verified); `Generate Privacy Report` confirmed the UserDefaults/CA92.1 entry
- Confirmed `android/variables.gradle` compileSdkVersion=36, targetSdkVersion=36 (>= 35 required by Google Play for new submissions, deadline Aug 31 2025)
- REQUIREMENTS.md updated: COMPLY-02, COMPLY-03, COMPLY-06 marked complete with traceability table updated

## Task Commits

Each task was committed atomically:

1. **Task 1: Create public privacy policy page** - `a7a833b` (feat)
2. **Task 2: Create ios/App/App/PrivacyInfo.xcprivacy** - `2f3f33d` (feat)
3. **Task 3: Add PrivacyInfo.xcprivacy to Xcode App target** - `00f2924` (chore — human checkpoint result)
4. **Task 4: Verify Android SDK + mark COMPLY-02/03/06 complete** - `95835d4` (feat)

## Files Created/Modified

- `src/app/privacy/page.tsx` — Server Component public privacy policy page with 7 sections; no auth gate
- `ios/App/App/PrivacyInfo.xcprivacy` — Apple privacy manifest; NSPrivacyTracking=false, UserDefaults/CA92.1 declared
- `ios/App/App.xcodeproj/project.pbxproj` — 4 new PrivacyInfo.xcprivacy references (fileRef + buildFile in App target)
- `.planning/REQUIREMENTS.md` — COMPLY-02, COMPLY-03, COMPLY-06 marked [x]; traceability updated to Complete

## Decisions Made

- Placed `/privacy` page outside all route groups (`src/app/privacy/`) so it bypasses any auth middleware — App Store reviewers and search bots get HTTP 200 without cookies
- Declared only `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` in the manifest. Plugin audit confirmed only `@capacitor/preferences` touches NSUserDefaults; adding undeclared APIs would be a false declaration and grounds for rejection
- `android/variables.gradle` was not modified — compileSdkVersion=36 already exceeds the >= 35 requirement; downgrading would break Play Store compliance

## Deviations from Plan

None — plan executed exactly as written. The human Xcode checkpoint (Task 3) was resolved by the user and verified with `grep -c 'PrivacyInfo.xcprivacy' project.pbxproj` returning 4 (>= 2 required).

## Issues Encountered

None. The Task 3 human checkpoint was anticipated in the plan design — Xcode's pbxproj UUID generation cannot be automated by Claude.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 07-02 (COMPLY-01): App icons + splash screens — `@capacitor/assets` package already added to package.json (user prep)
- Plan 07-03 (COMPLY-04): Account deletion flow — no dependencies on this plan's output
- Phase 8 submission: PrivacyInfo.xcprivacy is now in project; `npm run build` + App Store Connect upload should pass privacy manifest validation

---

*Phase: 07-compliance-submission-prep*
*Completed: 2026-05-23*
