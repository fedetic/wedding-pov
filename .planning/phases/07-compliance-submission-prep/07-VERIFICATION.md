---
phase: 07-compliance-submission-prep
verified: 2026-05-24T15:13:24Z
status: human_needed
score: 5/6
overrides_applied: 0
human_verification:
  - test: "Navigate to the /privacy URL (https://pov.jjwedding.nl/privacy) from a browser with no cookies/auth — confirm HTTP 200 is returned and the page renders without redirect"
    expected: "HTTP 200 with the Privacy Policy page visible — 7 sections rendered (What we collect, How we store it, What we share, Google Drive scope, Account deletion, Children, Contact)"
    why_human: "Can't curl the Railway production URL from this environment. The page code is correct but live reachability requires human confirmation."
  - test: "In Xcode, open ios/App/App.xcworkspace and inspect Assets.xcassets > AppIcon. Confirm no missing/empty icon slots or yellow warning badges"
    expected: "AppIcon slot shows the branded 1024x1024 logo with no warnings. Xcode 14+ uses a single-image catalog — one filled slot is correct."
    why_human: "The Contents.json has a single universal 1024x1024 entry (Xcode 14+ single-image catalog). Visual confirmation in Xcode is the only way to confirm no warning badges appear and the branded image renders correctly, not the original Capacitor placeholder."
  - test: "On an iOS device or simulator, navigate to Settings > Danger zone. Tap 'Delete account', then 'Confirm delete'. Confirm the account is deleted and the app redirects to /login."
    expected: "Account deleted from DB, all related records cascaded (sessions, accounts, googleTokens, events, uploadRecords), and WebView redirected to /login."
    why_human: "End-to-end delete flow requires a live session and DB access — cannot be verified by static code analysis alone."
  - test: "In App Store Connect, open the Wedding POV app listing and confirm no red exclamation marks remain in 'App Information' or '1.0 Prepare for Submission'"
    expected: "All required fields filled (name, subtitle, description, keywords, category, support URL, privacy URL, age rating, screenshots)"
    why_human: "App Store Connect is an external service — cannot be verified programmatically."
---

# Phase 7: Compliance + Submission Prep — Verification Report

**Phase Goal:** Both apps meet every App Store and Google Play requirement for submission — icons, privacy materials, account deletion, and complete store listings are in place
**Verified:** 2026-05-24T15:13:24Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App icons and splash screens at all required iOS and Android sizes are generated and integrated (no missing asset warnings in Xcode or Android Studio) | VERIFIED | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` updated from 110522 → 421952 bytes in commit f8f3e7a (branded content). Xcode 14+ single-image catalog pattern confirmed — one 1024×1024 PNG is the correct modern output. Android `mipmap-xxxhdpi/ic_launcher.png`, `ic_launcher_foreground.png`, `ic_launcher_background.png`, `ic_launcher_round.png` all present. `mipmap-anydpi-v26/ic_launcher.xml` adaptive XML present. iOS Splash.imageset has 6 PNGs (1x/2x/3x light + dark). Visual verification in Xcode + Android Studio confirmed in Task 3 checkpoint (human-approved, recorded in 07-03-SUMMARY.md). |
| 2 | A public `/privacy` page is live on Railway and accessible from within the native app | VERIFIED (code); HUMAN NEEDED (live URL) | `src/app/privacy/page.tsx` exists outside all route groups — no `auth.api.getSession()`, no `redirect()`, no `"use client"`. 7 sections confirmed. Settings page has `<Link href="/privacy">Privacy Policy</Link>`. Live reachability at https://pov.jjwedding.nl/privacy requires human spot-check. |
| 3 | iOS Xcode project includes a valid `PrivacyInfo.xcprivacy` file declaring all required-reason APIs used by Capacitor plugins | VERIFIED | `ios/App/App/PrivacyInfo.xcprivacy` exists, valid plist XML. Declares `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1`. `NSPrivacyTracking = false`. `grep -c 'PrivacyInfo.xcprivacy' ios/App/App.xcodeproj/project.pbxproj` = 4 (>= 2 required — fileRef + buildFile entries confirmed). |
| 4 | Organizer can delete their account from within the native app and the backend removes all associated data | VERIFIED (code); HUMAN NEEDED (live test) | `src/lib/auth.ts` has `user: { deleteUser: { enabled: true } }`. `DeleteAccountButton.tsx` calls `authClient.deleteUser({})`, handles `SESSION_EXPIRED`, two-step confirm (idle → confirming → deleting), redirects to `/login` on success. DB cascade chain confirmed: `users.id ← sessions, accounts, googleTokens, events → uploadRecords` (all `onDelete: "cascade"`). End-to-end live test requires human. |
| 5 | App Store Connect and Google Play Console listings have complete metadata | PARTIAL (accepted) | App Store Connect: COMPLETE per STORE-LISTINGS.md — name, subtitle, bundle ID, category, support URL, privacy URL (https://pov.jjwedding.nl/privacy), age rating 4+, description, keywords, screenshots submitted. Google Play Console: DEFERRED — no Android device available at time of execution. This is an accepted partial completion per project owner decision (documented in 07-04-SUMMARY.md and STORE-LISTINGS.md). COMPLY-05 marked `[~]` in REQUIREMENTS.md. |
| 6 | Android `build.gradle` sets `compileSdkVersion 35` and `targetSdkVersion 35` | VERIFIED | `android/variables.gradle`: `compileSdkVersion = 36`, `targetSdkVersion = 36`. Both values are >= 35 — the requirement is satisfied (36 > 35). `android/app/build.gradle` reads `rootProject.ext.compileSdkVersion` and `rootProject.ext.targetSdkVersion`. No code change was required. |

**Score:** 5/6 truths fully verified in code (SC5 partial/accepted, SC2 and SC4 need live human test)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/privacy/page.tsx` | Public unauthenticated privacy policy page | VERIFIED | 84 lines, 7 `<section>` blocks, no auth gate, exports `PrivacyPage`, Server Component |
| `ios/App/App/PrivacyInfo.xcprivacy` | Apple privacy manifest with UserDefaults/CA92.1 | VERIFIED | Valid plist XML, correct content, 24 lines |
| `src/app/(organizer)/dashboard/settings/DeleteAccountButton.tsx` | Client component with two-step confirm + SESSION_EXPIRED | VERIFIED | 110 lines, all required behaviors present |
| `src/app/(organizer)/dashboard/settings/page.tsx` | Settings page with Delete Account + Privacy link | VERIFIED | Imports `DeleteAccountButton`, renders `<DeleteAccountButton />` and `<Link href="/privacy">`, BiometricToggle preserved, no `"use client"` |
| `src/lib/auth.ts` | Better Auth config with `user.deleteUser.enabled = true` | VERIFIED | `user: { deleteUser: { enabled: true } }` block present |
| `assets/logo.png` | 1024×1024 source logo for icon generation | VERIFIED | 219480 bytes, committed in f8f3e7a |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | Branded iOS app icon (Xcode 14+ single-image format) | VERIFIED | 421952 bytes (updated from 110522-byte placeholder in f8f3e7a) |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` | Highest-density Android launcher icon | VERIFIED | Exists, updated in f8f3e7a |
| `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` | Adaptive icon foreground layer | VERIFIED | Exists |
| `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` | Adaptive icon XML descriptor | VERIFIED | Exists |
| `.planning/phases/07-compliance-submission-prep/STORE-LISTINGS.md` | Frozen record of submitted metadata | VERIFIED | App Store Connect section complete; Google Play Console section documents deferred values for future use |
| `.planning/REQUIREMENTS.md` | All 6 COMPLY requirements tracked | VERIFIED | COMPLY-01..04, COMPLY-06 marked `[x]`; COMPLY-05 marked `[~]` (partial); traceability table matches |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ios/App/App.xcodeproj/project.pbxproj` | `ios/App/App/PrivacyInfo.xcprivacy` | Xcode file reference in App target build phase | WIRED | 4 references confirmed (`grep -c 'PrivacyInfo.xcprivacy' project.pbxproj` = 4) |
| `src/app/(organizer)/dashboard/settings/page.tsx` | `src/app/privacy/page.tsx` | `<Link href="/privacy">` | WIRED | `href="/privacy"` confirmed in settings page |
| `DeleteAccountButton.tsx` | `better-auth /delete-user endpoint` | `authClient.deleteUser({})` | WIRED | Call confirmed on line 17; response handling on lines 18-36 |
| `src/lib/auth.ts user.deleteUser config` | DB cascade chain | `internalAdapter.deleteUser → DELETE FROM users → CASCADE` | WIRED | `deleteUser: { enabled: true }` confirmed; cascade chain confirmed in schema.ts (sessions, accounts, googleTokens, events, uploadRecords all have `onDelete: "cascade"`) |
| `STORE-LISTINGS.md App Store Connect` | `https://pov.jjwedding.nl/privacy` | Privacy Policy URL field | WIRED | `Privacy Policy URL: https://pov.jjwedding.nl/privacy` present in STORE-LISTINGS.md |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `DeleteAccountButton.tsx` | `{ data, error }` from `authClient.deleteUser({})` | better-auth `/delete-user` POST endpoint (live HTTP) | Yes — calls live endpoint, handles real response | FLOWING |
| `src/app/privacy/page.tsx` | Static JSX — no dynamic data | None (static Server Component) | N/A — no data fetch required | N/A (static content by design) |
| `src/app/(organizer)/dashboard/settings/page.tsx` | `session` from `auth.api.getSession()` | Better Auth session middleware | Yes — uses live session | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Privacy page has no auth gate, 7 sections, exports PrivacyPage | `node -e` (static checks) | All 5 checks: true | PASS |
| PrivacyInfo.xcprivacy valid plist with correct content | `node -e` (static checks) | All 5 checks: true | PASS |
| DeleteAccountButton has all required behaviors | `node -e` (static checks) | All 6 checks: true | PASS |
| auth.ts has deleteUser enabled with existing config preserved | `node -e` (static checks) | All 5 checks: true | PASS |
| Android SDK >= 35 | `grep compileSdkVersion android/variables.gradle` | 36, 36 | PASS |
| PrivacyInfo.xcprivacy in Xcode App target | `grep -c 'PrivacyInfo.xcprivacy' project.pbxproj` | 4 | PASS |
| Live /privacy URL returns HTTP 200 | `curl -sI https://pov.jjwedding.nl/privacy` | SKIPPED — cannot reach production from this environment | SKIP (human) |

### Probe Execution

No phase-specific probes defined. Step 7c skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| COMPLY-01 | 07-03-PLAN.md | App has icons and splash screens for all required iOS and Android sizes | SATISFIED | iOS single-image catalog updated (421952-byte branded PNG); Android mipmap full set; adaptive icon XML present |
| COMPLY-02 | 07-01-PLAN.md | Public privacy policy page at `/privacy` accessible from native app | SATISFIED | `src/app/privacy/page.tsx` outside route groups; `<Link href="/privacy">` in settings page |
| COMPLY-03 | 07-01-PLAN.md | iOS PrivacyInfo.xcprivacy with required-reason APIs | SATISFIED | File exists, valid XML, UserDefaults/CA92.1 declared, 4 pbxproj references |
| COMPLY-04 | 07-02-PLAN.md | In-app account deletion removing all associated data | SATISFIED | `deleteUser.enabled = true`; DeleteAccountButton wired; DB cascade chain covers all 5 tables |
| COMPLY-05 | 07-04-PLAN.md | Store listings complete metadata | PARTIAL (accepted) | App Store Connect complete; Google Play Console deferred per project owner decision |
| COMPLY-06 | 07-01-PLAN.md | Android compileSdkVersion and targetSdkVersion >= 35 | SATISFIED | Both = 36 in `android/variables.gradle` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | No TBD/FIXME/XXX/TODO/HACK/placeholder patterns detected in any phase-modified file | — | — |

### Human Verification Required

#### 1. Live /privacy URL accessibility

**Test:** Open https://pov.jjwedding.nl/privacy in a browser with no cookies (incognito) and confirm the page loads with HTTP 200 — no redirect to /login
**Expected:** Full privacy policy page renders with 7 sections (What we collect, How we store it, What we share, Google Drive scope, Account deletion, Children, Contact). The "← Home" link and the page title "Privacy Policy" are visible.
**Why human:** Cannot reach the Railway production URL from the local verification environment. The code is correct (no auth gate, outside route groups) but live deploy reachability requires human confirmation.

#### 2. iOS AppIcon visual confirmation in Xcode

**Test:** Open `ios/App/App.xcworkspace` in Xcode, navigate to `App/Assets.xcassets > AppIcon`. Inspect the AppIcon catalog entry.
**Expected:** The single AppIcon slot (Xcode 14+ single-image catalog) shows the branded Wedding POV logo — NOT the original Capacitor green/default placeholder. No yellow warning badges. The 1024×1024 slot shows a filled branded image.
**Why human:** Xcode's asset catalog rendering and warning badges can't be verified by reading file bytes. The file was updated (110522 → 421952 bytes), but visual confirmation that the branded art renders without warnings is required.

#### 3. End-to-end account deletion live test

**Test:** With a test organizer account, navigate to Settings > Danger zone, tap "Delete account", read the confirmation copy, tap "Confirm delete". After deletion, verify the app redirects to /login.
**Expected:** Account deleted from DB; all sessions, accounts, googleTokens, events, and upload records for that user are removed via cascade. App WebView navigates to /login.
**Why human:** Requires a live session and DB access. The code wiring and cascade chain are statically verified, but end-to-end behavior (including better-auth's `deleteSessionCookie` interaction with the WebView) can only be confirmed on device/simulator.

#### 4. App Store Connect listing completeness

**Test:** Log into App Store Connect and open the Wedding POV app. Check "App Information" and "1.0 Prepare for Submission" for red exclamation marks or missing fields.
**Expected:** No red flags. All fields documented in STORE-LISTINGS.md are filled: name, subtitle, bundle ID nl.jjwedding.pov, category Photo & Video/Lifestyle, support URL https://pov.jjwedding.nl, privacy policy URL https://pov.jjwedding.nl/privacy, age rating 4+, 6.9" screenshots uploaded.
**Why human:** App Store Connect is an external service — listing state cannot be verified programmatically.

---

### COMPLY-05 Partial Status — Accepted Deviation

The ROADMAP Success Criterion 5 requires "App Store Connect AND Google Play Console listings have complete metadata." Google Play Console listing was not created because the project owner lacks an Android device for testing at this time.

This is an accepted partial completion per the project owner's decision (documented in 07-04-SUMMARY.md, STORE-LISTINGS.md, and flagged in the verification request: "COMPLY-05 is intentionally partial — App Store Connect is complete; Google Play Console is deferred pending Android device availability").

**Evidence of accepted partial state:** REQUIREMENTS.md uses `[~]` (partial) marker on COMPLY-05 with explanatory text. STORE-LISTINGS.md documents all Play Console metadata values for future use when an Android device is available.

**Phase 8 dependency:** Phase 8 SC#3 ("Android app available on Play Store internal track") will require the Play Console listing to be created before Android distribution can proceed. This must be resolved as part of Phase 8 pre-work.

---

### Gaps Summary

No blocking gaps. All 6 COMPLY requirements are either fully implemented in code (COMPLY-01, COMPLY-02, COMPLY-03, COMPLY-04, COMPLY-06) or accepted as intentionally partial (COMPLY-05). The 4 human verification items are confirmatory checks for live behavior and visual rendering — the underlying code is substantive and fully wired in all cases.

The phase goal is achieved in the codebase. Human verification items confirm live deployment behavior and external service state, not code completeness.

---

_Verified: 2026-05-24T15:13:24Z_
_Verifier: Claude (gsd-verifier)_
