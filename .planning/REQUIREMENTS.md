# Requirements — Wedding POV

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01**: Organizer can create an account with email and password
- [ ] **AUTH-02**: Organizer can log in with email and password
- [ ] **AUTH-03**: Organizer can connect their Google Drive account via OAuth immediately after signup, before creating their first event

### Event Management (EVENT)

- [ ] **EVENT-01**: Organizer can create an event with a name, a configurable photo limit, and an active/inactive toggle
- [ ] **EVENT-02**: Organizer can view a list of all their events
- [ ] **EVENT-03**: Organizer can toggle an event active or inactive (inactive events reject guest uploads)

### QR Code (QR)

- [ ] **QR-01**: Organizer can download a print-ready PNG QR code for any of their events

### Guest Upload (GUEST)

- [ ] **GUEST-01**: Guest can open the upload page in a mobile browser by scanning the event QR code — no app install required
- [ ] **GUEST-02**: Guest can enter a nickname before uploading photos
- [ ] **GUEST-03**: Guest can select up to the event's configured photo limit and initiate an upload
- [ ] **GUEST-04**: Guest sees a per-photo progress indicator during upload
- [ ] **GUEST-05**: Guest sees a clear completion confirmation when all photos have been uploaded

### Infrastructure (INFRA)

- [ ] **INFRA-01**: Photos are uploaded to the organizer's Google Drive into a flat folder named after the event
- [ ] **INFRA-02**: Server-side HEIC→JPEG conversion is applied before Drive upload (iOS compatibility)
- [ ] **INFRA-03**: Rate limiting is enforced on the guest upload endpoint to prevent abuse (no guest auth)
- [ ] **INFRA-04**: Drive uploads use a server-brokered resumable upload pattern — organizer tokens never reach the guest browser

## v2 Requirements (Deferred)

These are table-stakes or differentiators to add in a future milestone:

- Organizer can log out from the app
- Organizer can disconnect / reconnect their Google Drive
- Guest can retry a failed individual photo upload
- Upload history / list of uploads per event visible to organizer in-app
- Shareable event link (copyable URL alongside QR)
- Email notifications to organizer when photos are uploaded
- Custom event branding (logo, color) on guest upload page

## Out of Scope

- **Native mobile app** — web app in mobile browser is sufficient; no App Store distribution
- **In-app photo gallery** — organizer views photos directly in Google Drive
- **Per-guest subfolders in Drive** — flat folder keeps implementation simple; Drive search is sufficient
- **Real-time upload dashboard** — organizer monitors uploads via Drive natively
- **Video upload** — file size and Drive quota complexity; not needed for photo-first use case
- **In-app camera** — browser's native file picker surfaces the camera; no custom camera UI needed
- **Billing / SaaS monetization** — v1 is self-serve; monetization is a later milestone
- **Face recognition or AI tagging** — anti-feature; complexity with no proven user demand

## Traceability

*(Filled by roadmap agent)*

| REQ-ID | Phase |
|--------|-------|
| AUTH-01 | — |
| AUTH-02 | — |
| AUTH-03 | — |
| EVENT-01 | — |
| EVENT-02 | — |
| EVENT-03 | — |
| QR-01 | — |
| GUEST-01 | — |
| GUEST-02 | — |
| GUEST-03 | — |
| GUEST-04 | — |
| GUEST-05 | — |
| INFRA-01 | — |
| INFRA-02 | — |
| INFRA-03 | — |
| INFRA-04 | — |
