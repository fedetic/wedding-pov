# Research Summary

**Project:** Wedding POV — QR-code event photo upload web app
**Domain:** Multi-tenant event photo collection / Google Drive integration
**Researched:** 2025-05-02
**Confidence:** HIGH

---

## Executive Summary

Wedding POV is a zero-friction photo-collection tool for events: guests scan a QR code, enter a nickname, and upload photos directly to the organizer's Google Drive. The competitive space is dominated by native mobile apps (POV, Once, Lense, disposable.app) that silo photos in their own cloud storage — requiring organizers to export later. The singular differentiator here is that photos land in the organizer's own Google Drive immediately, with no proprietary silo and no export step. Everything else about the build should serve that value proposition.

The recommended architecture is a **server-brokered resumable upload pattern**: the Next.js server (on Railway, not Vercel) holds Drive OAuth tokens securely, initiates resumable upload sessions with Google on behalf of guests, and returns a self-authenticating session URI that the guest's browser uses to PUT photo bytes directly to Google's CDN. The server never handles photo bytes — it only orchestrates access. This pattern satisfies the core security requirement (tokens never reach guest browsers) while keeping the server out of the bandwidth-intensive data path.

The highest-risk area is the Google Drive OAuth integration. Two pitfalls can silently kill the product: using the wrong OAuth scope (`drive` instead of `drive.file`) triggers a weeks-long Google security review; and leaving the GCP app in "Testing" status causes all organizer refresh tokens to expire every 7 days, which is catastrophic if it happens on a wedding day. Both must be resolved in Phase 1 and treated as launch gates, not post-launch items.

---

## Stack Recommendation

The full recommended stack, verified via npm and official docs:

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Framework** | Next.js | 15.x (`15.1.11`) | App Router for SSR organizer dashboard, Route Handlers for upload API, Server Actions for forms — one repo, no separate backend |
| **Language** | TypeScript | 5.x | Required for Drizzle schema, auth types, Drive API response shapes |
| **Styling** | Tailwind CSS | 4.x (`4.2.4`) | Mobile-first utilities; fast iteration on upload and dashboard UIs |
| **Auth** | Better Auth | 1.x (`1.6.9`) | Email/password with bcrypt, DB-backed sessions (not JWT), Drizzle adapter built-in, TypeScript-native |
| **ORM** | Drizzle ORM | 0.45.x | Lightweight, serverless-friendly, SQL-transparent; Drizzle Kit for migrations; Better Auth adapter supported |
| **Database** | PostgreSQL (Neon) | 16+ | Relational model for events/uploads/organizers; Neon free tier covers v1; serverless driver works with Railway |
| **Drive API** | `googleapis` Node.js | 171.x | Official Google client; OAuth2 flow, token refresh, resumable upload to Drive |
| **QR Code** | `qrcode` | 1.5.4 | Server-side PNG/SVG generation in Route Handlers; no browser dependency |
| **Upload UX** | Native `<input multiple>` | — | No library weight; mobile browsers surface camera roll natively; custom XHR for progress events |
| **Hosting** | Railway | — | **No request body size limit** — Vercel Hobby caps at 4.5 MB, which phone photos routinely exceed |

**Key omissions and why:**
- **NOT Vercel** — 4.5 MB body limit on Hobby blocks photo uploads. Railway runs persistent Node.js with no artificial limits.
- **NOT Auth.js/NextAuth** — JWT credentials sessions are messy; Google Drive tokens must be stored separately anyway. Better Auth keeps sessions in DB by default.
- **NOT Supabase** — bundles auth + storage we're replacing with our own auth (Better Auth) and Drive. Dead weight.
- **NOT Uppy/Filepond** — 200 KB JS overhead for drag-and-drop we don't need. Mobile guests need the fastest path to done.

---

## Table Stakes Features

Features guests or organizers will be blocked without. Missing any of these = product doesn't work.

### Guest Upload Flow

- **Zero-friction join** — scan QR → browser opens upload page → no app install, no account required. Any friction drops participation sharply.
- **Nickname entry before upload** — single required text field; stored in filename and DB record for attribution.
- **Multi-photo selection** — `<input type="file" multiple accept="image/*">` — guests have 20 photos ready; single-select is unusable.
- **Upload progress + clear completion state** — guests at events are distracted; without a big "Done! ✓" they'll upload twice or abandon.
- **Mobile browser compatibility** — iOS Safari + Android Chrome. 100% of guests are on mobile. Desktop is organizer-only.
- **Configurable per-guest photo limit** — enforced server-side (not just client). Prevents one guest from filling the folder.
- **Graceful upload failure with retry** — spotty event WiFi is the norm; silent failures lose photos permanently.
- **HEIC/HEIF support** — iPhones shoot HEIC by default (iOS 11+). Rejecting HEIC excludes ~60% of guests. Use `accept="image/*"` and accept `image/heic` server-side.
- **Text URL fallback** — QR codes fail in dim venues, on dirty surfaces, on older phones. Always show the URL below the code.

### Organizer Management

- **Email/password signup and login** — organizer account creation before anything else.
- **Google Drive OAuth connection** — the storage backend; nothing else works without this.
- **Event creation** — name + photo limit. Event name becomes the Drive folder name.
- **QR code generation** — viewable in dashboard, downloadable as PNG (min 800px) and SVG.
- **Event active/inactive toggle** — organizer closes uploads after the event; prevents stale uploads days later.

### Infrastructure

- **Server-side upload brokering** — Drive tokens must never reach guest browsers. Server initiates resumable sessions; guest PUT bytes to Google's CDN directly.
- **Resumable uploads for all photos** — Google's own guidance: required for files >5 MB and mobile networks. Silent failure on drop is not acceptable.
- **Short slug URLs** — `/e/{slug}` (6–8 chars, < 40 chars total URL) to keep QR codes scannable in low light.

---

## Key Differentiators

What makes Wedding POV meaningfully different from POV, Once, Lense, disposable.app, and every other competitor:

| Differentiator | Value | Complexity |
|---------------|-------|------------|
| **Google Drive native storage** | Photos land in organizer's own Drive immediately — zero export step, no vendor lock-in, organizer owns data the moment it's uploaded. **No competitor does this.** | Medium — this is the core architecture |
| **Guest name in filename** | `Sarah_001.jpg`, `John_002.jpg` — organizer sees attribution directly in Drive without opening any dashboard. Flat folder but fully legible. | Low — rename on upload before Drive |
| **Zero proprietary silo** | Organizer never needs to "log in and download" — photos ARE in Drive already. Entire organizer review experience is just... Drive. | Architectural outcome, not extra work |
| **Short human-readable slug** | `/e/jane-tom-2025` is speakable, typeable, memorable. Guests who can't scan can type it. | Low — slug generation at event creation |
| **Event branding on upload page** | Upload page shows event name (and optionally couple names + date). Feels personal, not generic. | Low — event name already in DB |

**What to defer (v2):**
- Printable QR card templates (PDF ready-to-print) — high value but not blocking launch
- Organizer dashboard with upload count + guest list — Drive folder shows this already
- Post-event email summary — nice, not essential
- Event expiry date — organizer can manually toggle for v1
- Multiple QR export sizes — SVG download covers most print needs

---

## Critical Pitfalls to Avoid

Top pitfalls that would kill the project if ignored, ordered by severity:

### 1. OAuth App in "Testing" Status — Refresh Tokens Expire in 7 Days
**What kills you:** Organizer connects Drive 10 days before the wedding. On the wedding day, every guest upload fails with `invalid_grant`. Organizer must re-link Drive mid-event.

**Prevention:** Submit the GCP app for **OAuth verification** before any production event. `drive.file` is a non-sensitive scope requiring only basic verification (not a full security assessment). Build a "Reconnect Drive" banner in the dashboard triggered by `invalid_grant`. This is a **hard launch gate** — do not host real events while in Testing mode.

### 2. Wrong OAuth Scope: `drive` Instead of `drive.file`
**What kills you:** Using `https://www.googleapis.com/auth/drive` (full access) triggers Google's restricted scope path — weeks of security review, third-party auditor, potential rejection.

**Prevention:** Use `https://www.googleapis.com/auth/drive.file` exclusively. This scope only lets the app see/modify files **it created** — which is exactly what we need. Verify in GCP console before any auth work. Wrong scope = rebuild the entire OAuth flow.

### 3. Missing Refresh Token on First Drive Authorization
**What kills you:** The `googleapis` client only issues a `refresh_token` on first authorization. If you don't pass `access_type: 'offline'` and `prompt: 'consent'`, Google returns only a 1-hour `access_token`. After an hour, all uploads silently fail and organizer must revoke + re-link their Drive.

**Prevention:** Always set `accessType: 'offline'` and `prompt: 'consent'` in the OAuth URL. In the callback handler, **assert `tokens.refresh_token` is present** before saving to DB. If missing, re-trigger the auth flow immediately. Encrypt the refresh token at rest (AES-256).

### 4. No Rate Limiting on Guest Upload Endpoint
**What kills you:** The guest upload URL has no authentication by design. Anyone with the URL (or QR code) can upload unlimited garbage to the organizer's Drive until it's full or the project hits GCP quota limits.

**Prevention:** IP-based rate limiting (max ~25 uploads/IP/hour), server-side photo count enforcement per nickname+session (not just client-side), file type validation via magic bytes (not just Content-Type header), 25 MB per-file size cap. All of this must be in the initial implementation — not a later hardening pass.

### 5. Not Using Resumable Uploads for Mobile Photos
**What kills you:** Simple (`uploadType=media`) uploads restart from zero on any network drop. On mobile at a wedding venue with spotty WiFi, a 90%-complete upload that fails silently loses those photos permanently.

**Prevention:** Use `uploadType=resumable` for all photos. Initiate the session server-side, return the session URI to the browser, have the browser PUT in chunks (5–10 MB each). Implement exponential backoff and a Retry button. Show per-file progress via chunk offset.

### 6. Loading Photo Files Fully Into Memory Client-Side
**What kills you:** Using `FileReader.readAsDataURL()` base64-encodes files (1.33× size increase) and loads them entirely into memory. 5 photos × 10 MB each = 50–65 MB in RAM. iOS Safari has aggressive memory limits and will kill the tab mid-upload with no error message.

**Prevention:** Stream the `File` object directly via `fetch()` body. Never use `readAsDataURL()`. For chunked resumable uploads, read one chunk at a time with `file.slice(start, end)`. Upload files sequentially, not in parallel, to limit peak memory usage.

### 7. `redirect_uri_mismatch` When Deploying to New Environments
**What kills you:** The OAuth redirect URI in GCP must exactly match your server's callback URL. Deploying to production or adding a staging environment without updating GCP means organizers cannot connect Drive.

**Prevention:** Register ALL environment redirect URIs in GCP from day one: `http://localhost:3000/...`, `https://staging.domain.com/...`, `https://domain.com/...`. Treat GCP redirect URI updates as part of every deployment checklist.

---

## Architecture in One Page

### Pattern: Server-Brokered Resumable Upload

```
Guest flow (no auth):
──────────────────────────────────────────────────────────────────
Guest scans QR → opens /e/{slug} in mobile browser
  → GET /e/[slug]  →  Server: look up event by slug (SSR)
                   ←  Returns event name, photoLimit, isActive

Guest enters nickname → selects photos (up to photoLimit)

For each photo:
  1. Browser → POST /api/upload/initiate
               {eventSlug, guestNickname, fileName, mimeType, fileSize}

  2. Server:
     a. Validate event is active + slug exists
     b. Check guest hasn't exceeded photoLimit (count DB records)
     c. Look up organizer's Drive credentials (refresh if expired)
     d. POST to Google Drive API: ?uploadType=resumable
        → Google returns self-authenticating session URI
     e. Write UploadRecord {status: "pending"} to DB
     f. Return {sessionUri, uploadRecordId} to browser

  3. Browser → PUT photo bytes directly to sessionUri (Google CDN)
     ↑ Server never touches photo bytes — token never reaches browser

  4. Browser → POST /api/upload/confirm
               {uploadRecordId, driveFileId}
     Server: update UploadRecord {status: "complete", driveFileId}

  5. Browser shows "3 photos saved to Jane & Tom's Wedding! 🎉"

Organizer setup flow:
──────────────────────────────────────────────────────────────────
Signup (email + password)
  → Better Auth creates user in DB
  → Click "Connect Google Drive"
  → Redirect to Google OAuth (scope: drive.file, access_type: offline, prompt: consent)
  → Callback: exchange code → {access_token, refresh_token}
  → Encrypt refresh_token → store in drive_credentials table
  → Create root Drive folder "WeddingPOV Events"
  → Prompt to create first event

Event creation:
──────────────────────────────────────────────────────────────────
Organizer submits {name, photoLimit}
  → Server generates slug (e.g. "wdg-k7x2")
  → Server creates Drive subfolder "{event.name}" inside root folder
  → Event saved: {id, organizerId, name, slug, photoLimit, driveFolderId, isActive}
  → QR code generated: https://app.com/e/{slug}
  → QR displayed in dashboard + downloadable as PNG/SVG
```

### Data Model

```
users (Better Auth)
  └── drive_credentials (1:1) — encrypted refresh_token, driveFolderRootId
  └── events (1:N)            — name, slug, photoLimit, driveFolderId, isActive
        └── upload_records (1:N) — guestNickname, fileName, driveFileId, status
```

**Multi-tenancy:** Row-level isolation. Every query against organizer data includes `WHERE organizer_id = {session.organizerId}`. No organizer can access another's events or tokens.

### Components

| Component | Responsibility |
|-----------|---------------|
| Guest Upload UI | QR landing page, nickname entry, file selection, progress + confirmation |
| Organizer Dashboard | Event CRUD, QR code display/download, upload history |
| Upload API Routes | Validate events, initiate Drive resumable sessions, record completions |
| Drive OAuth Module | OAuth flow initiation, code exchange, token refresh, folder creation |
| Auth Module (Better Auth) | Organizer email/password sessions (HTTP-only cookie, DB-backed) |
| Database Module (Drizzle) | Type-safe DB access, migrations, schema enforcement |

---

## Build Order Recommendation

The dependency chain is strict: Drive OAuth blocks event creation; event creation blocks QR code; QR code blocks guest upload. Drive OAuth is also the highest-risk component (external OAuth, token encryption, refresh logic) and must be built and **tested** early — not deferred.

| Phase | Focus | Key Deliverables | Pitfalls to Avoid |
|-------|-------|-----------------|-------------------|
| **Phase 1** | Foundation + Auth | DB schema (Drizzle + Neon), organizer signup/login (Better Auth), Drive OAuth flow with token encryption | Wrong scope, missing refresh token, redirect_uri_mismatch, 7-day Testing expiry |
| **Phase 2** | Events + QR Codes | Event creation, Drive folder creation, slug generation, QR code generation (PNG + SVG download), event active/inactive toggle | QR URL > 40 chars; dense code in low light |
| **Phase 3** | Guest Upload Flow | Guest upload page (mobile-first), upload initiation API (resumable sessions), client-side chunked PUT to Drive, confirm API, progress UI, error + retry states, rate limiting | No rate limiting, memory loading, HEIC rejection, silent failure, non-resumable upload |
| **Phase 4** | Polish + Launch Gate | HEIC → JPEG server-side conversion, mobile viewport fixes, guest name in filename, organizer upload history view | OAuth verification submission (must be complete before any production event) |

**Ordering rationale:**
- Drive OAuth must come before events (you can't create a Drive folder without an OAuth token)
- Events must come before QR codes (slug needed for URL)
- QR codes must come before guest upload (nothing to scan otherwise)
- Rate limiting is in Phase 3 initial implementation — not a later hardening pass
- OAuth verification is a hard launch gate, not a nice-to-have

### Research Flags

**Needs deeper research during planning:**
- **Phase 1 (Drive OAuth):** Token encryption approach (AES-256 key management in Railway env vars), Better Auth custom OAuth token storage pattern — relatively new library (1.x), integration details matter.
- **Phase 3 (Resumable Upload client-side):** Chunked PUT implementation in browser, chunk size tuning for mobile, handling partial resume after tab close — not well-documented in tutorials.

**Standard patterns (skip research-phase):**
- **Phase 2 (Events + QR):** Event CRUD and slug generation are standard Next.js + Drizzle patterns. `qrcode` npm package is well-documented.
- **Phase 4 (Polish):** HEIC handling (`accept="image/*"` + server accept), `100dvh` vs `100vh` — known solutions.

---

## Open Questions

Unresolved decisions that must be answered during planning or early in the build:

1. **HEIC handling strategy** — Accept HEIC as-is to Drive (macOS and Google Photos handle it) OR convert to JPEG server-side before upload? Server-side conversion adds `sharp` dependency and CPU cost, but Drive HEIC preview is inconsistent. Decision needed before Phase 3.

2. **Nickname collision strategy** — Flat folder with `{timestamp}_{nickname}_{filename}` prefix (simple, no API overhead) OR per-guest subfolders in Drive (cleaner attribution but adds API calls per upload and contradicts the "flat folder" principle in PROJECT.md)? File naming scheme must be decided in Phase 1 architecture, not retrofitted.

3. **OAuth verification timeline** — Google's basic OAuth verification can take days to weeks. When does the submission happen relative to the first real event? This needs a buffer built into the launch plan.

4. **Guest session binding** — PROJECT.md says "no auth for guests." PITFALLS.md recommends a short-lived server-side session token issued at nickname submission to bind uploads and enforce photo limits reliably. Is a stateless (localStorage + IP-based) approach sufficient, or is a lightweight server session needed to prevent limit bypass?

5. **Railway vs. Neon for DB** — Stack recommends Railway for app hosting + Neon for DB (free tier). Alternatively, Railway provides a built-in Postgres service. Consolidating on Railway simplifies networking but loses Neon's branching for preview environments. Decide before Phase 1 setup.

6. **Event slug format** — Human-readable (`jane-tom-2025`) vs. random (`wdg-k7x2`)? Human-readable is more speakable but risks collision for common names; random is unique but less memorable. A hybrid (e.g., `jane-tom-x7q2`) may be the best of both.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm; versions confirmed; Railway body-limit constraint directly documented by Vercel |
| Features | HIGH | Competitive landscape mapped from live App Store data + product pages; 5+ products analyzed |
| Architecture | HIGH | Server-brokered resumable upload pattern verified against Google Drive API official docs; multi-tenancy patterns are standard |
| Pitfalls | HIGH | All critical pitfalls sourced from official Google docs (OAuth expiry, scopes, upload types, error handling) |

**Overall confidence: HIGH**

### Gaps to Address

- **Better Auth + Google Drive OAuth token storage integration** — Better Auth 1.x is new (2024–2025). The pattern for storing a *separate* Drive OAuth token (not the Better Auth session) alongside the auth session is not heavily documented in tutorials. Will need careful implementation in Phase 1.
- **Mobile upload performance on older iPhones** — PITFALLS.md flags memory limits on iPhone 12 and older. Actual chunk size tuning and sequential-vs-parallel upload decisions should be validated against real device testing in Phase 3, not just at code review.
- **Google OAuth verification timeline** — The research confirms `drive.file` requires only "basic verification" (not full security assessment), but actual processing time is variable. Treat as a project-level risk with a timeline buffer.

---

## Sources

### Primary (HIGH confidence)
- Google Drive API manage-uploads docs — resumable upload pattern, chunk sizes, session URI lifetime
- Google Drive API scopes docs — `drive.file` non-sensitive classification, `drive` restricted scope requirements
- Google OAuth2 token expiration docs — 7-day Testing expiry, 6-month inactivity expiry, 100 token/client cap
- googleapis Node.js client docs (Context7) — token handling, `tokens` event, `access_type: offline`
- Google Drive error handling docs — exponential backoff requirements, quota units
- npm registry — Next.js 15.1.11, Better Auth 1.6.9, Drizzle 0.45.x, Tailwind 4.2.4, qrcode 1.5.4, googleapis 171.x
- Vercel limits page — 4.5 MB Hobby serverless body limit (confirmed)
- App Store data (iTunes API) — POV, Once, Scene, Lense, disposable.app ratings and feature sets

### Secondary (MEDIUM confidence)
- disposable.app features page — QR export sizes, printable templates, free tier offering
- Railway public pricing page — Hobby $5/mo included usage
- Better Auth docs (Context7) — Drizzle adapter, Google OAuth token handling pattern

### Tertiary (LOW confidence)
- googleapis CORS behavior on Drive upload endpoint — inferred from architecture constraint (server-side mandatory due to token security); not directly tested

---

*Research completed: 2025-05-02*
*Ready for roadmap: yes*
