# Roadmap: Wedding POV

## Overview

Four phases from zero to a live, wedding-ready photo upload app. Phase 1 establishes the organizer account and Drive OAuth token architecture. Phase 2 delivers event management and QR codes. Phase 3 builds the complete guest upload experience — the core value of the product. Phase 4 hardens the system for real-world use: OAuth production verification, mobile polish, and end-to-end validation before the wedding day.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Auth** - Organizer accounts, email/password auth, Google Drive OAuth with encrypted token storage, Railway deployment (4 plans)
- [ ] **Phase 2: Events + QR** - Event CRUD, Drive folder creation on event save, short slug URLs, QR code PNG download, active/inactive toggle
- [ ] **Phase 3: Guest Upload** - Mobile-first upload page, nickname entry, photo selection up to limit, server-brokered resumable upload, per-photo progress, HEIC conversion, rate limiting, completion confirmation
- [ ] **Phase 4: Launch Readiness** - OAuth app promoted to Production, end-to-end smoke test on real mobile devices, filename attribution verified in Drive

## Phase Details

### Phase 1: Foundation + Auth
**Goal**: Organizer can create an account, log in, and connect Google Drive — the system has everything it needs to store photos securely
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. Organizer can register with email and password and land on a dashboard
  2. Organizer can log back in with their credentials after logging out (logout is v2; login persistence is the testable criterion here)
  3. Organizer can click "Connect Google Drive," complete the OAuth flow, and see a "Drive connected" confirmation
  4. Drive access persists after session expiry — refresh token is stored and works without re-auth
  5. App is deployed and reachable at a public Railway URL
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Bootstrap Next.js 15, install deps, Drizzle schema (7 tables), drizzle-kit push to Neon
- [ ] 01-02-PLAN.md — Better Auth config, auth API route, middleware, Register + Login forms, Dashboard shell
- [ ] 01-03-PLAN.md — Google Drive OAuth routes (/api/drive/connect, /api/drive/callback), AES-256-GCM token encryption
- [ ] 01-04-PLAN.md — Railway deployment, env vars, GCP redirect URI registration, smoke test all auth flows

### Phase 2: Events + QR
**Goal**: Organizer can create events, generate scannable QR codes, and have Drive folders ready to receive photos
**Depends on**: Phase 1
**Requirements**: EVENT-01, EVENT-02, EVENT-03, QR-01, INFRA-01
**Success Criteria** (what must be TRUE):
  1. Organizer can create an event with a name and photo limit, and it appears in their event list
  2. A Google Drive folder named after the event is automatically created in the organizer's Drive when the event is saved
  3. Organizer can toggle an event active or inactive — inactive events will reject guest uploads
  4. Organizer can download a print-ready PNG QR code for any event
  5. Scanning the QR code opens the correct `/e/[slug]` upload page URL in a mobile browser
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Backend: install deps (qrcode, nanoid), createEvent Server Action (Drive folder + DB insert + slug), PATCH toggle API route
- [ ] 02-02-PLAN.md — Dashboard UI: EventList (Server Component), EventRow (optimistic toggle), CreateEventForm, /dashboard/events/new page, update dashboard
- [ ] 02-03-PLAN.md — QR feature: QRModal component (256px QR generation, PNG download), wire into EventRow

**UI hint**: yes

### Phase 3: Guest Upload
**Goal**: Guests can scan the QR code, enter their name, upload photos, and see them land in the organizer's Google Drive — with no app install and no account
**Depends on**: Phase 2
**Requirements**: GUEST-01, GUEST-02, GUEST-03, GUEST-04, GUEST-05, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Guest can open the upload page in iOS Safari or Android Chrome by scanning the QR code — no app install required
  2. Guest can enter a nickname and select up to the event's configured photo limit (server enforces the limit)
  3. Guest sees a per-photo progress indicator during upload and a clear "Upload complete ✓" confirmation when all photos are done
  4. Photos appear in the correct Drive folder attributed by guest name (e.g. `Sarah_001.jpg`, `Sarah_002.jpg`)
  5. HEIC files from iPhones are converted to JPEG before Drive upload; the upload endpoint rejects abusive burst requests; Drive tokens never appear in any guest browser request
**Plans**: TBD
**UI hint**: yes

### Phase 4: Launch Readiness
**Goal**: The system is verified, mobile-polished, and safe to run on a real wedding day — OAuth tokens won't expire mid-event, uploads work on real phones, and the full flow is confirmed end-to-end
**Depends on**: Phase 3
**Requirements**: *(no additional v1 requirements — this phase validates and hardens what phases 1-3 built)*
**Success Criteria** (what must be TRUE):
  1. Google Drive OAuth app is in "Production" status in GCP Console — refresh tokens do not expire after 7 days
  2. Full guest flow (scan → nickname → select photos → upload → confirmation) works on an actual iPhone (iOS Safari) and Android phone (Chrome)
  3. Photos from the test run appear in Drive with correct guest name attribution and no corruption
  4. Inactive events correctly reject upload attempts with a clear error message
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Auth | 0/? | Not started | - |
| 2. Events + QR | 0/? | Not started | - |
| 3. Guest Upload | 2/3 | In progress | - |
| 4. Launch Readiness | 0/? | Not started | - |
