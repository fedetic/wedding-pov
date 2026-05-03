---
phase: 03-guest-upload
plan: "02"
subsystem: guest-ui
tags: [next.js, react, client-component, xhr, state-machine, mobile]
dependency_graph:
  requires: [03-01-PLAN.md]
  provides: [guest-upload-ui]
  affects: [src/app/e, src/components/guest]
tech_stack:
  added: []
  patterns: [server-component-shell, client-state-machine, sequential-xhr-upload]
key_files:
  created:
    - src/app/e/[slug]/page.tsx
    - src/components/guest/GuestUploadClient.tsx
  modified: []
decisions:
  - Used db.select().from(events) instead of db.query.events.findFirst() — no Drizzle relations defined in schema
  - Inline EventNotFound and EventInactive components (no separate files) per plan spec
  - Friendly full-page error preferred over notFound() per plan notes
metrics:
  duration: "170s"
  completed: "2026-05-03T13:28:00Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 3 Plan 02: Guest Upload Page + 4-Step XHR State Machine UI Summary

**One-liner:** Mobile-first guest upload page with sequential XHR state machine (landing → nickname → photo select → upload → complete/error) using terracotta-rose palette and HEIC support.

## What Was Built

### Task 1 — Server Component: `src/app/e/[slug]/page.tsx`

- `export const dynamic = 'force-dynamic'` ensures real-time `isActive` checking
- DB lookup using `db.select().from(events).where(eq(events.slug, slug)).limit(1)` (no Drizzle relations defined)
- Inline `EventNotFound` and `EventInactive` components with friendly copy from UI-SPEC
- Passes serialisable props (`eventSlug`, `eventName`, `photoLimit`) to `GuestUploadClient`
- Route lives at `src/app/e/[slug]` — outside `(organizer)` group, not protected by middleware

### Task 2 — Client Component: `src/components/guest/GuestUploadClient.tsx`

- `'use client'` directive as first line
- 4-step state machine: `landing | select | upload | complete | error`
- Landing: nickname input → "Continue →"
- Select: hidden file input + styled label (`image/*,.HEIC,.heic`), thumbnail grid, over-limit validation, "Upload [N] photo(s) →" CTA
- Upload: sequential XHR loop, per-photo progress bars, ✓/× status indicators
- Complete: 🎉 emoji + count message
- Error: friendly message + "Try again" (returns to select step preserving photo list)
- No googleapis / drizzle / crypto imports — pure browser APIs only
- All interactive elements have `min-h-[44px]` touch targets

## Verification

```
npx tsc --noEmit 2>&1 | grep -E "src/app/e|src/components/guest"
# → no output (zero errors)

npm run build
# → ✓ Compiled successfully, /e/[slug] listed as ƒ (Dynamic)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Used select() instead of db.query.events.findFirst()**

- **Found during:** Task 1
- **Issue:** `db.query.events.findFirst()` requires Drizzle relations to be defined in schema; schema.ts has no `relations()` exports
- **Fix:** Used `db.select().from(events).where(eq(events.slug, slug)).limit(1)` with destructured array — equivalent result
- **Files modified:** `src/app/e/[slug]/page.tsx`
- **Commit:** 37ee605

## Known Stubs

None — all data is wired: event data comes from DB, upload posts to `/api/upload/[slug]`.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced in this plan. The `/e/[slug]` route is intentionally public (guest-facing QR landing).

## Self-Check: PASSED

- `src/app/e/[slug]/page.tsx` ✅ exists
- `src/components/guest/GuestUploadClient.tsx` ✅ exists
- Commit `37ee605` ✅ exists
