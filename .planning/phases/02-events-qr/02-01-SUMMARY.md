---
phase: 02-events-qr
plan: "01"
subsystem: backend
tags: [server-action, api-route, google-drive, drizzle, security]
dependency_graph:
  requires: []
  provides:
    - createEvent Server Action (Drive folder + DB insert)
    - PATCH /api/events/[id]/toggle (ownership-checked isActive toggle)
  affects:
    - src/app/actions/events.ts
    - src/app/api/events/[id]/toggle/route.ts
    - package.json
tech_stack:
  added:
    - qrcode ^1.5.4
    - nanoid ^5.1.11
    - "@types/qrcode ^1.5.6"
  patterns:
    - Server Action with "use server" directive
    - Drizzle ORM select/insert/update with ownership filters
    - AES-256-GCM token decrypt + Google Drive oauth2Client pattern
    - Next.js 15 async params in API routes
key_files:
  created:
    - src/app/actions/events.ts
    - src/app/api/events/[id]/toggle/route.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "slug format: {sanitized-event-name}-{nanoid(6)} — URL-safe, ~1B combinations, negligible collision risk"
  - "Drive folder created before DB insert — atomic: if Drive fails, no orphan DB row"
  - "Toggle route returns 404 for wrong owner (not 403) — avoids leaking event existence to other organizers"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
---

# Phase 02 Plan 01: Event Backend Primitives Summary

**One-liner:** `createEvent` Server Action with Drive folder creation + PATCH toggle route with IDOR protection using Drizzle's `and(organizerId, id)` filter.

## What Was Built

Two backend contracts that all Phase 2 UI (plans 02-02, 02-03) depends on:

1. **`src/app/actions/events.ts`** — `createEvent` Server Action
   - Auth-gated: returns `{ success: false, error: "Unauthorized" }` if no session
   - Server-side input validation: name (1–100 chars), photoLimit (1–100)
   - Checks Drive is connected before any API call; friendly error if not
   - Decrypts organizer's refresh token server-side, creates Google Drive folder
   - Only inserts event DB row after Drive folder succeeds (atomic)
   - Returns `{ success: true, slug }` on success; slug format: `{event-name}-{nanoid(6)}`

2. **`src/app/api/events/[id]/toggle/route.ts`** — PATCH route
   - Auth-gated: 401 if unauthenticated
   - Ownership verified with `and(eq(events.id, id), eq(events.organizerId, session.user.id))`
   - Returns 404 for wrong owner AND missing event (no information leak)
   - Flips `isActive` and returns `{ isActive: boolean }` on success

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `e7b1674` | feat(02-01): install qrcode/nanoid and implement createEvent Server Action |
| 2 | `33d7b99` | feat(02-01): implement PATCH toggle route with IDOR ownership check |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Coverage

All T-02-01 through T-02-05 mitigations implemented as specified:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-01 | IDOR: `and(eq(events.id), eq(events.organizerId))` in toggle route | ✅ Implemented |
| T-02-02 | Auth check at top of createEvent and toggle route | ✅ Implemented |
| T-02-03 | Refresh token decrypted server-side only; not logged | ✅ Implemented |
| T-02-04 | photoLimit: `Math.floor()` + bounds check 1–100 | ✅ Implemented |
| T-02-05 | name: `trim()` + length check 1–100 | ✅ Implemented |
| T-02-06 | DoS on Drive API: accepted (v1 has 1-2 organizers) | ✅ Accepted |

## Threat Flags

None — no new security surface beyond what the threat model covers.

## Known Stubs

None — this plan creates pure server-side logic with no UI; no stub data flows to any renderer.

## Self-Check: PASSED

- [x] `src/app/actions/events.ts` exists
- [x] `src/app/api/events/[id]/toggle/route.ts` exists
- [x] Commit `e7b1674` exists
- [x] Commit `33d7b99` exists
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run build` → success (route visible in build output as `/api/events/[id]/toggle`)
