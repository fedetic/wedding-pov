# Architecture Patterns — Wedding POV

**Domain:** Multi-tenant QR-code event photo upload web app  
**Researched:** 2025-01-31  
**Confidence:** HIGH (Google Drive API docs verified via Context7; patterns verified against official sources)

---

## Recommended Architecture

### Pattern: Server-Brokered Direct Upload

The app uses a **server-brokered upload pattern** — the server holds Drive OAuth tokens securely and creates resumable upload sessions on behalf of guests, but guest browsers upload photo bytes directly to Google's CDN. The server is never in the data path for photo bytes.

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────┐    │
│  │   Guest Browser      │      │   Organizer Browser      │    │
│  │  (no auth required)  │      │   (email+password login) │    │
│  └──────────┬───────────┘      └────────────┬─────────────┘    │
│             │                               │                   │
└─────────────┼───────────────────────────────┼───────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER LAYER (Next.js)                       │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Guest Upload   │  │  Organizer   │  │   Drive OAuth     │  │
│  │  API Routes     │  │  API Routes  │  │   Module          │  │
│  │                 │  │              │  │                   │  │
│  │ POST /api/      │  │ POST /api/   │  │ GET  /api/auth/   │  │
│  │  upload/init    │  │  events      │  │  google/callback  │  │
│  │ POST /api/      │  │ GET  /api/   │  │                   │  │
│  │  upload/confirm │  │  events/:id  │  │ Token refresh     │  │
│  └────────┬────────┘  └──────┬───────┘  └────────┬──────────┘  │
│           │                  │                    │             │
│           └──────────────────┼────────────────────┘            │
│                              │                                  │
│                   ┌──────────▼──────────┐                      │
│                   │   Database Module   │                      │
│                   │   (Prisma + PG)     │                      │
│                   └─────────────────────┘                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              ▼                                 ▼
┌─────────────────────────┐        ┌────────────────────────────┐
│   PostgreSQL Database   │        │   Google Drive API         │
│                         │        │                            │
│  organizers             │        │  /upload/drive/v3/files    │
│  events                 │        │   ?uploadType=resumable    │
│  drive_credentials      │        │                            │
│  upload_records         │        │  Per-organizer folders     │
└─────────────────────────┘        └────────────────────────────┘
                                              ▲
                                              │
                              Photo bytes PUT directly by
                              guest browser (no auth needed
                              once session URI is issued)
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Guest Upload UI** | QR landing page, nickname entry, photo selection, upload progress | Upload API Routes |
| **Organizer Dashboard UI** | Event CRUD, QR code display, upload history view | Organizer API Routes |
| **Upload API Routes** | Validate events, initiate Drive resumable sessions, record completions | Database Module, Drive OAuth Module |
| **Organizer API Routes** | Event CRUD, slug generation, Drive folder creation, QR generation | Database Module, Drive OAuth Module |
| **Drive OAuth Module** | Initiate Drive OAuth flow, exchange codes, refresh access tokens | Google OAuth endpoints, Database Module |
| **Auth Module (Better Auth)** | Organizer email/password login, session management | Database (users table) |
| **Database Module (Prisma)** | Type-safe DB access, migrations, row-level data isolation | PostgreSQL |

---

## Data Flow

### 1. Organizer Setup Flow

```
Organizer signs up (email + password)
    → Better Auth creates user record in DB
    → Organizer clicks "Connect Google Drive"
    → Server redirects to Google OAuth (scope: drive.file)
    → Google returns code to /api/auth/google/drive/callback
    → Server exchanges code for {access_token, refresh_token}
    → refresh_token stored encrypted in drive_credentials table
    → Server creates root Drive folder "WeddingPOV Events"
    → driveFolderRootId stored in organizer record
    → Organizer is prompted to create their first event
```

### 2. Event Creation Flow

```
Organizer submits event form {name, photoLimit}
    → Server generates unique slug (8-char alphanumeric, e.g. "wdg-k7x2")
    → Server refreshes Drive access token if needed
    → Server creates Drive subfolder "{event.name}" inside root folder
    → driveFolderId stored in event record
    → Event record saved: {id, organizerId, name, slug, photoLimit, driveFolderId}
    → Server generates QR code pointing to https://app.com/e/{slug}
    → QR code displayed as downloadable PNG
```

### 3. Guest Upload Flow (the critical path)

```
Guest scans QR → opens https://app.com/e/{slug} in mobile browser
    → Server looks up event by slug → returns {name, photoLimit, isActive}
    → Guest enters nickname (stored in localStorage for session)
    → Guest selects photos (up to photoLimit)

For each photo:
    1. Browser → POST /api/upload/initiate
                 body: {eventSlug, guestNickname, fileName, mimeType, fileSize}
                 
    2. Server:
       a. Validates event is active, slug is real
       b. Checks guest hasn't exceeded photoLimit (count existing records)
       c. Looks up organizer's Drive credentials
       d. Refreshes access token if expired (using stored refresh_token)
       e. POST to Google: /upload/drive/v3/files?uploadType=resumable
          headers: Authorization: Bearer {access_token}
          body: {name: "{nickname}/{fileName}", parents: [driveFolderId]}
       f. Google returns resumable session URI (valid ~1 week)
       g. Creates UploadRecord {status: "pending"} in DB
       h. Returns {sessionUri, uploadRecordId} to browser
       
    3. Browser → PUT photo bytes directly to sessionUri
       (No Authorization header needed — session URI is self-authenticating)
       Google returns {id: driveFileId} on success
       
    4. Browser → POST /api/upload/confirm
                 body: {uploadRecordId, driveFileId}
       Server updates UploadRecord {status: "complete", driveFileId}
       
    5. Browser shows success feedback
```

**Why this pattern?**
- Server never handles photo bytes (not a bandwidth bottleneck)
- Organizer's Drive tokens never reach the guest's browser
- Google's CDN handles delivery; resumable upload supports mobile's unreliable connections
- Pattern is explicitly documented by Google Drive API (HIGH confidence — [source](https://developers.google.com/workspace/drive/api/guides/manage-uploads))

---

## Key Data Models

### `organizers` (= users table, managed by Better Auth)

```sql
id              TEXT PRIMARY KEY    -- uuid
email           TEXT UNIQUE NOT NULL
password_hash   TEXT NOT NULL
created_at      TIMESTAMP NOT NULL
-- Drive credentials stored separately (see below)
```

### `drive_credentials`

```sql
id                TEXT PRIMARY KEY   -- uuid
organizer_id      TEXT UNIQUE NOT NULL  -- FK → organizers.id
access_token      TEXT               -- short-lived, refresh on use
refresh_token     TEXT NOT NULL      -- encrypted at rest
token_expiry      TIMESTAMP
drive_folder_id   TEXT               -- root folder ID in Drive
connected_at      TIMESTAMP NOT NULL
```

> **Token storage:** refresh_token stored encrypted (AES-256 using `ENCRYPTION_KEY` env var). Never logged. Never returned to client.

### `events`

```sql
id              TEXT PRIMARY KEY   -- uuid
organizer_id    TEXT NOT NULL      -- FK → organizers.id (multi-tenancy key)
name            TEXT NOT NULL
slug            TEXT UNIQUE NOT NULL   -- e.g. "wdg-k7x2" (URL-safe, human-readable)
photo_limit     INT NOT NULL DEFAULT 20
drive_folder_id TEXT NOT NULL      -- subfolder in organizer's Drive
is_active       BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMP NOT NULL
```

### `upload_records`

```sql
id               TEXT PRIMARY KEY   -- uuid
event_id         TEXT NOT NULL      -- FK → events.id
organizer_id     TEXT NOT NULL      -- denormalized for fast isolation queries
guest_nickname   TEXT NOT NULL
file_name        TEXT NOT NULL
mime_type        TEXT NOT NULL
file_size_bytes  INT
drive_file_id    TEXT               -- null until confirmed
status           TEXT NOT NULL      -- "pending" | "complete" | "failed"
initiated_at     TIMESTAMP NOT NULL
confirmed_at     TIMESTAMP
```

---

## QR Code Data Model

### URL Format

```
https://app.com/e/{slug}
```

- `slug`: 8-char random alphanumeric with prefix, e.g. `wdg-k7x2`
- **No signing, no expiry in the URL** — the event's `is_active` flag controls access server-side
- Human-readable (short enough to type if QR fails to scan)
- No guest auth embedded in QR — all guests share the same URL; identity established by nickname at upload time

### Why not a signed token in the URL?

A signed token (JWT with expiry) in the QR URL would add complexity without meaningful security benefit. The event URL is meant to be shared; guests all scan the same QR. The security model is:
- Organizer controls active/inactive state
- Photo limit enforced server-side per guest nickname
- Drive folder is owned by the organizer, not shared with guests

---

## Google Drive OAuth — Scope Strategy

**Required scope:** `https://www.googleapis.com/auth/drive.file`

| Scope | Access | Why Chosen |
|-------|--------|------------|
| `drive.file` | Only files created by this app | **Correct minimum scope** — app only needs to create/read files it owns. No access to organizer's existing Drive data. |
| `drive` | All Drive files | Overly broad — triggers security review, organizers would (rightly) distrust |
| `drive.readonly` | Read-only | Insufficient — we need to create files |

**Token lifecycle:**
1. Organizer grants Drive access once (OAuth consent screen)
2. Server stores `refresh_token` encrypted in DB
3. On each upload initiation, server checks `token_expiry`:
   - If valid: use stored `access_token`
   - If expired: call Google token endpoint with `refresh_token` → get new `access_token`, update DB
4. `accessType: "offline"` and `prompt: "select_account consent"` **must** be set on the OAuth flow to guarantee a refresh token is returned (confirmed via Better Auth docs — Google only issues refresh tokens on first consent unless forced)

---

## Multi-Tenancy Model

**Pattern: Row-level isolation in a shared schema**

Every table with organizer-owned data has `organizer_id` as a non-nullable FK. Every server query that touches organizer data includes `WHERE organizer_id = {session.organizerId}`.

```
organizers
    └── drive_credentials (1:1)
    └── events (1:N)
            └── upload_records (1:N, also has organizer_id denormalized)
```

**Isolation guarantees:**
- No event can be queried without matching `organizer_id` (enforced in all API routes)
- Drive credentials are 1:1 per organizer — no token sharing
- `upload_records.organizer_id` denormalized to enable fast isolation checks without join
- Guest upload route validates `event.organizer_id` before touching Drive credentials

**Why not separate schemas?** Overkill for v1. Row-level isolation is correct at this scale and requires no infrastructure complexity. Can migrate to schema-per-tenant if needed at 1000+ organizers.

---

## Session Model

### Organizer Sessions

- Better Auth manages session via HTTP-only cookie (DB-backed or JWT)
- Standard authenticated session; all dashboard routes require active session

### Guest Sessions (no auth)

- **No server-side session** — guests are stateless from the server's perspective
- **localStorage** stores `{nickname, eventSlug}` for duration of browser session
  - Allows "resume" UX if page is accidentally closed mid-upload
  - Cleared on successful upload completion or browser close
- **URL param carries event context** — `/e/{slug}` is all the state needed
- Guest nickname is captured at upload initiation time, stored in `upload_records`
- No cookies, no accounts, no tracking beyond what's in `upload_records`

---

## Component Communication

```
What talks to what:

Guest Browser
  ↔  Next.js Server (App Router + API Routes)
       - GET  /e/[slug]           → Event public info (SSR)
       - POST /api/upload/initiate → Start upload session
       - POST /api/upload/confirm  → Mark upload complete

Organizer Browser
  ↔  Next.js Server
       - POST /api/auth/signin          → Login
       - GET  /api/auth/google/drive    → Initiate Drive OAuth
       - GET  /api/auth/google/callback → Complete Drive OAuth
       - POST /api/events               → Create event
       - GET  /api/events               → List events
       - GET  /api/events/[id]/uploads  → Upload history

Next.js Server
  ↔  PostgreSQL (via Prisma)        → All persistent state
  ↔  Google OAuth endpoint          → Token exchange/refresh
  ↔  Google Drive API v3            → Create folders, initiate resumable sessions

Guest Browser (after receiving sessionUri)
  ↔  Google Drive Upload CDN        → PUT photo bytes directly
       (session URI is self-authenticating; no Authorization header)
```

---

## Suggested Build Order

Dependencies between components drive this order:

| # | Component | Depends On | Rationale |
|---|-----------|------------|-----------|
| 1 | **Database schema + Prisma setup** | — | Blocks everything |
| 2 | **Organizer auth (email/password)** | DB | Blocks all organizer-facing features |
| 3 | **Drive OAuth flow** | Auth (session needed to associate tokens) | Blocks event creation and uploads |
| 4 | **Event CRUD + slug generation** | Auth, Drive OAuth (folder creation) | Blocks QR code and guest flow |
| 5 | **QR code generation** | Events (need slug) | Blocks guest usage |
| 6 | **Guest upload page (UI only)** | Events (need to look up by slug) | Validate UX before wiring upload |
| 7 | **Upload initiation API** | Events, Drive OAuth, DB | Core upload flow — server half |
| 8 | **Client-side upload + confirm** | Upload initiation (needs session URI) | Core upload flow — client half |
| 9 | **Upload history (organizer view)** | upload_records table | Nice-to-have for organizer feedback |

**Critical path:** DB → Auth → Drive OAuth → Events → Guest Upload

The Drive OAuth integration is the highest-risk component (external OAuth flow, token encryption, refresh logic) and should be built and tested early rather than deferred.

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Server-brokered resumable upload (not server-proxy) | Server stays out of photo byte path; Drive tokens never reach guest browser; resumable is mobile-friendly for unreliable connections |
| `drive.file` scope (not `drive`) | Minimum viable permission; organizers only need app-created files managed; broader scope requires Google security review |
| Refresh token encrypted in DB (not in env var) | Per-organizer tokens must be stored per-row; env var only works for single-tenant |
| Slug-based QR URLs (not signed tokens) | Events are designed to be shared; `is_active` flag provides sufficient access control; signed URLs add complexity with no security benefit in this model |
| Row-level multi-tenancy (not schema-per-tenant) | Correct for v1 scale; no infra complexity; adding `organizerId` to every query is standard and auditable |
| localStorage for guest nickname (not server session) | Zero-friction guest UX is the core value; server sessions require cookie consent overhead and session management for anonymous users |
| denormalize `organizer_id` onto `upload_records` | Enables fast isolation checks on uploads without always joining through events |

---

## Scalability Considerations

| Concern | At 10 organizers | At 1K organizers | At 100K organizers |
|---------|-----------------|------------------|--------------------|
| DB | Single PG instance | Single PG, add read replica | Connection pooling (PgBouncer), consider sharding |
| Upload throughput | No bottleneck (direct to Google) | No bottleneck (direct to Google) | Rate limiting on initiation endpoint |
| Drive token refresh | Simple per-request check | Add token expiry caching in DB | Consider Redis for hot token cache |
| Slug uniqueness | DB unique constraint sufficient | DB unique constraint sufficient | Same — slugs are compact space |
| Multi-tenancy | Row-level sufficient | Row-level sufficient | Evaluate schema-per-tenant migration |

---

## Sources

- Google Drive API resumable upload: https://developers.google.com/workspace/drive/api/guides/manage-uploads (HIGH confidence — official docs via Context7)
- Google Drive API scopes: https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list (HIGH confidence — official docs via Context7)
- Better Auth Google OAuth refresh token pattern: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/google.mdx (HIGH confidence — official library docs via Context7)
- Better Auth token storage: https://github.com/better-auth/better-auth/blob/main/docs/content/docs/concepts/oauth.mdx (HIGH confidence — official library docs via Context7)
