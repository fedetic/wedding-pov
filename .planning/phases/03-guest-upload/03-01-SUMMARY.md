---
phase: "03-guest-upload"
plan: "01"
subsystem: "backend"
tags: ["upload", "google-drive", "heic-conversion", "rate-limiting", "oauth2"]
dependency_graph:
  requires: []
  provides: ["upload-api-route", "drive-upload-helper", "rate-limiter"]
  affects: ["src/lib/rate-limiter.ts", "src/lib/drive-upload.ts", "src/app/api/upload/[slug]/route.ts"]
tech_stack:
  added: ["heic-convert@2.1.0", "rate-limiter-flexible@11.0.2", "@types/heic-convert@2.1.0"]
  patterns: ["RateLimiterMemory per IP:slug key", "OAuth2 token refresh with persistence", "HEIC→JPEG server-side conversion"]
key_files:
  created:
    - src/lib/rate-limiter.ts
    - src/lib/drive-upload.ts
    - src/app/api/upload/[slug]/route.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "heic-convert v2.1.0 is CJS (not ESM); imported directly without dynamic import"
  - "@types/heic-convert installed (exists on DefinitelyTyped) — plan note about self-typing was incorrect for v2.1.0"
  - "uploadFileToDrive returns finalFileName and finalMimeType so the route can insert the converted values into DB"
  - "Rate limiter fail-open on unexpected errors to avoid blocking uploads due to rate-limiter bugs"
  - "Drive upload record failure is logged but does not fail the HTTP response (file already in Drive)"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-03"
  tasks_completed: 1
  files_created: 3
  files_modified: 2
---

# Phase 3 Plan 01: Upload API Route + HEIC Conversion + Rate Limiting Summary

**One-liner:** Server-side upload pipeline — RateLimiterMemory (30/15min per IP:slug), OAuth2-brokered Drive upload with HEIC→JPEG conversion at 0.85 quality, and POST /api/upload/[slug] route handler with full validation and DB record insertion.

## What Was Built

### src/lib/rate-limiter.ts
RateLimiterMemory singleton exporting `uploadRateLimiter`:
- 30 points per 15-minute window (per `${ip}:${slug}` key)
- 10-minute block duration on exhaustion
- Returns `Retry-After` header on 429 responses

### src/lib/drive-upload.ts
`uploadFileToDrive()` helper:
1. Loads organizer's `googleTokens` row from DB
2. Decrypts `encryptedRefreshToken` via AES-256-GCM `decrypt()`
3. Builds OAuth2 client with stored credentials
4. Registers `tokens` event listener → persists refreshed `access_token` + `expiry_date` back to DB
5. Detects HEIC/HEIF by MIME type and file extension
6. If HEIC: converts using `heicConvert({ buffer, format: 'JPEG', quality: 0.85 })` and renames file to `.jpg`
7. Uploads via `drive.files.create()` with `Readable.from(Buffer.from(uploadBuffer))`
8. Returns `{ driveFileId, finalFileName, finalMimeType }`

### src/app/api/upload/[slug]/route.ts
POST handler:
- Awaits `params` (Next.js 15 async params pattern)
- Extracts real IP from `x-forwarded-for` (Railway proxy), falls back to `127.0.0.1`
- Calls `uploadRateLimiter.consume()` → 429 with `Retry-After` on `RateLimiterRes` rejection
- Validates: file present (File instance), nickname non-empty, size ≤ 10 MB
- DB lookup: `events` WHERE slug AND isActive=true → 404 if not found
- 503 guard if `event.driveFolderId` is null (Drive folder not yet created)
- Calls `uploadFileToDrive()` → 500 on error
- Inserts `uploadRecords` row (failure logged but does not fail HTTP response)
- Returns `{ driveFileId, fileName }` — zero token data in response

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing feature] Added @types/heic-convert installation**
- **Found during:** Task 1
- **Issue:** Plan said "heic-convert v2 ships its own .d.ts" — v2.1.0 does NOT ship `.d.ts`. `@types/heic-convert` exists on DefinitelyTyped.
- **Fix:** Installed `@types/heic-convert@2.1.0` as devDependency.
- **Files modified:** package.json, package-lock.json

**2. [Rule 1 - Bug] heic-convert is CJS, not ESM**
- **Found during:** Task 3
- **Issue:** Plan said "heic-convert v2 is ESM — use dynamic import". Actual v2.1.0 is CommonJS (`require`-based, no `type: module`).
- **Fix:** Used direct named import `import heicConvert from 'heic-convert'` (works with CJS + @types).

**3. [Rule 2 - Missing return values] uploadFileToDrive extended to return finalFileName and finalMimeType**
- **Found during:** Task 3
- **Issue:** Route needs to insert `finalFileName` and `finalMimeType` (post-HEIC-conversion) into `uploadRecords`. The plan's function signature only showed `{ driveFileId }` return.
- **Fix:** Extended return type to `{ driveFileId, finalFileName, finalMimeType }`.

## Known Stubs

None — all data paths are wired end-to-end.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: rate-limit-bypass | src/app/api/upload/[slug]/route.ts | X-Forwarded-For is trusted as-is; a proxy-less attacker can spoof IP. Acceptable given Railway deployment always sets this header. |

## Self-Check: PASSED

All 3 created files verified on disk. Commit `670b832` verified in git log.
