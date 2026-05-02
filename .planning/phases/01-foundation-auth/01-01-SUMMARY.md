# Plan 01-01 Summary: Bootstrap — Next.js 15, Dependencies, Schema, Crypto

## Status: Complete

## What Was Built

- **Next.js 15 project** scaffolded with TypeScript, Tailwind CSS, App Router, `src/` directory layout
- **Phase 1 npm dependencies** installed: `better-auth@1.6.9`, `@better-auth/drizzle-adapter@1.6.9`, `drizzle-orm@0.45.2`, `@neondatabase/serverless@1.1.0`, `googleapis@171.4.0`, `drizzle-kit@0.31.10`
- **Drizzle schema** (`src/lib/db/schema.ts`) with 7 tables:
  - Better Auth managed: `users`, `sessions`, `accounts`, `verifications`
  - Custom: `google_tokens` (encrypted refresh token storage), `events` (Phase 2 stub), `upload_records` (Phase 3 stub)
- **Neon HTTP client** (`src/lib/db/index.ts`) exporting `db` singleton
- **AES-256-GCM crypto utility** (`src/lib/crypto.ts`) with `encrypt`/`decrypt`, validates `ENCRYPTION_KEY` length on module load
- **drizzle.config.ts** pointing at schema and Neon PostgreSQL
- **.env.local** template created and gitignored; filled with real `DATABASE_URL`, `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`
- **Schema pushed to Neon** — all 7 tables live in production database

## Verification Results

- ✅ All packages installed and resolvable (`better-auth`, `drizzle-orm`, `googleapis`, `@neondatabase/serverless`)
- ✅ `src/lib/db/schema.ts` exports 7 `pgTable` definitions including `googleTokens.encryptedRefreshToken`
- ✅ `src/lib/crypto.ts` exports `encrypt` and `decrypt`
- ✅ `.env.local` exists with real values; gitignored
- ✅ Neon database contains all 7 tables (verified via query)

## Key Notes for Downstream Plans

- `drizzle-kit push` requires `node --env-file=.env.local` to load `DATABASE_URL` (dotenv not installed separately)
- `DATABASE_URL` contains `&channel_binding=require` — keep quotes when shell-exporting
- `ENCRYPTION_KEY` must remain exactly 64 hex chars; `crypto.ts` throws on startup if wrong length
