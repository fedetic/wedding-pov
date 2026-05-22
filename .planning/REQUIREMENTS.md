# Requirements: Wedding POV

**Defined:** 2026-05-17
**Core Value:** Guests can share their POV photos at an event with zero friction — scan, name, upload, done.

---

## v1.0 Requirements — All Complete ✓

> Archived: see `.planning/milestones/v1.0-REQUIREMENTS.md`

---

## v1.1 Requirements — Mobile App

Requirements for the Capacitor iOS/Android native app milestone.

### Capacitor Infrastructure (CAP)

- [x] **CAP-01**: Organizer can open the organizer dashboard in a native iOS app (Capacitor shell loading the live Railway URL)
- [x] **CAP-02**: Organizer can open the organizer dashboard in a native Android app (Capacitor shell loading the live Railway URL)
- [x] **CAP-03**: All API calls from the native app succeed (CORS configured for `capacitor://localhost` on iOS and `http://localhost` on Android)
- [x] **CAP-04**: Organizer session persists correctly across app restarts (Better Auth cookies work in the Capacitor webview)
- [x] **CAP-05**: Organizer can connect Google Drive from within the native app (OAuth opens in system browser via `@capacitor/browser`, not WKWebView)

### Native Features (NATIVE)

- [x] **NATIVE-01**: Organizer can share the event QR code PNG via the native OS share sheet (Messages, AirDrop, WhatsApp, email, etc.)
- [ ] **NATIVE-02**: Organizer can enable Face ID / Touch ID to unlock the app on subsequent opens (falls back to email/password if biometrics unavailable)
- [ ] **NATIVE-03**: Opening a `weddingpov.app/e/[slug]` link on a device with the app installed opens the native app directly (Universal Links / App Links)
- [ ] **NATIVE-04**: Native app shows a clear offline error screen with a retry button when there is no internet connection

### App Store & Play Store Compliance (COMPLY)

- [ ] **COMPLY-01**: App has icons and splash screens for all required iOS and Android sizes (generated from a 1024×1024 master)
- [ ] **COMPLY-02**: Public privacy policy page at `/privacy` on Railway is accessible from within the native app
- [ ] **COMPLY-03**: iOS app includes `PrivacyInfo.xcprivacy` privacy manifest declaring all required-reason APIs used by Capacitor and its plugins
- [ ] **COMPLY-04**: Organizer can delete their account and all associated data (Better Auth user, Drive credentials, events, upload records) from within the native app
- [ ] **COMPLY-05**: App Store and Google Play listings have complete metadata (name, description, screenshots at required sizes, category, support URL, privacy URL)
- [ ] **COMPLY-06**: Android build targets SDK 35 (compileSdkVersion 35, targetSdkVersion 35) as required by Google Play for new submissions

### Distribution (DIST)

- [ ] **DIST-01**: iOS app is available on TestFlight for internal testing before App Store submission
- [ ] **DIST-02**: iOS app is submitted to App Store review and passes
- [ ] **DIST-03**: Android app is available on Play Store internal track before Google Play submission
- [ ] **DIST-04**: Android app is submitted to Google Play review and passes

---

## v2 Requirements (Deferred)

Items acknowledged but not in scope for v1.1.

### Notifications
- **NOTIF-01**: Organizer receives push notification when a guest uploads photos (requires Firebase, APNs certificates, server-side trigger)
- **NOTIF-02**: Organizer can configure notification preferences (per-photo vs. batched)

### Organizer Experience
- **ORG-01**: Email notifications to organizer when photos are uploaded
- **ORG-02**: Custom event branding (logo, color) on guest upload page

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Guest mobile app | Guests use web browser via QR scan — no install friction is the core value proposition |
| Home screen widgets (WidgetKit) | Requires separate native Swift extension target; disproportionate effort for a feature relevant a few hours per event |
| In-app photo gallery | Google Drive is the gallery — duplicating it contradicts the validated v1.0 architecture decision |
| Real-time live upload counter | Push notifications (v2) are the right solution; live counter requires app to stay foregrounded |
| QR code scanner | Organizer already has the QR displayed in-app; adds camera permission with no workflow value |
| Offline event creation | App is inherently server-dependent; organizer creates events before arriving at venue |
| Social login (Apple Sign In, Google Sign In) | Biometric auth addresses login friction without changing auth architecture |
| Static export / offline-first architecture | Server Actions, Better Auth cookies, and middleware require server-side rendering; `server.url` approach is used instead |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAP-01 | Phase 5 | Complete |
| CAP-02 | Phase 5 | Complete |
| CAP-03 | Phase 5 | Complete |
| CAP-04 | Phase 5 | Complete |
| CAP-05 | Phase 5 | Complete |
| NATIVE-01 | Phase 6 | Complete |
| NATIVE-02 | Phase 6 | Pending |
| NATIVE-03 | Phase 6 | Pending |
| NATIVE-04 | Phase 6 | Pending |
| COMPLY-01 | Phase 7 | Pending |
| COMPLY-02 | Phase 7 | Pending |
| COMPLY-03 | Phase 7 | Pending |
| COMPLY-04 | Phase 7 | Pending |
| COMPLY-05 | Phase 7 | Pending |
| COMPLY-06 | Phase 7 | Pending |
| DIST-01 | Phase 8 | Pending |
| DIST-02 | Phase 8 | Pending |
| DIST-03 | Phase 8 | Pending |
| DIST-04 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19 ✓
- Unmapped: 0 ✓

---

*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 — traceability updated after roadmap creation*
