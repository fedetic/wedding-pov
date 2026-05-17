# Feature Research

**Domain:** Organizer-only mobile app — Capacitor wrapper of existing Next.js wedding photo upload dashboard (v1.1 milestone)
**Researched:** 2026-05-17
**Confidence:** HIGH

---

## Context

This research is scoped to **what is new** in v1.1. The existing web features (login, Drive connect, create event, QR code, upload history, thank-you message, active toggle) are already built and will function inside the Capacitor webview. The questions are: what native capabilities genuinely improve the organizer experience, what is required to pass App Store / Play Store review, and what looks appealing but is not worth the cost.

---

## Feature Landscape

### Table Stakes (Required for Store Approval and Basic Usability)

These features are either hard requirements enforced by Apple / Google at submission time, or conditions without which the app will be rejected under minimum functionality guidelines. Missing any one of these blocks ship.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| App icons and splash screen | Required by both stores; no icon = submission blocked | LOW | Capacitor CLI generates all required sizes from a 1024×1024 PNG master and a splash image; one-time asset work |
| Store listing metadata (description, screenshots, category, support URL) | Required for App Store Connect and Play Console submission; without this there is no listing | LOW | Screenshots must show the actual app on device or simulator; "Productivity" or "Utilities" category |
| Privacy policy URL (in store listing + accessible within app) | Apple requires a public URL in App Store Connect AND reachable from within the app; Google requires it too. Required even if the app collects minimal data. | LOW | A static `/privacy` page on the existing Railway domain; must disclose Google OAuth token handling and any analytics |
| Privacy manifest file (PrivacyInfo.xcprivacy) | Apple enforces this for all new submissions since May 2024; missing it causes upload rejection in App Store Connect regardless of app quality | MEDIUM | Declare all required-reason APIs used by Capacitor and its plugins; run `Product > Analyze` in Xcode to generate a privacy report that shows what needs declaring |
| In-app account deletion | Apple mandates that any app supporting account creation must offer in-app account deletion since June 2022; will be hard-rejected without it | MEDIUM | The organizer account exists; a "Delete my account" flow must be reachable from within the native app, not just the website settings page |
| Google Drive OAuth working inside Capacitor webview | The app is non-functional without Drive connection; Google blocks OAuth in WKWebView (returns `disallowed_useragent` error); this is not optional | HIGH | Must use `@capacitor/browser` to open the OAuth flow in SFSafariViewController (iOS) / Chrome Custom Tab (Android), then redirect back via a custom URL scheme. This is the most technically risky item in the milestone. |
| At least one native capability beyond web page rendering | Apple Guideline 4.2 rejects apps that merely display a website with no added value; a blank webview of the existing site will be rejected | MEDIUM | The native share sheet for QR codes satisfies this and provides genuine organizer value (see Differentiators); it is the lowest-cost path to Guideline 4.2 compliance |
| Offline / no-network error state | Apple reviewers test what happens with no connectivity; a blank white screen triggers Guideline 2.1 (app completeness) rejection | LOW | Detect webview load failure and show a static "No internet connection" message with a retry button; Capacitor's webview emits load error events that can be caught |
| Demo account credentials in App Review Notes | Apple will reject a login-required app if no working test account is provided; reviewer cannot evaluate the app | LOW | Provide a seeded organizer account (email + password) with at least one event created; do not use production data |
| Android target SDK 35 (API level 35) | Google Play requires all new submissions to target Android 15 (API level 35) as of August 31, 2025 | LOW | Set `targetSdkVersion = 35` and `compileSdkVersion = 35` in `android/app/build.gradle`; verify Capacitor's current Android template supports this |

### Differentiators (Native Capabilities That Genuinely Improve Organizer Experience)

Features where native APIs provide something the browser cannot, with a clear, specific organizer benefit at a live event.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Native share sheet for QR code | Organizer can share the event QR code PNG via Messages, AirDrop, WhatsApp, email with a single tap — the browser cannot trigger the native share sheet. At a wedding, handing someone their phone to scan a QR is friction; texting the QR image is zero friction. | LOW | `@capacitor/share` supports `Share.share({ files: ['file:///...qr.png'] })` on iOS and Android. Generate the QR PNG on-device from the event URL (or use the existing download-PNG from the web dashboard), save to the app's cache directory, then pass the local file path. This is the single most valuable native feature at low cost. |
| Push notifications for new guest uploads | Organizer gets a native lock-screen notification when a guest uploads photos — immediately useful during a live event. Safari on iOS does not support web push notifications; this is a native-only capability. | HIGH | Requires: Firebase project, `@capacitor/push-notifications`, APNs certificate in Apple Developer Portal, FCM `google-services.json` in Android project, FCM token stored per organizer on the server, and a server-side trigger on upload completion. This is not a Capacitor config item — it requires backend changes. Do not block the initial release on this. |
| Biometric authentication (Face ID / Touch ID) | Organizer unlocks the app with biometrics instead of typing email + password on every session; specifically useful when checking upload counts during the event with wet/gloved hands. | MEDIUM | Use `@capacitor-community/biometric-auth` or `@aparajita/capacitor-biometric-auth`; must fall back to email + password when biometrics fail or are not enrolled. The server session must already exist — biometrics unlock the app, they do not replace server authentication. |
| Deep links to specific events | A shared event URL (e.g. `https://weddingpov.app/e/jane-tom`) opens directly in the native app and navigates to that event's QR code screen instead of opening in Safari. Useful when a co-organizer shares an event link. | MEDIUM | Requires Universal Links (iOS) and App Links (Android): an `apple-app-site-association` file and `assetlinks.json` file hosted at the Railway domain root. Capacitor handles the URL via `App.addListener('appUrlOpen', ...)`. Straightforward but requires server file changes and Apple Developer Portal configuration. |

### Anti-Features (High Apparent Appeal, Low Actual Organizer Value)

Features commonly considered for mobile apps that are not worth the implementation cost for this specific organizer use-case.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Home screen widgets (WidgetKit / Android Glance) | "Show live upload count on the home screen without opening the app" sounds useful at a live event | WidgetKit runs in a sandboxed iOS extension with its own process; it cannot read the main app's UserDefaults, Keychain, or network session directly. It requires a separate Swift target in Xcode, App Groups entitlement shared between app and extension, a shared data store, and a background refresh budget controlled by the OS (not the app). The upload count also requires a server poll, which widgets cannot do on demand. This is a full native Swift feature — not a Capacitor plugin, not a web view. Estimated 2–3 days of native Swift work for a number that is relevant for a few hours per event and then meaningless. | The upload history tab in the app is the right place; open it at the event to see counts |
| In-app photo gallery / lightbox | "Organizer should see uploaded photos without opening Drive" | The core product decision (validated in v1.0) is that Google Drive is the gallery. Adding an in-app gallery means: Drive API file listing, thumbnail generation, caching, pagination, access token refresh during photo load, and UI work. It duplicates what Drive already does well on the organizer's phone. | Organizer views photos in the Google Drive iOS/Android app, which is already on their device |
| Real-time upload counter / live dashboard | "Show a counter that increments as guests upload" | A live counter in a mobile app's foreground webview is technically feasible (WebSocket or SSE), but "real-time" while the app is backgrounded requires push notifications — which is already the correct native feature for that need. | Push notifications (Differentiators) are the right solution: the organizer gets a notification per upload or per batch, not a counter that requires the app to be open and active |
| QR code scanner (scan their own event's QR) | "Tap a button to scan and open the event" | The organizer creates the event and already has the QR code displayed on-screen. Scanning their own QR adds no workflow value. Worse, it adds a camera permission requirement, which triggers an additional iOS permission dialog and must be justified in the privacy nutrition label. | The existing in-app QR display and copy-URL button cover the organizer's actual need |
| Apple Sign In / Google Sign In (social login for organizers) | "Reduce login friction" | The app uses email + password via Better Auth. Apple only requires Sign in with Apple if the app offers other third-party social logins. Adding Google Sign In requires `@codetrix-studio/capacitor-google-auth`, a separate Google OAuth client ID for iOS/Android (distinct from the Drive OAuth client), and backend changes to Better Auth. This changes the auth architecture for marginal benefit over biometric unlock (which is much lower cost). | Biometric authentication (Differentiators) addresses the friction problem without architectural changes |
| Offline event creation | "Create events without internet when venue WiFi is unreliable" | The app is inherently server-dependent: event creation writes to the database, Drive folder creation requires an active OAuth token, and QR code generation requires the event's server-assigned ID. Building offline queuing requires a local database, sync logic, conflict resolution, and error handling for when the server rejects a queued event. Disproportionate to the actual need. | Organizer creates events before arriving at the venue; the web app is the fallback on any browser |
| Multiple organizer accounts / account switching | "Co-organizer wants to manage the same events" | Deferred to the SaaS milestone in PROJECT.md. Account switching in a Capacitor app adds session management complexity. | Co-organizer logs in with shared credentials or the primary organizer manages events |

---

## Feature Dependencies

```
[App Store / Play Store submission]
    └──requires──> [App icons + splash screen]
    └──requires──> [Store listing metadata + screenshots]
    └──requires──> [Privacy policy URL]
    └──requires──> [Privacy manifest (PrivacyInfo.xcprivacy)]
    └──requires──> [In-app account deletion]
    └──requires──> [Demo account in review notes]
    └──requires──> [Android target SDK 35]
    └──requires──> [At least one native capability]
                       └──satisfied by──> [Native QR share sheet]

[Native QR share sheet]
    └──requires──> [QR code PNG accessible as a local file:// URL]
                       └──option A: generate PNG in-app from event URL]
                       └──option B: download PNG from existing web endpoint, cache locally]

[Google Drive OAuth in Capacitor]
    └──requires──> [@capacitor/browser plugin]
    └──requires──> [Custom URL scheme or Universal Link as OAuth redirect URI]
    └──requires──> [Railway server handles redirect and exchanges code for token]
    └──conflicts──> [WKWebView direct OAuth] (Google blocks this; returns disallowed_useragent)

[Biometric authentication]
    └──requires──> [Valid server-side session already established via email/password]
    └──enhances──> [Login friction on repeat opens]

[Deep links to events]
    └──requires──> [apple-app-site-association file on Railway domain]
    └──requires──> [assetlinks.json on Railway domain]
    └──requires──> [Capacitor App plugin appUrlOpen listener]
    └──enhances──> [Sharing event links with co-organizers]

[Push notifications]
    └──requires──> [Firebase project + google-services.json]
    └──requires──> [APNs certificate in Apple Developer Portal]
    └──requires──> [FCM token stored per organizer in database]
    └──requires──> [Server trigger on upload completion]
    └──independent of all other Capacitor native features]
```

### Dependency Notes

- **Google Drive OAuth is the critical path blocker:** The app cannot function without Drive connection, and the existing web OAuth flow breaks inside WKWebView. Resolve this before any other feature work.
- **Native QR share sheet is the path-of-least-resistance for Guideline 4.2 compliance:** It provides real organizer value and proves native integration to Apple reviewers simultaneously. Build it as part of the initial submission.
- **Push notifications are independent but require backend changes:** Do not block the store submission on push. Add after the app is live.
- **Biometric auth requires an existing authenticated session:** It unlocks the app on repeat opens; it does not replace server auth. Implement after the OAuth flow is confirmed stable.

---

## MVP Definition

### Launch With (v1.1 — initial App Store and Play Store submission)

Minimum required for both stores to accept the app and for the organizer experience to be meaningfully better than a browser bookmark.

- [ ] Working organizer dashboard in Capacitor webview (all existing web features functional on iOS and Android)
- [ ] Google Drive OAuth working via `@capacitor/browser` (not WKWebView) with correct redirect handling
- [ ] Native share sheet for QR code PNG (`@capacitor/share`)
- [ ] App icons and splash screen (all required sizes for both platforms)
- [ ] Privacy policy page (static, hosted on Railway domain, linked from within app)
- [ ] Privacy manifest (PrivacyInfo.xcprivacy) added to Xcode project
- [ ] In-app account deletion flow
- [ ] Offline / no-network error state (static message, not blank white screen)
- [ ] Demo organizer account documented in App Review Notes
- [ ] Android `targetSdkVersion = 35`
- [ ] App Store Connect listing (description, screenshots, support URL, privacy nutrition label)
- [ ] Google Play Console listing (description, screenshots, content rating questionnaire)

### Add After Validation (v1.1.x)

Add once the base app is live and the OAuth / webview behavior is confirmed stable in production on real devices.

- [ ] Biometric authentication (Face ID / Touch ID) — reduces login friction; implement using community plugin after core auth is confirmed working
- [ ] Deep links to specific events — improves co-organizer sharing workflow; requires `apple-app-site-association` and `assetlinks.json` on Railway domain

### Future Consideration (v2+)

Defer until organizer count justifies the infrastructure investment.

- [ ] Push notifications for new uploads — correct feature for live-event alerting, but requires Firebase, APNs, and backend changes; add when more than a handful of organizers are active
- [ ] Home screen widgets — native Swift extension work; defer indefinitely until there is a clear use-case that the app itself cannot satisfy

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google Drive OAuth in Capacitor (via browser plugin) | HIGH — app is non-functional without it | HIGH | P1 |
| Native QR share sheet | HIGH — core native differentiator, satisfies Guideline 4.2 | LOW | P1 |
| App icons + splash screen | HIGH — store requirement | LOW | P1 |
| Privacy policy page | HIGH — store requirement | LOW | P1 |
| Privacy manifest (PrivacyInfo.xcprivacy) | HIGH — Apple upload rejection without it | MEDIUM | P1 |
| In-app account deletion | HIGH — Apple hard requirement | MEDIUM | P1 |
| Offline error state | HIGH — prevents Guideline 2.1 rejection | LOW | P1 |
| Demo account in review notes | HIGH — prevents review failure | LOW | P1 |
| Android API level 35 | HIGH — Play Store requirement since Aug 2025 | LOW | P1 |
| Store listing metadata + screenshots | HIGH — required for submission | LOW | P1 |
| Biometric authentication | MEDIUM | MEDIUM | P2 |
| Deep links to events | MEDIUM | MEDIUM | P2 |
| Push notifications | HIGH (live-event value) | HIGH | P3 |
| Home screen widgets | LOW | HIGH — native Swift, not Capacitor | P3 |

**Priority key:**
- P1: Must have for initial App Store / Play Store submission
- P2: Add after first live release; no new store submission needed if delivered via OTA
- P3: Future milestone; requires significant new infrastructure

---

## App Store / Play Store Submission Requirements Summary

**Apple App Store (HIGH confidence — verified against Apple Developer documentation)**
- Apple Developer Program membership ($99/year)
- App icons: all sizes generated by Capacitor CLI from 1024×1024 master
- Screenshots: at least one per device class in App Store Connect (iPhone 6.7", iPad if targeting iPad)
- Privacy policy URL: publicly accessible, linked from within app
- Privacy manifest (PrivacyInfo.xcprivacy): declares required-reason APIs
- Privacy nutrition label: completed in App Store Connect
- In-app account deletion (for apps with account creation)
- Support URL in App Store Connect
- Demo account in App Review Notes (for login-required apps)
- Build with iOS 26 SDK / Xcode 26 for submissions after April 2026
- No empty sections or "coming soon" text (Guideline 2.1 — App Completeness)
- Native value beyond webview (Guideline 4.2 — Minimum Functionality)

**Google Play Store (HIGH confidence — verified against Android developer documentation)**
- Google Play Developer account ($25 one-time)
- App icon: 512×512 PNG
- Feature graphic: 1024×500 px
- Screenshots: at least 2 (minimum 320px, maximum 3840px on longest side)
- Privacy policy URL
- Content rating questionnaire completed in Play Console
- Data safety section completed in Play Console
- `targetSdkVersion = 35` (Android 15) for new submissions as of August 31, 2025
- App must provide genuine added value beyond website display (similar to Apple 4.2)

---

## Sources

- Apple App Review Guidelines (Guideline 4.2 minimum functionality, Guideline 2.1 completeness): [mobiloud.com/blog/app-store-review-guidelines-webview-wrapper](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)
- Apple account deletion requirement: [developer.apple.com/news/?id=12m75xbj](https://developer.apple.com/news/?id=12m75xbj)
- Apple upcoming requirements (SDK, Xcode): [developer.apple.com/news/upcoming-requirements/](https://developer.apple.com/news/upcoming-requirements/)
- Apple privacy manifest for Capacitor apps: [capacitorjs.com/docs/v5/ios/privacy-manifest](https://capacitorjs.com/docs/v5/ios/privacy-manifest)
- Apple App Store submission guide 2026: [newly.app/articles/app-store-requirements](https://newly.app/articles/app-store-requirements)
- Google Play target SDK 35 deadline: [developer.android.com/google/play/requirements/target-sdk](https://developer.android.com/google/play/requirements/target-sdk)
- Google Play webview app policy: [median.co/blog/will-google-play-approve-my-webview-app](https://median.co/blog/will-google-play-approve-my-webview-app)
- Capacitor Share plugin API (file sharing, native share sheet): [capacitorjs.com/docs/apis/share](https://capacitorjs.com/docs/apis/share)
- Capacitor Push Notifications: [capacitorjs.com/docs/apis/push-notifications](https://capacitorjs.com/docs/apis/push-notifications)
- Google OAuth disallowed_useragent in WKWebView: [nextnative.dev/blog/google-sign-in-for-ios](https://nextnative.dev/blog/google-sign-in-for-ios)
- OAuth in Capacitor via browser plugin: [capgo.app/blog/5-steps-to-implement-oauth2-in-capacitor-apps/](https://capgo.app/blog/5-steps-to-implement-oauth2-in-capacitor-apps/)
- Capacitor Deep Links (Universal Links / App Links): [capacitorjs.com/docs/guides/deep-links](https://capacitorjs.com/docs/guides/deep-links)
- WidgetKit complexity with React Native / Capacitor: [unosquare.com/blog/home-screen-widgets-ios-widgetkit-react-native](https://www.unosquare.com/blog/home-screen-widgets-ios-widgetkit-react-native/)
- Better Auth in Capacitor apps: [capawesome.io/blog/how-to-use-better-auth-in-capacitor-apps/](https://capawesome.io/blog/how-to-use-better-auth-in-capacitor-apps/)

---
*Feature research for: Wedding POV organizer mobile app — Capacitor v1.1 milestone*
*Researched: 2026-05-17*
