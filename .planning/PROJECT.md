# Wedding POV — Event Photo Upload via QR Code

## What This Is

A web app that lets event organizers generate a QR code guests can scan to upload their personal photos directly to the organizer's Google Drive. No app install required for guests — they scan, enter a nickname, pick photos, and upload. Built first for a personal wedding, architected to scale into a multi-tenant SaaS where anyone can create their own events.

## Core Value

Guests can share their POV photos at an event with zero friction — scan, name, upload, done.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Organizer**
- [ ] Organizer can sign up and log in with email + password
- [ ] Organizer can connect their Google Drive account via OAuth
- [ ] Organizer can create an event with a name and configurable photo limit
- [ ] Organizer can view and download a printable QR code for their event

**Guest**
- [ ] Guest can scan QR code and open the upload page in a browser (no install)
- [ ] Guest can enter their name/nickname before uploading
- [ ] Guest can select up to the event's configured photo limit and upload them
- [ ] Guest receives clear feedback when upload is complete

**Infrastructure**
- [ ] Photos are uploaded to the organizer's Google Drive into a flat folder named after the event
- [ ] Each organizer's Drive is isolated (OAuth tokens per organizer)

### Out of Scope

- Native mobile app — web works for guests; no App Store distribution needed
- In-app gallery or photo curation — organizer views photos directly in Drive
- Subfolder organization by guest — flat folder keeps it simple
- Real-time upload dashboard — organizer monitors via Drive
- Full SaaS (billing, plans) — SaaS generalization is a later milestone; v1 is self-serve but not monetized

## Context

- Repo: `wedding-pov` — primary use case is the organizer's own wedding
- Architecture must support multi-tenant from day one (each organizer links their own Drive), so expanding to SaaS later is additive, not a rewrite
- Guests must have zero friction: QR → browser → upload, no account required on the guest side
- Google Drive is the photo storage backend; no separate storage layer needed for v1

## Constraints

- **Platform**: Web only — guests open a URL in their mobile browser after scanning
- **Storage**: Google Drive per organizer (via OAuth) — no proprietary storage in v1
- **Auth (guests)**: None — guests only enter a nickname, no account required
- **Auth (organizers)**: Email + password + Google Drive OAuth

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native mobile | Zero install for guests; QR → browser is the smoothest path | — Pending |
| Google Drive as storage | Organizer already owns the photos in a familiar place; no extra storage cost | — Pending |
| Flat Drive folder per event | Simplest structure; guest subfolders add complexity with little benefit | — Pending |
| Multi-tenant architecture from v1 | SaaS generalization later requires no rewrite; marginal added cost upfront | — Pending |
| Email/password for organizers | Simple to ship; OAuth for organizers is just Drive connection, not login | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-02 after initialization*
