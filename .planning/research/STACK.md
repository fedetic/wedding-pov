# Technology Stack

**Project:** Wedding POV — QR-code event photo upload web app
**Researched:** 2025-05-02
**Research Mode:** Ecosystem

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x (stable: `15.1.11`) | Full-stack web framework | App Router enables SSR for organizer dashboard, static pages for QR landing, Route Handlers for upload API, Server Actions for forms — one repo, no separate backend needed |
| TypeScript | 5.x | Type safety | Required for Drizzle schema, auth types, Drive API response shapes |
| Tailwind CSS | 4.x (stable: `4.2.4`) | Styling | Mobile-first utilities, zero config purging, fast iteration on upload/organizer UIs |

**Confidence:** HIGH — verified via npm, Context7, and official Next.js docs.

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Better Auth | 1.x (stable: `1.6.9`) | Organizer email/password auth + session management | Cleaner credentials handling than Auth.js/NextAuth for this use case: first-class email/password with bcrypt, Drizzle adapter built-in, session stored in DB (not JWT), TypeScript-native |

**Why NOT Auth.js (NextAuth v5 / `@auth/core`):** Auth.js credentials provider pushes JWT-encoded sessions which makes credential revocation and token storage messy. Google OAuth tokens for Drive must be stored separately from the auth session. Better Auth keeps sessions in the DB by default and has a cleaner Drizzle integration.

**Why NOT Clerk:** Third-party managed auth adds unnecessary cost and vendor lock-in for what is fundamentally a simple email/password flow. Organizer count will be tiny at v1.

**Why NOT Lucia:** Lucia v3 deliberately de-emphasizes the library side and pushes users to implement OAuth themselves. Maintenance posture has shifted; Better Auth absorbed that user base and is more actively developed.

**Confidence:** MEDIUM-HIGH — Better Auth is newer (1.x, 2024–2025) but well-documented and actively maintained. Verified via Context7 and npm.

#### Google Drive OAuth Token Storage (separate from auth)

The organizer's Google Drive OAuth tokens (`access_token` + `refresh_token`) must be stored in your own database — **not** inside the Better Auth session. These tokens are used server-side when proxying uploads to Drive. Store them in a `google_tokens` table keyed to `organizer_id`.

```
Auth session: identifies who the organizer is → their user ID
google_tokens table: stores Drive refresh token per user ID
```

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16+ | Primary database | Relational model fits events → uploads → organizers; handles concurrent writes from simultaneous guests; mature JSON support for flexible metadata |
| Drizzle ORM | 0.45.x | ORM + migrations | Lightweight (~7.4 KB), tree-shakeable, SQL-like TypeScript DSL, first-class Drizzle Kit migrations, supported by Better Auth adapter, no "magic" runtime |
| Neon | latest | Serverless Postgres host | Free tier generously sized for v1 (0.5 GB), branches for preview envs, serverless driver (`@neondatabase/serverless`) works well with Railway or Vercel |

**Why NOT Supabase:** Supabase bundles auth, storage, and edge functions — overkill when we have our own auth (Better Auth) and our own storage (Google Drive). The Supabase Postgres is fine but the magic client library then becomes dead weight.

**Why NOT PlanetScale (MySQL):** MySQL adds friction with Drizzle schema (different type semantics); Postgres is better-supported across the ecosystem.

**Why NOT SQLite (Turso/Libsql):** Multi-region write conflicts for simultaneous event uploads; file locking limits horizontal scale. Turso's libsql is acceptable for personal use but adds an extra abstraction layer for no real benefit given Neon's free tier.

**Confidence:** HIGH — Drizzle + Neon is the dominant combination in the Next.js ecosystem in 2025, verified via Context7 and npm.

#### Schema Sketch

```
users              → organizer accounts (Better Auth managed)
events             → event name, photo_limit, created_by (FK → users)
google_tokens      → user_id (FK), access_token, refresh_token, expires_at
upload_records     → event_id, guest_nickname, filename, drive_file_id, uploaded_at
```

---

### Google Drive Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `googleapis` (Node.js) | 171.x | Google Drive API client | Official Google client; handles OAuth2 flow, token refresh, multipart and resumable upload to Drive |

**Upload Architecture (Critical Decision):**

Server-side upload is **mandatory**. The organizer's Drive `refresh_token` is stored in your database. It must never be sent to a guest's browser. The upload flow is:

```
Guest browser
  → POST /api/upload (multipart/form-data, photo file + event_id + nickname)
  → Next.js Route Handler
     → Look up organizer's refresh_token from google_tokens table
     → Create googleapis OAuth2 client with refresh_token
     → drive.files.create() with Readable stream from request body
     → Return Drive file ID + success
  → Guest browser shows confirmation
```

**Upload type selection (per Google Drive API docs):**
- Files ≤ 5 MB: multipart upload (`uploadType=multipart`) — single request, low complexity
- Files > 5 MB (likely for full-res phone photos): resumable upload (`uploadType=resumable`) — handles mobile network interruptions, required for reliability

**Why NOT browser-direct-to-Drive:** Cannot expose organizer OAuth token to guest browser. Server must act as the authenticated intermediary.

**Why NOT Drive Picker:** Drive Picker is for users to *select* files from their own Drive, not for unauthenticated guests to upload to someone else's Drive. Wrong tool for this flow.

**Token refresh:** googleapis OAuth2 client handles refresh automatically when you set `refresh_token` on the client and the `access_token` has expired. Store the new `access_token` and `expires_at` after each refresh.

**Confidence:** HIGH — verified via Context7/googleapis Node.js docs, Google Drive API public docs.

---

### File Upload UX (Guest-side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `<input type="file" multiple accept="image/*">` | — | Photo selection | Mobile browsers surface the camera roll natively; no library weight needed for MVP |
| Custom progress UI with `XMLHttpRequest` or `fetch` + `ReadableStream` | — | Upload progress | XHR's `upload.onprogress` event gives byte-level progress for a clean progress bar without dependency |

**Why NOT Uppy (5.x):** Uppy is excellent for complex multi-source uploads (Dropbox, Google Drive picker, S3 direct). For a simple "pick from camera roll → upload" flow on mobile, it adds ~200 KB of JS and visual complexity guests don't need. Native input + custom progress is lighter and faster on mobile.

**Why NOT Filepond:** Same argument — heavier than necessary, optimized for desktop-class drag-and-drop experiences. Mobile guests scan a QR code and want the fastest path to done.

**Mobile UX notes:**
- `capture="environment"` attribute can offer camera as first option (optional, prefer camera roll for event photos)
- Set explicit `max-size` validation client-side before upload starts
- Show per-file progress; block UI until upload completes to prevent guests navigating away

**Confidence:** HIGH — this is standard practice for mobile-first upload flows.

---

### QR Code Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `qrcode` | 1.5.4 | Server-side QR code generation | Mature library, outputs PNG buffer or SVG string, works in Node.js/Next.js Route Handler, no browser dependency |

**Usage pattern:**
```typescript
import QRCode from 'qrcode'
// In a Route Handler:
const png = await QRCode.toBuffer(eventUrl, { errorCorrectionLevel: 'M', width: 800 })
return new Response(png, { headers: { 'Content-Type': 'image/png' } })
```

Organizer can view → right-click save, or download via a `<a href="/api/events/[id]/qr" download>` link.

**Why NOT `react-qr-code`:** Client-side only (SVG in browser). Fine for rendering in the UI, but doesn't support server-side generation for download. Use `qrcode` server-side; optionally add `react-qr-code` as a preview component in the dashboard.

**Confidence:** HIGH — `qrcode` npm 1.5.4 verified, widely used.

---

### Hosting & Deployment

| Technology | Purpose | Why |
|------------|---------|-----|
| Railway | Application hosting | **No serverless function body-size limit** — Vercel Hobby caps request bodies at 4.5 MB (a blocking constraint for photo uploads). Railway runs a persistent Node.js process; standard HTTP semantics, no artificial limits |
| Neon | Database hosting | Serverless Postgres, free tier, connects from Railway via `DATABASE_URL` |

**Critical issue with Vercel:**

> Vercel Hobby serverless functions have a **4.5 MB request body limit**. Phone photos routinely exceed this (HEIC/JPG from iPhone: 5–15 MB). Vercel Pro raises this but costs $20/mo.

Railway avoids this entirely. The Next.js app runs as a persistent server (`next start`), not as per-request serverless functions. Upload Route Handlers can stream arbitrarily large files.

**Why NOT Fly.io:** Railway is simpler to get started with (GitHub-connected deploys, built-in Postgres service). Fly.io is excellent but requires more CLI-driven setup. For a personal project, Railway wins on DX.

**Why NOT Cloudflare Workers:** Workers have a 100 MB body limit on Paid plans, but the bigger issue is the Workers runtime lacks Node.js `googleapis` compatibility (WHATWG Streams-based, not Node.js Buffer/Stream). googleapis requires a Node.js runtime.

**Deployment architecture on Railway:**
```
Railway Service: Next.js app (npm run start, PORT from env)
Railway Service: PostgreSQL (or use Neon — either works)
Environment variables: DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
                       BETTER_AUTH_SECRET, NEXT_PUBLIC_APP_URL
```

**Confidence:** HIGH for the Railway recommendation. The Vercel body size limit is documented in their public limits page (verified). MEDIUM for exact Railway pricing/plan details (verified from their public pricing page: Hobby = $5 included usage/mo).

---

## Installation

```bash
# Create Next.js app
npx create-next-app@latest wedding-pov --typescript --tailwind --app --src-dir

# Core dependencies
npm install better-auth drizzle-orm @neondatabase/serverless googleapis qrcode

# Drizzle Kit (dev)
npm install -D drizzle-kit @types/qrcode

# Better Auth types (peer)
npm install better-auth

# Tailwind (already installed by create-next-app if --tailwind)
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | SvelteKit, Remix | Next.js has the most complete auth library support and Drive upload examples in 2025; SvelteKit is excellent but ecosystem is smaller for auth/Drive integrations |
| Auth | Better Auth | Auth.js (NextAuth v5) | Better Auth has cleaner credentials flow and DB-backed sessions by default |
| Auth | Better Auth | Clerk | Vendor lock-in, cost, overkill for small organizer count |
| ORM | Drizzle | Prisma | Drizzle is lighter, serverless-friendly, SQL-transparent; Prisma's binary engine is a poor fit for serverless Postgres |
| Database | Neon Postgres | Supabase, PlanetScale, Turso | Neon gives pure Postgres without bundled auth/storage we don't need |
| Upload UX | Native `<input>` | Uppy, Filepond | Libraries add JS weight with no real benefit for simple mobile camera roll selection |
| Hosting | Railway | Vercel, Fly.io | Railway has no body size limit; Vercel Hobby 4.5 MB limit blocks photo uploads |
| QR Code | `qrcode` | `react-qr-code` | `qrcode` works server-side for PNG generation; add `react-qr-code` for inline preview if needed |

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| Next.js 15.1.11 stable | `npm info next version` | HIGH |
| Better Auth 1.6.9, Drizzle adapter | `npm info better-auth version`, Context7 `/better-auth/better-auth` | HIGH |
| Drizzle ORM 0.45.2 | `npm info drizzle-orm version` | HIGH |
| googleapis Node.js 171.x, Drive multipart/resumable | Context7 `/websites/googleapis_dev_nodejs_googleapis`, Google Drive API docs | HIGH |
| qrcode 1.5.4 | `npm info qrcode version` | HIGH |
| Tailwind 4.2.4 | `npm info tailwindcss version` | HIGH |
| Auth.js credentials JWT awkwardness | Context7 `/websites/authjs_dev` | HIGH |
| Vercel 4.5 MB body limit | Vercel public limits page (`vercel.com/docs/limits/overview`) | HIGH |
| Google Drive upload types (5 MB threshold) | `developers.google.com/drive/api/guides/manage-uploads` | HIGH |
| Railway Hobby $5/mo included usage | Railway public pricing page | MEDIUM |
| googleapis CORS on upload endpoint | Not directly verified; inferred from architecture constraint (server-side mandatory due to token security) | LOW — but moot, server-side is correct regardless |
