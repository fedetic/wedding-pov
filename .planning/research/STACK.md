# Technology Stack

**Project:** Wedding POV — v1.1 Capacitor Mobile App
**Researched:** 2026-05-17
**Research Mode:** Ecosystem (milestone-scoped — Capacitor additions only)
**Confidence:** HIGH for Capacitor core; MEDIUM for Google Drive OAuth in webview

> This document covers **additions and changes** for the v1.1 Capacitor milestone only.
> The existing stack (Next.js 15, Better Auth, Drizzle + Neon, Railway) is validated and unchanged.
> Do not re-research or modify what already works.

---

## Critical Architecture Decision: Static Export vs. Live Server Webview

This is the most important decision for this milestone. Get it wrong and the milestone becomes a rewrite.

**The problem:** Capacitor conventionally bundles a static `out/` directory into the native binary. But this app uses Server Actions, cookies (Better Auth sessions), Route Handlers that read request state, and dynamic routes — all of which are **explicitly unsupported** in Next.js static export mode (`output: 'export'`).

Enabling `output: 'export'` would break:
- Better Auth session cookies (cookies() API is unsupported in static export)
- All Server Actions (unsupported in static export)
- Route Handlers that read `request` headers/cookies (unsupported in static export)
- Dynamic routes without `generateStaticParams()` (e.g., `/events/[id]`)

**The solution: Load the live Railway URL in the Capacitor webview.**

Configure `server.url` in `capacitor.config.ts` to point to the Railway production URL. The webview renders the real SSR app. The native binary is essentially a thin shell. All auth, data fetching, and Server Actions continue to work exactly as they do in the browser.

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.weddingpov.app',
  appName: 'Wedding POV',
  webDir: 'out',        // fallback/placeholder — not used in production
  server: {
    url: 'https://your-railway-url.railway.app',
    cleartext: false,
  },
};

export default config;
```

**Trade-offs of this approach:**

| Concern | Impact | Mitigation |
|---------|--------|------------|
| App requires internet connection | Low — organizers have connectivity; this is not an offline tool | None needed |
| App review risk (Apple may reject) | Low — documented community successes; no explicit policy against it | Add minimal native features to justify native shell |
| Plugin/web version mismatch | Low — Capacitor plugins in the native build stay fixed; no OTA updates | Pin plugin versions; bump native build when adding new plugins |
| No offline capability | Acceptable — not a requirement for v1.1 | Out of scope |

**Why NOT static export:** The existing server-side architecture is the app's backbone. Refactoring Better Auth cookie sessions to token-in-localStorage, converting all Server Actions to client-side API calls, and making all routes statically parameterized would be a near-complete rewrite for no user-facing benefit.

**Why NOT hybrid (partial static):** There is no clean seam in this app where some pages are static and others are server-rendered. The auth boundary runs through everything.

**Confidence:** MEDIUM — `server.url` in production is underdocumented by Capacitor but community reports (multiple developers, App Store and Play Store approved apps) confirm it works. Source: [Capacitor Discussion #4080](https://github.com/ionic-team/capacitor/discussions/4080), [Discussion #5075](https://github.com/ionic-team/capacitor/discussions/5075).

---

## Recommended Stack Additions

### Capacitor Core

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@capacitor/core` | `^8.x` | Capacitor runtime | Latest stable; requires Node 22+, iOS 15+, Android API 24+; Xcode 26 required for App Store submission (Apple mandate as of 2026-04-28) |
| `@capacitor/cli` | `^8.x` | Build and sync tool | CLI for `cap add ios`, `cap add android`, `cap sync`, `cap open ios/android` |
| `@capacitor/ios` | `^8.x` | iOS native project | Generates and manages the Xcode project |
| `@capacitor/android` | `^8.x` | Android native project | Generates and manages the Gradle project; targets API 36 (compileSdk/targetSdk), minimum SDK 24 |

**Why Capacitor 8 not 7:** Capacitor 8 is the current release as of May 2026. Plugin versions are tied to core major versions — all official plugins are `@8.x`. Using Capacitor 7 would require finding older plugin versions and lose access to current bug fixes. Build tooling (Xcode 26, AGP 8.13) aligns with Capacitor 8 requirements.

**Confidence:** HIGH — verified via [npm @capacitor/core](https://www.npmjs.com/package/@capacitor/core), [Capacitor 8 migration guide](https://capacitorjs.com/docs/updating/8-0).

---

### Native Plugins Needed

| Package | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `@capacitor/share` | `^8.x` | Native share sheet | Organizer shares QR code via Messages, AirDrop, etc. — key v1.1 feature; triggers OS-level share sheet, not a webview modal |
| `@capacitor/status-bar` | `^8.x` | Status bar styling | Prevents white status bar on dark-background screens; style matches app theme |
| `@capacitor/splash-screen` | `^8.x` | Launch splash | App launch screen shown while webview loads the Railway URL; required for App Store review |
| `@capacitor/app` | `^8.x` | App lifecycle + deep links | Required for handling URL open events (OAuth redirect callbacks); also provides back button support on Android |

**Do NOT add:**
- `@capacitor/camera` — guests upload via browser; organizers don't need in-app camera
- `@capacitor/push-notifications` — out of scope for v1.1
- `@capacitor/geolocation` — not needed
- `@capacitor/filesystem` — not needed (photos stay in Drive, not on device)

**Confidence:** HIGH — all are official Capacitor plugins, versions track core major version.

---

### Asset Generation

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@capacitor/assets` | latest | Icon and splash screen generation | Generates all required icon/splash sizes for iOS and Android from a single 1024x1024 source image; run once per asset change |

**Required source files:**
```
assets/
  icon-only.png         # 1024x1024 — used for app icon
  icon-foreground.png   # 1024x1024 — foreground layer (adaptive icon)
  icon-background.png   # 1024x1024 — background layer (adaptive icon)
  splash.png            # 2732x2732 — light mode splash
  splash-dark.png       # 2732x2732 — dark mode splash
```

Run: `npx capacitor-assets generate`

**Confidence:** HIGH — [official Capacitor docs](https://capacitorjs.com/docs/guides/splash-screens-and-icons).

---

### Google Drive OAuth in Capacitor Webview

**The core problem:** Google explicitly blocks OAuth flows in embedded WKWebView (iOS) and android.webkit.WebView (Android). The Capacitor webview IS one of these — running the existing `/connect-drive` redirect flow inside the webview will fail with `disallowed_useragent`.

**The solution:** Use `@capacitor/browser` to open Google's OAuth consent screen in the system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android), then deep-link back into the app when the flow completes.

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@capacitor/browser` | `^8.x` | System browser for OAuth | Opens SFSafariViewController (iOS) / Chrome Custom Tabs (Android); Google OAuth compliant; shares system cookies |

**OAuth redirect flow for Google Drive connect:**

```
1. Organizer taps "Connect Google Drive" in app
2. App calls CapacitorBrowser.open({ url: '/api/auth/connect-drive' })
   → This opens the Railway URL in SFSafariViewController
3. Server initiates Google OAuth: redirect to accounts.google.com/o/oauth2/...
4. User approves Drive access in system browser
5. Google redirects to: https://your-railway.app/api/auth/callback/google-drive
6. Server stores refresh token, redirects to: com.weddingpov.app://oauth-callback?success=true
7. @capacitor/app catches the URL via App.addListener('appUrlOpen', ...)
8. App closes browser, navigates back to dashboard
```

**Required Google Cloud Console changes:**
- Add redirect URI: `https://your-railway.app/api/auth/callback/google-drive` (already exists)
- The custom scheme URI (`com.weddingpov.app://`) is registered natively — no Google Console entry needed for the deep link return leg

**iOS Info.plist change needed:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.weddingpov.app</string>
    </array>
  </dict>
</array>
```

**Android AndroidManifest.xml change needed:**
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="com.weddingpov.app" />
</intent-filter>
```

**Confidence:** MEDIUM — Google's policy against embedded webview OAuth is HIGH confidence (official docs). The `@capacitor/browser` + deep link pattern is MEDIUM confidence (community-verified pattern, not officially documented by Capacitor for Drive specifically). Source: [Google OAuth 2.0 Native App guide](https://developers.google.com/identity/protocols/oauth2/native-app), [Capacitor 5-step OAuth guide](https://capgo.app/blog/5-steps-to-implement-oauth2-in-capacitor-apps/).

**Note on email/password auth:** The existing Better Auth email/password flow works unchanged inside the webview — no special handling needed. Cookies set by the Railway server are accessible within the Capacitor webview because `server.url` points to the real domain.

---

### CI/CD for App Store and Play Store

**iOS (GitHub Actions + Fastlane)**

| Component | Version | Purpose |
|-----------|---------|---------|
| `fastlane` | latest (Ruby gem) | Automate certificate, build, and TestFlight upload |
| `maierj/fastlane-action` | `v3.1.0` | GitHub Actions wrapper for Fastlane |
| GitHub Actions `macos-latest` runner | — | Required for Xcode builds (macOS only) |

Required GitHub repository secrets for iOS:
```
APP_STORE_CONNECT_TEAM_ID       # Apple Developer membership
BUNDLE_IDENTIFIER               # com.weddingpov.app
BUILD_CERTIFICATE_BASE64        # base64-encoded .p12 distribution certificate
BUILD_PROVISION_PROFILE_BASE64  # base64-encoded .mobileprovision
APPLE_KEY_ID                    # App Store Connect API key ID
APPLE_ISSUER_ID                 # App Store Connect API issuer ID
APPLE_KEY_CONTENT               # base64-encoded .p8 key file
P12_PASSWORD                    # .p12 certificate password
```

Xcode requirement: Apple mandates Xcode 26 for all App Store submissions as of 2026-04-28. GitHub's `macos-latest` runner must have Xcode 26 available (verify runner image version before setting up pipeline).

**Android (GitHub Actions + Fastlane)**

| Component | Version | Purpose |
|-----------|---------|---------|
| `fastlane supply` | latest | Upload AAB to Play Store internal track |
| Java JDK | 17 | Required for Gradle builds |
| Android compileSdk / targetSdk | 36 | Required by Capacitor 8; Google Play requires API 35+ for new submissions |

Required GitHub repository secrets for Android:
```
PLAY_CONFIG_JSON          # base64-encoded Google Cloud service account credentials
ANDROID_KEYSTORE_FILE     # base64-encoded .jks or .keystore signing file
KEYSTORE_KEY_ALIAS        # key alias
KEYSTORE_KEY_PASSWORD     # key password
KEYSTORE_STORE_PASSWORD   # keystore password
DEVELOPER_PACKAGE_NAME    # com.weddingpov.app
```

**Workflow trigger:** Tag-based (`v*` tags) triggers the build + submit pipeline. This keeps CI costs low (~$0.04/build on private repos for macOS runners).

**Confidence:** HIGH for the overall CI shape. MEDIUM for specific GitHub Actions runner Xcode version (verify `macos-latest` has Xcode 26 at time of setup). Sources: [iOS CI guide](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/), [Android CI guide](https://capgo.app/blog/automatic-capacitor-android-build-github-action/).

---

## Installation

```bash
# Capacitor core + platforms
npm install @capacitor/core
npm install -D @capacitor/cli
npm install @capacitor/ios @capacitor/android

# Required native plugins
npm install @capacitor/share @capacitor/status-bar @capacitor/splash-screen @capacitor/app @capacitor/browser

# Asset generation (dev only)
npm install -D @capacitor/assets

# Initialize Capacitor in the project (run once)
npx cap init "Wedding POV" com.weddingpov.app --web-dir=out

# Add native platforms (run once)
npx cap add ios
npx cap add android

# After each web build: sync JS + plugins into native projects
npx cap sync
```

---

## next.config.ts Changes Required

**DO NOT add `output: 'export'`** — this would break the existing app.

The only `next.config.ts` change needed for Capacitor is to remove or loosen the `X-Frame-Options: DENY` header, which currently blocks the app from loading inside the Capacitor webview on some Android configurations. Also consider the `Permissions-Policy: camera=()` header — it currently blocks camera access globally, which is fine since the app doesn't need camera, but verify it doesn't interfere with webview initialization.

```typescript
// next.config.ts — the ONLY change needed for Capacitor
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Remove X-Frame-Options: DENY — blocks Capacitor webview on Android
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
```

**Confidence:** MEDIUM — `X-Frame-Options: DENY` is known to interfere with webviews loading remote content. Verify during integration testing on Android.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Webview strategy | Live server URL (`server.url`) | Static export (`output: 'export'`) | Static export breaks Server Actions, cookies, and dynamic routes — a near-complete rewrite |
| Drive OAuth in webview | `@capacitor/browser` + deep link | In-webview redirect | Google blocks OAuth in WKWebView / android.webkit.WebView — will fail with `disallowed_useragent` |
| Drive OAuth in webview | `@capacitor/browser` + deep link | `capacitor-community/generic-oauth2` | Generic OAuth plugin adds complexity and an extra dependency for a flow the existing server already handles; only the system browser opener is new |
| CI/CD | Fastlane + GitHub Actions | Ionic Appflow | Appflow costs $49+/mo; Fastlane is free and sufficient for a one-person project |
| CI/CD | Fastlane + GitHub Actions | Manual Xcode/Android Studio upload | Not reproducible, error-prone for certificates and signing |
| Capacitor version | 8.x | 7.x | Capacitor 7 is a previous major; plugins are versioned to core; no reason to use older version |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `output: 'export'` in next.config.ts | Breaks Server Actions, cookies, dynamic routes — the entire existing architecture | Keep SSR, load via `server.url` |
| `@capacitor/camera` | Organizers don't take photos in-app; guests use browser | Not needed |
| Live OTA update service (Capgo, Appflow) | v1.1 scope doesn't need hot code updates; adds cost and complexity | Standard app store releases |
| Ionic Framework UI components | Adding Ionic's component library would change the UI system mid-project for no user benefit | Keep Tailwind CSS as-is |
| `allowNavigation` in Capacitor config | Underdocumented, known to cause Android platform detection bugs | Use `server.url` for the primary app, `@capacitor/browser` for OAuth |
| `capacitor-community/generic-oauth2` | Replaces the server-side OAuth flow the app already has; unnecessary extra layer | Existing server-side Better Auth + Drive OAuth flow, triggered via `@capacitor/browser` |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@capacitor/core@8.x` | Node.js 22+, Xcode 26+, Android Studio 2025.2.1+ | Capacitor 8 dropped support for Node < 22 |
| `@capacitor/ios@8.x` | iOS 15+ deployment target | Apple mandates build with iOS 26 SDK (Xcode 26); deployment target can still be iOS 15 |
| `@capacitor/android@8.x` | compileSdk 36, targetSdk 36, minSdk 24, Java 17 | Google Play requires targetSdk 35+ for new submissions; Capacitor 8 targets 36 |
| All `@capacitor/*` plugins | Must match core major version | All official plugins are on `@8.x`; mixing major versions causes runtime errors |
| `next@16.2.4` | No changes needed | No `output: 'export'` means no Next.js changes for Capacitor compatibility |
| `better-auth@1.6.9` | Works unchanged in webview | Cookie-based sessions work when `server.url` points to the real Railway domain |

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Capacitor 8 is current; latest plugins are 8.x | [npm @capacitor/core](https://www.npmjs.com/package/@capacitor/core), [capacitor-plugins GitHub](https://github.com/ionic-team/capacitor-plugins) | HIGH |
| Capacitor 8 requires Node 22, Xcode 26, Android Studio 2025.2.1 | [Capacitor 8.0 migration docs](https://capacitorjs.com/docs/updating/8-0) | HIGH |
| Apple mandates Xcode 26 for App Store as of 2026-04-28 | [capgo.app Xcode 26 post](https://capgo.app/blog/xcode-26-requirement-for-capacitor-apps/) | HIGH |
| Google Play requires targetSdk 35+ for new submissions | [Android developer target SDK guide](https://developer.android.com/google/play/requirements/target-sdk), [Ionic forum](https://forum.ionicframework.com/t/your-app-is-affected-by-google-play-s-target-api-level-35-requirements/249266) | HIGH |
| Static export breaks Server Actions, cookies, dynamic routes | [Next.js static export docs](https://nextjs.org/docs/app/guides/static-exports) — Unsupported Features section | HIGH |
| `server.url` in production: community-reported success, no explicit Apple policy against it | [Capacitor Discussion #4080](https://github.com/ionic-team/capacitor/discussions/4080), [Discussion #5075](https://github.com/ionic-team/capacitor/discussions/5075) | MEDIUM |
| Google blocks OAuth in WKWebView / android.webkit.WebView | [Google OAuth 2.0 policies](https://developers.google.com/identity/protocols/oauth2/policies), [Google native app guide](https://developers.google.com/identity/protocols/oauth2/native-app) | HIGH |
| `@capacitor/browser` uses SFSafariViewController (iOS) / Chrome Custom Tabs (Android) | [Capacitor Browser API docs](https://capacitorjs.com/docs/v2/apis/browser) | HIGH |
| iOS CI: Fastlane secrets and workflow shape | [capgo.app iOS CI guide](https://capgo.app/blog/automatic-capacitor-ios-build-github-action/) | MEDIUM |
| Android CI: Fastlane secrets and workflow shape | [capgo.app Android CI guide](https://capgo.app/blog/automatic-capacitor-android-build-github-action/) | MEDIUM |
| Icon 1024x1024, splash 2732x2732 requirements | [Capacitor splash/icon docs](https://capacitorjs.com/docs/guides/splash-screens-and-icons) | HIGH |
| `X-Frame-Options: DENY` can interfere with webview | General web security knowledge; WebView is a frame | MEDIUM |

---
*Stack research for: Wedding POV v1.1 — Capacitor iOS/Android mobile app*
*Researched: 2026-05-17*
