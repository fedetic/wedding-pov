---
phase: 07-compliance-submission-prep
plan: "02"
subsystem: auth-ui
tags: [account-deletion, better-auth, compliance, settings]
dependency_graph:
  requires: ["07-01"]
  provides: ["COMPLY-04"]
  affects: ["src/lib/auth.ts", "src/app/(organizer)/dashboard/settings"]
tech_stack:
  added: []
  patterns: ["better-auth deleteUser endpoint", "two-step confirm UX", "SESSION_EXPIRED error handling"]
key_files:
  created:
    - src/app/(organizer)/dashboard/settings/DeleteAccountButton.tsx
  modified:
    - src/lib/auth.ts
    - src/app/(organizer)/dashboard/settings/page.tsx
    - .planning/REQUIREMENTS.md
decisions:
  - "No email verification for delete: email provider not configured in v1; fresh session (< 24h) satisfies sensitiveSessionMiddleware"
  - "No beforeDelete hook needed: DB cascade chain in schema.ts covers all 5 related tables"
  - "SESSION_EXPIRED matched via error.code AND regex fallback: better-auth may surface it in message text too"
metrics:
  duration: "8 min"
  completed_date: "2026-05-23"
  tasks_completed: 3
  files_modified: 4
---

# Phase 7 Plan 02: Account Deletion (COMPLY-04) Summary

**One-liner:** In-app account deletion via better-auth `/delete-user` endpoint with two-step confirm and SESSION_EXPIRED stale-session handling.

## What Was Built

Enabled better-auth's built-in `/delete-user` endpoint and wired a new `DeleteAccountButton` client component into the Settings page. The deletion flow satisfies App Store Guideline 5.1.1(v) requiring in-app account deletion. The existing DB cascade chain (`users → sessions, accounts, googleTokens, events → uploadRecords`) handles all related-table cleanup without a custom hook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Enable user.deleteUser in auth.ts | 2eb2c3d | src/lib/auth.ts |
| 2 | Create DeleteAccountButton component | 9a8cd65 | src/app/(organizer)/dashboard/settings/DeleteAccountButton.tsx |
| 3 | Wire settings page + mark COMPLY-04 complete | 497d3ae | src/app/(organizer)/dashboard/settings/page.tsx, .planning/REQUIREMENTS.md |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is fully wired. The DeleteAccountButton calls the live better-auth `/delete-user` endpoint; no mock data or placeholder values.

## Threat Flags

No new security surface beyond the plan's threat model. The `sensitiveSessionMiddleware` (fresh session <24h required) provides CSRF protection on the `/delete-user` endpoint per T-07-05.

## Self-Check: PASSED

Files verified to exist:
- src/lib/auth.ts — contains `user.deleteUser.enabled = true`
- src/app/(organizer)/dashboard/settings/DeleteAccountButton.tsx — exports `DeleteAccountButton`
- src/app/(organizer)/dashboard/settings/page.tsx — imports `DeleteAccountButton`, renders `<DeleteAccountButton />` and `href="/privacy"`
- .planning/REQUIREMENTS.md — `- [x] **COMPLY-04**` and `| COMPLY-04 | Phase 7 | Complete |`

Commits verified:
- 2eb2c3d — feat(07-02): enable user.deleteUser in better-auth config
- 9a8cd65 — feat(07-02): create DeleteAccountButton with two-step confirm and SESSION_EXPIRED handling
- 497d3ae — feat(07-02): wire DeleteAccountButton and Privacy link into Settings page; mark COMPLY-04 complete

Build: `npm run build` succeeded — `/dashboard/settings` route compiled as Dynamic (ƒ).
