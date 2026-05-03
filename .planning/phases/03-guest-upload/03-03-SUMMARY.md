---
phase: 03-guest-upload
plan: "03"
subsystem: e2e-verification
tags: [verification, middleware, mobile, smoke-test]
status: complete
completed_at: 2025-05-03
---

# Phase 3 — Plan 03: E2E Verification — COMPLETE

## What was verified

### Middleware audit
- `src/middleware.ts` matcher is `["/dashboard/:path*"]` — `/e/*` routes are fully public, no auth wall
- No changes required

### Automated checks (all passed)
- `POST /api/upload/[slug]` returns 200 with `{ driveFileId, fileName }` on valid upload
- No token data (`refresh_token`, `encryptedRefreshToken`, `decrypt`) in API responses
- No server-only imports (googleapis, drizzle, crypto) in `GuestUploadClient.tsx`
- XHR + `upload.onprogress` pattern confirmed present
- HEIC detection by MIME type + extension (both required for iOS Safari)
- TypeScript: zero errors in new files
- `npm run build`: passes, `/e/[slug]` shows as `ƒ Dynamic`

### Mobile smoke test (human checkpoint)
- QR scan on iPhone opens `https://wedding-pov-production.up.railway.app/e/[slug]` ✅
- Landing step renders with event name and nickname input ✅
- Nickname entry → Continue → photo selection step ✅
- iOS photo picker shows HEIC photos (accept="image/*,.HEIC,.heic") ✅
- Sequential upload with per-photo progress bars ✅
- Completion screen with 🎉 and photo count ✅
- Photos appear in Google Drive folder ✅

### Post-checkpoint improvement
- Added guest nickname prefix to Drive filenames: `[Nickname]_[filename].jpg`
- Keeps flat folder (all photos browsable at once) while showing uploader identity
- Nickname sanitised (spaces→underscores, non-word chars stripped)

## Requirements satisfied
| REQ-ID | Status |
|--------|--------|
| GUEST-01 | ✅ QR scan opens mobile upload page |
| GUEST-02 | ✅ Nickname entry before uploading |
| GUEST-03 | ✅ Photo limit enforced |
| GUEST-04 | ✅ Per-photo XHR progress bars |
| GUEST-05 | ✅ Completion confirmation screen |
| INFRA-01 | ✅ Photos uploaded to organizer's Drive folder |
| INFRA-02 | ✅ HEIC→JPEG server-side via heic-convert |
| INFRA-03 | ✅ Rate limiting (30 photos/15 min per IP:slug) |
| INFRA-04 | ✅ Server-brokered tokens — never reach guest browser |
