---
phase: 02-events-qr
plan: "02"
subsystem: frontend
tags: [react, next.js, server-component, client-component, drizzle, tailwind, optimistic-ui]
dependency_graph:
  requires:
    - 02-01 (createEvent Server Action + PATCH toggle route)
  provides:
    - EventList Server Component (queries DB by organizerId)
    - EventRow Client Component (optimistic toggle + QR stub)
    - CreateEventForm Client Component (calls createEvent Server Action)
    - EventCreatedBanner Client Component (auto-dismisses after 3s)
    - /dashboard/events/new page
    - Updated /dashboard page with live EventList
  affects:
    - src/components/events/StatusBadge.tsx
    - src/components/events/EventRow.tsx
    - src/components/events/EventListClient.tsx
    - src/components/events/EventList.tsx
    - src/components/events/CreateEventForm.tsx
    - src/components/events/EventCreatedBanner.tsx
    - src/app/(organizer)/dashboard/events/new/page.tsx
    - src/app/(organizer)/dashboard/page.tsx
tech_stack:
  added: []
  patterns:
    - Server Component querying Drizzle ORM, passing rows to Client Component
    - Optimistic UI with useState + revert on fetch error
    - Client Component calling Server Action directly (no fetch)
    - useEffect-based auto-dismiss banner
key_files:
  created:
    - src/components/events/StatusBadge.tsx
    - src/components/events/EventRow.tsx
    - src/components/events/EventListClient.tsx
    - src/components/events/EventList.tsx
    - src/components/events/CreateEventForm.tsx
    - src/components/events/EventCreatedBanner.tsx
    - src/app/(organizer)/dashboard/events/new/page.tsx
  modified:
    - src/app/(organizer)/dashboard/page.tsx
decisions:
  - "EventListClient introduced as thin Client Component wrapper so EventList can stay a Server Component while managing shared toggle error state"
  - "EventData type exported from EventRow.tsx so EventListClient can import it without circular dependency"
  - "QR button onClick is a no-op stub (Plan 02-03 wires QRModal); data-slug + data-qr-trigger attributes left as breadcrumbs"
  - "EventCreatedBanner rendered conditionally in dashboard Server Component (eventStatus === 'created'); auto-dismiss handled client-side with useEffect"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-01"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 1
---

# Phase 02 Plan 02: Event Management UI Summary

**One-liner:** Event list table (Server Component + optimistic-toggle Client Component) and Create Event form wired to the createEvent Server Action, with auto-dismiss success banner on redirect.

## What Was Built

Six component files and two page updates that turn Plan 02-01's backend into a working organizer UI:

1. **`src/components/events/StatusBadge.tsx`** — Pure display, no hooks. Renders `Active` (`bg-green-100 text-green-800`) or `Inactive` (`bg-gray-100 text-gray-600`) pill badges.

2. **`src/components/events/EventRow.tsx`** — Client Component. Renders one table row per event. Optimistic toggle: flips `isActive` immediately via `useState`, sends `PATCH /api/events/[id]/toggle`, syncs with server truth on success, reverts + calls `onToggleError` on failure. QR button is a no-op stub (`onClick={() => {}}`) with `data-qr-trigger` attribute for Plan 02-03. Exports `EventData` type.

3. **`src/components/events/EventListClient.tsx`** — Client Component. Manages shared `toggleError` state passed to each `EventRow`. Renders empty state ("No events yet") or the full `<table>` depending on `initialEvents.length`.

4. **`src/components/events/EventList.tsx`** — Server Component. Queries `events` table via Drizzle (`eq(events.organizerId, userId)`), passes rows to `EventListClient`. No `"use client"` directive.

5. **`src/components/events/CreateEventForm.tsx`** — Client Component. Controlled form (name, photoLimit, isActive). On submit calls `createEvent` Server Action directly; on success redirects to `/dashboard?event=created`; on failure renders error banner below submit button.

6. **`src/components/events/EventCreatedBanner.tsx`** — Client Component. Renders green `✓ Event created.` banner, auto-dismisses after 3 seconds via `useEffect` + `setTimeout`.

7. **`src/app/(organizer)/dashboard/events/new/page.tsx`** — Static Server Component shell. Back link + `h1 "Create event"` + `<CreateEventForm />`. Auth enforced by existing middleware.

8. **`src/app/(organizer)/dashboard/page.tsx`** — Updated to import `EventList` + `EventCreatedBanner`. Replaced placeholder Events section with live table. Added `?event=created` handling. Updated Drive section to use `font-semibold` (design system compliance: `font-medium` → `font-semibold`).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `5e9f1b9` | feat(02-02): create event display components (StatusBadge, EventRow, EventListClient, EventList, CreateEventForm) |
| 2 | `5f80f97` | feat(02-02): add /dashboard/events/new page and update dashboard with EventList |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Design System] Replaced `font-medium` with `font-semibold` in Google Drive section**
- **Found during:** Task 2 (updating dashboard/page.tsx)
- **Issue:** Existing dashboard used `font-medium` on the "Google Drive" h2 heading and "Connect Google Drive" button, violating the locked design system rule (only `font-normal` and `font-semibold` allowed)
- **Fix:** Changed `font-medium` → `font-semibold` on the h2 and button in the Google Drive section
- **Files modified:** `src/app/(organizer)/dashboard/page.tsx`
- **Commit:** `5f80f97`

## Threat Model Coverage

All T-02-07 through T-02-10 mitigations applied as specified:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-07 | Client HTML constraints (`maxLength`, `min`, `max`) as UX hints; server validation in `createEvent()` is enforcement layer | ✅ Implemented |
| T-02-08 | `EventList` receives `userId` from `session.user.id` (not URL params); Drizzle query uses `eq(events.organizerId, userId)` | ✅ Implemented |
| T-02-09 | `?event=created` banner shows only cosmetic copy — accepted as no security impact | ✅ Accepted |
| T-02-10 | Optimistic toggle reconciled immediately with server truth; reverts on error | ✅ Accepted |

## Known Stubs

**QR button in EventRow.tsx** — `onClick={() => {}}` (no-op). This is intentional: Plan 02-03 will wire `QRModal` by editing `EventRow.tsx`. The `data-slug` and `data-qr-trigger` attributes serve as breadcrumbs for the Plan 02-03 executor. The stub does NOT prevent the plan's goal (event listing and creation) from being achieved.

## Threat Flags

None — no new security surface beyond what the threat model covers.

## Self-Check: PASSED

- [x] `src/components/events/StatusBadge.tsx` exists
- [x] `src/components/events/EventRow.tsx` exists (exports `EventData`)
- [x] `src/components/events/EventListClient.tsx` exists (`"use client"`)
- [x] `src/components/events/EventList.tsx` exists (Server Component, no `"use client"`)
- [x] `src/components/events/CreateEventForm.tsx` exists (`"use client"`)
- [x] `src/components/events/EventCreatedBanner.tsx` exists (`"use client"`)
- [x] `src/app/(organizer)/dashboard/events/new/page.tsx` exists
- [x] `src/app/(organizer)/dashboard/page.tsx` imports `EventList` and renders `<EventList userId={session.user.id} />`
- [x] Commit `5e9f1b9` exists
- [x] Commit `5f80f97` exists
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npm run build` → success (route `/dashboard/events/new` visible in build output)
