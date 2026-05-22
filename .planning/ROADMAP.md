# Roadmap: Wedding POV

## Milestones

- ✅ **v1.0 MVP** - Phases 1–4 (shipped 2026-05-04)
- 🚧 **v1.1 Mobile App** - Phases 5–8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-05-04</summary>

### Phase 1: Foundation + Auth
**Goal**: Organizer can create an account, log in, and connect Google Drive — the system has everything it needs to store photos securely
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Bootstrap Next.js 15, install deps, Drizzle schema (7 tables), drizzle-kit push to Neon
- [x] 01-02-PLAN.md — Better Auth config, auth API route, middleware, Register + Login forms, Dashboard shell
- [x] 01-03-PLAN.md — Google Drive OAuth routes (/api/drive/connect, /api/drive/callback), AES-256-GCM token encryption
- [x] 01-04-PLAN.md — Railway deployment, env vars, GCP redirect URI registration, smoke test all auth flows

### Phase 2: Events + QR
**Goal**: Organizer can create events, generate scannable QR codes, and have Drive folders ready to receive photos
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Backend: install deps (qrcode, nanoid), createEvent Server Action (Drive folder + DB insert + slug), PATCH toggle API route
- [x] 02-02-PLAN.md — Dashboard UI: EventList (Server Component), EventRow (optimistic toggle), CreateEventForm, /dashboard/events/new page, update dashboard
- [x] 02-03-PLAN.md — QR feature: QRModal component (256px QR generation, PNG download), wire into EventRow

### Phase 3: Guest Upload
**Goal**: Guests can scan the QR code, enter their name, upload photos, and see them land in the organizer's Google Drive — with no app install and no account
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Upload API: RateLimiterMemory (30/15min per IP:slug), OAuth2-brokered Drive upload with HEIC→JPEG conversion, POST /api/upload/[slug] route handler
- [x] 03-02-PLAN.md — Guest UI: Mobile-first upload page with sequential XHR state machine (landing → nickname → photo select → upload → complete/error), terracotta-rose palette, HEIC support
- [x] 03-03-PLAN.md — E2E Verification: middleware audit, build check, token leak audit, mobile flow confirmation on iPhone iOS Safari

### Phase 4: Launch Readiness
**Goal**: The system is verified, mobile-polished, and safe to run on a real wedding day
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — GCP OAuth Production promotion + Drive reconnect + token auto-refresh verification
- [x] 04-02-PLAN.md — End-to-end smoke test on iPhone + Android + inactive event rejection + Drive attribution audit

</details>

---

### 🚧 v1.1 Mobile App (In Progress)

**Milestone Goal:** Publish the organizer dashboard as a native iOS and Android app via Capacitor, distributed through App Store and Google Play.

- [x] **Phase 5: Capacitor Infrastructure** — Capacitor setup, CORS fix, cookie persistence, Google Drive OAuth via system browser (completed 2026-05-18)
- [ ] **Phase 6: Native Features** — QR share sheet, biometric auth, deep links, offline error screen
- [ ] **Phase 7: Compliance + Submission Prep** — Icons/splash, privacy policy, PrivacyInfo.xcprivacy, account deletion, store metadata
- [ ] **Phase 8: Distribution** — TestFlight, App Store submission, Play Store internal track, Google Play submission

## Phase Details

### Phase 5: Capacitor Infrastructure
**Goal**: The native app shell loads the live organizer dashboard and all core functionality works — API calls succeed, sessions persist, and Google Drive OAuth completes without error
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04, CAP-05
**Success Criteria** (what must be TRUE):
  1. Organizer can open the organizer dashboard in a native iOS app (Xcode build runs on device/simulator without error)
  2. Organizer can open the organizer dashboard in a native Android app (Gradle build runs on device/emulator without error)
  3. Organizer can log in and all API calls succeed in both native apps (no CORS errors for `capacitor://localhost` on iOS and `http://localhost` on Android)
  4. Organizer session persists after force-quitting and relaunching the app (Better Auth cookie survives WKWebView across restarts)
  5. Organizer can complete the Google Drive OAuth flow from within the native app (SFSafariViewController/Chrome Custom Tab opens, OAuth completes, and app resumes with Drive connected)
**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — Server trust: add Capacitor origins to trustedOrigins in auth.ts, remove X-Frame-Options from next.config.ts
- [x] 05-02-PLAN.md — Capacitor scaffold: install packages, create capacitor.config.ts, cap add ios + android, WKAppBoundDomains
- [x] 05-03-PLAN.md — Session persistence: install better-auth-capacitor, update auth-client.ts with platform detection
- [x] 05-04-PLAN.md — Google Drive OAuth: ConnectDriveButton with Browser.open, URL scheme registration, callback deep link redirect

### Phase 6: Native Features
**Goal**: The native app provides genuine native capabilities — QR sharing via OS share sheet, biometric unlock, deep link routing, and a graceful offline state
**Depends on**: Phase 5
**Requirements**: NATIVE-01, NATIVE-02, NATIVE-03, NATIVE-04
**Success Criteria** (what must be TRUE):
  1. Organizer can tap a share button on an event QR code and the native OS share sheet appears with the QR PNG (Messages, AirDrop, WhatsApp, email all available as targets)
  2. Organizer can enable Face ID or Touch ID in app settings; subsequent app opens require biometric confirmation before showing the dashboard
  3. Opening a `weddingpov.app/e/[slug]` link on an iOS or Android device with the app installed launches the native app directly to that event (Universal Links and App Links both work; server-side AASA and assetlinks.json files are served correctly)
  4. When the device has no internet connection, the app shows a static error screen with a retry button instead of a blank white screen
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md — QR share sheet (NATIVE-01): install @capacitor/share + @capacitor/filesystem, add Share button to QRModal with handleShare() writing PNG to Filesystem Cache and invoking native share sheet
- [x] 06-02-PLAN.md — Deep link infra (NATIVE-03): AASA + assetlinks.json Route Handlers with Content-Type: application/json, App.entitlements with Associated Domains, AndroidManifest autoVerify intent filters for both domains, DeepLinkHandler.tsx component
- [x] 06-03-PLAN.md — Biometric unlock (NATIVE-02): install @aparajita/capacitor-biometric-auth, NSFaceIDUsageDescription, /dashboard/settings page with toggle, BiometricLockScreen component, Settings link in dashboard header
- [ ] 06-04-PLAN.md — Layout integration (NATIVE-04 + final wiring): OfflineOverlay with reactive @capacitor/network listener, NativeShell wrapper, mount in src/app/layout.tsx

### Phase 7: Compliance + Submission Prep
**Goal**: Both apps meet every App Store and Google Play requirement for submission — icons, privacy materials, account deletion, and complete store listings are in place
**Depends on**: Phase 6
**Requirements**: COMPLY-01, COMPLY-02, COMPLY-03, COMPLY-04, COMPLY-05, COMPLY-06
**Success Criteria** (what must be TRUE):
  1. App icons and splash screens at all required iOS and Android sizes are generated and integrated (no missing asset warnings in Xcode or Android Studio)
  2. A public `/privacy` page is live on Railway and accessible by tapping a link from within the native app
  3. iOS Xcode project includes a valid `PrivacyInfo.xcprivacy` file declaring all required-reason APIs used by Capacitor plugins (App Store Connect upload succeeds without privacy manifest warnings)
  4. Organizer can delete their account from within the native app and the backend removes the Better Auth user record, Drive credentials, all events, and all upload records
  5. App Store Connect and Google Play Console listings have complete metadata — name, description, category, screenshots at required sizes, support URL, and privacy policy URL
  6. Android `build.gradle` sets `compileSdkVersion 35` and `targetSdkVersion 35` (Gradle build succeeds; no Play Store SDK version rejection)
**Plans**: TBD

### Phase 8: Distribution
**Goal**: Both apps are published — iOS is live on the App Store and Android is live on Google Play after passing review
**Depends on**: Phase 7
**Requirements**: DIST-01, DIST-02, DIST-03, DIST-04
**Success Criteria** (what must be TRUE):
  1. iOS app is available on TestFlight for internal testing (build is uploaded to App Store Connect, at least one internal tester can install it)
  2. iOS app passes App Store review and is publicly downloadable from the App Store
  3. Android app is available on the Play Store internal track before submission (APK/AAB is uploaded, internal testers can install it via Google Play)
  4. Android app passes Google Play review and is publicly downloadable from Google Play
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation + Auth | v1.0 | 4/4 | Complete | 2026-05-04 |
| 2. Events + QR | v1.0 | 3/3 | Complete | 2026-05-04 |
| 3. Guest Upload | v1.0 | 3/3 | Complete | 2026-05-04 |
| 4. Launch Readiness | v1.0 | 2/2 | Complete | 2026-05-04 |
| 5. Capacitor Infrastructure | v1.1 | 4/4 | Complete   | 2026-05-18 |
| 6. Native Features | v1.1 | 3/4 | In Progress|  |
| 7. Compliance + Submission Prep | v1.1 | 0/TBD | Not started | - |
| 8. Distribution | v1.1 | 0/TBD | Not started | - |
