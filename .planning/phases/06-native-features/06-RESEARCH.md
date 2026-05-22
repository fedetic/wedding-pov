# Phase 6: Native Features - Research

**Researched:** 2026-05-22
**Domain:** Capacitor 8 native plugins — share sheet, biometric auth, Universal Links / App Links, offline detection
**Confidence:** HIGH (official Capacitor docs and npm registry verified for all core APIs; biometric plugin selection confirmed via npm existence check)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Share button lives inside `QRModal.tsx`, alongside Download button (not on EventRow)
- Share content: QR PNG image + guest URL text — both together
- Share button only renders when `Capacitor.isNativePlatform()` is true
- `QRModal.tsx` already generates the QR as a `dataUrl` (PNG) — share action converts to file for native share sheet
- New `/settings` route in organizer dashboard with biometric enable/disable toggle
- Settings page is always reachable from dashboard (not native-only), but toggle only renders on native
- Lock granularity: app quit / cold launch only — biometric prompt on next cold open after toggle is enabled
- Fallback: if biometrics hardware unavailable, fall back to email/password silently — no error shown
- After 3 consecutive biometric failures, show "Use password instead" — does not auto-logout
- Pattern intercepted for deep links: `weddingpov.app/e/[slug]` (guest upload URL)
- When app installed and link opened: app launches, navigates to dashboard home
- Not logged in: shows login screen; after login, lands on dashboard home (no event-specific routing)
- Requires serving `apple-app-site-association` from Railway at `/.well-known/apple-app-site-association`
- Requires serving `assetlinks.json` from Railway at `/.well-known/assetlinks.json`
- Deep link handling additive to existing `appUrlOpen` listener in `ConnectDriveButton.tsx`
- Show fullscreen offline overlay when `@capacitor/network` reports no connectivity
- `@capacitor/network` is already installed
- Retry button checks connectivity and reloads the WebView
- Reactive: overlay appears whenever connectivity is lost
- Overlay sits above the WebView — does not navigate away

### Claude's Discretion
- Exact biometric plugin — `@capacitor-community/biometric-auth` is the likely choice; researcher to confirm best Capacitor 8 compatible option
- Offline overlay design (copy, icon, colors) — already specified in 06-UI-SPEC.md
- Settings page design — already specified in 06-UI-SPEC.md
- How to convert the QR `dataUrl` to a shareable file — Filesystem plugin or Blob URL; researcher to identify cleanest approach for `@capacitor/share`

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NATIVE-01 | Organizer can share event QR code PNG via native OS share sheet (Messages, AirDrop, WhatsApp, email, etc.) | `@capacitor/share` + `@capacitor/filesystem` pattern: write dataUrl to Cache, get URI, call `Share.share({ files: [uri] })` |
| NATIVE-02 | Organizer can enable Face ID / Touch ID to unlock app on subsequent opens (falls back to email/password if biometrics unavailable) | `@aparajita/capacitor-biometric-auth` v10 — Capacitor 8 compatible, slopcheck [OK], `checkBiometry()` + `authenticate()` API |
| NATIVE-03 | Opening a `weddingpov.app/e/[slug]` link on device with app installed opens native app directly (Universal Links / App Links) | AASA + entitlements for iOS; assetlinks.json + `android:autoVerify` intent filter for Android; `appUrlOpen` listener already in AppDelegate.swift |
| NATIVE-04 | Native app shows clear offline error screen with retry button when no internet connection | `@capacitor/network` already installed; `Network.addListener('networkStatusChange', ...)` + `Network.getStatus()` on mount |
</phase_requirements>

---

## Summary

Phase 6 adds four native capabilities to the existing Capacitor 8 shell. The foundation from Phase 5 (server.url → Railway, `@capacitor/app` `appUrlOpen` listener, `Capacitor.isNativePlatform()` pattern) is solid and directly reused.

**NATIVE-01 (QR Share):** `@capacitor/share` is already listed as a dependency in STACK.md but is not yet installed in `package.json`. The share sheet requires a `file://` URI — not a `data:` URL. The pattern is: write the base64-stripped PNG to `@capacitor/filesystem` (Directory.Cache), retrieve the URI, pass it to `Share.share({ files: [uri], text: guestUrl })`. `@capacitor/filesystem` also needs to be added.

**NATIVE-02 (Biometric):** The original CONTEXT.md named `@capacitor-community/biometric-auth` but that package does not exist on npm (404). The correct package is `@aparajita/capacitor-biometric-auth` v10 — confirmed on npm (slopcheck [OK]), Capacitor 8+ required, 224 stars, 49 releases, well-maintained. iOS requires adding `NSFaceIDUsageDescription` to `Info.plist`.

**NATIVE-03 (Deep Links):** `AppDelegate.swift` already has the `continue userActivity` handler that Capacitor needs for Universal Links. The missing pieces are: (a) Associated Domains entitlement in Xcode (`applinks:weddingpov.app` and `applinks:pov.jjwedding.nl`), (b) AASA file served at `/.well-known/apple-app-site-association` from Railway via a Next.js Route Handler, (c) `assetlinks.json` served at `/.well-known/assetlinks.json`, (d) Android intent filter with `android:autoVerify="true"`. The `appUrlOpen` JavaScript listener extends the existing pattern in `ConnectDriveButton.tsx`.

**NATIVE-04 (Offline):** `@capacitor/network` is already installed. The pattern is a single top-level React component using `Network.getStatus()` on mount and `Network.addListener('networkStatusChange', ...)` for reactive updates. The overlay must be in a client component at layout level.

**Primary recommendation:** Add `@capacitor/share`, `@capacitor/filesystem`, and `@aparajita/capacitor-biometric-auth` to `package.json`; implement each feature as a self-contained client component; keep all native-conditional logic behind `Capacitor.isNativePlatform()`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| QR Share Sheet (NATIVE-01) | Browser / Client | — | `@capacitor/share` is a client-side Capacitor plugin; the QR `dataUrl` is already in client state in `QRModal.tsx`; no server involvement |
| Biometric Unlock (NATIVE-02) | Browser / Client | — | `@aparajita/capacitor-biometric-auth` is a client-side native plugin; session check via `@capacitor/preferences` (native storage); no server call needed for the lock gate |
| Deep Link URL Association (NATIVE-03) | API / Backend | Browser / Client | Railway (Next.js) must serve AASA and assetlinks.json files; the JS `appUrlOpen` listener handles routing client-side |
| Offline Detection (NATIVE-04) | Browser / Client | — | `@capacitor/network` is a client-side plugin; the overlay is a React client component; no server involvement |
| Biometric preference persistence | Browser / Client | — | `@capacitor/preferences` (already installed) stores the boolean natively — not in a server DB |

---

## Standard Stack

### New packages to install

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@capacitor/share` | `^8.0.1` | Native OS share sheet | Official Capacitor plugin; triggers iOS/Android share sheet with file + text; slopcheck [OK] |
| `@capacitor/filesystem` | `^8.1.2` | Write QR PNG to device cache | Required to convert base64 dataUrl to a `file://` URI for `@capacitor/share`; official plugin; slopcheck [OK] |
| `@aparajita/capacitor-biometric-auth` | `^10.0.0` | Face ID / Touch ID authentication | Community plugin, Capacitor 8+ required, 224 stars, 49 releases, slopcheck [OK]; the original `@capacitor-community/biometric-auth` does NOT exist on npm |

### Already installed (no action needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `@capacitor/network` | `^8.0.1` | Offline detection — already in `package.json` |
| `@capacitor/preferences` | `^8.0.1` | Persist biometric toggle state natively — already installed |
| `@capacitor/app` | `^8.1.0` | `appUrlOpen` listener for deep links — already installed and used |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@aparajita/capacitor-biometric-auth` | `@capgo/capacitor-native-biometric` | `@capgo` exists (slopcheck [OK]) but stores credentials (username/password) — this app doesn't need credential storage, only a lock gate; `@aparajita` has cleaner API for presence-only biometric prompts |
| Route Handler for AASA | `public/.well-known/` static files | Static files in `public/` work, but Next.js App Router docs recommend metadata files go in `app/` not `public/`; Route Handler gives explicit `Content-Type: application/json` control, preventing download behavior [CITED: Next.js local docs public-folder.md] |

**Installation:**
```bash
npm install @capacitor/share @capacitor/filesystem @aparajita/capacitor-biometric-auth
npx cap sync
```

**Version verification (run at plan time):**
```bash
npm view @capacitor/share version          # expected: 8.0.1
npm view @capacitor/filesystem version     # expected: 8.1.2
npm view @aparajita/capacitor-biometric-auth version  # expected: 10.0.0
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@capacitor/share` | npm | ~5 yrs | High (official Ionic plugin) | github.com/ionic-team/capacitor-plugins | [OK] | Approved |
| `@capacitor/filesystem` | npm | ~5 yrs | High (official Ionic plugin) | github.com/ionic-team/capacitor-plugins | [OK] | Approved |
| `@aparajita/capacitor-biometric-auth` | npm | ~3 yrs | Medium (community) | github.com/aparajita/capacitor-biometric-auth | [OK] | Approved |
| `@capgo/capacitor-native-biometric` | npm | ~2 yrs | Medium (community) | github.com/Cap-go/capacitor-native-biometric | [OK] | Not used — `@aparajita` preferred |
| `@capacitor-community/biometric-auth` | npm | — | — | — | [SLOP] (404 on npm) | REMOVED — does not exist |

**Packages removed due to [SLOP] / non-existence:** `@capacitor-community/biometric-auth` — 404 on npm registry; do not install.
**Packages flagged as suspicious [SUS]:** None.

---

## Architecture Patterns

### System Architecture Diagram

```
Cold Launch (biometric enabled)
  ↓
AppDelegate.swift (Universal Link entry? → appUrlOpen)
  ↓
React App mounts
  ├── OfflineOverlay (layout level)
  │     └── Network.getStatus() → if offline, show overlay
  │           └── Network.addListener('networkStatusChange') → reactive
  └── BiometricLockScreen (layout level, native-only)
        └── BiometricAuth.checkBiometry() → isAvailable?
              ├── YES → BiometricAuth.authenticate() → unlock → show dashboard
              └── NO → fall through to existing auth middleware (login page)

QR Share Flow
  QRModal.tsx (organizer taps Share)
  ↓
  Filesystem.writeFile({ path: 'qr-{slug}.png', data: base64, directory: Cache })
  ↓
  Filesystem.getUri({ path: 'qr-{slug}.png', directory: Cache })
  ↓
  Share.share({ files: [result.uri], text: guestUrl })
  ↓
  OS share sheet appears (Messages, AirDrop, WhatsApp, etc.)

Deep Link Entry
  User taps weddingpov.app/e/[slug] on device with app installed
  ↓
  iOS: AASA verified → app opens → AppDelegate continues userActivity → Capacitor fires appUrlOpen
  Android: autoVerify → intent resolves to app → app opens → Capacitor fires appUrlOpen
  ↓
  App.addListener('appUrlOpen', handler) in a layout-level client component
  ↓
  Navigate to /dashboard (already logged in) or /login (not logged in → middleware handles)

Railway Server (well-known files)
  GET /.well-known/apple-app-site-association → Route Handler returns JSON (Content-Type: application/json)
  GET /.well-known/assetlinks.json → Route Handler returns JSON (Content-Type: application/json)
```

### Recommended Project Structure

```
src/
├── app/
│   ├── .well-known/
│   │   ├── apple-app-site-association/
│   │   │   └── route.ts             # Serves AASA JSON with Content-Type: application/json
│   │   └── assetlinks.json/
│   │       └── route.ts             # Serves assetlinks JSON with Content-Type: application/json
│   ├── (organizer)/
│   │   └── dashboard/
│   │       └── settings/
│   │           └── page.tsx         # Settings page with biometric toggle
│   └── layout.tsx                   # Mount OfflineOverlay + DeepLinkHandler here
├── components/
│   ├── events/
│   │   └── QRModal.tsx              # Add Share button (native-only)
│   └── native/
│       ├── OfflineOverlay.tsx       # Network listener + fullscreen overlay
│       ├── BiometricLockScreen.tsx  # Lock gate on cold open
│       └── DeepLinkHandler.tsx      # appUrlOpen listener for Universal Links
ios/
└── App/
    └── App/
        ├── Info.plist               # Add NSFaceIDUsageDescription
        └── App.entitlements         # Add Associated Domains (applinks:weddingpov.app)
android/
└── app/
    └── src/main/
        └── AndroidManifest.xml      # Add autoVerify intent filter for https://weddingpov.app
public/
  (no changes needed — well-known served via Route Handlers)
```

### Pattern 1: QR Share — dataUrl to file:// to share sheet

**What:** Convert the in-memory base64 PNG to a temporary file, get its native URI, pass to share sheet.
**When to use:** Any time sharing a blob/dataUrl via native share sheet.

```typescript
// Source: Capacitor Filesystem docs (capacitorjs.com/docs/apis/filesystem)
//         + Capacitor Share docs (capacitorjs.com/docs/apis/share)
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

async function handleShare(dataUrl: string, guestUrl: string, slug: string) {
  // dataUrl format: "data:image/png;base64,iVBORw0KGgo..."
  // Strip the data: prefix — Filesystem expects raw base64
  const base64 = dataUrl.split(',')[1];

  const fileName = `qr-${slug}.png`;

  await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
    // No encoding param → Filesystem treats data as binary base64
  });

  const { uri } = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });

  await Share.share({
    files: [uri],
    text: guestUrl,
    dialogTitle: 'Share QR code', // Android only
  });
}
```

**Critical note:** Do NOT pass `dataUrl` directly to `Share.share({ url: dataUrl })` — the share plugin only accepts `file://` URIs, not `data:` URLs. [VERIFIED: npm registry + official Capacitor docs]

### Pattern 2: Biometric Lock Gate

**What:** On cold open, check if biometrics are enabled (from Preferences) and available (from plugin), then prompt. After 3 failures, show fallback.
**When to use:** Top-level client component, renders before dashboard content.

```typescript
// Source: github.com/aparajita/capacitor-biometric-auth (v10 README)
import { BiometricAuth, BiometryError } from '@aparajita/capacitor-biometric-auth';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

async function checkAndLock(): Promise<'unlocked' | 'fallback' | 'skip'> {
  if (!Capacitor.isNativePlatform()) return 'skip';

  const { value } = await Preferences.get({ key: 'biometricEnabled' });
  if (value !== 'true') return 'skip';

  const { isAvailable } = await BiometricAuth.checkBiometry();
  if (!isAvailable) return 'fallback'; // silent fallback to password

  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Wedding POV',
      allowDeviceCredential: false,
    });
    return 'unlocked';
  } catch (error) {
    if (error instanceof BiometryError) {
      // Handle specific error codes for failure counting
    }
    return 'fallback';
  }
}
```

**iOS Info.plist addition required:**
```xml
<key>NSFaceIDUsageDescription</key>
<string>Wedding POV uses Face ID to protect your account.</string>
```
[CITED: github.com/aparajita/capacitor-biometric-auth README]

### Pattern 3: Universal Links — AASA Route Handler

**What:** Serve the AASA file from Next.js App Router with correct Content-Type.
**When to use:** Required for iOS Universal Links.

```typescript
// Source: Next.js local docs (backend-for-frontend.md) — Route Handler for .well-known
// src/app/.well-known/apple-app-site-association/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const aasa = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${process.env.APPLE_TEAM_ID}.com.weddingpov.app`,
          paths: ['/e/*'],
        },
      ],
    },
  };
  return NextResponse.json(aasa, {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

**Note:** Apple's CDN fetches the AASA file on device enrollment and on each app install update. Changes take up to 24h to propagate via Apple's CDN. For immediate testing, use developer mode. [ASSUMED: propagation timing — consistent across multiple sources but not verified in official Apple docs in this session]

### Pattern 4: Offline Overlay

**What:** Reactive fullscreen overlay using `@capacitor/network`.
**When to use:** Top-level layout client component.

```typescript
// Source: Capacitor Network docs (capacitorjs.com/docs/apis/network)
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';

function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Check current status on mount
    Network.getStatus().then(({ connected }) => setIsOffline(!connected));

    // Subscribe to changes
    const listenerPromise = Network.addListener('networkStatusChange', ({ connected }) => {
      setIsOffline(!connected);
    });

    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, []);

  if (!isOffline) return null;
  // Render overlay...
}
```

### Pattern 5: Deep Link Handler — Universal Links via appUrlOpen

**What:** Extend the existing `appUrlOpen` pattern to handle Universal Links.
**When to use:** Layout-level client component (runs before routing).

```typescript
// Source: capacitorjs.com/docs/guides/deep-links
// Pattern established in ConnectDriveButton.tsx — extend, do not replace
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener('appUrlOpen', (data) => {
      // Universal Links fire here: https://weddingpov.app/e/my-event
      // Custom scheme OAuth callbacks also fire here: com.weddingpov.app://oauth-callback
      // Only handle Universal Links — OAuth is handled in ConnectDriveButton
      if (data.url.startsWith('https://') && data.url.includes('/e/')) {
        router.push('/dashboard');
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, [router]);

  return null;
}
```

**Important:** The existing `appUrlOpen` listener in `ConnectDriveButton.tsx` handles only `com.weddingpov.app://oauth-callback`. Universal Links fire with `https://` URLs — these are distinct and do not conflict. [VERIFIED: official docs + code inspection]

### Anti-Patterns to Avoid

- **Passing `dataUrl` directly to `Share.share({ url })`:** The `url` param requires `http://`, `https://`, or `file://`. Data URLs are silently ignored or cause errors on some Android versions. Always write to Filesystem first. [CITED: Ionic Forum + capacitor-plugins GitHub issues]
- **Using `@capacitor-community/biometric-auth`:** This package does NOT exist on npm (HTTP 404). It was likely confused with `@aparajita/capacitor-biometric-auth`. Never install a package that returns 404 from the registry.
- **Placing AASA in `public/`:** Next.js App Router serves `public/` files with `Cache-Control: public, max-age=0` and no extension-based Content-Type control. The AASA file has no extension and defaults to `application/octet-stream`, causing Apple's verifier to reject it. Use a Route Handler instead to set `Content-Type: application/json` explicitly.
- **Testing Universal Links in iOS Simulator:** The iOS Simulator does NOT fully replicate Universal Link behavior. Test Associated Domains on a physical device enrolled in your Apple Developer team. [CITED: PITFALLS.md + Apple docs]
- **Duplicate `appUrlOpen` listeners:** Adding a second listener in a layout component while the existing listener in `ConnectDriveButton.tsx` stays active is safe — each listener only acts on its own URL pattern. But do not remove or replace the OAuth listener.
- **Checking `biometryType` for Android capability:** The `@aparajita` plugin documentation warns that Android may report biometry hardware as available when it is not actually usable by apps. Use only `isAvailable` and `strongBiometryIsAvailable` as reliable indicators. [CITED: github.com/aparajita/capacitor-biometric-auth README]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Native share sheet | Custom share UI with mailto/clipboard/WhatsApp links | `@capacitor/share` + `@capacitor/filesystem` | The OS share sheet provides all installed apps (AirDrop, Messages, WhatsApp, email) without any per-app code; hand-rolled approach misses most targets |
| Biometric auth | LocalAuthentication Swift bridge / BiometricPrompt Java | `@aparajita/capacitor-biometric-auth` | Handles enrollment state, lockout, error codes, iOS/Android API differences, and the 3-failure fallback scenario correctly |
| Offline detection | `window.addEventListener('offline')` browser event | `@capacitor/network` | Browser `navigator.onLine` and `offline` events are unreliable on iOS WKWebView in Capacitor; the native plugin reads actual OS network state |
| File temp storage | `window.URL.createObjectURL(blob)` | `@capacitor/filesystem` + `Directory.Cache` | Blob URLs are not `file://` URIs; the share plugin cannot accept them; Filesystem is the only path to a shareable file URI |

**Key insight:** In Capacitor, browser APIs for network status and share are either non-functional or incompatible with the native layer. Always use the corresponding Capacitor plugin.

---

## Common Pitfalls

### Pitfall 1: `@capacitor-community/biometric-auth` Does Not Exist
**What goes wrong:** Installing a non-existent package. `npm install @capacitor-community/biometric-auth` fails with HTTP 404.
**Why it happens:** The CONTEXT.md named this package as the "likely choice" but it does not exist in the npm registry. The confusion likely stems from a naming pattern — other Capacitor community plugins exist at `@capacitor-community/*` but biometric-auth is not one of them.
**How to avoid:** Use `@aparajita/capacitor-biometric-auth` — verified at npm, Capacitor 8+, slopcheck [OK].
**Warning signs:** `npm error 404 Not Found - GET https://registry.npmjs.org/@capacitor-community%2fbiometric-auth`

### Pitfall 2: AASA `Content-Type` Wrong — Apple Silently Rejects
**What goes wrong:** Universal Links never open the app. The AASA file exists and is accessible but Apple's verifier rejects it.
**Why it happens:** If served with `Content-Type: application/octet-stream` (the default for extensionless files in many servers), Apple's AASA verifier may reject the file. Required type is `application/json`.
**How to avoid:** Use a Next.js Route Handler (`src/app/.well-known/apple-app-site-association/route.ts`) with explicit `Content-Type: application/json`. [CITED: multiple developer blogs + Capacitor deep links guide]
**Warning signs:** Apple's AASA validator at `https://app-site-association.cdn-apple.com/a/v1/weddingpov.app` returns an error; Universal Links open Safari instead of the app.

### Pitfall 3: Associated Domains Entitlement Missing from Xcode Project
**What goes wrong:** Universal Links silently fall through to Safari even though the AASA file is correctly served.
**Why it happens:** The `App.entitlements` file does not yet exist in this project (confirmed: `ls ios/App/App/*.entitlements` returned nothing). Without the entitlement, iOS ignores the AASA file entirely.
**How to avoid:** Add Associated Domains capability in Xcode Signing & Capabilities tab, specifying `applinks:weddingpov.app` and `applinks:pov.jjwedding.nl` (both domains are in `WKAppBoundDomains`). This creates `App.entitlements` with the `com.apple.developer.associated-domains` key.
**Warning signs:** No `App.entitlements` file in `ios/App/App/`; Universal Links open in browser.

### Pitfall 4: Android `sha256_cert_fingerprints` Mismatch in `assetlinks.json`
**What goes wrong:** Android App Links don't work — intents resolve to browser even with correct HTTPS domain.
**Why it happens:** `assetlinks.json` requires the exact SHA-256 fingerprint of the signing certificate. Debug and release keystores produce different fingerprints. If the file was generated with the debug cert fingerprint but the app is built with a release cert (or vice versa), `autoVerify` fails silently.
**How to avoid:** Get the fingerprint from the release keystore: `keytool -list -v -keystore release.keystore -alias <alias>`. The `assetlinks.json` must contain the fingerprint of the cert the distributed app is signed with.
**Warning signs:** `adb shell pm get-app-links com.weddingpov.app` shows `verified: false`.

### Pitfall 5: `NSFaceIDUsageDescription` Missing — App Crashes on Face ID Devices
**What goes wrong:** App crashes on launch on iPhone X and later devices with Face ID.
**Why it happens:** iOS requires `NSFaceIDUsageDescription` in `Info.plist` before any Face ID API call. If missing, the OS terminates the app.
**How to avoid:** Add the key to `ios/App/App/Info.plist` before any biometric code is merged.
**Warning signs:** App crashes on physical iPhone X+ with no JS error; crash log shows `LAErrorDomain`.

### Pitfall 6: Offline Overlay on Web Platform
**What goes wrong:** Offline overlay mounts on web builds, breaking the web dashboard experience.
**Why it happens:** If `Capacitor.isNativePlatform()` guard is missing from the `useEffect`, `Network.addListener` may either do nothing or throw on web.
**How to avoid:** Guard all `@capacitor/network` calls with `if (!Capacitor.isNativePlatform()) return;` (established pattern from `ConnectDriveButton.tsx`).

### Pitfall 7: Universal Link `paths` Scope Too Broad
**What goes wrong:** App intercepts ALL `weddingpov.app` links — including the main landing page, privacy policy, and other non-app pages. Users who click a regular website link on the domain get the app instead of Safari.
**Why it happens:** Using `"paths": ["*"]` in the AASA file intercepts every path on the domain.
**How to avoid:** Scope AASA paths to `/e/*` only (the guest upload route) — the only links organizers share publicly. The OAuth deep link uses a custom scheme (`com.weddingpov.app://`) not a Universal Link.

---

## Code Examples

### Complete QR Share Handler

```typescript
// Source: Capacitor Filesystem docs + Share docs
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

async function handleNativeShare(dataUrl: string, guestUrl: string, slug: string) {
  if (!Capacitor.isNativePlatform()) return;
  if (!dataUrl) return;

  const base64 = dataUrl.split(',')[1]; // strip "data:image/png;base64,"

  await Filesystem.writeFile({
    path: `qr-${slug}.png`,
    data: base64,
    directory: Directory.Cache,
    // No encoding → binary base64 write
  });

  const { uri } = await Filesystem.getUri({
    path: `qr-${slug}.png`,
    directory: Directory.Cache,
  });

  await Share.share({
    files: [uri],
    text: guestUrl,
    dialogTitle: 'Share QR code',
  });
}
```

### AASA Route Handler (Next.js App Router)

```typescript
// src/app/.well-known/apple-app-site-association/route.ts
// Source: Next.js local docs (backend-for-frontend.md) + Capacitor deep links guide
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${process.env.APPLE_TEAM_ID}.com.weddingpov.app`,
            paths: ['/e/*'],
          },
        ],
      },
    },
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

### assetlinks.json Route Handler (Next.js App Router)

```typescript
// src/app/.well-known/assetlinks.json/route.ts
// Source: Capacitor deep links guide
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.weddingpov.app',
          sha256_cert_fingerprints: [
            process.env.ANDROID_CERT_FINGERPRINT ?? '',
          ],
        },
      },
    ],
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

### Android Intent Filter Addition (AndroidManifest.xml)

```xml
<!-- Add inside the <activity> element, alongside the existing com.weddingpov.app:// filter -->
<!-- Source: Capacitor deep links guide (capacitorjs.com/docs/guides/deep-links) -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="weddingpov.app" android:pathPrefix="/e/" />
</intent-filter>
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="pov.jjwedding.nl" android:pathPrefix="/e/" />
</intent-filter>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `navigator.share()` Web Share API | `@capacitor/share` native plugin | Web Share API still "spotty" as of 2026 (especially file sharing on Android Chrome) | Native plugin is the reliable path for mobile file sharing |
| LocalAuthentication directly via Cordova plugins | `@aparajita/capacitor-biometric-auth` Capacitor 8 plugin | Capacitor 8 (2025) | Plugin wraps both iOS LAContext and Android BiometricPrompt in a unified API |
| `middleware.ts` in Next.js | `proxy.ts` in this Next.js version | Next.js 16 (this project) | AGENTS.md: "middleware is deprecated and renamed to proxy" — do not use `middleware.ts` |
| Serving AASA from `public/` | Serving via Route Handler in `app/.well-known/` | Next.js App Router convention | App Router recommends metadata files in `app/`; Route Handler gives Content-Type control |

**Deprecated/outdated:**
- `middleware.ts`: this version of Next.js uses `proxy.ts` — confirmed in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` [VERIFIED: local Next.js docs]
- `@capacitor-community/biometric-auth`: does not exist on npm [VERIFIED: npm registry HTTP 404]

---

## Critical Finding: APPLE_TEAM_ID Environment Variable

The AASA file requires the Apple Team ID in the format `TEAMID.com.weddingpov.app`. This value must be available as an environment variable (`APPLE_TEAM_ID`) in Railway's production config. Similarly, `ANDROID_CERT_FINGERPRINT` is needed for `assetlinks.json`. These must be added to Railway env vars before the deep link feature can work end-to-end.

The Android cert fingerprint is only knowable after the release keystore is generated (Phase 8 distribution work). For Phase 6, the `assetlinks.json` route handler can use a placeholder or empty string — it will not cause crashes, just means App Links won't auto-verify until the fingerprint is set.

---

## Open Questions

1. **`APPLE_TEAM_ID` availability**
   - What we know: Required for AASA `appID` field; format is `TEAMID.com.weddingpov.app`
   - What's unclear: Whether Joey has an Apple Developer account and knows the Team ID
   - Recommendation: Add `APPLE_TEAM_ID=PLACEHOLDER` to Railway env vars and document it as needing replacement; or hardcode it if known

2. **`ANDROID_CERT_FINGERPRINT` for `assetlinks.json`**
   - What we know: Required for Android App Links to work; must match the release keystore cert SHA-256
   - What's unclear: The release keystore hasn't been generated (that's Phase 8)
   - Recommendation: Implement the route handler with an env var placeholder; Android App Links will not verify until Phase 8 fills in the real fingerprint; this is acceptable and does not block the iOS Universal Link implementation

3. **`applinks:` domain scope — `weddingpov.app` vs `pov.jjwedding.nl`**
   - What we know: Both domains are in `WKAppBoundDomains`; the server.url points to `pov.jjwedding.nl`
   - What's unclear: Which domain organizers share QR guest links from — `window.location.origin` in `QRModal.tsx` returns the Railway domain, which is `pov.jjwedding.nl`
   - Recommendation: Configure Associated Domains and AASA for BOTH domains; add intent filters for both Android as well [ASSUMED: both domains need AASA — may depend on which URL guests actually use]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Package install, cap sync | ✓ | v22+ (confirmed via Phase 5 decisions) | — |
| Xcode (Associated Domains) | NATIVE-03 iOS entitlements | ✓ (assumed — ios/ dir exists, built in Phase 5) | 26+ (per Phase 5 research) | — |
| Android Studio | NATIVE-03 Android App Links | ✓ (assumed — android/ dir exists) | 2025.2.1+ (per Phase 5 research) | — |
| Apple Developer account | NATIVE-03 — Team ID for AASA | [ASSUMED] ✓ | — | Without Team ID, AASA can use placeholder; Universal Links won't work until real ID is set |
| Android release keystore | NATIVE-03 — SHA-256 fingerprint for assetlinks.json | ✗ | — | Use placeholder fingerprint in assetlinks.json; App Links won't verify until Phase 8 |
| Railway env var `APPLE_TEAM_ID` | AASA route handler | ✗ | — | Hardcode Team ID if known; or defer AASA population until after Phase 8 |

**Missing dependencies with no fallback:**
- None that block Phase 6 entirely — all features can be implemented; Universal Links / App Links won't fully verify until env vars are set

**Missing dependencies with fallback:**
- `APPLE_TEAM_ID` — can be hardcoded or added as Railway env var at any time; AASA route handler will still serve the file, just with a placeholder team ID

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Apple CDN AASA propagation takes up to 24h | Architecture Patterns: Pattern 3 | Low impact — just affects testing timeline; actual behavior is the same |
| A2 | Both `weddingpov.app` and `pov.jjwedding.nl` need AASA + intent filters | Open Questions #3 | If only one domain is needed, two intent filters are harmless; if the wrong one is configured, Universal Links don't work |
| A3 | Joey has an Apple Developer account | Environment Availability | Without account, Universal Links cannot be configured; blocks NATIVE-03 on iOS |
| A4 | The `@capgo/capacitor-native-biometric` is less suitable than `@aparajita` for this use case | Standard Stack | Low risk — both exist and work; choice affects API ergonomics only |

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

AGENTS.md contains one binding directive:

> "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."

**Checked and enforced:**

| Convention | This Next.js Version | Research Impact |
|------------|---------------------|-----------------|
| `middleware.ts` → `proxy.ts` | Confirmed in local docs: `proxy.md` replaces `middleware.md`; `proxy.js` is the correct file name | If adding proxy-level logic for deep links, use `proxy.ts` not `middleware.ts`. For Phase 6, no proxy-level logic is needed — `appUrlOpen` handles routing client-side. |
| `.well-known` files | App Router docs confirm: use Route Handlers in `app/.well-known/` for metadata files; `public/` works but has no Content-Type control | Route Handler pattern confirmed and used in all code examples above |
| Route Handlers | `app/path/route.ts` convention — unchanged from training | Confirmed in local `route.md` |

---

## Sources

### Primary (HIGH confidence)
- [Capacitor Share API docs](https://capacitorjs.com/docs/apis/share) — `Share.share()` API signature, `files` param, `file://` URI requirement
- [Capacitor Filesystem API docs](https://capacitorjs.com/docs/apis/filesystem) — `writeFile()` with base64, `Directory.Cache`
- [Capacitor Network API docs](https://capacitorjs.com/docs/apis/network) — `getStatus()`, `addListener('networkStatusChange')`
- [Capacitor Deep Links guide](https://capacitorjs.com/docs/guides/deep-links) — AASA format, entitlements, `android:autoVerify`, `appUrlOpen` pattern
- [github.com/aparajita/capacitor-biometric-auth](https://github.com/aparajita/capacitor-biometric-auth) — `checkBiometry()`, `authenticate()`, NSFaceIDUsageDescription requirement, Capacitor 8+ support
- npm registry — `npm view @aparajita/capacitor-biometric-auth`: version 10.0.0, Capacitor 8+ peer deps [VERIFIED: npm registry]
- npm registry — `@capacitor-community/biometric-auth`: HTTP 404 — does not exist [VERIFIED: npm registry]
- Next.js local docs (`node_modules/next/dist/docs/`) — Route Handler for `.well-known`, `proxy.ts` replaces `middleware.ts`, public folder Content-Type caveat [VERIFIED: local codebase]
- slopcheck 0.6.1 — all 6 packages checked: [OK] for `@capacitor/share`, `@capacitor/filesystem`, `@capacitor/network`, `@capacitor/preferences`, `@aparajita/capacitor-biometric-auth`, `@capgo/capacitor-native-biometric`

### Secondary (MEDIUM confidence)
- [Apple Developer: Supporting Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains) — entitlement format, AASA file format
- Capacitor PITFALLS.md (project research) — AASA Content-Type requirement, Universal Link physical device testing requirement
- Ionic Forum / GitHub Issues — dataUrl cannot be passed directly to `Share.share()`, file write is required

### Tertiary (LOW confidence)
- Apple CDN 24h propagation claim — multiple dev blogs, not found in official Apple docs in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirmed, slopcheck all OK, official Capacitor docs verified
- Architecture: HIGH — official plugin APIs verified, existing codebase inspected
- Pitfalls: HIGH — biometric package non-existence verified (npm 404), AASA Content-Type from official docs, entitlements gap from codebase inspection

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable APIs — Capacitor 8, Apple AASA format, Android assetlinks format are all stable)
