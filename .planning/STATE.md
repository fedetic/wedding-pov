# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2025-05-02)

**Core value:** Guests can share their POV photos at an event with zero friction — scan, name, upload, done.
**Current focus:** Phase 1 — Foundation + Auth

## Current Position

Phase: 1 of 4 (Foundation + Auth)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2025-05-02 — Roadmap created; ready to begin Phase 1 planning

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Planning]: Railway (not Vercel) — 4.5 MB Vercel body limit blocks photo uploads
- [Planning]: Better Auth — DB-backed sessions, Drizzle adapter, avoids NextAuth JWT complexity
- [Planning]: Server-brokered resumable upload — Drive tokens never reach guest browser; guest PUTs bytes directly to Google CDN
- [Planning]: `drive.file` scope (not `drive`) — wrong scope triggers weeks-long Google security review

### Pending Todos

None yet.

### Blockers/Concerns

- **OAuth risk**: GCP app must be promoted to Production before launch; Testing mode causes refresh token expiry every 7 days — catastrophic on a wedding day. Flag for Phase 4.
- **OAuth risk**: Must request `drive.file` scope, NOT `drive` scope. Wrong scope = weeks-long security review.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Auth | Organizer log out | v2 | Planning |
| Auth | Disconnect / reconnect Drive | v2 | Planning |
| Guest | Retry failed individual photo | v2 | Planning |
| Organizer | In-app upload history per event | v2 | Planning |
| Event | Shareable event link (URL alongside QR) | v2 | Planning |

## Session Continuity

Last session: 2025-05-02
Stopped at: Roadmap created — all 16 v1 requirements mapped across phases 1-3; Phase 4 is launch-readiness hardening
Resume file: None
