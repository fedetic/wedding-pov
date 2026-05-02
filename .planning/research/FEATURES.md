# Feature Landscape

**Domain:** QR-code-based event photo upload / collection (wedding-pov)
**Researched:** 2025-05-30
**Confidence:** HIGH — competitive landscape mapped from live App Store data, product feature pages, and community signals

---

## Competitive Landscape Summary

The space is crowded with disposable-camera-style apps (POV, Once, Scene, Lense, disposable.app). Key players studied:

| Product | Model | Rating | Reviews | Key Differentiator |
|---------|-------|--------|---------|-------------------|
| **POV – Disposable Camera Events** | Native iOS app | 4.9★ | 12,881 | No-download guest UX, delayed reveal |
| **disposable.app** | Web + native app | — | — | Free tier, live slideshow, team support |
| **Once - Disposable Camera Event** | Native + App Clip | 4.79★ | 150 | App Clip for guests, unlock-together reveal |
| **Lense: Disposable Event Camera** | Native iOS | 4.84★ | 1,216 | QR scan → guest perspective |
| **Scene Disposable Camera Events** | Native + App Clip | — | — | Delayed reveal emphasis |
| **swsh - shared photo album** | Native iOS | — | — | Group chats, AI filters, themes |
| **Waldo: Shared Photo Albums** | Native iOS | — | — | Face recognition ("find me") |

**Key differentiator for wedding-pov vs. all above:** Photos land directly in organizer's **Google Drive** — zero proprietary silo, organizer owns their data immediately. Every competitor uses their own cloud storage requiring organizers to log in and download.

---

## Table Stakes

Features users expect. Missing any of these is a deal-breaker.

### Guest Upload UX

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Zero-friction join** — scan QR → browser opens upload page | Industry baseline; POV, Once, disposable.app all lead with this | Low | No install, no account, no app download — any friction and participation drops sharply |
| **Nickname/name entry before upload** | Guests at weddings want attribution; organizer needs to know who sent what | Low | Single text field, required before upload; stored as metadata |
| **Multi-photo selection** | Guests have already taken dozens of photos on their camera app — they won't upload one at a time | Low | `<input multiple accept="image/*">` — critical UX, never single-select only |
| **Upload progress indicator + clear completion state** | Guests leave before upload finishes without feedback; silent failure kills trust | Low | Progress bar per photo, or overall; big green "Done!" state — guests at events are distracted |
| **Mobile browser compatibility** — iOS Safari + Android Chrome | 100% of guests will be on mobile; desktop is organizer-only | Medium | iOS Safari has quirks: HEIC file inputs, 1GB request limits per fetch, memory constraints on large batches |
| **Configurable per-guest photo limit** | Prevents one enthusiastic guest from uploading 200 blurry shots; all competitors offer this | Low | Set by organizer at event creation; enforced at upload time |
| **Text URL fallback alongside QR code** | QR codes fail: dirty surfaces, bad lighting, older phones; always need the URL | Low | Short, readable slug (e.g. `/e/jane-tom`) is far better than UUID URL |
| **Error messages that make sense** | "Upload failed" with no explanation causes guests to give up | Low | "Too many photos", "File too large", "Event closed" — specific, friendly messages |

### Organizer Management

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Create an event with a name** | Core primitive — every product does this | Low | Name becomes Drive folder name and page title |
| **Generate + view QR code** | The entire distribution mechanism | Low | Must render in-app for screen-scanning; must also export |
| **Download printable QR code** | Organizers print on table cards, A-frame signs, invitation inserts | Low | Export as PNG (300 DPI minimum) and SVG; QR code libraries generate these |
| **Connect Google Drive via OAuth** | The storage backend for this product | Medium | One-time auth per organizer; scoped to specific folder |
| **Event active / inactive toggle** | Organizers need to close uploads after the event | Low | Prevents late uploads days later; simple boolean flag |

### Photo Handling

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **JPEG and PNG upload** | Universal baseline formats | Low | Straightforward |
| **HEIC/HEIF support** | iPhones shoot HEIC by default since iOS 11; refusing HEIC excludes ~60% of guests | Medium | Browser accepts it via `accept="image/*"` but Drive may not preview HEIC — **convert to JPEG server-side before uploading to Drive** |
| **File size limits with clear messaging** | Prevents 50MB raw uploads from timing out; sets expectations | Low | Suggest 20–25MB per file limit; raw iPhone photos are 3–8MB JPEG, 2–4MB HEIC |
| **Graceful handling of upload failures** | Spotty event WiFi is common; retries are expected | Medium | Detect failure, offer retry; do not silently drop |

### QR Code Presentation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **QR code with embedded event URL** | The QR code IS the product for guests | Low | URL must be stable (no expiry) |
| **URL displayed below QR code** | Accessibility and fallback | Low | `weddingpov.app/e/jane-tom` printed under the code |

---

## Differentiators

Features that give competitive edge — not universally expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Google Drive native storage** | Photos land directly in organizer's Drive — zero export step, organizer owns data immediately, no vendor lock-in | Medium | **This is wedding-pov's unique differentiator vs. the entire field.** Implement first. |
| **Guest name in uploaded filename** | `Sarah_001.jpg`, `John_002.jpg` — organizer sees who shot what directly in Drive without opening any dashboard | Low | Rename on upload before sending to Drive; easy win with high perceived value |
| **Organizer dashboard: upload count + guest list** | "47 photos from 12 guests" — lightweight status without opening Drive | Medium | Read from DB, not Drive API (avoid Drive API quota on every dashboard load) |
| **Event page custom branding** | Upload page shows the couple's names, event date — feels personal, not generic | Low | Event name + optional subtitle; already implied by event creation |
| **Printable QR card templates** | Ready-made A5/A4 table card designs with QR code embedded — organizer downloads PDF ready to print | Medium | disposable.app offers this as a free tier feature; guests respond to well-presented materials |
| **Short human-readable event slug** | `/e/jane-tom-2025` vs `/e/a7f3d2b9` — scannable, typeable, shareable in speech | Low | Collision-resistant slugs (append random suffix if taken) |
| **Event expiry date** | Organizer sets an upload window; uploads auto-close; prevents confused guests uploading weeks later | Low | Date picker at creation; cron/check at upload time |
| **Multiple QR code size exports** | Phone-screen, A5, A4, A3 — disposable.app offers this free; expected in premium tools | Low | SVG scales; PNG at multiple DPIs |
| **Post-event email summary to organizer** | "Your event is now closed. 83 photos from 19 guests were uploaded." | Medium | Trigger on event expiry or manual close; one send only |

---

## Anti-Features

Features to explicitly **NOT** build. These are complexity traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **In-app camera (capture new photos in the browser)** | Browser camera API is unreliable cross-platform; iOS Safari has capture quality/permissions issues; guests already have a better camera app; forces them to take new photos instead of uploading the candid they already captured | Let guests upload from camera roll — this is the right model for "your POV" |
| **In-app photo gallery / lightbox for organizer** | Drive IS the gallery. Building a parallel gallery adds: CDN costs, thumbnail generation, pagination, storage duplication, access controls. All complexity with zero user benefit for v1. | Direct organizer to their Drive folder; that's the entire point of this product |
| **Photo moderation / approval queue** | Turns simple upload into a workflow product. organizer would need to approve before photos show in gallery — but there IS no gallery. | Organizer removes unwanted photos directly in Drive like any other file |
| **Social features (likes, comments, reactions)** | Turns a photo collection tool into a social network. Requires moderation, reporting, block lists, etc. | Zero social layer; Drive commenting if needed |
| **Face recognition ("find photos of me")** | GDPR Article 9 (biometric data), BIPA (Illinois), massive ML infrastructure, privacy liability | Out of scope permanently |
| **Video upload** | File sizes 10–100× larger than photos; Drive quota exhaustion risk; browser upload timeouts on cellular; transcoding complexity; playback in Drive works but HEVC encoding is inconsistent | Photos only for v1 and v2; video is a separate product decision |
| **Native mobile app** | App Store submission, review cycles, platform-specific code, update forcing — all eliminated by web. Already in PROJECT.md Out of Scope | Web works perfectly for guests |
| **Subfolder per guest in Drive** | Already in PROJECT.md Out of Scope. Guest subfolders break Drive's "flat scan" view and add API calls per upload | Guest name in filename achieves the same organization goal with zero overhead |
| **Print fulfillment (order prints, books)** | Entirely different business (print-on-demand vendors, payment processing, shipping). Mission creep. | Out of scope permanently — Chatbooks/Artifact exist for this |
| **Custom domain per event** | DNS management, per-domain SSL certificates, propagation delays, complexity wildly exceeds benefit | Short slugs on the main domain (`/e/slug`) achieve the same human-readability |
| **RSVP / guest list management** | Different product category (event planning). Adds pre-event complexity to what should be a day-of tool. | Organizer manages guest list in their own system; wedding-pov just receives uploads |
| **Billing / subscription management** | Already Out of Scope for v1. Not building until SaaS milestone. | Build with multi-tenant architecture ready, billing as additive |
| **Watermarking photos** | Damages the photos organizer paid (indirectly) to have taken. Alienates users. | Never watermark guest-uploaded photos |
| **AI photo culling / "best of" selection** | Premature optimization. Model costs money, opinions are subjective at weddings. | Organizer curates in Drive |

---

## Feature Dependencies

```
Google Drive OAuth connected
  └─→ Event creation (can't create event without Drive destination)
       └─→ Drive folder creation (folder named after event)
            └─→ QR code generation (URL = event upload page)
                 └─→ Guest upload flow
                      ├─→ Nickname entry (captured first)
                      │    └─→ Guest name in filename (requires nickname)
                      ├─→ Photo limit enforcement (requires per-session counter)
                      └─→ Upload progress + completion feedback

Event active/inactive toggle
  └─→ Upload acceptance gating (check flag before accepting upload)

Event expiry date
  └─→ Auto-close on expiry (requires background job or check-on-request)
```

**Critical path:** OAuth → Event → QR Code → Upload. Nothing works without the Drive OAuth connection.

---

## MVP Recommendation

### Must ship in v1 (table stakes, no exceptions)

1. **Google Drive OAuth** — organizer connects their Drive
2. **Event creation** — name, photo limit per guest
3. **QR code generation** — viewable in dashboard, downloadable as PNG
4. **Guest upload page** — scan → enter nickname → select photos → upload → done
5. **Per-guest photo limit enforcement** — tracked by session/nickname
6. **Mobile-compatible upload** — tested on iOS Safari + Android Chrome
7. **HEIC → JPEG conversion** — server-side before Drive upload
8. **Clear upload feedback** — progress, success, error states
9. **Event active/inactive toggle** — organizer can close uploads

### Should ship in v1 (low complexity, high value)

- Guest name in filename (`Sarah_001.jpg`)
- Text URL fallback below QR code
- Short human-readable event slug

### Defer to v2 (differentiators, not blockers)

- **Printable QR card templates** — high perceived value but not blocking launch
- **Organizer upload count dashboard** — useful but Drive shows the folder count
- **Post-event email summary** — nice-to-have, not day-one need
- **Event expiry date** — organizer can manually toggle for v1
- **Multiple QR export sizes** — SVG download covers most needs

### Never build (anti-features)

Video upload, in-app gallery, social features, face recognition, native app, print fulfillment.

---

## Sources

- App Store search results + full descriptions (iOS iTunes API): POV, Once, Scene, Lense, disposable.app, swsh, Waldo (HIGH confidence — live data)
- disposable.app Features page (`/features`) — scraped directly (HIGH confidence)
- PROJECT.md — existing product decisions (authoritative)
- Competitive analysis: features consistently present across 5+ products = table stakes
