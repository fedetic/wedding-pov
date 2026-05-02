# Plan 01-03 Summary: Google Drive OAuth — Connect & Callback Routes

## Status: Complete

## What Was Built

- **`src/app/api/drive/connect/route.ts`** — Session-gated `GET` handler that builds a Google OAuth URL with:
  - Scope: `https://www.googleapis.com/auth/drive.file` (not the full `drive` scope — avoids security review)
  - `access_type: "offline"` to request a refresh token
  - `prompt: "select_account consent"` to force consent on every connect (guarantees a fresh refresh_token)
  - `state: session.user.id` to carry the organizer's ID through the OAuth round-trip
- **`src/app/api/drive/callback/route.ts`** — `GET` handler that:
  - Handles errors and missing params (redirects to `/dashboard?drive=error`)
  - Exchanges authorization code for tokens via `oauth2Client.getToken(code)`
  - Asserts `tokens.refresh_token` is non-null; if null, re-triggers `/api/drive/connect` (forces fresh consent)
  - Encrypts refresh token with AES-256-GCM via `encrypt()` before any DB write
  - UPSERTs into `google_tokens` with `onConflictDoUpdate` (one row per organizer)
  - Redirects to `/dashboard?drive=connected` on success

## Verification Results

- ✅ Both route files created and pass all content checks
- ✅ `drive.file` scope used (not full `drive`)
- ✅ `access_type: "offline"` and `prompt: "select_account consent"` present
- ✅ `userId` carried in `state` parameter
- ✅ `refresh_token` null-assertion and re-trigger logic present
- ✅ Refresh token encrypted before DB write
- ✅ UPSERT pattern with `onConflictDoUpdate`
- ✅ `npx tsc --noEmit` exits 0

## Key Notes for Downstream Plans

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are now in `.env.local`
- The redirect URI `http://localhost:3000/api/drive/callback` is registered in GCP Console for dev; Railway URL to be added in Plan 04
- Organizer is added as GCP Test User — prevents 7-day refresh token expiry during development
- Dashboard already handles `?drive=connected` and `?drive=error` feedback params (built in Plan 02)
- Token decryption for Drive API calls will use `decrypt(row.encryptedRefreshToken)` in Phase 2+
