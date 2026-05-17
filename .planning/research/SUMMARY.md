# Research Summary — v1.1 Mobile App (Capacitor)

**Project:** Wedding POV — v1.1 Capacitor iOS/Android
**Researched:** 2026-05-17
**Confidence:** HIGH for Capacitor core and App Store requirements; MEDIUM for `server.url` App Store acceptance

---

## Executive Summary

Adding Capacitor to this Next.js 15 App Router project is feasible and the right approach. The core architecture decision — `server.url` (load live Railway URL in webview) vs. static export — is the milestone's most critical call. Research is split: static export is incompatible with this app's server-side features, but `server.url` is underdocumented for production by Capacitor. Community evidence strongly supports `server.url` for App Store-approved apps.

Two blockers must be resolved before anything works: (1) Google Drive OAuth will silently break inside the Capacitor WKWebView (`disallowed_useragent`), and (2) Capacitor's origins must be added to Railway's CORS allowlist. The native QR share sheet (`@capacitor/share`) is the primary justification for native distribution and is LOW complexity.

---

## Key Decision: `server.url` vs Static Export

**This is the most important call for the milestone.**

| Approach | Verdict | Why |
|----------|---------|-----|
| `server.url` pointing to Railway | **Recommended** | Static export is incompatible — Server Actions, `cookies()`, dynamic Route Handlers, and auth middleware all break under `output: 'export'`. Community confirms `server.url` apps pass App Store and Play Store review. |
| Static export + Client Component refactor | Not recommended | Would require converting Better Auth sessions, all Server Actions, and protected routes to client-side — effectively a partial rewrite for no user-facing benefit. |

**Residual risk:** Apple Guideline 4.2 (minimum functionality). Mitigation: the native QR share sheet is a genuine native capability unavailable in Safari. A second differentiator (biometrics or deep links) strengthens the case.

---

## Stack Additions

| Package | Version | Purpose |
|---------|---------|---------|
| `@capacitor/core` | `^8.x` | Capacitor runtime |
| `@capacitor/cli` | `^8.x` | Build + sync CLI |
| `@capacitor/ios` | `^8.x` | Xcode project |
| `@capacitor/android` | `^8.x` | Gradle/Android Studio project |
| `@capacitor/share` | `^8.x` | Native QR share sheet (flagship feature) |
| `@capacitor/browser` | `^8.x` | Google Drive OAuth (SFSafariViewController / Chrome Custom Tabs) |
| `@capacitor/status-bar` | `^8.x` | Native status bar color control |
| `@capacitor/splash-screen` | `^8.x` | Splash screen management |
| `@capacitor/app` | `^8.x` | Deep links + Android back button |

**One `next.config.ts` change:** Remove `X-Frame-Options: DENY` (can interfere with Capacitor webview on Android).

---

## Table Stakes Features

Features without which the app is rejected or non-functional:

- **Google Drive OAuth via `@capacitor/browser`** — WKWebView blocks Google OAuth with `disallowed_useragent`; must open SFSafariViewController/Chrome Custom Tab and redirect back via custom URL scheme
- **CORS update** — Add `capacitor://localhost` (iOS) and `http://localhost` (Android) to Railway's allowed origins
- **Session cookie persistence** — Test Better Auth HTTP-only cookies in WKWebView; iOS ITP may drop cross-origin cookies (Railway domain vs `capacitor://localhost`)
- **App icons + splash screen** — Required by both stores; generate from 1024×1024 PNG master
- **Privacy policy URL** — Static `/privacy` page on Railway; must be reachable from within the app
- **PrivacyInfo.xcprivacy** — Apple mandates this for all new submissions since May 2024; missing causes upload rejection
- **In-app account deletion** — Apple requires this for any app with account creation (since June 2022)
- **Demo account for App Review** — Login-required apps will be rejected without working test credentials
- **Offline / no-network error state** — Blank white screen triggers Guideline 2.1 rejection; show static error + retry
- **Android target SDK 35** — Required for Play Store new submissions as of August 31, 2025
- **Native QR share sheet** — Minimum native capability to satisfy Guideline 4.2 (minimum functionality)

---

## Differentiators

- **Native QR share sheet** (`@capacitor/share`) — Share event QR PNG via Messages/AirDrop/WhatsApp with one tap; low complexity, high event-day value
- **Biometric auth** (`@capacitor-community/biometric-auth`) — Unlock app with Face ID/Touch ID; strengthens Guideline 4.2 case; medium complexity
- **Deep links** — `https://weddingpov.app/e/[slug]` opens native app directly to event; requires Universal Links + App Links server files; medium complexity

---

## Anti-Features (Do Not Build)

- **Home screen widgets** — WidgetKit requires separate native Swift target; disproportionate effort for a feature useful for a few hours per event
- **In-app photo gallery** — Google Drive IS the gallery; duplicating it contradicts the core product decision
- **Real-time upload counter** — Push notifications are the right tool for this need; live counter requires app to be foregrounded
- **QR code scanner** — Organizer already has the QR displayed; adds camera permission with no workflow value

---

## Critical Pitfalls

1. **Google Drive OAuth in WKWebView** — `disallowed_useragent` blocks the OAuth flow. Fix with `@capacitor/browser`. Test on real device (emulator may not reproduce). PHASE 1 blocker.
2. **CORS** — `capacitor://localhost` / `http://localhost` not in Railway allowlist. Every API call fails. PHASE 1 blocker.
3. **HTTP-only cookie cross-origin** — iOS ITP may block Better Auth session cookies from Railway inside the Capacitor webview. Test in Phase 1; fallback is `better-auth-capacitor` plugin or token-in-Preferences strategy.
4. **App Store Guideline 4.2 rejection** — Pure webview wrapper risks rejection. QR share sheet + one additional native feature (biometrics or deep links) strongly mitigates.
5. **PrivacyInfo.xcprivacy** — Missing this causes App Store Connect upload rejection regardless of app quality. Must be included at submission.
6. **In-app account deletion** — Hard reject without it. Requires a new backend endpoint (delete user + revoke Drive tokens + delete events).

---

## Recommended Build Order

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| Phase 5 | Capacitor setup + blockers | Install Capacitor 8, `server.url` config, CORS fix, cookie persistence test, Drive OAuth via `@capacitor/browser`, custom URL scheme deep link callback |
| Phase 6 | Native features | QR native share sheet, biometric auth (optional), app icon + splash screen |
| Phase 7 | Store submission prep | Privacy policy page, PrivacyInfo.xcprivacy, account deletion flow, demo account, store listing metadata + screenshots |
| Phase 8 | CI/CD + submission | Fastlane + GitHub Actions for iOS/Android, TestFlight, App Store + Play Store review |

*Phase numbering continues from v1.0 (Phases 1–4).*

---

## Open Questions

1. **Does `server.url` survive App Store review?** Community-confirmed but not Capacitor-official. Prototype early; have a contingency plan if rejected.
2. **Do Better Auth session cookies persist in WKWebView?** Must be tested on a real device in Phase 5 before building anything else on top.
3. **One or two native features for Guideline 4.2?** QR share is LOW complexity. Biometrics is MEDIUM. Recommend shipping both to strengthen the case.
4. **Account deletion endpoint scope?** Must decide: delete only the Better Auth user record, or also revoke Drive tokens + delete all events and upload records.

---

*Research completed: 2026-05-17*
*Ready for roadmap: yes — with `server.url` as the working assumption*
