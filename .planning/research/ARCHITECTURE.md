# Architecture Research — Capacitor Integration

**Domain:** Capacitor wrapper of an existing Next.js 15 App Router web app (Railway-deployed, server-rendered)
**Researched:** 2026-05-17
**Confidence:** MEDIUM-HIGH — Core Capacitor patterns HIGH; cookie SameSite behavior in WKWebView MEDIUM (platform behavior varies by iOS version); App Store approval for webview apps MEDIUM (reviewer discretion)

---

## The Core Architectural Decision: Static Export vs. Live URL

This is the highest-stakes decision in the integration and must be resolved first because everything else depends on it.

### Option A: Static Export (`output: "export"`)

Next.js generates a fully client-side bundle into an `out/` folder. Capacitor bundles those files into the app binary. All API calls go to the Railway URL over HTTPS.

**What works:**
- Standard Capacitor pattern, well-documented
- App binary contains all UI assets (faster startup, App Store compliant)
- Native plugins work correctly

**What breaks in this project:**
- Server Components become Client Components — the organizer dashboard is already SSR-heavy
- Server Actions (`"use server"`) are not supported in static export — confirmed in Next.js docs
- `auth.api.getSession({ headers })` in middleware and Server Components cannot run — there is no server
- The middleware at `src/middleware.ts` cannot execute
- Drive OAuth callback (`/api/drive/callback`) is a Route Handler with DB writes — it must run server-side

**Verdict for this project: Static export is not viable without a major rewrite.** The organizer dashboard relies on Server Components, Server Actions, middleware-based auth, and server-side OAuth callback handlers. Converting all of these to client-side fetch would be a substantial rewrite of the existing architecture.

### Option B: Live URL (`server.url` in capacitor.config.ts pointing to Railway)

The Capacitor webview loads `https://your-app.railway.app` on every launch. All server-side functionality is preserved as-is.

**What works:**
- Zero architectural changes to the Next.js app
- Middleware, Server Components, Server Actions, cookies — all work unchanged
- OAuth callbacks land on the Railway server as normal web requests
- Instant iteration: deploy to Railway, update is live without an app binary push

**The risks:**
- Requires active internet connection on every launch (no offline capability)
- Section 4.7 of App Store Review Guidelines applies to apps loading remote content; reviewers have cited this for rejection in the past
- server.url is documented as a development tool; Ionic explicitly warns against production use
- The app is essentially a mobile browser pointed at your Railway URL — any significant UI change post-review bypasses Apple's review (which is exactly why Apple is cautious)

**App Store compliance reality (MEDIUM confidence):** Multiple Capacitor apps using server.url have shipped to App Store, but rejections have occurred. The determining factor is typically whether the app provides native functionality beyond just loading a URL. Apps with native plugins (Share, Camera, Push Notifications, etc.) are more likely to pass. A pure webview shell with no native features is the most likely rejection scenario.

### Recommended Architecture: Hybrid

**Ship with static export for the UI shell, call Railway API endpoints from the mobile client.**

This is the architecturally correct answer and avoids both sets of problems:

1. The organizer dashboard UI is refactored as a thin client-side React SPA (Client Components, no Server Components or Server Actions)
2. All business logic stays on Railway as API Route Handlers (`/api/*`)
3. Auth session management shifts from middleware + Server Component session reads to client-side Better Auth session calls
4. Capacitor bundles the `out/` static build — fully App Store compliant, works offline for cached pages

**What must change in Next.js:**

| Current | Change Required | Effort |
|---------|----------------|--------|
| `src/middleware.ts` redirecting unauthenticated requests | Client-side redirect after `authClient.getSession()` check | Low |
| Dashboard Server Components reading session via `auth.api.getSession()` | Client Components calling `authClient.getSession()` | Medium |
| Server Actions for event mutations | `fetch('/api/events', { method: 'POST' })` from client | Medium |
| `next.config.ts` with `X-Frame-Options: DENY` header | Remove or scope this header | Low |
| `BETTER_AUTH_URL` trusted origins | Add Capacitor origin to trustedOrigins | Low |

**What does NOT change:**
- All `/api/*` Route Handlers on Railway — unchanged, they already work as HTTP endpoints
- Google Drive OAuth flow — unchanged (handled entirely server-side)
- Better Auth session cookies — works correctly when called from the mobile webview making requests to Railway
- Guest upload pages (`/e/[slug]`) — excluded from mobile app entirely; web-only

---

## System Architecture: Capacitor Integration

```
┌─────────────────────────────────────────────────────────────────────┐
│                      MOBILE NATIVE LAYER                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Capacitor Shell (iOS / Android)             │   │
│  │                                                               │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │              WKWebView / Android WebView                 │ │   │
│  │  │                                                          │ │   │
│  │  │   Static HTML/JS/CSS bundle (out/ from next build)      │ │   │
│  │  │   Client-side React SPA                                  │ │   │
│  │  │   Better Auth client → fetch to Railway                  │ │   │
│  │  │   Event API calls → fetch to Railway                     │ │   │
│  │  │                                                          │ │   │
│  │  └──────────────────────────┬───────────────────────────────┘ │   │
│  │                             │                                  │   │
│  │  ┌──────────────────────────▼───────────────────────────────┐ │   │
│  │  │              Capacitor Plugin Bridge                     │ │   │
│  │  │                                                          │ │   │
│  │  │  @capacitor/share    → Native share sheet (QR codes)    │ │   │
│  │  │  @capacitor/browser  → System browser (OAuth)           │ │   │
│  │  │  @capacitor/app      → appUrlOpen events (deep links)   │ │   │
│  │  └──────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                          HTTPS to Railway
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                    RAILWAY DEPLOYMENT (unchanged)                    │
│                                                                      │
│   Next.js 15 App Router server                                      │
│                                                                      │
│   /api/auth/[...all]     ← Better Auth (sessions, login, signup)    │
│   /api/drive/connect     ← Initiates Google OAuth                   │
│   /api/drive/callback    ← Receives Google OAuth code               │
│   /api/drive/disconnect  ← Removes Drive connection                 │
│   /api/events/*          ← Event CRUD                               │
│   /api/upload/[slug]     ← Guest upload initiation (web-only)       │
│   /e/[slug]              ← Guest upload page (web-only, excluded    │
│                             from mobile app routes)                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
┌─────────────────────────┐        ┌────────────────────────────┐
│   Neon PostgreSQL        │        │   Google Drive API          │
│   (unchanged)            │        │   (unchanged)               │
└─────────────────────────┘        └────────────────────────────┘
```

---

## Authentication: Better Auth Cookies in Capacitor WebView

### How cookies behave in a Capacitor webview

The WebView in a Capacitor app uses WKWebView (iOS) and Android WebView, each maintaining cookie storage isolated from the system browser (Safari/Chrome). When the static webview makes `fetch` requests to `https://your-app.railway.app` with `credentials: "include"`, the browser sends and receives cookies scoped to the Railway domain.

**The critical constraint:** The webview origin is `capacitor://localhost` (iOS default) or `https://localhost` (Android default). Any fetch to `https://your-app.railway.app` is cross-origin. For Better Auth's session cookies to work:

1. The cookie must have `SameSite=None; Secure` to be sent on cross-origin requests from the webview
2. The Railway server must return `Access-Control-Allow-Origin: https://localhost` (or use a wildcard, with care) and `Access-Control-Allow-Credentials: true`
3. Better Auth's `trustedOrigins` must include `capacitor://localhost` and `https://localhost`

**iOS 14+ WKWebView ITP (Intelligent Tracking Prevention):** Apple's WebKit ITP can block third-party cookies. Because the webview origin (`capacitor://localhost`) differs from the cookie domain (`railway.app`), these are treated as cross-site. This means the cookie approach is unreliable on iOS without additional configuration.

**Mitigation for iOS:** Configure `WKAppBoundDomains` in `Info.plist` to declare `your-app.railway.app` as an app-bound domain. This relaxes ITP restrictions for declared domains.

**Alternative approach — Bearer token in localStorage:** Instead of relying on session cookies, the mobile app stores the session token in `localStorage` after login and includes it as an `Authorization: Bearer <token>` header on all requests. Better Auth supports both cookie and token-based sessions. This completely bypasses the cross-origin cookie problem and is the recommended approach for Capacitor.

Better Auth's client SDK (`authClient`) handles this when configured with `fetchOptions: { credentials: "include" }` for web, or can be switched to token mode for mobile detection.

### Detecting mobile context

```typescript
// In auth-client.ts — detect Capacitor environment
import { Capacitor } from "@capacitor/core";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
  fetchOptions: Capacitor.isNativePlatform()
    ? {} // token-based; no credentials: include
    : { credentials: "include" },
});
```

Session token storage on mobile: Better Auth will store the session token in `localStorage` when not using cookies. On native, prefer using `@capacitor/preferences` for secure persistent storage across app restarts.

---

## Google Drive OAuth: Redirect Flow in Mobile Webview

### The problem

The existing flow is a server-side redirect chain:

```
Dashboard → GET /api/drive/connect → 302 → accounts.google.com
accounts.google.com → 302 → https://your-app.railway.app/api/drive/callback
/api/drive/callback → stores tokens in DB → 302 → /dashboard?drive=connected
```

**This flow does not work as a simple webview navigation** because:
1. The in-app webview navigating to `accounts.google.com` violates Google's OAuth policy — Google explicitly blocks OAuth flows inside embedded webviews (UIWebView/WKWebView) as of 2019
2. The redirect back to `https://your-app.railway.app/api/drive/callback` would load inside the webview, not return the user to the app with a success signal
3. Google requires OAuth to happen in the system browser for mobile apps

### The solution: Capacitor Browser plugin + server callback

The correct mobile OAuth pattern for server-side OAuth (where the token exchange happens on your server, not in the mobile app) is:

```
1. User taps "Connect Google Drive" in app
2. App calls Capacitor.Browser.open({ url: "https://your-app.railway.app/api/drive/connect" })
   → Opens SFSafariViewController (iOS) / Chrome Custom Tab (Android)
   → System browser navigates through Google OAuth consent
3. Google redirects to https://your-app.railway.app/api/drive/callback
   → Server exchanges code, stores tokens — unchanged
   → Server redirects to https://your-app.railway.app/dashboard?drive=connected
4. The final redirect URL is detected by the Browser plugin
   → App listens for browserFinished event OR detects URL change
   → Browser.close() is called to dismiss the system browser
5. App navigates to dashboard and fetches updated drive connection status
```

**Why this works:** The system browser (SFSafariViewController) is not an embedded webview — it is the system browser that Google permits for OAuth. The token exchange happens entirely server-side, so no native SDK integration is needed. The `/api/drive/callback` redirect URI registered in Google Cloud Console remains `https://your-app.railway.app/api/drive/callback` — no custom URL scheme needed for this flow because the callback lands on your server, not in the app.

**The detection mechanism:** The app detects when the OAuth flow completes by checking the URL that the Browser navigates to. When the system browser reaches `/dashboard?drive=connected` or `/dashboard?drive=error`, the app knows the flow is done:

```typescript
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";

async function connectDrive() {
  await Browser.open({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/drive/connect`,
    presentationStyle: "popover", // iOS: keeps app visible behind it
  });

  // Listen for the browser to finish
  Browser.addListener("browserFinished", async () => {
    // Re-fetch drive connection status from API
    await refreshDriveStatus();
  });
}
```

**Note on Browser.close():** `Browser.close()` only works on iOS and Web. On Android, the Chrome Custom Tab closes automatically when it navigates to a URL that the Android system does not know how to handle, or when the user presses back. For this flow, the system browser stays open until the user dismisses it manually or the app detects the callback. Adding a "Return to app" link on the `/dashboard?drive=connected` page that the user taps is a reliable cross-platform UX pattern.

**No changes needed to `/api/drive/connect` or `/api/drive/callback`** — these routes are unchanged. The only change is how the mobile app initiates the flow (Browser.open instead of `window.location.href`).

---

## Next.js Changes Required

### 1. `next.config.ts` — Remove blocking headers for mobile

The current `X-Frame-Options: DENY` header blocks the page from being loaded in any frame or webview. For the static export approach (where assets are local), this header is moot. For any server-rendered pages that the webview might load (e.g., the callback redirect landing page), this header must not block the webview.

```typescript
// next.config.ts — updated headers
async headers() {
  return [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        // REMOVED: X-Frame-Options: DENY — blocks webview
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        // ADD for mobile webview cross-origin requests:
        { key: "Access-Control-Allow-Origin", value: "capacitor://localhost" },
        { key: "Access-Control-Allow-Credentials", value: "true" },
      ],
    },
  ];
},
```

**Caution:** `Access-Control-Allow-Credentials: true` with a wildcard origin is rejected by browsers. The origin must be explicit. For a production app with both web and mobile clients, use a function to set the origin header dynamically based on the request's `Origin` header.

### 2. `src/lib/auth.ts` — Add mobile origins to trustedOrigins

```typescript
export const auth = betterAuth({
  // ...existing config...
  trustedOrigins: [
    process.env.BETTER_AUTH_URL!,
    process.env.NEXT_PUBLIC_APP_URL!,
    "capacitor://localhost",   // iOS Capacitor origin
    "https://localhost",       // Android Capacitor origin
  ].filter(Boolean),
});
```

### 3. `src/middleware.ts` — Scope away from API routes for mobile

The current middleware redirects unauthenticated requests to `/login`. For the static export approach, middleware does not run (no server). However, the server's `/api/*` routes still run middleware if the matcher includes them. Ensure the matcher excludes API routes so mobile fetch calls are not redirected to an HTML login page:

```typescript
export const config = {
  matcher: ["/dashboard/:path*"],
  // API routes are NOT matched — they handle auth internally
};
```

The existing matcher is already correct. No change required here.

### 4. `next.config.ts` — Add static export mode (mobile build only)

The `output: "export"` setting must only apply to mobile builds, not the Railway deployment. Use a separate next config or environment variable:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  output: process.env.CAPACITOR_BUILD === "true" ? "export" : undefined,
  images: {
    unoptimized: process.env.CAPACITOR_BUILD === "true",
  },
  // ...rest of config
};
```

Then in `package.json`:
```json
{
  "scripts": {
    "build": "next build",
    "build:mobile": "CAPACITOR_BUILD=true next build",
    "mobile": "npm run build:mobile && npx cap sync"
  }
}
```

---

## Build Order

The build pipeline is strictly ordered by dependencies:

```
1. npm run build:mobile
   ↓ Next.js static export
   ↓ Outputs: out/ directory with HTML/JS/CSS

2. npx cap sync
   ↓ Copies out/ to ios/App/App/public/ and android/app/src/main/assets/public/
   ↓ Updates Capacitor native dependencies

3a. iOS path:
   npx cap open ios
   ↓ Opens Xcode
   ↓ Select signing team, bundle ID (com.weddingpov.app)
   ↓ Product → Archive → Distribute to App Store Connect

3b. Android path:
   npx cap open android
   ↓ Opens Android Studio
   ↓ Build → Generate Signed Bundle/APK
   ↓ Upload to Google Play Console
```

**Development iteration cycle:**
```
Edit code → npm run build:mobile → npx cap sync → npx cap run ios
```

**Key commands:**
- `npx cap sync` = copy web assets + update native deps (use this after any web change)
- `npx cap copy` = copy web assets only (faster, skips dep update)
- `npx cap run ios` = build and run on device/simulator
- `npx cap open ios` = open Xcode for manual build/archive

---

## App Store and Play Store Architectural Requirements

### iOS — App Transport Security (ATS)

All HTTPS connections from the app to Railway must use TLS 1.2+, which Railway (via standard SSL) provides. No ATS exceptions are needed because the Railway URL is HTTPS. Do not add `NSAllowsArbitraryLoads: true` — it will be rejected.

The only domain the app contacts externally is `your-app.railway.app`. All other network activity goes through Google OAuth in the system browser (not subject to ATS in the same way).

**Info.plist additions required:**
```xml
<!-- Required for WKWebView cookie handling on iOS 14+ -->
<key>WKAppBoundDomains</key>
<array>
  <string>your-app.railway.app</string>
</array>
```

### iOS — App Review Guideline 4.2 (Minimum Functionality)

A webview shell that only loads a website is at high rejection risk. To pass review, the app must demonstrate native functionality that is distinct from opening the URL in Safari:

**Required native features for approval:**
- Native share sheet for QR codes (`@capacitor/share`) — this is already a milestone requirement and is the primary native differentiator
- Branded launch screen / splash screen
- App icon (not the web favicon)

**Helpful but not required:**
- Offline fallback screen (shows branded error instead of browser's "no connection" page)
- Custom navigation behavior (e.g., hardware back button handling on Android)

**Explicit rejection triggers to avoid:**
- Browser-style navigation bars or URL bars showing in the UI
- Generic "You are offline" messages (the browser default)
- No use of any native APIs whatsoever

### Google Play Store — Policy Compliance

Google Play is significantly more permissive than Apple for webview apps. The main requirement is that the app provides value beyond mobile web browsing. The native share sheet and the focused organizer use-case (not a generic website wrapper) are sufficient for approval.

**AndroidManifest.xml — required for network access:**
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

**Minimum SDK version:** Capacitor 6+ requires minSdkVersion 23 (Android 6.0). This covers 99%+ of active Android devices.

### Google Cloud Console — OAuth Credential Requirements

The existing Web Application credential (used by Railway's `/api/drive/connect` flow) continues to work for the mobile app because the OAuth flow opens in the system browser and the redirect lands on the Railway server — not in the app. No additional OAuth client IDs need to be registered.

**Verify in Google Cloud Console:**
- The authorized redirect URI `https://your-app.railway.app/api/drive/callback` is registered
- No custom scheme redirect URIs are needed (the callback goes server-to-server)

---

## Integration Points

### New Components (Capacitor-only)

| Component | Purpose | Plugin |
|-----------|---------|--------|
| `capacitor.config.ts` | Capacitor configuration (webDir, appId, scheme) | core |
| `ios/` directory | Xcode project (generated by `cap add ios`) | core |
| `android/` directory | Android Studio project (generated by `cap add android`) | core |
| Native share integration | Share QR code PNG via system share sheet | `@capacitor/share` |
| OAuth browser opener | Open `/api/drive/connect` in system browser | `@capacitor/browser` |
| Platform detection | Route around cookie issues, detect native context | `@capacitor/core` |

### Modified Components

| Component | What Changes | Why |
|-----------|-------------|-----|
| `src/lib/auth.ts` | Add `capacitor://localhost` and `https://localhost` to `trustedOrigins` | Mobile webview cross-origin auth |
| `next.config.ts` | Remove `X-Frame-Options: DENY`; add mobile CORS headers; add `CAPACITOR_BUILD` flag | Mobile webview compatibility |
| `src/lib/auth-client.ts` | Detect native platform, adjust fetch options or session strategy | Cross-origin cookie handling |
| Dashboard `<a href="/api/drive/connect">` | Replace with `Browser.open()` call in mobile context | Google OAuth policy requires system browser |
| `package.json` | Add `build:mobile` and `mobile` scripts | Build pipeline |

### Unchanged Components

| Component | Why Unchanged |
|-----------|--------------|
| All `/api/*` Route Handlers | They are HTTP endpoints; mobile client calls them the same as web client |
| `/api/drive/connect` and `/api/drive/callback` | OAuth server-side flow is unchanged; only the initiating client differs |
| Neon PostgreSQL / Drizzle schema | No schema changes needed |
| Guest upload pages (`/e/[slug]`) | Excluded from mobile app; web-only |
| Better Auth session management on server | Server-side session logic is unchanged |

---

## Data Flow: Drive OAuth from Mobile

```
Organizer taps "Connect Google Drive" in mobile app
    ↓
Browser.open({ url: "https://railway-app/api/drive/connect" })
    ↓
System browser (SFSafariViewController / Chrome Custom Tab) opens
    ↓
/api/drive/connect: unchanged — generates authUrl, returns 302 to Google
    ↓
User completes Google OAuth consent in system browser
    ↓
Google 302 → https://railway-app/api/drive/callback?code=...&state=...
    ↓
/api/drive/callback: unchanged — exchanges code, stores tokens, 302 → /dashboard?drive=connected
    ↓
System browser shows /dashboard?drive=connected (the Railway-deployed server-rendered page)
    ↓
User taps "Return to app" link OR dismisses the browser manually
    ↓
App's browserFinished listener fires → app re-fetches drive status → shows "Drive connected"
```

**Key insight:** The mobile app never sees the OAuth code or tokens. The entire exchange happens between the system browser, Google's servers, and the Railway server. This is architecturally cleaner than native SDK approaches and requires no changes to the existing backend.

---

## Data Flow: Authentication from Mobile

```
User enters email + password in the mobile app (Client Component)
    ↓
authClient.signIn.email({ email, password })  [from better-auth/client]
    ↓
fetch POST https://railway-app/api/auth/sign-in/email { credentials: "include" }
    ↓
Server validates credentials, creates session, sets Set-Cookie header
    ↓
[On web]: Cookie stored in browser, sent automatically on future requests
[On mobile]: Cookie may not persist cross-origin due to WKWebView ITP
    ↓
[Mobile mitigation]: Extract session token from response, store in @capacitor/preferences
    ↓
Future API calls include Authorization: Bearer <token> header
```

---

## Anti-Patterns

### Anti-Pattern 1: Using `server.url` pointing to Railway in production

**What people do:** Set `server.url: "https://your-app.railway.app"` in `capacitor.config.ts` for production builds.

**Why it's wrong:** Violates App Store Review Guidelines section 4.7 (remote web content in native apps). Multiple developers have reported rejections. The app is a shell with no bundled assets — any post-review update to the Railway app bypasses Apple's review, which is exactly what Apple is preventing.

**Do this instead:** Static export with API calls to Railway. The UI logic is in the bundle, the data layer is on Railway.

### Anti-Pattern 2: Triggering Google Drive OAuth inside the main webview

**What people do:** Navigate the app's webview to `/api/drive/connect` using `window.location.href` or `router.push`.

**Why it's wrong:** Google explicitly blocks OAuth in embedded webviews. The authorization page will show an error ("403: disallowed_useragent") because Google detects the WKWebView user agent.

**Do this instead:** Use `@capacitor/browser` to open the OAuth URL in SFSafariViewController / Chrome Custom Tab. This is the system browser and Google permits it.

### Anti-Pattern 3: Relying on HTTP-only session cookies without cross-origin configuration

**What people do:** Assume the Capacitor webview handles cookies the same way a desktop browser does.

**Why it's wrong:** The webview origin (`capacitor://localhost`) is cross-origin from `your-app.railway.app`. WKWebView ITP (iOS 14+) blocks third-party cookies. Sessions appear to work in dev (on a simulator where ITP may not be enforced) but break on real devices.

**Do this instead:** Either configure `WKAppBoundDomains` in Info.plist and `SameSite=None; Secure` on cookies, OR switch to Bearer token auth for the mobile client.

### Anti-Pattern 4: Shipping a webview app with zero native features

**What people do:** Build the Capacitor wrapper with no native plugins, submit to App Store.

**Why it's wrong:** Apple's Guideline 4.2 rejects apps that provide no functionality beyond a mobile website. A reviewer opening the app and seeing that it's identical to visiting the URL in Safari will likely reject it.

**Do this instead:** Ensure at least one meaningful native feature is present and prominent — for this app, the native share sheet for QR codes is the primary native differentiator and must be implemented before submission.

---

## Capacitor Configuration

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.weddingpov.app",
  appName: "Wedding POV",
  webDir: "out", // Next.js static export output directory
  server: {
    // androidScheme defaults to "https" — keep it
    // DO NOT set server.url for production builds
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    // Enable native cookie handling if using cookie-based auth
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single organizer, v1.1 | Current approach — static export + Railway API calls — is correct |
| Multiple organizers using the mobile app | No changes needed; auth is per-organizer, Drive tokens are per-organizer |
| OTA (over-the-air) updates to app UI | Capacitor Live Update (Capgo or Appflow) allows pushing web bundle updates without App Store resubmission — but requires careful compliance with Apple's guidelines |

---

## Sources

- Capacitor static export requirement: [capgo.app Next.js + Capacitor guide](https://capgo.app/blog/building-a-native-mobile-app-with-nextjs-and-capacitor/) (MEDIUM — third-party, consistent with official docs)
- Capacitor `server.url` production concerns: [ionic-team/capacitor Discussion #5075](https://github.com/ionic-team/capacitor/discussions/5075) (HIGH — Ionic team GitHub discussion)
- Next.js static export Server Actions limitation: [Next.js docs](https://nextjs.org/docs/app/guides/static-exports) (HIGH — official)
- Capacitor Browser plugin (SFSafariViewController): [capacitorjs.com/docs/apis/browser](https://capacitorjs.com/docs/apis/browser) (HIGH — official)
- Google OAuth embedded webview restriction: [developers.google.com OAuth2 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app) (HIGH — official)
- iOS WKWebView ITP cookie blocking: [webkit.org bug #213510](https://bugs.webkit.org/show_bug.cgi?id=213510) and [thinktecture.com](https://www.thinktecture.com/en/ios/wkwebview-itp-ios-14/) (HIGH — platform bug report)
- App Store Guideline 4.2 for webview apps: [mobiloud.com analysis](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper) (MEDIUM — third-party analysis of Apple guidelines)
- Better Auth trustedOrigins: [better-auth.com/docs/reference/security](https://better-auth.com/docs/reference/security) (HIGH — official)
- Capacitor configuration: [capacitorjs.com/docs/config](https://capacitorjs.com/docs/config) (HIGH — official)
- Capacitor build workflow: [capacitorjs.com/docs/basics/workflow](https://capacitorjs.com/docs/basics/workflow) (HIGH — official)

---

*Architecture research for: Capacitor integration with Next.js 15 App Router on Railway*
*Researched: 2026-05-17*
