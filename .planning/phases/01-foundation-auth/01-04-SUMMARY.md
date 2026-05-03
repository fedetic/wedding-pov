# Plan 01-04 Summary: Railway Deployment

## Status: Complete

## What Was Done

- **Railway project created** from the `wedding-pov` GitHub repo (Next.js auto-detected via Nixpacks)
- **All 7 env vars configured** in Railway Variables tab: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`, `PORT`
- **Railway public domain** generated: `https://wedding-pov-production.up.railway.app`
- **GCP Authorized redirect URIs** updated to include: `https://wedding-pov-production.up.railway.app/api/drive/callback`
- **`joeysun95@gmail.com`** added as GCP test user

## Fixes Applied During Deployment

| Issue | Fix |
|-------|-----|
| 502 — app binding to Railway's internal port (8080) vs domain port (3000) | Added `PORT=3000` Railway env var |
| Better Auth "Invalid origin" error | Added `trustedOrigins` to `src/lib/auth.ts` |
| Drive callback redirecting to internal Railway IP | Changed all `request.url`-based redirects to use `BETTER_AUTH_URL` as base |
| `NEXT_PUBLIC_APP_URL` baked as localhost at build time | Updated Railway env var, triggered rebuild |

## Smoke Test Results

- ✅ Registration at Railway URL — user row created in Neon, redirect to `/dashboard`
- ✅ Login at Railway URL — session cookie set, authenticated dashboard shown
- ✅ Unauthenticated `/dashboard` redirect — middleware redirects to `/login`
- ✅ Drive OAuth connect — Google consent → `/dashboard?drive=connected`, encrypted token in Neon

## Security Verification

- ✅ Passwords stored as `scrypt(password, random_salt)` — memory-hard, properly salted
- ✅ All traffic over HTTPS (Railway default)
- ✅ Refresh tokens AES-256-GCM encrypted in `google_tokens.encrypted_refresh_token`
- ✅ `.env.local` never committed (gitignored)
