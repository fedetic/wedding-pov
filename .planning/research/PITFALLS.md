# Pitfalls Research

**Domain:** Adding Capacitor to an existing Next.js 15 App Router web app (Railway-deployed SSR) for App Store and Google Play distribution
**Researched:** 2026-05-17
**Confidence:** HIGH (multiple authoritative sources cross-validated for each critical pitfall)

---

## Critical Pitfalls

Mistakes that cause showstoppers, store rejections, or security failures.

---

### Pitfall 1: Google OAuth Inside the Capacitor WebView — `disallowed_useragent`

**What goes wrong:**
Opening Google's OAuth authorization URL inside WKWebView (iOS) or Android WebView causes Google to return a hard `403: disallowed_useragent` error. The login page does not load. The organizer cannot connect their Google Drive inside the app.

**Why it happens:**
Google permanently blocked OAuth inside embedded webviews in September 2021. Their policy states that embedded browser controls (WKWebView, Android WebView) allow developers to intercept keystrokes and cookies during the auth flow, making them a man-in-the-middle risk. This is enforced by User-Agent detection — Capacitor's WKWebView is fingerprinted and blocked at the Google OAuth endpoint. There is no workaround that doesn't violate Google's Terms of Service (spoofing the User-Agent is explicitly prohibited).

**How to avoid:**
Open the Google OAuth flow in the system browser, not in the webview. The correct pattern for Capacitor:
1. Use the `@capacitor/browser` plugin to open the Google authorization URL in SFSafariViewController (iOS) or Chrome Custom Tabs (Android).
2. Register a custom URL scheme (e.g. `com.weddingpov.app://oauth`) or Universal Link in `Info.plist` / `AndroidManifest.xml`.
3. Configure your server's OAuth callback (`/api/drive/callback`) to redirect to `com.weddingpov.app://oauth?code=...` after the Google callback completes.
4. Capacitor's App plugin picks up the deep link and the app extracts the auth code.
5. The app sends the code to your server to exchange for tokens — server completes the flow server-side as today.

This preserves the server-side token exchange (Google tokens never touch the app client) while routing the consent screen through a safe browser.

**Warning signs:**
- You see "This browser or app may not be secure" on a Google login screen inside the app.
- You receive a `403 disallowed_useragent` error before Google's login page renders.
- Any attempt to load `accounts.google.com` in the Capacitor webview.

**Phase to address:** Phase 1 (Capacitor setup + Google Drive OAuth mobile flow). This must be solved before any organizer can use the mobile app at all. It is the single highest-risk item in this milestone.

---

### Pitfall 2: Static Export Breaks the Entire Server Stack

**What goes wrong:**
Every tutorial for "Capacitor + Next.js" instructs adding `output: 'export'` to `next.config.ts`. This converts the app to a static site. In a static export:
- Server Actions fail to build (`Server Actions are not supported with static export`)
- API routes (Route Handlers) only support GET and cannot read request headers or cookies
- Middleware does not run at all
- Server Components that do data fetching break
- Better Auth's session cookies cannot be validated server-side

For wedding-pov, the organizer dashboard is built entirely on server components, server actions, and HTTP-only session cookies managed by Better Auth. A static export would require rewriting essentially the entire authenticated portion of the app.

**Why it happens:**
The static export tutorials assume a simple SPA that calls an external backend API. The App Router pattern of server-side rendering, server actions, and server-brokered Google Drive uploads does not survive static export.

**How to avoid:**
Do NOT use `output: 'export'`. Instead, configure Capacitor to load from the Railway-deployed URL using `server.url` in `capacitor.config.ts` for development, and evaluate one of these two production strategies:

- **Option A (recommended for this app):** Point `server.url` at the Railway production URL permanently. The app is a thin native shell around the existing SSR web app. All server functionality (auth, Drive OAuth, server actions) works unchanged. The App Store review risk (guideline 4.2) is mitigated by adding at least two native features (native share sheet for QR codes, and potentially Face ID / push notifications).
- **Option B (future-proof but complex):** Split the dashboard into client-only pages that call API routes, removing server actions and SSR dependencies. This is a significant refactor and is not justified for v1.1.

**Warning signs:**
- Your `next.config.ts` contains `output: 'export'`
- Build fails with "Server Actions are not supported with static export"
- Authentication redirects silently break in the packaged app
- Pages load but show no data (server actions silently do nothing)

**Phase to address:** Phase 1 (Capacitor configuration). The architecture decision — `server.url` vs static export — must be made before any code is written.

---

### Pitfall 3: CORS Rejection — `capacitor://localhost` and `http://localhost` Origins Blocked Server-Side

**What goes wrong:**
When a Capacitor app makes API requests, the browser origin is `capacitor://localhost` (iOS) or `http://localhost` (Android). Your Railway server's CORS configuration only allows `https://your-app.railway.app`. All API calls — including Better Auth session validation and server action requests — fail with CORS errors.

**Why it happens:**
Capacitor runs your web assets from a local scheme. When the native WebView makes requests to your remote Railway server, the request carries a non-standard origin that the server has never seen. Most CORS configs have an explicit allowlist of known HTTPS origins; the Capacitor schemes are not on it.

**How to avoid:**
Add `capacitor://localhost` and `http://localhost` to the CORS `Access-Control-Allow-Origin` allowlist on your Railway server, scoped to the same trusted routes already allowed for the web app. Also add `credentials: 'include'` to all fetch calls from the app (or verify it's already set). Update Better Auth's `trustedOrigins` config to include both Capacitor origins.

Additionally, configure the Capacitor HTTP plugin (`@capacitor/http`) which intercepts native requests and bypasses WebView CORS restrictions entirely — use it for any call that cannot be fixed via server-side CORS headers.

**Warning signs:**
- API calls that work in the browser fail silently in the packaged app
- Network tab in Safari Web Inspector (attached to iOS device) shows CORS preflight failures
- Server logs show no incoming request at all (request was blocked before it left the WebView)

**Phase to address:** Phase 1 (Capacitor setup). Test CORS before any feature work begins — it blocks everything.

---

### Pitfall 4: HTTP-Only Session Cookies Not Sent From Capacitor WebView

**What goes wrong:**
Better Auth issues HTTP-only session cookies to the organizer's browser. When the same app runs inside a Capacitor WebView talking to a remote Railway server, the cookies are either:
- Not set at all (iOS rejects cookies from cross-origin `Set-Cookie` due to ITP/SameSite policy)
- Set but not persisted after app restart
- Dropped because `SameSite=None; Secure` requires a secure context but `capacitor://localhost` is not HTTPS

The organizer appears logged in, closes the app, reopens it, and is logged out. Or never appears logged in at all.

**Why it happens:**
iOS WebKit (WKWebView) changed its default cookie acceptance policy to `NSHTTPCookieAcceptPolicyOnlyFromMainDocumentDomain`. Any cookie set by a cross-origin response (i.e., your Railway server responding to requests from `capacitor://localhost`) is treated as a third-party cookie and rejected. This is the same ITP (Intelligent Tracking Prevention) mechanism that blocks tracking cookies in Safari.

Additionally, `Secure` cookies require HTTPS but the Capacitor scheme is not considered a secure context by WebKit, making `SameSite=None; Secure` cookies unusable in some Capacitor versions.

**How to avoid:**
Use the `better-auth-capacitor` plugin (https://github.com/productdevbook/better-auth-capacitor), which was purpose-built for this exact problem. It:
- Intercepts Better Auth session requests on native and stores session tokens in device native storage instead of relying on WebView cookie storage
- Handles the OAuth flow via system browser with deep link callback
- Provides a `/capacitor-authorization-proxy` endpoint registration for origin override
- Dispatches `better-auth:session-update` DOM events after OAuth completion

If not using the plugin, the fallback pattern is: the server issues a short-lived Bearer token (alongside or instead of cookies) that the app stores in Capacitor's `@capacitor/preferences` (secure native storage) and attaches to every request as an `Authorization: Bearer` header.

**Warning signs:**
- Organizer is logged out every time the app is backgrounded or restarted
- Server logs show requests with no session cookie attached
- Login succeeds but the next navigation immediately redirects to login again
- `document.cookie` is empty in the WebView JS console

**Phase to address:** Phase 1 (auth + Capacitor integration). Authentication is the gate for all other features.

---

### Pitfall 5: App Store Rejection — Guideline 4.2 "Minimum Functionality" (Webview Wrapper)

**What goes wrong:**
Apple's App Review team rejects apps under Guideline 4.2 when the submission is judged to be "a thin veneer" over a website with no native functionality. A Capacitor app that simply loads a URL and provides no native experience is exactly what this guideline targets. The rejection notice says the app "does not include enough features or content" and that users would be better served by a web clip or Safari bookmark.

**Why it happens:**
Apple explicitly states: "Your app should include features, content, and UI that elevate it beyond a repackaged website." Reviewers ask: "What can this app do that Safari cannot?" If the answer is "nothing," it gets rejected. The review is subjective — the same app can be approved by one reviewer and rejected by another — but thin webview wrappers with zero native integration are consistently flagged.

**How to avoid:**
Add at least two meaningful native features that are genuinely not available in the browser version. For this app, the best candidates are:

1. **Native Share Sheet for QR codes** — `@capacitor/share` lets the organizer share the QR code image or event link via AirDrop, Messages, WhatsApp, etc. This is a native iOS capability that Safari web apps cannot access.
2. **Biometric unlock / Face ID** — `@capacitor/preferences` + `@capacitor-mlkit/face-detection` or simply using Face ID to re-authenticate (Better Auth + biometric). Genuinely native, genuinely useful.
3. **Push notifications for upload activity** — notify the organizer when guests start uploading. Native, valuable, impossible in Safari without PWA setup.

Do NOT submit with only the QR native share as the sole differentiator — add at least one more. Include a brief note in the App Review notes field describing the native features present and why the app genuinely needs to be a native app (e.g., "Organizers use the native share sheet to distribute QR codes via AirDrop at the event venue").

**Warning signs:**
- The app has zero usage of any Capacitor native plugin beyond the basic webview
- The only difference from opening the website in Safari is the app icon on the home screen
- No offline handling, no native UI elements, no system integration

**Phase to address:** Phase 1 (Capacitor planning). Native features must be scoped into the plan before build — retrofitting them after rejection costs weeks. QR native share is already planned; treat it as mandatory for approval, not optional.

---

### Pitfall 6: OAuth Redirect URI Mismatch — Custom Scheme vs. HTTPS Universal Links

**What goes wrong:**
After opening the Google OAuth flow in the system browser, the callback redirect URI registered in Google Cloud Console must exactly match what your server sends after completing the token exchange. Two common mismatches:

1. You register a custom scheme (`com.weddingpov.app://oauth`) in Google Cloud Console, but Google has deprecated custom URI schemes for installed apps since they can be intercepted by other apps on the device.
2. You use Universal Links (`https://weddingpov.app/auth/callback`) for the deep link back into the app, but forget to set up the Apple App Site Association file (`/.well-known/apple-app-site-association`) or Android Digital Asset Links (`/.well-known/assetlinks.json`) on your domain.

Either scenario means the OAuth flow completes on Google's side, and then the user is left stranded — they're dropped back to a browser page with no way to return to the app.

**Why it happens:**
The redirect URI for native apps goes through two hops: (1) Google redirects to your server's `/api/drive/callback`, which exchanges the code for tokens, then (2) your server redirects the browser to the app's deep link. Step 2 requires either a correctly configured custom scheme registered in the app's native manifests or a Universal Link with AASA file. Developers test step 1 (server callback) without testing step 2 (browser → app handoff), leading to last-mile failures.

**How to avoid:**
- Register the custom scheme in both `Info.plist` (iOS URL Types) and `AndroidManifest.xml` (intent filter with `android:scheme`). Google Cloud Console should list `com.weddingpov.app` (custom scheme) as an authorized redirect for the final server → app redirect.
- If using Universal Links, serve `/.well-known/apple-app-site-association` from Railway with `Content-Type: application/json` (not `application/pkce+json`) — Apple fetches this on device enrollment.
- Test the full round-trip: open the auth URL → Google consent → Railway callback → deep link into app. Test on a physical device (simulators handle deep links differently).

**Warning signs:**
- After Google consent, user sees a "this page cannot open" error in Safari
- The app receives no `appUrlOpen` event after OAuth
- Universal Link opens in the browser instead of the app

**Phase to address:** Phase 2 (Google Drive OAuth mobile integration). This is the implementation detail that requires the most testing time.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `server.url` pointing to Railway for production | Zero refactoring, all SSR features preserved | App Store review risk under 4.2; app requires internet to function | Acceptable for v1.1 if 2+ native features are added |
| Skip `better-auth-capacitor`, patch cookies manually | Avoid a dependency | iOS cookie persistence breaks unpredictably across iOS versions; support burden high | Never for cookie-dependent auth |
| Spoof User-Agent to bypass Google's webview OAuth block | Makes OAuth work in the webview | Violates Google ToS; account/project can be suspended | Never |
| Hard-code `capacitor://localhost` in CORS allowlist without environment check | Fast to ship | Leaks mobile-only origin in production server config; negligible risk but messy | Acceptable temporarily |
| Submit to App Store with only one native feature (QR share) | Faster to ship | High rejection probability under 4.2; delays by 2-4 weeks | Never — add a second native feature |
| Test OAuth redirect only in iOS Simulator | Faster development cycle | Simulator handles deep links differently than physical devices; actual deep link may silently fail | Never for OAuth flow — test on device |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Drive OAuth on mobile | Opening `accounts.google.com` in Capacitor WebView | Open via `@capacitor/browser` (SFSafariViewController / Chrome Custom Tabs) |
| Google Drive OAuth on mobile | Registering the app's custom scheme as the Google Cloud Console redirect URI | Register your server's `/api/drive/callback` as the redirect URI; server then redirects to the custom scheme |
| Better Auth session cookies | Relying on `Set-Cookie` from cross-origin Railway server in WKWebView | Use `better-auth-capacitor` plugin; store session in native Preferences storage |
| Railway server CORS | Only allowlisting `https://` origins | Also add `capacitor://localhost` (iOS) and `http://localhost` (Android) to `trustedOrigins` |
| Deep links | Testing Universal Links only in the iOS Simulator | Must test on a physical device enrolled with your Apple Developer team |
| Apple App Site Association | Serving AASA with wrong `Content-Type` | Must be `application/json`; Railway must serve it without authentication on `/.well-known/` path |
| Xcode signing | Using "Automatically manage signing" then changing bundle ID | Set bundle ID once in `capacitor.config.ts` before opening Xcode; changing it after invalidates provisioning profiles |

---

## Performance Traps

Patterns that work in the browser but degrade in Capacitor.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading the full Railway server URL on cold start | 2–4s blank white screen while HTML/JS downloads over cellular | Consider a native loading splash or skeleton via Capacitor Splash Screen plugin | Every cold start on slow connections |
| Not configuring WKWebView cache | Full page reload on every app open (re-downloads all JS) | Set `server.allowNavigation` and ensure Railway serves aggressive Cache-Control headers for static assets | First open after backgrounding |
| Synchronous deep link handling that delays app startup | App open feels sluggish after OAuth redirect | Handle `appUrlOpen` asynchronously; do not block the main thread on token exchange | OAuth redirect cold starts |
| Large QR code image shared via native share sheet without compression | Share sheet shows raw high-res PNG, fails on AirDrop to older devices | Generate share-sheet QR at 600×600px max before calling `@capacitor/share` | Sharing to iOS 14 or older devices |

---

## Security Mistakes

Mobile-specific security issues beyond the v1.0 web security posture.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Better Auth session token in `localStorage` in the WebView | Accessible to any injected JS; XSS → session theft | Use `@capacitor/preferences` (native secure storage) for any tokens held natively |
| Leaving `server.url` pointed at `localhost:3000` in a production build | Production app talks to nothing; auth always fails | Use environment-conditional config: `server.url` only in dev builds; remove for release |
| Disabling App Transport Security (ATS) on iOS to allow HTTP | Allows downgrade attacks; likely App Store rejection | Railway is HTTPS; ATS should remain enabled |
| Allowing `allowNavigation: ['*']` in `capacitor.config.ts` | App webview can navigate to any external URL, including malicious redirects after OAuth | Restrict `allowNavigation` to your Railway domain and `accounts.google.com` callback only |
| Exposing raw Google `access_token` or `refresh_token` in the mobile app | Tokens can be extracted from app storage or memory | All Drive API calls remain server-side; mobile app only holds a Better Auth session token |

---

## UX Pitfalls

Mobile-specific user experience mistakes for the organizer app.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| White screen on cold start while Railway HTML loads | Organizer sees a blank screen for 2–4 seconds — feels broken | Configure Capacitor Splash Screen plugin to hold until the webview signals ready |
| No offline state handling | App crashes or shows network error with no explanation when organizer opens app without internet | Show a graceful "You're offline" state in the webview; cache the dashboard shell |
| OAuth flow opens system browser, user does not return to app (deep link fails) | Organizer completes Google auth but lands in Safari with no path back to the app | Deep link setup must be verified end-to-end on device before any user testing |
| Push notifications not requested at first launch | Organizers who never grant permission miss upload alerts | Request notification permission at a contextually relevant moment (first event created), with a clear explanation |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces specific to this Capacitor integration.

- [ ] **Google Drive OAuth on mobile:** Auth flow opened in system browser — verify it does NOT open inside the Capacitor WebView
- [ ] **OAuth redirect return:** After Google consent, verify the app actually receives the `appUrlOpen` event on a physical device (not Simulator)
- [ ] **Better Auth session persistence:** Close and reopen the app — verify the organizer is still logged in without re-entering credentials
- [ ] **CORS on Railway:** Verify API calls from the iOS build succeed (not just from the web browser) using Safari Web Inspector attached to device
- [ ] **App Store native features:** Confirm QR native share AND at least one additional native feature are implemented and testable by App Review
- [ ] **Xcode signing:** Provisioning profile is configured for Distribution, not just Development — verify on a non-team device
- [ ] **Android keystore:** Production keystore is generated, backed up, and used for the Play Store build — never use the debug keystore for production
- [ ] **Bundle ID set once:** `capacitor.config.ts` `appId` matches Xcode bundle identifier and Play Console app ID exactly; changing this later invalidates everything
- [ ] **AASA / Digital Asset Links served:** `/.well-known/apple-app-site-association` returns 200 from Railway without authentication
- [ ] **CSP meta tag:** Capacitor injects an inline script into `index.html` at build time — confirm CSP does not block it (add nonce or allow hash)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| App Store rejection under 4.2 | MEDIUM (1–2 weeks) | Add 1–2 additional native features; re-submit with App Review notes explaining native functionality |
| `disallowed_useragent` on Google OAuth discovered after shipping | HIGH (requires re-architecture of auth flow) | Migrate to `@capacitor/browser` + deep link callback; update GCP redirect URIs |
| Session cookies not persisting on iOS discovered post-launch | MEDIUM | Add `better-auth-capacitor` plugin; migrate session storage to native Preferences; no server changes needed |
| CORS blocking discovered in TestFlight | LOW | Add Capacitor origins to Railway CORS allowlist; deploy to Railway (no app store submission needed for server changes) |
| Android keystore lost after Play Store submission | CATASTROPHIC (app cannot be updated, must create new listing) | Back up keystore before first Play Store submission to a password manager and a separate secure location |
| Wrong bundle ID submitted to App Store | HIGH | Must create a new App ID in Apple Developer Portal; existing TestFlight builds are invalidated |
| Deep link not working — OAuth redirect strands user in browser | LOW-MEDIUM | Fix AASA file or native manifest intent filter; re-deploy Railway + re-build native app |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Google OAuth `disallowed_useragent` | Phase 1: Capacitor setup + native OAuth flow design | Test Google Drive OAuth on a physical iOS device; confirm no webview open of accounts.google.com |
| Static export breaks SSR stack | Phase 1: Architecture decision (server.url vs export) | Build succeeds with server actions intact; login works in packaged app |
| CORS rejections from Capacitor origins | Phase 1: Server CORS config update | API call from iOS build returns 200, not CORS error (verify in Safari Web Inspector) |
| HTTP-only cookies not persisting | Phase 1: Auth strategy for mobile | Close + reopen app; session intact; no re-login required |
| App Store 4.2 rejection | Phase 1: Native feature planning + Phase 3: App Store submission | App Review notes list 2+ native features; QR native share and one additional confirmed working |
| OAuth redirect URI mismatch | Phase 2: Google Drive OAuth mobile flow | Full OAuth round-trip tested on physical device; app receives `appUrlOpen` event |
| Xcode signing failures | Phase 2: iOS build setup | TestFlight build successfully installs on non-team device |
| Android keystore loss | Phase 2: Android build setup | Keystore file and credentials backed up to secure location before first Play Store upload |
| AASA / Digital Asset Links | Phase 2: Deep link setup | Apple's AASA validator confirms correct file; Universal Links open app, not browser |
| Capacitor inline script CSP conflict | Phase 2: Build configuration | Production build loads without CSP errors in browser console |
| Android Gradle / AGP version conflicts | Phase 2: Android build setup | `./gradlew assembleRelease` succeeds without errors after Capacitor install |

---

## Sources

- Google Developer Blog — OAuth embedded webview block (enforced September 2021): https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
- Google OAuth 2.0 for native apps: https://developers.google.com/identity/protocols/oauth2/native-app
- Capacitor iOS troubleshooting guide: https://capacitorjs.com/docs/ios/troubleshooting
- Capacitor Android troubleshooting guide: https://capacitorjs.com/docs/android/troubleshooting
- Capacitor security guide (CSP): https://capacitorjs.com/docs/guides/security
- Capacitor deep links guide: https://capacitorjs.com/docs/guides/deep-links
- Next.js static export limitations: https://nextjs.org/docs/app/guides/static-exports
- Next.js discussion — Server Actions in static export: https://github.com/vercel/next.js/discussions/67503
- Capacitor `server.url` in production discussion: https://github.com/ionic-team/capacitor/discussions/4080
- Apple App Store Guideline 4.2 — Minimum Functionality: https://developer.apple.com/app-store/review/guidelines/
- better-auth-capacitor plugin: https://github.com/productdevbook/better-auth-capacitor
- iOS WKWebView cookie issues (Capacitor issue tracker): https://github.com/ionic-team/capacitor/issues/1373
- Capacitor CORS and `capacitor://localhost` origin: https://ionicframework.com/docs/troubleshooting/cors
- Capacitor OAuth2 implementation guide: https://capgo.app/blog/5-steps-to-implement-oauth2-in-capacitor-apps/
- Supabase discussion — OAuth redirects in Capacitor iOS/Android/Next.js: https://github.com/orgs/supabase/discussions/11548
- Capawesome — iOS troubleshooting guide: https://capawesome.io/blog/troubleshooting-capacitor-ios-issues/
- Capawesome — Android troubleshooting guide: https://capawesome.io/blog/troubleshooting-capacitor-android-issues/
- Capawesome — AGP 9 build errors fix: https://capawesome.io/blog/how-to-fix-capacitor-plugin-build-errors-with-agp-9/

---
*Pitfalls research for: Adding Capacitor to Next.js 15 App Router (wedding-pov v1.1 mobile milestone)*
*Researched: 2026-05-17*
