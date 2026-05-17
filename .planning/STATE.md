# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-17)

**Core value:** Guests can share their POV photos at an event with zero friction — scan, name, upload, done.
**Current focus:** v1.1 Mobile App — Phase 5: Capacitor Infrastructure

## Current Position

Phase: 5 of 8 (Capacitor Infrastructure)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-05-17 — v1.1 roadmap created (Phases 5–8)

Progress: [░░░░░░░░░░] 0% (v1.1)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 12
- Average duration: ~3 minutes
- Total execution time: ~36 minutes

**By Phase (v1.0):**

| Phase | Plans | Avg/Plan |
|-------|-------|----------|
| 1. Foundation + Auth | 4 | ~3 min |
| 2. Events + QR | 3 | ~3 min |
| 3. Guest Upload | 3 | ~3 min |
| 4. Launch Readiness | 2 | ~3 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v1.0]: Railway (not Vercel) — 4.5 MB body limit blocks photo uploads
- [v1.0]: `drive.file` scope (not `drive`) — avoids weeks-long Google security review
- [v1.1 Research]: `server.url` pointing to Railway (not static export) — Server Actions, cookies(), and auth middleware are incompatible with `output: 'export'`
- [v1.1 Research]: Google Drive OAuth must open via `@capacitor/browser` (SFSafariViewController/Chrome Custom Tabs) — WKWebView triggers `disallowed_useragent` rejection

### Pending Todos

None yet.

### Blockers/Concerns

- **CAP-03 (CORS)**: `capacitor://localhost` and `http://localhost` must be added to Railway CORS allowlist before any API calls work — Phase 5 blocker
- **CAP-05 (OAuth)**: WKWebView blocks Google OAuth — must validate `@capacitor/browser` flow on real device (emulator may not reproduce)
- **CAP-04 (cookies)**: iOS ITP may block Better Auth HTTP-only cookies cross-origin — must validate on real device in Phase 5 before building on top
- **NATIVE-03 (deep links)**: Requires serving `apple-app-site-association` and `assetlinks.json` from Railway + Apple Developer portal configuration — coordinate with Phase 6
- **App Store 4.2 risk**: Pure webview wrapper can be rejected for minimum functionality — QR share sheet (NATIVE-01) + biometrics (NATIVE-02) are the mitigation

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Notifications | Push notifications when guest uploads (NOTIF-01, NOTIF-02) | v2 | v1.1 planning |
| Organizer | Email notifications on upload (ORG-01) | v2 | v1.1 planning |
| Organizer | Custom event branding (ORG-02) | v2 | v1.1 planning |

## Session Continuity

Last session: 2026-05-17
Stopped at: v1.1 roadmap created — ready to plan Phase 5
Resume file: None
