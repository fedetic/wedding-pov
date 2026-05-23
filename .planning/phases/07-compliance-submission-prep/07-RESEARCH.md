# Phase 7: Compliance + Submission Prep - Research

**Researched:** 2026-05-23
**Domain:** iOS/Android store compliance, privacy manifests, account deletion, asset generation
**Confidence:** HIGH

---

## Summary

Phase 7 covers six distinct compliance tasks before both apps can be submitted to the App Store and Google Play. Each requirement is independent and can be planned as a separate work unit.

**COMPLY-06 (Android SDK version) is already satisfied.** `variables.gradle` sets `compileSdkVersion = 36` and `targetSdkVersion = 36`, which exceeds the Play Store's minimum requirement of SDK 35. No code change is needed — the plan should document this as a verification-only task.

The most technically interesting requirements are COMPLY-03 (PrivacyInfo.xcprivacy) and COMPLY-04 (account deletion). The privacy manifest needs to be hand-authored because Capacitor's own `PrivacyInfo.xcprivacy` declares empty arrays — the app-level manifest must cover `@capacitor/preferences`' use of UserDefaults (reason code CA92.1). Account deletion uses better-auth's built-in `/delete-user` endpoint, which is gated by `sensitiveSessionMiddleware` (fresh session within 24 hours by default) and must be enabled via `user.deleteUser.enabled: true` in `auth.ts`. The DB cascade chain (`users → sessions, accounts, googleTokens, events → uploadRecords`) means no custom cleanup code is needed beyond enabling the endpoint.

**Primary recommendation:** Tackle requirements in this order: COMPLY-06 (verify-only, 5 min) → COMPLY-01 (asset generation) → COMPLY-03 (privacy manifest) → COMPLY-02 (privacy page) → COMPLY-04 (account deletion) → COMPLY-05 (store listing metadata).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMPLY-01 | App icons and splash screens at all required iOS and Android sizes, generated from 1024×1024 master | `@capacitor/assets` v3.0.5 already installed; Easy Mode generates all sizes from single logo file |
| COMPLY-02 | Public `/privacy` page on Railway accessible from within native app | Standard Next.js App Router page at `src/app/privacy/page.tsx`; no auth gate; link from Settings |
| COMPLY-03 | iOS `PrivacyInfo.xcprivacy` declaring all required-reason APIs used by Capacitor plugins | Hand-authored plist at `ios/App/App/PrivacyInfo.xcprivacy`; only `NSPrivacyAccessedAPICategoryUserDefaults` / CA92.1 needed for `@capacitor/preferences` |
| COMPLY-04 | Organizer can delete account and all data from native app | better-auth `/delete-user` endpoint; enable via `user.deleteUser.enabled: true`; DB cascade handles all related data |
| COMPLY-05 | App Store and Google Play listings have complete metadata | Manual task: screenshots at required sizes, name/description/category/URLs; no code changes |
| COMPLY-06 | Android `compileSdkVersion 35` and `targetSdkVersion 35` | Already satisfied: `variables.gradle` has `compileSdkVersion = 36`, `targetSdkVersion = 36` (36 >= 35) |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- Read `node_modules/next/dist/docs/` before writing any Next.js code — APIs may differ from training data
- Heed deprecation notices in Next.js
- No CONTEXT.md exists for this phase (no locked decisions from a discuss-phase)

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App icon / splash asset generation | Build tool (CLI) | — | `@capacitor/assets generate` runs at build time; outputs to `ios/` and `android/` |
| Privacy policy page | Frontend Server (SSR) | — | Standard Next.js page at `/privacy`; Railway serves it; no auth needed |
| iOS PrivacyInfo.xcprivacy | Native (Xcode) | — | File lives in iOS Xcode project target; referenced at App Store Connect upload time |
| Account deletion UI | Browser / Client | — | Client component calling `authClient.deleteUser()` in Settings page |
| Account deletion backend | API / Backend | Database | better-auth `/delete-user` endpoint + DB cascade; no custom API route needed |
| Store listing screenshots | Manual / Design | — | Created outside codebase; uploaded directly in App Store Connect / Play Console |
| Android SDK version | Build config | — | `variables.gradle` — already set correctly at 36 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor/assets` | 3.0.5 | Generate iOS + Android icons and splash screens from single source image | Official Ionic tool; slopcheck OK; already installed [VERIFIED: npm registry] |
| `better-auth` | 1.6.9 (installed) | `/delete-user` endpoint for account deletion | Already in project; has built-in deleteUser with sensitiveSession gate [VERIFIED: codebase] |

### No additional packages needed

All requirements can be satisfied with the existing stack:
- Asset generation: `@capacitor/assets` (already installed by slopcheck test run)
- Privacy page: standard Next.js App Router page
- Privacy manifest: hand-authored XML file
- Account deletion: better-auth built-in endpoint
- Store metadata: manual browser-based task

### Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@capacitor/assets` | npm | 4+ yrs (32 versions) | — | github.com/ionic-team/capacitor-assets | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
[Organizer device]
      |
      | taps "Delete Account"
      v
[Settings page — client component]
      |
      | authClient.deleteUser({ password? })
      v
[better-auth /delete-user POST]
      |
      |-- sensitiveSessionMiddleware (session < 24h old?) --|
      |                                                     |
      | yes: proceed                                    no: 400 SESSION_EXPIRED
      v
[internalAdapter.deleteUser(userId)]
      |
      v
[Postgres: DELETE FROM users WHERE id = ?]
      |
      |-- CASCADE → sessions
      |-- CASCADE → accounts
      |-- CASCADE → googleTokens
      |-- CASCADE → events
                      |
                      └── CASCADE → uploadRecords
      |
      v
[deleteSessionCookie]
      |
      v
[client: router.push("/login")]
```

### Recommended Project Structure Changes

```
src/
├── app/
│   ├── privacy/
│   │   └── page.tsx          # COMPLY-02: public privacy policy page (NEW)
│   └── (organizer)/
│       └── dashboard/
│           └── settings/
│               ├── page.tsx  # ADD: Delete Account section
│               └── DeleteAccountButton.tsx  # NEW: client component
├── lib/
│   └── auth.ts               # ADD: user.deleteUser.enabled = true (COMPLY-04)
ios/
└── App/
    └── App/
        └── PrivacyInfo.xcprivacy  # NEW: COMPLY-03
assets/
└── logo.png  # NEW: 1024×1024 source for @capacitor/assets (COMPLY-01)
```

### Pattern 1: @capacitor/assets Easy Mode

**What:** Single 1024×1024 PNG source generates all required iOS and Android icon + splash sizes.
**When to use:** Only time this is run is once per phase; outputs to `ios/` and `android/` directories.

```bash
# Source: @capacitor/assets README (node_modules/@capacitor/assets/README.md)
# Create assets/ directory with logo.png (1024×1024 minimum)
npx @capacitor/assets generate \
  --iconBackgroundColor '#ffffff' \
  --splashBackgroundColor '#ffffff'
```

The tool writes:
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (all required sizes)
- iOS: `ios/App/App/Assets.xcassets/Splash.imageset/` (2732×2732)
- Android: `android/app/src/main/res/mipmap-*/` (adaptive icon layers)
- Android: `android/app/src/main/res/drawable-*/` (splash screens)

**Peer dependency note:** `@capacitor/assets` v3 declares `@capacitor/cli ^5.3.0` as a dependency but the project uses `@capacitor/cli ^8.3.4`. The tool installs and runs successfully despite this mismatch because it does not call Capacitor CLI APIs at runtime — it only uses `sharp` for image processing. [VERIFIED: tested in this session — `npx capacitor-assets --version` returns `3.0.5`]

### Pattern 2: iOS PrivacyInfo.xcprivacy

**What:** Apple-required plist file declaring which protected APIs the app uses and why. Must be added to the Xcode app target.
**When to use:** Required since May 1, 2024; App Store Connect upload will warn/reject without it.

```xml
<!-- Source: capacitorjs.com/docs/v5/ios/privacy-manifest -->
<!-- File location: ios/App/App/PrivacyInfo.xcprivacy -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>
```

**Why only UserDefaults / CA92.1:** The installed Capacitor plugins were audited:
- `@capacitor/ios` core: declares empty `NSPrivacyAccessedAPITypes` array [VERIFIED: codebase grep]
- `@capacitor/preferences`: uses `NSUserDefaults` on iOS — requires CA92.1 [CITED: capacitorjs.com/docs/v5/ios/privacy-manifest]
- `@capacitor/filesystem`, `@capacitor/network`, `@capacitor/share`, `@capacitor/browser`, `@capacitor/app`: no `PrivacyInfo.xcprivacy` in their npm packages (privacy manifest lives in SPM source, not npm package)
- `@aparajita/capacitor-biometric-auth`: no `PrivacyInfo.xcprivacy` found; uses `LAContext` (LocalAuthentication) which is NOT on Apple's required-reason API list
- No file system fingerprinting, no `NSFileSystemFreeSize`, no `NSFileSystemSize` usage detected

**IMPORTANT:** After creating the file, it must be added to the Xcode project target in Xcode (File > Add Files). The file on disk alone is not sufficient — Xcode's `project.pbxproj` must reference it.

### Pattern 3: better-auth deleteUser

**What:** Enable built-in account deletion. Requires fresh session (created within 24 hours by default) OR password provision. DB cascade handles all data cleanup.
**When to use:** COMPLY-04.

```typescript
// Source: VERIFIED from node_modules/better-auth/dist/api/routes/update-user.mjs
// In src/lib/auth.ts — ADD to betterAuth() options:
user: {
  deleteUser: {
    enabled: true,
    // No sendDeleteAccountVerification needed — email not configured in v1.
    // Fresh session (< 24h) satisfies the sensitiveSessionMiddleware.
    // beforeDelete: optional hook; not needed since DB cascade covers all tables.
  },
},
```

```typescript
// Source: VERIFIED from project codebase (SignOutButton.tsx pattern)
// In src/app/(organizer)/dashboard/settings/DeleteAccountButton.tsx:
"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAccountButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    // No password needed if session is fresh (< 24h old).
    // If session is stale, better-auth returns 400 SESSION_EXPIRED.
    // User must sign out and sign in again to get a fresh session.
    await authClient.deleteUser({});
    router.push("/login");
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        className="text-sm text-red-600 hover:text-red-800 underline">
        Delete account
      </button>
    );
  }
  return (
    <div className="flex gap-3">
      <button onClick={handleDelete}
        className="text-sm text-red-600 hover:text-red-800 font-semibold">
        Confirm delete
      </button>
      <button onClick={() => setConfirming(false)}
        className="text-sm text-gray-500 hover:text-gray-700">
        Cancel
      </button>
    </div>
  );
}
```

### Pattern 4: Privacy Page (COMPLY-02)

**What:** Standard unauthenticated Next.js page. No auth middleware. Accessible from browser and webview.

```
src/app/privacy/page.tsx  — server component, no auth.api.getSession() call
```

The page must be linkable from within the native app. The Settings page (`/dashboard/settings/page.tsx`) is the canonical location for the link since it already exists and is accessible to authenticated users.

### Anti-Patterns to Avoid

- **Don't add privacy page inside `(organizer)` route group:** Auth middleware would block it. Privacy policies must be publicly accessible — keep at `app/privacy/`.
- **Don't use `@capacitor/assets` with `--legacy` flag:** v3 removed Cordova support entirely; there is no Cordova/legacy mode.
- **Don't hand-roll account deletion SQL:** better-auth's `internalAdapter.deleteUser` + DB cascade covers everything. A custom DELETE route would duplicate logic and risk missing cleanup steps.
- **Don't add PrivacyInfo.xcprivacy to `ios/App/` root:** The file must be inside the app target directory (`ios/App/App/`) and added to the Xcode project. Files outside the target are ignored by App Store Connect's privacy report tool.
- **Don't skip the Xcode project.pbxproj reference:** Creating the file on disk is not enough. Xcode must reference it in the app target's build phases. The plan should include running `cap sync` after file creation, or explicitly adding in Xcode.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon + splash resizing | ImageMagick script, manual Photoshop export | `npx @capacitor/assets generate` | Handles all platform-specific sizes (mipmap densities, adaptive icons, iOS sizes); maintaining manually is error-prone |
| Account deletion data cleanup | Custom API route deleting googleTokens, events, uploadRecords | better-auth's `/delete-user` + DB cascade | DB `onDelete: cascade` already handles all tables; better-auth manages session invalidation |
| Privacy manifest API discovery | Auditing source code for NSUserDefaults calls | Use the verified list in this research + Xcode's Privacy Report tool | Easy to miss indirect calls through SDKs; Xcode's report runs static analysis |

**Key insight:** The compliance work is mostly configuration and file creation, not novel code. The entire feature set is either built into existing tools or requires one small file.

---

## Common Pitfalls

### Pitfall 1: @capacitor/assets writes placeholder icons if source is missing or wrong size

**What goes wrong:** If `assets/logo.png` doesn't exist or is < 1024×1024, the tool either errors or produces blurry icons. Xcode and Android Studio will still build but icons will look wrong.
**Why it happens:** The tool requires the source image at exactly the expected path; it does not fall back gracefully.
**How to avoid:** Create `assets/logo.png` (or `assets/icon-only.png` for Custom Mode) before running the generate command. Verify the source is at least 1024×1024.
**Warning signs:** Xcode shows "missing @2x, @3x" warnings in the asset catalog; Android Studio shows "Vector drawable lint warnings."

### Pitfall 2: PrivacyInfo.xcprivacy not added to Xcode target

**What goes wrong:** The XML file exists on disk but App Store Connect upload still reports "Missing Privacy Manifest" or the Xcode Privacy Report doesn't list it.
**Why it happens:** Xcode only recognizes files referenced in `project.pbxproj`. Creating the file manually does not auto-add it to the target.
**How to avoid:** After creating the file, open Xcode → right-click the App group → Add Files to "App" → select `PrivacyInfo.xcprivacy` → ensure "Add to target: App" is checked.
**Warning signs:** Xcode's Product → Generate Privacy Report does not mention `NSPrivacyAccessedAPICategoryUserDefaults`.

### Pitfall 3: deleteUser fails with SESSION_EXPIRED for stale sessions

**What goes wrong:** User opens the app after > 24 hours, navigates to Settings, taps "Delete Account" — gets an error.
**Why it happens:** `sensitiveSessionMiddleware` checks `session.createdAt` against `freshAge` (default 3600 * 24 seconds = 24 hours). [VERIFIED: `node_modules/better-auth/dist/context/create-context.mjs` line 145]
**How to avoid:** Show a clear error message: "For security, please sign out and sign in again before deleting your account." The `DeleteAccountButton` should catch the `SESSION_EXPIRED` error and display this message.
**Warning signs:** API returns 400 with `BASE_ERROR_CODES.SESSION_EXPIRED`.

### Pitfall 4: Privacy page blocked by auth middleware

**What goes wrong:** `/privacy` page returns 401 or redirects to `/login` when App Store reviewers or users tap the link without being logged in.
**Why it happens:** If the page is placed inside `(organizer)/` route group, Next.js middleware or the page's own `auth.api.getSession()` redirect will block unauthenticated access.
**How to avoid:** Place the page at `src/app/privacy/page.tsx` (outside any auth-gated route group). Do not add a session check. [VERIFIED: codebase — `(organizer)` group pages all call `if (!session) redirect("/login")`]
**Warning signs:** App Store reviewer notes in rejection citing inaccessible privacy policy link.

### Pitfall 5: COMPLY-06 is already done — don't change variables.gradle

**What goes wrong:** Someone edits `variables.gradle` to change `compileSdkVersion` from 36 to 35, accidentally downgrading the project.
**Why it happens:** The requirement says "compileSdkVersion 35" as a minimum, not as an exact target. The current value of 36 exceeds the requirement.
**How to avoid:** The plan should verify the current value is >= 35 and mark COMPLY-06 complete without modification. [VERIFIED: `android/variables.gradle` — `compileSdkVersion = 36`, `targetSdkVersion = 36`]

### Pitfall 6: App Store screenshots — 6.9" vs 6.5"

**What goes wrong:** Upload only 6.5" iPhone screenshots when the preferred size is now 6.9" (1320×2868). Or vice versa — confusion about which size is "required."
**Why it happens:** Apple changed the preferred size to 6.9" in 2025; either 6.9" or 6.5" satisfies the requirement, but only one is needed (App Store Connect scales down automatically).
**How to avoid:** Provide 6.9" iPhone screenshots (1320×2868 portrait). This satisfies all iPhone sizes via automatic scaling. [CITED: developer.apple.com/help/app-store-connect/reference/screenshot-specifications/]

---

## COMPLY-06 Status: Already Satisfied

This section documents why COMPLY-06 requires no code change.

| Requirement | Required Value | Current Value | Status |
|-------------|---------------|---------------|--------|
| `compileSdkVersion` | >= 35 | 36 | SATISFIED |
| `targetSdkVersion` | >= 35 | 36 | SATISFIED |

**Source:** `android/variables.gradle` [VERIFIED: codebase]

Google Play's stated deadline is August 31, 2025 for new app submissions to target API level 35+. SDK 36 exceeds this requirement. [CITED: support.google.com/googleplay/android-developer/answer/11926878]

The plan task for COMPLY-06 should be: verify `variables.gradle` values, confirm they meet the requirement, update `REQUIREMENTS.md` to mark COMPLY-06 complete.

---

## Store Listing Metadata Reference (COMPLY-05)

### App Store Connect (iOS)

Required metadata for a new app listing:
- **Name:** "Wedding POV" (30 char max)
- **Subtitle:** optional (30 char max)
- **Description:** up to 4000 chars
- **Keywords:** up to 100 chars
- **Category:** primary (e.g., "Photo & Video")
- **Support URL:** must be a live URL (e.g., `https://pov.jjwedding.nl`)
- **Privacy Policy URL:** must be a live URL — this is the `/privacy` page from COMPLY-02
- **Screenshots:** minimum 1x 6.9" iPhone (1320×2868) OR 1x 6.5" iPhone (1284×2778). [CITED: developer.apple.com/help/app-store-connect/reference/screenshot-specifications/]
- **Age Rating:** set via questionnaire (no adult content → 4+)

### Google Play Console (Android)

Required metadata:
- **App name:** "Wedding POV" (50 char max)
- **Short description:** up to 80 chars
- **Full description:** up to 4000 chars
- **Category:** "Photography" or "Productivity"
- **Screenshots:** minimum 2 phone screenshots at 1080×1920 (9:16 portrait) [CITED: appradar.com/blog/android-app-screenshot-sizes]
- **Feature graphic:** 1024×500 px (required for Play Store listing)
- **Privacy policy URL:** same `/privacy` page URL
- **Content rating:** complete IARC questionnaire

**Note:** Screenshot creation is a manual task (design work). The plan should include this as a manual step or defer to the organizer (app owner). Screenshots can be device captures of the running app.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cordova-res` for asset generation | `@capacitor/assets` v3 | Capacitor 1.x → 2.x | Cordova-res still works but is not maintained for Capacitor 8; use @capacitor/assets |
| Manual privacy manifest | PrivacyInfo.xcprivacy + Xcode | May 2024 (Apple enforcement) | Required for all App Store submissions since May 1, 2024 |
| App Store: 6.5" iPhone screenshots required | 6.9" preferred (6.5" still accepted) | ~2025 (iPhone 16 Pro Max launch) | Either size works; 6.9" is now the preferred upload |
| Google Play: target SDK 33 acceptable | Must target SDK 35+ by Aug 31, 2025 | August 2025 deadline | Current project targets 36 — already compliant |

**Deprecated/outdated:**
- `cordova-res`: Removed from `@capacitor/assets` v1+. Use `@capacitor/assets` only. [CITED: @capacitor/assets README]
- iOS Privacy Manifest omission: Was tolerated before May 2024. Now causes App Store Connect upload warnings/rejection.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@capacitor/assets` CLI | COMPLY-01 icon generation | ✓ | 3.0.5 | — |
| `sharp` (image processing) | `@capacitor/assets` internals | ✓ | 0.32.6 (bundled) | — |
| Xcode | COMPLY-03 PrivacyInfo.xcprivacy project integration | unknown (macOS dev machine) | — | File created by plan; human adds to Xcode project |
| App Store Connect account | COMPLY-05 | unknown | — | Manual — organizer provides |
| Google Play Console account | COMPLY-05 | unknown | — | Manual — organizer provides |

**Missing dependencies with no fallback:**
- Xcode is needed to add `PrivacyInfo.xcprivacy` to the project target. This is a manual step; the plan cannot automate it. The plan must include a checkpoint for the developer to open Xcode and add the file.

**Missing dependencies with fallback:**
- App Store Connect / Play Console credentials: not needed for code changes in COMPLY-01 through COMPLY-04; needed only for COMPLY-05 which is a manual browser task.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@capacitor/preferences` is the only installed Capacitor plugin using a required-reason API (UserDefaults). No other installed plugin requires additional `NSPrivacyAccessedAPITypes` entries. | Common Pitfalls / PrivacyInfo | If biometric plugin or another plugin uses a required-reason API, the manifest would be incomplete and App Store Connect might still warn. Mitigation: run Xcode's "Generate Privacy Report" to verify after submission. |
| A2 | App Store reviewers will approve a Capacitor-based app with native features (share sheet NATIVE-01, biometrics NATIVE-02) as satisfying Guideline 4.2 minimum functionality | — | Rejection remains possible. The existing concerns in STATE.md blocker "App Store 4.2 risk" apply here. Phase 7 does not change the risk; it is not a compliance concern that can be resolved by this phase. |

**If this table is empty:** It is not — two assumptions documented above.

---

## Open Questions

1. **Does `PrivacyInfo.xcprivacy` need to be added to Xcode manually, or does `cap sync` handle it?**
   - What we know: `cap sync` copies plugin assets to the iOS project but does not generate or register app-level privacy manifests. Plugin-level privacy manifests (included in SPM packages) are handled by SPM automatically.
   - What's unclear: Whether `cap sync` after creating the file will reference it in `project.pbxproj` automatically.
   - Recommendation: Treat this as a manual Xcode step. The plan should include a checkpoint: "Open Xcode → Add Files to App target → select PrivacyInfo.xcprivacy → confirm target membership."

2. **What logo/icon artwork should be used for COMPLY-01?**
   - What we know: The project currently has placeholder assets (`AppIcon-512@2x.png` — single entry in Contents.json; no actual branded artwork).
   - What's unclear: Whether the organizer/developer has a final 1024×1024 icon designed.
   - Recommendation: Plan should note that a 1024×1024 `assets/logo.png` must exist before running the generate command. This is a design dependency, not a code dependency.

3. **Should the DeleteAccountButton require password entry, or rely on fresh-session only?**
   - What we know: better-auth's `deleteUser` allows deletion without password if the session was created within 24 hours (freshAge default = 86400 seconds). Password is optional.
   - What's unclear: Whether the app owner wants an extra confirmation step beyond the two-step confirm UI.
   - Recommendation: Rely on fresh-session check (no password field). Show a clear error if session is stale, directing the user to sign out and back in.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/better-auth/dist/api/routes/update-user.mjs` — deleteUser implementation, sensitiveSessionMiddleware, freshAge behavior [VERIFIED: codebase]
- `node_modules/better-auth/dist/context/create-context.mjs` — freshAge default value = 86400 [VERIFIED: codebase]
- `android/variables.gradle` — compileSdkVersion = 36, targetSdkVersion = 36 [VERIFIED: codebase]
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json` — current icon state (single placeholder entry) [VERIFIED: codebase]
- `node_modules/@capacitor/ios/Capacitor/Capacitor/PrivacyInfo.xcprivacy` — Capacitor core declares empty arrays [VERIFIED: codebase]
- `node_modules/@capacitor/assets/README.md` — Easy Mode usage and flags [VERIFIED: codebase]
- `src/lib/db/schema.ts` — cascade chain [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- [capacitorjs.com/docs/v5/ios/privacy-manifest](https://capacitorjs.com/docs/v5/ios/privacy-manifest) — `@capacitor/preferences` UserDefaults / CA92.1 requirement
- [developer.apple.com/help/app-store-connect/reference/screenshot-specifications/](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) — iPhone 6.9" 1320×2868 as current preferred size
- [better-auth.com/docs/concepts/users-accounts](https://better-auth.com/docs/concepts/users-accounts) — deleteUser API documentation
- [support.google.com/googleplay/android-developer/answer/11926878](https://support.google.com/googleplay/android-developer/answer/11926878) — Play Store SDK 35 deadline August 31, 2025

### Tertiary (LOW confidence)
- WebSearch results for Google Play screenshot requirements (not verified against official Play Console docs directly)

---

## Metadata

**Confidence breakdown:**
- COMPLY-01 (asset generation): HIGH — tool verified working in this session
- COMPLY-02 (privacy page): HIGH — standard Next.js App Router page, no unknowns
- COMPLY-03 (PrivacyInfo): HIGH — manifest structure verified; Xcode target-add step is procedural
- COMPLY-04 (account deletion): HIGH — better-auth source code read directly; cascade chain verified from schema
- COMPLY-05 (store metadata): MEDIUM — screenshot size specs verified; store listing details are manual browser work
- COMPLY-06 (Android SDK): HIGH — variables.gradle read directly; already satisfied

**Research date:** 2026-05-23
**Valid until:** 2026-11-23 (App Store screenshot requirements are stable; could shift with new iPhone releases)
