# Phase 3: Guest Upload — Research

**Researched:** 2025-05-03  
**Domain:** File upload, HEIC conversion, Google Drive API, rate limiting, Next.js App Router  
**Confidence:** HIGH

---

## Summary

Phase 3 builds the guest-facing upload page at `/e/[slug]`. The primary complexity is the server-brokered upload pipeline: guest HEIC photos hit a Next.js API Route, get converted to JPEG on the server using a pure-WASM library, then get pushed to the organizer's Google Drive folder using stored tokens — all without Drive credentials touching the guest browser.

The routing architecture is straightforward: a Server Component page handles slug validation and data loading; a Client Component runs the step-machine UI with sequential XHR uploads for per-photo progress. Rate limiting uses an in-memory singleton (no Redis required).

**Primary recommendation:** API Route + `heic-convert` + `googleapis` + `RateLimiterMemory`. All packages already installed or pure-WASM. No native binaries, no new infra.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Slug validation & event data loading | Frontend Server (SSR) | — | Server Component page.tsx queries DB before any HTML reaches browser |
| Upload state machine (nickname → select → upload → done) | Browser / Client | — | Requires local state, file picker, XHR progress events |
| HEIC → JPEG conversion | API / Backend | — | Cannot expose organizer tokens; conversion must precede Drive upload |
| Drive upload | API / Backend | — | Organizer's OAuth tokens live server-side only (INFRA-04) |
| Rate limiting | API / Backend | — | IP extracted at route handler level; in-memory limiter on upload endpoint |
| Upload record persistence | API / Backend | Database / Storage | Route handler inserts upload_records row after Drive confirms |

---

## Q1: HEIC→JPEG Conversion

### Decision
**Use `heic-convert` (v2.1.0).** Do NOT use `sharp` for HEIC input.

### Rationale
`heic-convert` depends on `heic-decode` → `libheif-js` (v1.19.8), which is an **Emscripten/WASM build of libheif**. Zero native bindings. Works identically on macOS arm64 (dev) and Linux x64 (Railway) without recompilation. [VERIFIED: npm registry + heic-decode README]

`sharp` v0.34.5 supports HEIC _output_ (`heif()`) but HEIC _input_ requires `libvips` compiled with `libheif + libde265 + x265`. Sharp's docs note: "Support for patent-encumbered HEIC images using hevc compression requires the use of a globally-installed libvips compiled with support for libheif, libde265 and x265." The pre-built binaries distributed for Linux x64 do NOT guarantee HEIC input support. [VERIFIED: Context7 / sharp.pixelplumbing.com]

### API Pattern
```typescript
// Source: heic-convert README / npm catdad-experiments/heic-convert
import convert from 'heic-convert';
import { Readable } from 'stream';

async function heicToJpeg(inputBuffer: Buffer): Promise<Buffer> {
  const outputBuffer = await convert({
    buffer: inputBuffer,    // Buffer | Uint8Array
    format: 'JPEG',
    quality: 0.92,          // 0–1; 0.92 matches camera-quality output
  });
  return Buffer.from(outputBuffer);
}
```

### Detection Logic
Not every uploaded file is HEIC — iOS Photo Library exports HEIC by default but also serves JPEG when selected differently. Detect HEIC by MIME type OR magic bytes:

```typescript
function isHeic(mimeType: string, filename: string): boolean {
  return (
    mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    filename.toLowerCase().endsWith('.heic') ||
    filename.toLowerCase().endsWith('.heif')
  );
}
```

### Installation
```bash
npm install heic-convert
# TypeScript types: heic-convert ships its own .d.ts
```

### Gotchas
- **Memory**: HEIC decoding in WASM is CPU-bound and loads the full image into memory. A 10 MB HEIC (12MP) expands to ~36 MB as RGBA pixel data during conversion. Railway's default container (512 MB RAM) handles this fine for sequential uploads, but concurrent conversions could pressure memory.
- **Cold start**: WASM module initialises on first call (~200 ms). Subsequent calls are fast.
- **No streaming**: `heic-convert` operates on a complete `Buffer`, not a stream. The full file must be in memory. Fine for 3–10 MB photos.

---

## Q2: Drive Resumable Upload (Server-Brokered)

### Decision
**Use `googleapis` v171.4.0 (already installed).** Call `drive.files.create()` with `media.body` as a `Readable` stream created from the converted JPEG buffer. The library selects multipart vs resumable upload automatically based on file size.

### Flow
```
POST /api/upload/[slug]
  1. Parse multipart/form-data → get file buffer + nickname
  2. HEIC→JPEG conversion (if needed)
  3. Load organizer's tokens from googleTokens table
  4. Create OAuth2Client, setCredentials(refresh_token + cached access_token)
  5. drive.files.create({ requestBody: { name, parents }, media: { mimeType, body: Readable } })
  6. googleapis auto-refreshes token if expired; 'tokens' event updates DB cache
  7. Insert upload_records row with driveFileId + status='confirmed'
  8. Return { ok: true, fileName } to client
```

### Code Pattern
```typescript
// Source: Context7 / googleapis.dev/nodejs/googleapis
import { google } from 'googleapis';
import { Readable } from 'stream';
import { decrypt } from '@/lib/crypto';

async function uploadToDrive(
  jpegBuffer: Buffer,
  fileName: string,
  driveFolderId: string,
  organizerId: string,
  tokenRow: { encryptedRefreshToken: string; accessToken: string | null; accessTokenExpiresAt: Date | null }
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );

  const refreshToken = decrypt(tokenRow.encryptedRefreshToken);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: tokenRow.accessToken ?? undefined,
    expiry_date: tokenRow.accessTokenExpiresAt?.getTime() ?? undefined,
  });

  // Persist refreshed tokens back to DB to avoid unnecessary token exchanges
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db.update(googleTokens)
        .set({
          accessToken: tokens.access_token,
          accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          updatedAt: new Date(),
        })
        .where(eq(googleTokens.userId, organizerId));
    }
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [driveFolderId],
    },
    media: {
      mimeType: 'image/jpeg',
      body: Readable.from(jpegBuffer),
    },
    fields: 'id',
  });

  return res.data.id!;
}
```

### Multipart vs Resumable
For files under ~5 MB the googleapis library uses a multipart upload (metadata + binary in one request). For files over ~5 MB it automatically switches to resumable uploads. This is transparent — callers always use `drive.files.create()`. [ASSUMED — Google's own client library documentation notes this threshold; not verified against v171.4.0 source.]

### Gotcha: token row must be loaded fresh per request
The `googleTokens` table stores the _organizer's_ token (looked up via `events.organizerId`). The upload route must join events → googleTokens to find the right credentials:

```typescript
const [row] = await db
  .select({ /* event + token fields */ })
  .from(events)
  .innerJoin(googleTokens, eq(googleTokens.userId, events.organizerId))
  .where(eq(events.slug, slug))
  .limit(1);
```

---

## Q3: Rate Limiting (No Redis)

### Decision
**Use `rate-limiter-flexible` v11.0.2 with `RateLimiterMemory`.** Instantiate as a module-level singleton.

### Rationale
- No Redis, no additional infra, no Upstash account required. [VERIFIED: npm registry]
- `RateLimiterMemory` is purpose-built for this use case. The API is clean: throw-on-exceed pattern.
- Railway caveat: in-memory rate limiters don't share state across multiple instances. For a wedding app with bursty but low traffic, this is acceptable. Guests who hit limits will be rate-limited on their specific server instance, which is sufficient for anti-abuse. [ASSUMED — Railway instance count for hobby-tier projects]

### Rate Limit Key
Use `ip:slug` — limits per IP per event. A guest uploading 20 photos to event "abc" is a different bucket from the same IP uploading to event "xyz":

```
key = `${clientIp}:${slug}`
```

### Sensible Limits
For photo upload (each photo is one POST):
- **30 points per 15 minutes per key** — allows a guest to upload 30 photos (~50% more than the 20-photo limit), with headroom for retries after network errors.
- Block for 10 minutes after limit exceeded.

### Code Pattern
```typescript
// Source: Context7 / animir/node-rate-limiter-flexible
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Module-level singleton — persists across requests in same process
const uploadRateLimiter = new RateLimiterMemory({
  points: 30,        // 30 requests
  duration: 900,     // per 15 minutes
  blockDuration: 600, // block 10 min after exhaustion
});

async function checkRateLimit(ip: string, slug: string): Promise<void> {
  try {
    await uploadRateLimiter.consume(`${ip}:${slug}`);
  } catch {
    throw new Response(JSON.stringify({ error: 'Too many uploads. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
```

### IP Extraction in Next.js App Router
Railway sets `x-forwarded-for`. Extract in the route handler:

```typescript
function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0'
  );
}
```

### Installation
```bash
npm install rate-limiter-flexible
```

---

## Q4: Upload Progress (XHR vs fetch)

### Decision
**Use XHR with `xhr.upload.addEventListener('progress', handler)`.** Do not use `fetch`.

### Rationale
The `fetch` API does not expose upload progress events. XHR's `upload.onprogress` is the standard browser mechanism for per-file upload progress. iOS Safari 12+ fully supports `xhr.upload` progress events. [VERIFIED: UI spec line 487 + MDN knowledge / ASSUMED for iOS Safari version range]

### Pattern (confirmed in UI spec)
```typescript
// Source: UI-SPEC.md line 487; standard XHR pattern
function uploadFile(
  slug: string,
  file: File,
  nickname: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nickname', nickname);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', `/api/upload/${slug}`);
    xhr.send(formData);
  });
}
```

### Sequential Upload Loop
```typescript
for (let i = 0; i < files.length; i++) {
  setCurrentIndex(i);
  await uploadFile(slug, files[i], nickname, (pct) => {
    setProgress((prev) => ({ ...prev, [i]: pct }));
  });
}
```

### beforeunload Warning
The UI spec specifies: during Step 3 (upload in progress) use the browser's default `beforeunload` dialog — no custom dialog needed. Add/remove the listener around the upload loop:

```typescript
const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
window.addEventListener('beforeunload', handleBeforeUnload);
// ... await all uploads ...
window.removeEventListener('beforeunload', handleBeforeUnload);
```

---

## Q5: iOS HEIC File Input

### Decision
**Use `accept="image/*,.HEIC,.heic"`.** Both parts are required.

### Rationale
The UI spec (line 214, line 480) explicitly documents:
> "`image/*` alone does not reliably surface HEIC files in iOS Safari's photo picker." The explicit `.HEIC,.heic` suffixes force inclusion of HEIC files.

[VERIFIED: UI-SPEC.md — specification was authored with iOS Safari testing in scope]

### Exact Attribute
```html
<input
  type="file"
  accept="image/*,.HEIC,.heic"
  multiple
  className="sr-only"
/>
```

### Gotchas
- **No `<label htmlFor>` pattern**: Use `.click()` imperatively on the input ref instead. The UI spec (line 481) notes this gives more control over when the picker opens.
- **iOS reports HEIC MIME type as `image/heic`** — some older iOS versions may report it as `application/octet-stream`. Detection must also check file extension (see Q1 detection logic).
- **`multiple` attribute**: Required to allow multi-file selection. The client enforces the `photoLimit` cap before upload begins.

---

## Q6: Server Action vs API Route for File Upload

### Decision
**Use API Route at `POST /api/upload/[slug]`**. Do not use a Server Action.

### Rationale

| Factor | Server Action | API Route |
|---|---|---|
| Default body limit | **1 MB** (configurable to max ~3 MB) | **10 MB** (buffered; configurable) |
| XHR progress events | Not applicable (POST is handled differently) | ✅ Standard `multipart/form-data` POST |
| `request.formData()` | ✅ | ✅ |
| Compatible with XHR | Requires Next.js Action protocol | ✅ Plain HTTP POST |

[VERIFIED: Context7 / nextjs.org docs — `serverActions.bodySizeLimit` defaults to 1MB; `proxyClientMaxBodySize` defaults to 10MB]

Since photos can be 3–10 MB HEIC files and the client uses XHR for progress events, API Route is the only viable choice.

### Route Path (from UI spec)
```
POST /api/upload/[slug]
Content-Type: multipart/form-data
Body: file (binary) + nickname (string)
```

### Route Handler Pattern
```typescript
// src/app/api/upload/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },  // Next.js 15+: params is a Promise
) {
  const { slug } = await params;
  // 1. Rate limit check (ip:slug)
  // 2. formData() → extract file + nickname
  // 3. Validate: event exists, isActive, driveFolderId set
  // 4. HEIC→JPEG if needed
  // 5. Upload to Drive
  // 6. Insert upload_records row
  // 7. Return { ok: true, fileName }
}
```

### Body Size — Next.js Config
No config change needed for 10 MB limit — that's the default. If files regularly exceed 10 MB (e.g., RAW photos), add to `next.config.ts`:

```typescript
// Only add if photos regularly exceed 10 MB (uncommon)
const nextConfig = {
  experimental: {
    proxyClientMaxBodySize: 20 * 1024 * 1024, // 20 MB
  },
};
```

---

## Q7: Slug Lookup + Event Validation

### Decision
**Server Component page at `/e/[slug]/page.tsx` + Client Component `<UploadClient />`.**

### Pattern
```typescript
// src/app/e/[slug]/page.tsx — Server Component
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { UploadClient } from './UploadClient';

export default async function GuestUploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;  // Next.js 15+: await params

  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      photoLimit: events.photoLimit,
      isActive: events.isActive,
      driveFolderId: events.driveFolderId,
    })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);

  if (!event) notFound();  // → 404 page

  // Pass only what the client needs — no sensitive data
  return (
    <UploadClient
      slug={slug}
      eventName={event.name}
      photoLimit={event.photoLimit}
      isActive={event.isActive}
    />
  );
}
```

### Key Design Decisions
- `notFound()` for missing slug → renders Next.js 404 page (no slug enumeration leak)
- `isActive: false` is passed to the client; the client renders the "Event not accepting photos" screen (UI spec line 335–344). This is intentional — the server knows the state, and we pass it to the client rather than returning 404 for inactive events (which would be confusing to guests who had a valid QR code).
- `driveFolderId` is NOT passed to the client — it stays server-side only.
- Middleware currently only protects `/dashboard/:path*` — no middleware changes needed for `/e/:path*`. [VERIFIED: src/middleware.ts]

### File Structure
```
src/app/e/
└── [slug]/
    ├── page.tsx        # Server Component — slug validation + data loading
    └── UploadClient.tsx # 'use client' — step machine + XHR uploads
```

---

## Q8: Token Refresh for Drive

### Decision
**Use `googleapis` OAuth2Client with `setCredentials()` + `'tokens'` event listener to persist refreshed tokens back to DB.**

### Pattern
The `googleapis` OAuth2Client automatically refreshes expired access tokens when you set a `refresh_token` and make an API call. No manual refresh logic needed.

```typescript
// Source: Context7 / googleapis.dev/nodejs/googleapis — "Handling refresh tokens"
import { google } from 'googleapis';
import { db } from '@/lib/db';
import { googleTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

async function getAuthedDriveClient(
  organizerId: string,
  tokenRow: {
    encryptedRefreshToken: string;
    accessToken: string | null;
    accessTokenExpiresAt: Date | null;
  }
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );

  const refreshToken = decrypt(tokenRow.encryptedRefreshToken);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    // Provide cached access token + expiry to avoid unnecessary roundtrips
    access_token: tokenRow.accessToken ?? undefined,
    expiry_date: tokenRow.accessTokenExpiresAt?.getTime() ?? undefined,
  });

  // When a new access token is issued, persist it to avoid hitting /token on every request
  oauth2Client.on('tokens', async (tokens) => {
    await db
      .update(googleTokens)
      .set({
        accessToken: tokens.access_token ?? null,
        accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      })
      .where(eq(googleTokens.userId, organizerId));
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}
```

### Why This Works Without Better Auth
Better Auth manages the organizer's _session_ tokens. The Google Drive OAuth tokens live in the separate `googleTokens` table, encrypted. The upload route never touches Better Auth — it:
1. Finds the event by slug → gets `organizerId`
2. Queries `googleTokens` where `userId = organizerId`
3. Decrypts the refresh token with `decrypt()` from `src/lib/crypto.ts`
4. Passes it directly to googleapis

### Error Case: No Drive Connected
If the organizer hasn't connected Drive, `googleTokens` row won't exist. The upload route should return:
```json
{ "error": "event_not_ready" }  // HTTP 503
```
Clients show a generic error — no internal detail exposed.

---

## Standard Stack

### Packages to Install
```bash
npm install heic-convert rate-limiter-flexible
# Note: googleapis already installed (v171.4.0)
```

### Core Libraries
| Library | Version | Purpose | Notes |
|---|---|---|---|
| `heic-convert` | 2.1.0 | HEIC→JPEG server-side | Pure WASM, no native binaries [VERIFIED: npm] |
| `rate-limiter-flexible` | 11.0.2 | In-memory rate limiting | `RateLimiterMemory`, no Redis needed [VERIFIED: npm] |
| `googleapis` | 171.4.0 | Drive file upload + OAuth2 | Already installed [VERIFIED: package.json] |
| `lru-cache` | 11.3.5 | Optional: event data cache | Already in node_modules (transitive dep) [VERIFIED: npm] |

### Supporting (already available)
| Library | Source | Purpose |
|---|---|---|
| `drizzle-orm` | Existing | DB queries (events, uploadRecords, googleTokens) |
| `@neondatabase/serverless` | Existing | Neon PostgreSQL connection |
| `nanoid` | Existing | Unique IDs for uploadRecord rows |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| HEIC decoding | Custom C binding / sharp workaround | `heic-convert` | Patent-encumbered format; pure WASM implementation handles edge cases |
| Token refresh | Manual `/token` endpoint calls | `googleapis` OAuth2Client auto-refresh | Handles expiry timing, 401 retry, concurrent refresh dedup |
| Rate limiting counters | Custom Map + setInterval | `RateLimiterMemory` | Handles clock drift, TTL expiry, blocking duration correctly |
| Upload progress | Server-Sent Events / polling | XHR `upload.onprogress` | Native browser API, works offline-first, iOS compatible |
| File type detection | Extension-only check | MIME type + extension both checked | iOS sometimes reports `application/octet-stream` for HEIC |

---

## Common Pitfalls

### Pitfall 1: Sharp HEIC Input Fails on Railway
**What goes wrong:** `sharp(buffer).jpeg().toBuffer()` throws "Input file is missing or of an unsupported image format" for HEIC files on Railway Linux.  
**Why it happens:** Sharp's prebuilt libvips for Linux does not include libheif (HEIC decoder) by default. It must be compiled in.  
**How to avoid:** Use `heic-convert` instead. Never call `sharp` on HEIC input.  
**Warning signs:** Works on macOS dev (Homebrew libvips includes libheif) but fails in CI/production.

### Pitfall 2: Server Action 1 MB Body Limit
**What goes wrong:** Server Action receives truncated file; conversion throws.  
**Why it happens:** `serverActions.bodySizeLimit` defaults to 1 MB.  
**How to avoid:** Use API Route at `/api/upload/[slug]`, not a Server Action.

### Pitfall 3: `params` Not Awaited in Next.js 15+
**What goes wrong:** TypeScript error or runtime crash when accessing `params.slug` synchronously.  
**Why it happens:** Next.js 15+ makes `params` a Promise in both `page.tsx` and route handlers.  
**How to avoid:** Always `const { slug } = await params;` — consistent with existing code (see `toggle/route.ts`).  
**Warning signs:** Existing codebase already uses `const { id } = await params;` pattern.

### Pitfall 4: In-Memory Rate Limiter Resets on Deploy
**What goes wrong:** Rate limit counters reset to zero on every Railway deploy or instance restart.  
**Why it happens:** `RateLimiterMemory` state lives in the Node.js process.  
**How to avoid:** Acceptable for this app. Document it. If stricter limiting is needed later, add Upstash Redis.

### Pitfall 5: iOS Reports HEIC MIME as `application/octet-stream`
**What goes wrong:** Server sees MIME type as `application/octet-stream`, skips HEIC conversion, sends raw HEIC bytes to Drive.  
**Why it happens:** Older iOS Safari versions don't set correct MIME type for HEIC files.  
**How to avoid:** Check both MIME type and file extension for HEIC detection (see Q1 detection pattern).

### Pitfall 6: `fetch` Instead of XHR for Upload
**What goes wrong:** Progress bar stays at 0% throughout upload, then jumps to 100%.  
**Why it happens:** `fetch` API does not expose upload progress events.  
**How to avoid:** Use XHR with `xhr.upload.addEventListener('progress', ...)`.

### Pitfall 7: Drive Upload Without `parents`
**What goes wrong:** File uploads to Drive root, not the event folder.  
**Why it happens:** `drive.files.create()` defaults to root if `parents` not specified.  
**How to avoid:** Always pass `requestBody: { parents: [driveFolderId] }`.

### Pitfall 8: Organizer Has No Drive Connected
**What goes wrong:** `googleTokens` query returns empty; `decrypt()` throws on null.  
**Why it happens:** Organizer created an event but never completed Drive OAuth.  
**How to avoid:** Guard with explicit null check before decryption; return HTTP 503 with `event_not_ready` error code.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── e/
│   │   └── [slug]/
│   │       ├── page.tsx           # Server Component — slug validation, event data load
│   │       └── UploadClient.tsx   # 'use client' — step machine, XHR, progress UI
│   └── api/
│       └── upload/
│           └── [slug]/
│               └── route.ts       # POST — rate limit → formData → heic→jpeg → drive → db
├── lib/
│   ├── drive.ts                   # getAuthedDriveClient() helper (token refresh logic)
│   ├── heic.ts                    # heicToJpeg() helper
│   └── rate-limit.ts              # uploadRateLimiter singleton
```

### System Architecture Diagram
```
Guest browser (iOS Safari)
  │
  │  1. GET /e/[slug]
  ▼
Next.js Server Component (page.tsx)
  │  queries events table by slug
  │  passes { eventName, photoLimit, isActive } to client
  ▼
UploadClient (React, 'use client')
  │  Step 1: nickname input
  │  Step 2: file picker (accept="image/*,.HEIC,.heic")
  │  Step 3: sequential XHR uploads (one file at a time)
  │
  │  POST /api/upload/[slug]  multipart/form-data
  │  xhr.upload.onprogress → updates progress bar
  ▼
API Route Handler (/api/upload/[slug]/route.ts)
  │  1. Extract IP → RateLimiterMemory.consume(ip:slug) → 429 if exceeded
  │  2. formData() → file buffer + nickname
  │  3. Query events JOIN googleTokens WHERE slug=?
  │  4. isHeic() check → heic-convert if needed → JPEG buffer
  │  5. getAuthedDriveClient(organizerId, tokenRow)
  │  6. drive.files.create({ name: "{nickname}_{idx}.jpg", parents: [driveFolderId] })
  │  7. db.insert(uploadRecords) with driveFileId + status='confirmed'
  │  8. Return { ok: true, fileName }
  ▼
Google Drive API (organizer's folder)
  │
  └── File stored in driveFolderId
```

---

## Environment Availability

All dependencies are available in the current environment.

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | Runtime | ✓ | v20.19.6 | — |
| `googleapis` | Drive upload | ✓ (installed) | 171.4.0 | — |
| `heic-convert` | HEIC conversion | ✗ (not yet installed) | 2.1.0 latest | — |
| `rate-limiter-flexible` | Rate limiting | ✗ (not yet installed) | 11.0.2 latest | — |
| Neon PostgreSQL | Upload records | ✓ (existing) | — | — |
| Railway Linux x64 | Deployment | ✓ [ASSUMED] | — | — |

**Missing dependencies with no fallback:**
- `heic-convert` — required for INFRA-02; install in Wave 0
- `rate-limiter-flexible` — required for INFRA-03; install in Wave 0

---

## Code Examples

### Full Upload Route Handler Skeleton
```typescript
// src/app/api/upload/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events, googleTokens, uploadRecords } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { uploadRateLimiter } from '@/lib/rate-limit';
import { heicToJpeg, isHeic } from '@/lib/heic';
import { getAuthedDriveClient } from '@/lib/drive';
import { nanoid } from 'nanoid';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '0.0.0.0'
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const ip = getClientIp(request);

  // 1. Rate limiting
  try {
    await uploadRateLimiter.consume(`${ip}:${slug}`);
  } catch {
    return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 });
  }

  // 2. Parse form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const nickname = (formData.get('nickname') as string | null)?.trim();
  const indexStr = formData.get('index') as string | null;

  if (!file || !nickname || indexStr === null) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const index = parseInt(indexStr, 10);
  const paddedIndex = String(index + 1).padStart(3, '0');

  // 3. Load event + tokens
  const [row] = await db
    .select({
      eventId: events.id,
      organizerId: events.organizerId,
      isActive: events.isActive,
      driveFolderId: events.driveFolderId,
      encryptedRefreshToken: googleTokens.encryptedRefreshToken,
      accessToken: googleTokens.accessToken,
      accessTokenExpiresAt: googleTokens.accessTokenExpiresAt,
    })
    .from(events)
    .innerJoin(googleTokens, eq(googleTokens.userId, events.organizerId))
    .where(eq(events.slug, slug))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
  }
  if (!row.isActive) {
    return NextResponse.json({ error: 'event_inactive' }, { status: 403 });
  }
  if (!row.driveFolderId) {
    return NextResponse.json({ error: 'event_not_ready' }, { status: 503 });
  }

  // 4. HEIC→JPEG if needed
  let jpegBuffer = Buffer.from(await file.arrayBuffer());
  if (isHeic(file.type, file.name)) {
    jpegBuffer = await heicToJpeg(jpegBuffer);
  }

  // 5. Upload to Drive
  const sanitizedNickname = nickname.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  const fileName = `${sanitizedNickname}_${paddedIndex}.jpg`;

  const drive = await getAuthedDriveClient(row.organizerId, row);
  const driveFile = await drive.files.create({
    requestBody: { name: fileName, parents: [row.driveFolderId] },
    media: { mimeType: 'image/jpeg', body: Readable.from(jpegBuffer) },
    fields: 'id',
  });

  // 6. Record upload
  await db.insert(uploadRecords).values({
    id: nanoid(),
    eventId: row.eventId,
    organizerId: row.organizerId,
    guestNickname: nickname,
    fileName,
    mimeType: 'image/jpeg',
    fileSizeBytes: jpegBuffer.byteLength,
    driveFileId: driveFile.data.id!,
    status: 'confirmed',
    confirmedAt: new Date(),
  });

  return NextResponse.json({ ok: true, fileName });
}
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | googleapis multipart/resumable threshold is ~5MB | Q2 | Low — transparent to caller; library handles it |
| A2 | Railway hobby-tier runs single instance | Q3 | Low — in-memory rate limiting still works per instance; just doesn't aggregate across instances |
| A3 | Railway Linux/x64 prebuilt environment available | Environment | Low — Railway has been Linux x64 since inception |
| A4 | iOS Safari supports XHR upload.onprogress | Q4 | Medium — well-documented but not verified in current session |

---

## Open Questions

1. **Filename sanitization depth**
   - What we know: nickname is free text entered by guest.
   - What's unclear: should we sanitize at DB-insert time or at filename-generation time, or both?
   - Recommendation: sanitize both — strip non-alphanumeric at filename generation, store raw nickname in DB.

2. **Drive folder existence check**
   - What we know: `driveFolderId` is stored in events table.
   - What's unclear: should the upload route verify the folder still exists in Drive before uploading?
   - Recommendation: skip the existence pre-check; let Drive return a 404 which the route translates to `event_not_ready`.

3. **What to do if Drive upload succeeds but DB insert fails**
   - What we know: both operations happen in sequence.
   - What's unclear: should there be a compensating transaction (delete from Drive)?
   - Recommendation: leave orphaned Drive files; they're harmless and recovery is complex. Log the error.

---

## Sources

### Primary (HIGH confidence)
- Context7 / `sharp.pixelplumbing.com` — HEIC input requires compiled libheif; prebuilts may not include it
- Context7 / `googleapis.dev/nodejs/googleapis` — `drive.files.create()` with stream, `setCredentials()` pattern, `'tokens'` event
- Context7 / `animir/node-rate-limiter-flexible` — `RateLimiterMemory` API
- Context7 / `nextjs.org` — `serverActions.bodySizeLimit` (1 MB default), `proxyClientMaxBodySize` (10 MB default), async params pattern
- `src/middleware.ts` — confirmed `/e/:path*` not guarded
- `package.json` — confirmed googleapis 171.4.0 installed
- `heic-convert` README — pure Buffer API, quality param
- `libheif-js` npm page — confirmed Emscripten/WASM (not native)
- `03-UI-SPEC.md` — XHR pattern, accept attribute, sequential upload, step machine architecture

### Secondary (MEDIUM confidence)
- npm registry — heic-convert 2.1.0, rate-limiter-flexible 11.0.2, lru-cache 11.3.5, sharp 0.34.5

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry and Context7
- Architecture: HIGH — confirmed against existing codebase patterns and UI spec
- Pitfalls: MEDIUM — most verified; iOS Safari XHR progress assumed from training

**Research date:** 2025-05-03  
**Valid until:** 2025-06-03 (stable ecosystem)
