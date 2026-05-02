# Domain Pitfalls

**Domain:** QR-code-based event photo upload web app (Google Drive backend, guest upload, multi-tenant)
**Researched:** 2025-05-02
**Sources:** Google Workspace Drive API docs (Context7), Google Identity OAuth2 docs, googleapis Node.js client docs, Google Drive limits page (live), Google Drive API auth docs (live)

---

## Critical Pitfalls

Mistakes that cause rewrites, security incidents, or complete showstoppers.

---

### Pitfall 1: OAuth App in "Testing" Status — Refresh Tokens Expire in 7 Days

**What goes wrong:** When your Google Cloud project's OAuth consent screen is set to **Publishing status: Testing**, every refresh token issued to organizers expires in exactly **7 days**. After that, the organizer's Drive connection silently breaks — uploads start failing with `invalid_grant` — and they must re-authorize. For a wedding with 90 days between event creation and the day, this means re-linking Drive multiple times.

**Why it happens:** Google intentionally limits Testing-mode apps to prevent abuse before verification. The 7-day limit applies to any app requesting scopes beyond basic profile/email (`userinfo.email`, `userinfo.profile`, `openid`). `drive.file` scope triggers the 7-day expiry in Testing mode.

**Consequences:**
- Organizer's Drive connection breaks mid-event with no warning
- All guest uploads fail with a confusing error
- Organizer must re-connect Drive, generate a new QR code, and redistribute it — catastrophic on the day of an event

**Prevention:**
- Submit the app for **OAuth verification** before any real event is hosted. With `drive.file` (non-sensitive scope), basic verification is required but not the full security assessment.
- Display a clear reconnect prompt in the organizer dashboard when token refresh fails (catch `invalid_grant`, prompt re-auth).
- Store `refresh_token` only on the server; never let it expire silently — set up a periodic token health check or catch 401s proactively.
- In development, add test accounts explicitly in the GCP console to avoid the 7-day expiry for your own testing accounts (doesn't fix production, but helps local iteration).

**Detection:** Watch for `invalid_grant` in server logs. If organizer's last connected time is >6 days ago, surface a "Reconnect Drive" banner in the dashboard.

**Phase:** Must be addressed before any production event; OAuth verification should be in Phase 1 (auth + Drive connection) planning as a *required gate* before launch.

**Source:** https://developers.google.com/identity/protocols/oauth2#expiration

---

### Pitfall 2: Using `drive` Scope (Restricted) Instead of `drive.file` (Non-Sensitive)

**What goes wrong:** Using `https://www.googleapis.com/auth/drive` (full Drive access) instead of `https://www.googleapis.com/auth/drive.file` triggers the **restricted scope** path, which requires:
- A full security assessment by a third-party auditor
- Proof your app falls into one of Google's qualified categories (backup/sync, productivity, etc.)
- App review timelines of weeks to months

`drive.file` is sufficient for this app — it grants access only to files and folders the app itself creates, which is exactly what we need (create a folder, upload files into it).

**Why it happens:** Developers default to `drive` scope because it's the most obvious and always works; restricted scope consequences aren't obvious until verification is required.

**Consequences:** App stuck in Testing mode permanently, or you must rebuild the OAuth flow with a narrower scope and re-get organizer consent.

**Prevention:**
- Use `https://www.googleapis.com/auth/drive.file` exclusively.
- This scope only lets the app see/modify files *it created* — cannot list or read the organizer's existing Drive files, which is a feature, not a limitation.
- `drive.file` is classified as **non-sensitive**, requiring only basic OAuth App Verification, not a security assessment.

**Detection:** Check your GCP OAuth consent screen's declared scopes. If you see `drive` without `.file`, correct immediately.

**Phase:** Must be set correctly in Phase 1 (Drive OAuth integration). Wrong scope = rewrite of auth flow later.

**Source:** https://developers.google.com/workspace/drive/api/guides/api-specific-auth

---

### Pitfall 3: Uploading Photos Directly from the Browser to Google Drive API (CORS Trap)

**What goes wrong:** Attempting to call `https://www.googleapis.com/upload/drive/v3/files` directly from the guest's browser using the organizer's access token. This exposes the organizer's token to every guest's browser (token in JavaScript = token in DevTools = token can be abused) and causes CORS `origin_mismatch` issues if your domain isn't registered in GCP.

**Why it happens:** It seems efficient — skip the server, upload straight to Drive. But the token exposure is a critical security flaw.

**Consequences:**
- Organizer's `access_token` visible in every guest's browser network tab
- Any guest (or malicious actor) can use the token directly against Drive for 1 hour
- `origin_mismatch` CORS errors unless every deploy domain is registered in GCP authorized JavaScript origins

**Prevention:**
- **All Drive API calls must go through your server.** Guest POSTs photo bytes to your API → your server authenticates to Drive using the stored organizer token → your server streams/uploads to Drive.
- Server holds the `refresh_token` and `access_token` only. Guests never see them.
- This also gives you server-side rate limiting, file validation, and audit logging for free.

**Detection:** If you ever see `googleapis.com` in your frontend's network requests, something is wrong.

**Phase:** Architecture decision in Phase 1. If designed correctly from the start, this pitfall costs zero extra effort.

---

### Pitfall 4: Not Using Resumable Uploads for Mobile Photo Files

**What goes wrong:** Using simple (`uploadType=media`) or multipart uploads for photos from mobile. Modern smartphone photos are 3–15 MB. On mobile networks, connections drop. A simple upload that fails at 90% restarts from 0%. Guest gives up, thinks upload worked (it didn't), and you lose their photos.

**Why it happens:** Simple upload is easier to implement; multipart is well-documented. Resumable requires an extra round-trip to initiate the session.

**Consequences:**
- Silent photo loss on poor connections
- Guest sees no failure feedback if error handling is missing
- Wedding photos from a key moment are gone

**Prevention:**
- Use **resumable uploads** (`uploadType=resumable`) for all photos. Google's own guidance: "Resumable uploads are recommended for large files (greater than 5 MB) and when there's a high chance of network interruption, such as in mobile applications."
- Resumable session URIs are valid for **one week** — enough to handle any retry window.
- Chunk size: 256 KB minimum, 5–10 MB recommended chunks on mobile.
- Show per-file progress bar using the chunk offset to calculate percentage.
- Implement automatic retry with exponential backoff on network errors.

**Detection:** If upload uses a single POST with the file body, it's not resumable. Test on a throttled mobile connection.

**Phase:** Phase 2 (guest upload flow). Non-negotiable for any real event.

**Source:** https://developers.google.com/workspace/drive/api/guides/manage-uploads

---

### Pitfall 5: Guest Upload Has No Rate Limiting — Anyone Can Spam the Organizer's Drive

**What goes wrong:** The guest upload URL has no authentication. Anyone who gets the URL (or the QR code) can upload unlimited files. A bad actor could:
- Upload gigabytes of garbage until the organizer's Drive is full (750 GB/day Google-side limit)
- Upload malicious files disguised as photos
- Exhaust your project's Drive API quota (400M quota units/day project-wide)

**Why it happens:** No-login design is intentional for UX; abuse prevention is an afterthought.

**Consequences:**
- Organizer's Drive storage flooded
- Legitimate guest photos buried or rejected due to quota exhaustion
- Legal/ToS issues if malicious content is stored in organizer's Drive

**Prevention:**
- **Server-side rate limiting by IP**: max N uploads per IP per hour (suggest 20–30 for an event with 100 guests, 5 photos each).
- **Per-session limits**: enforce the event's configured photo limit on the server, not just the client. Guests are session-keyed by nickname + server-side session token.
- **File type validation on the server**: accept only MIME types `image/jpeg`, `image/png`, `image/heic`, `image/webp`. Reject everything else. Do not trust the `Content-Type` header alone — validate file magic bytes.
- **File size cap on the server**: reject files > 25 MB before they reach Drive.
- **Nickname + session binding**: issue a short-lived server-side session token when the guest submits their nickname. All uploads in that session are scoped to that token. Prevents re-using a session token to exceed limits.

**Detection:** No rate limiting at all is the warning sign. Add middleware logging upload counts per IP; alert if any IP exceeds 3× the per-session limit in 10 minutes.

**Phase:** Phase 2 (guest upload). Must be in the initial implementation, not a later hardening pass.

---

## Moderate Pitfalls

---

### Pitfall 6: iOS Safari HEIC Handling — Server Must Accept `image/heic`

**What goes wrong:** iPhones default to HEIC format. When a guest uses `<input type="file" accept="image/*">`, iOS Safari does auto-convert HEIC → JPEG when the file is selected — but only when `accept="image/*"` is used. If you set `accept="image/jpeg,image/png"` explicitly (omitting HEIC), iOS may still show HEIC files in the picker but they arrive as the raw HEIC binary, confusing servers that only accept JPEG.

**Why it happens:** HEIC browser support is inconsistent. iOS handles it in the OS layer, not the browser.

**Consequences:**
- Files rejected server-side because MIME type is `image/heic` not `image/jpeg`
- Guest sees an error with no clear explanation ("invalid file type")
- HEIC files are 2× smaller than JPEG — worth preserving if possible

**Prevention:**
- Use `accept="image/*"` (not a specific list) — this lets iOS do its HEIC → JPEG conversion.
- Add `image/heic` and `image/heif` to your server's accepted MIME types as fallback.
- If you want to serve the HEIC to the organizer's Drive without conversion, store it as-is — macOS and Google Photos handle HEIC natively.
- Do not reject `image/heic` server-side.

**Detection:** Test the upload flow on an iPhone using Camera Roll — check what MIME type arrives at your server.

**Phase:** Phase 2 (upload flow). Simple to handle correctly upfront.

---

### Pitfall 7: Loading Large Photo Files into Memory Client-Side Before Upload

**What goes wrong:** Using `FileReader.readAsDataURL()` or `URL.createObjectURL()` + reading entire file into an array buffer before streaming to your server. On mobile, a burst of 5 high-res photos (5–15 MB each) = 25–75 MB in RAM simultaneously. iOS Safari has aggressive memory limits and will kill the tab.

**Why it happens:** Tutorial code often reads files fully into memory; streaming is less obvious.

**Consequences:**
- Browser tab crashes mid-upload on older iPhones
- Guest loses all upload progress silently
- No error message (tab just reloads)

**Prevention:**
- Stream the file directly using `fetch()` with the `File` object as the body — browsers can stream `File` objects without loading them fully into memory.
- Do NOT use `FileReader.readAsDataURL()` — it base64-encodes (1.33× size increase) and loads entirely into memory.
- If you must chunk (for resumable uploads), read one chunk at a time using `file.slice(start, end)` and process it before moving to the next.
- Upload files sequentially, not in parallel, to limit concurrent memory usage on mobile.

**Detection:** Profile memory during upload on an iPhone 12 or older. If memory spikes > 100 MB, the approach is wrong.

**Phase:** Phase 2 (upload implementation). Critical for iOS reliability.

---

### Pitfall 8: QR Code URL Too Long — Dense Code That Fails to Scan

**What goes wrong:** If the event URL contains long UUIDs, multiple query parameters, or is not URL-shortified, the QR code becomes Version 10+ (dense modules) requiring perfect print quality and good lighting to scan. Guests at a wedding are often in dim venues, scanning from printed programs or folded cards.

**Why it happens:** Default URL patterns like `/events/f47ac10b-58cc-4372-a567-0e02b2c3d479/upload` are 50+ characters. A 50-character URL at Error Correction Level H = QR Version 5 (37×37 modules) — manageable. A 100-character URL = Version 10+ — significantly denser.

**Consequences:**
- Guests can't scan the code
- Frustration at the event, photos not captured

**Prevention:**
- Use **short alphanumeric event slugs** (6–8 characters), not full UUIDs in the URL: `/e/w3dg9q` instead of `/events/f47ac10b-...`
- Keep the full URL under 40 characters including the domain.
- Generate QR codes at **Error Correction Level M or Q** (15–25% redundancy) — better resilience for print than Level L, without the density of Level H.
- Print QR codes at minimum **2.5 cm × 2.5 cm** (1 inch) for reliable scanning from 20–30 cm.
- Test scanning from a printed sheet (not a screen) in low light before the event.

**Detection:** Generate the QR code and count the modules. Version 5 (37×37) or lower is ideal. Test with multiple phones.

**Phase:** Phase 1 (event creation + QR generation). URL slug design is an architectural decision.

---

### Pitfall 9: `origin_mismatch` Error When OAuth Redirect URI Changes

**What goes wrong:** The OAuth redirect URI registered in GCP must exactly match the URI your server redirects to during the OAuth callback. If you add a new domain, change ports (local dev), or deploy to a new environment without updating GCP, the entire OAuth flow breaks for new organizer connections.

**Why it happens:** GCP authorized redirect URIs are a static allowlist that requires manual updates.

**Consequences:**
- Organizer cannot connect their Google Drive to their account
- App is unusable for onboarding new organizers

**Prevention:**
- Register ALL expected redirect URIs upfront: `http://localhost:3000/auth/callback`, `https://staging.yourdomain.com/auth/callback`, `https://yourdomain.com/auth/callback`.
- Treat GCP redirect URI updates as part of any deployment checklist.
- Document the GCP console URL and exact redirect URI format for every developer.

**Detection:** Error `redirect_uri_mismatch` in OAuth callback. Check GCP console → Credentials → OAuth 2.0 Client IDs.

**Phase:** Phase 1 (auth setup). Register all environments from day one.

---

### Pitfall 10: Refresh Token Silently Absent — Organizer Never Gets Drive Connected

**What goes wrong:** The `googleapis` Node.js client only issues a `refresh_token` on the **first authorization**. If you request a new auth URL without `access_type: 'offline'` and `prompt: 'consent'`, subsequent authorizations return only an `access_token` (1-hour lifetime). If you forgot to store the `refresh_token` on first auth, the token disappears and the organizer can't re-auth without revoking access and re-granting.

**Why it happens:** Token handling during OAuth callback is a one-shot window.

**Consequences:**
- Organizer's Drive connection breaks after 1 hour silently
- No refresh token in DB = can't use Drive API
- Organizer must revoke app access in their Google Account settings and re-link

**Prevention:**
- Always request `access_type: 'offline'` and `prompt: 'consent'` in the auth URL.
- In the OAuth callback handler, assert `tokens.refresh_token` is present before saving to DB. If missing, throw an error and re-trigger the auth flow.
- Listen for the `tokens` event on `oauth2Client` to capture token refreshes and persist updated tokens to DB.
- Never call `getToken()` more than once per `code` — auth codes are single-use.

**Detection:** After OAuth callback, log whether `refresh_token` is present. If ever null after a successful grant, the flow is broken.

**Phase:** Phase 1 (Drive OAuth integration). Easy to get right with a checklist; catastrophic if missed.

**Source:** https://googleapis.dev/nodejs/googleapis/latest/index.html

---

### Pitfall 11: API Quota Exhaustion at Scale — Drive Quota Is Per-Project, Not Per-Organizer

**What goes wrong:** All organizers' Drive uploads share a single GCP project quota: **1,000,000 quota units per minute** (project-wide) and **400,000,000 quota units per day** (hard threshold). A `files.create` (upload) costs 50 quota units. At 400M/day ÷ 50 = ~8 million uploads per day project-wide. For a single event app this is fine, but if many events run simultaneously:

- 100 concurrent events × 100 guests × 5 photos = 50,000 uploads
- Each upload = multiple API calls (create + possibly metadata)
- Peak of 1,000 simultaneous uploads could hit per-minute limits

**Why it happens:** Quota is invisible until it's exhausted, and the error (`403 userRateLimitExceeded` or `429`) is easy to mis-handle as a generic failure.

**Consequences:**
- Uploads fail during peak event time (ceremony, bouquet toss)
- All guests across all simultaneous events affected

**Prevention:**
- Implement **exponential backoff** on all Drive API calls (required by Google).
- Queue uploads server-side with a job queue (BullMQ, etc.) rather than immediate parallel requests — this naturally smooths traffic spikes.
- Use the `quotaUser` parameter on API calls to scope per-user limits correctly for multi-tenant scenarios.
- Monitor quota usage in GCP console; set alerts at 70% of daily limit.

**Detection:** `403` with `reason: userRateLimitExceeded` or `429` in server logs. GCP console → APIs & Services → Quotas shows real-time usage.

**Phase:** Phase 2–3. Not critical for single-event v1 but necessary before multi-tenant SaaS.

---

### Pitfall 12: Guest Nickname Has No Server-Side Validation — Collision and Confusion in Drive

**What goes wrong:** Two guests both enter "Sarah" as their nickname. Files from both are uploaded to the same flat folder with no differentiation — Drive shows two `sarah_photo1.jpg` files. Drive auto-renames on collision (adds a numeric suffix), but organizer has no way to tell which "Sarah" took which photo.

**Why it happens:** Guest identifiers are cosmetic only — not tied to accounts — so collision is expected.

**Consequences:**
- Organizer cannot attribute photos to guests (defeats the "POV" value proposition)
- Confusing flat folder with duplicate-looking names

**Prevention:**
- Prefix uploaded filenames with a session UUID or timestamp: `{timestamp}_{nickname}_{original_filename}`.
- Alternatively, create per-guest subfolders named `{nickname}-{shortId}` (re-evaluate the "flat folder" decision — per-guest folders solve both attribution and collision with minimal complexity).
- Normalize nicknames server-side (trim, lowercase, max 30 chars) before using in filenames.

**Detection:** Upload two photos from two sessions both using the same nickname — check what arrives in Drive.

**Phase:** Phase 2 (upload flow). File naming scheme should be decided in architecture, not retrofitted.

---

## Minor Pitfalls

---

### Pitfall 13: CSP Blocking Google OAuth Redirect or API Calls

**What goes wrong:** A Content Security Policy that doesn't include Google's domains causes the OAuth popup or redirect to be blocked, or API calls to fail silently.

**Prevention:**
- Add to CSP:
  - `script-src: https://accounts.google.com/gsi/client`
  - `connect-src: https://accounts.google.com/gsi/ https://www.googleapis.com`
  - `frame-src: https://accounts.google.com`
- If server-side OAuth (recommended), only the redirect matters — no JavaScript CSP needed for Drive API since calls are server-side.

**Phase:** Phase 1 (auth setup).

**Source:** Google Identity CSP docs

---

### Pitfall 14: Guest Upload Page Not Optimized for Mobile Viewport During Upload

**What goes wrong:** The upload UI is desktop-designed. On mobile, a sticky footer button is obscured by the browser chrome (address bar + nav bar eating screen real estate), or the file picker opens and the page scrolls in a disorienting way. Guest taps "Done" on the file picker and doesn't realize files are queued.

**Prevention:**
- Use `min-height: 100dvh` (dynamic viewport height) not `100vh` on mobile — `100vh` doesn't account for browser chrome on iOS.
- Test specifically on iPhone Safari 15+ and Android Chrome.
- Show a persistent, unambiguous "X files selected — tap Upload" state before initiating the upload.
- Disable the upload button during upload; show a spinner with byte-level progress.

**Phase:** Phase 2 (guest upload UX). Budget specific mobile testing time.

---

### Pitfall 15: QR Code Printed with Low Contrast or on Colored Background

**What goes wrong:** A designer embeds the QR code into a wedding invitation template with a beige/tan background or decorative border that overlaps the quiet zone. Phone cameras fail to detect the code boundary.

**Prevention:**
- Require a **minimum 4-module quiet zone** (white border) around the QR code.
- QR code must be black on white (or very high contrast). Never reverse (white on dark background) unless specifically tested.
- Provide organizers with a plain white-background PNG for printing, separate from any styled version.
- Add a short URL text below the QR code as a fallback: `wedding-pov.app/e/w3dg9q`.

**Phase:** Phase 1 (QR code generation). Include quiet zone in the generated code by default.

---

### Pitfall 16: No Feedback When Upload Fails — Guest Assumes Success

**What goes wrong:** A network error during upload shows no user-facing error (or shows a brief toast that disappears). Guest leaves thinking photos were saved. Organizer never gets them.

**Prevention:**
- On any upload failure, show a persistent error state with a **Retry** button. Do not auto-dismiss error states.
- Distinguish between "upload in progress", "upload complete", and "upload failed" with visually distinct states (color, icon, copy).
- After a successful upload, show a clear confirmation: "3 photos saved to [Event Name]! 🎉".
- Log failures server-side; distinguish between client-network errors vs. Drive API errors.

**Phase:** Phase 2 (guest upload UX). Error states are often designed last — budget time for them explicitly.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Drive OAuth setup | Refresh token absent on first grant | Always use `access_type=offline&prompt=consent`; assert token present |
| Drive OAuth setup | Wrong scope (drive vs drive.file) | Use `drive.file` scope only; verify in GCP console |
| OAuth verification | 7-day refresh token expiry in Testing | Submit for verification before any production event |
| Drive OAuth setup | `redirect_uri_mismatch` in new environments | Register all environments in GCP from day one |
| Event URL design | QR code too dense to scan | Use 6-char slug; keep URL under 40 chars total |
| Guest upload flow | HEIC files rejected | Accept `image/*`; add `image/heic` to server allowed types |
| Guest upload flow | Large files crash mobile tab | Stream `File` object; never use `readAsDataURL()` |
| Guest upload flow | No rate limiting = spam | IP rate limit + server-side photo count enforcement from day one |
| Guest upload flow | Network drop = lost upload | Use resumable uploads with chunking for all photos |
| Guest upload flow | Silent failure = guest thinks upload worked | Persistent error state + retry button |
| Filename/Drive | Nickname collision in flat folder | Prefix filenames with timestamp + session ID |
| Production scale | API quota exhaustion during peak | Job queue + exponential backoff; monitor GCP quota dashboard |

---

## Sources

- Google Workspace Drive API limits: https://developers.google.com/workspace/drive/api/guides/limits *(confirmed: May 1, 2026 quota update; 400M units/day threshold)*
- Google Drive upload methods: https://developers.google.com/workspace/drive/api/guides/manage-uploads *(confirmed: resumable recommended for >5 MB and mobile)*
- Google Drive API scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth *(confirmed: `drive.file` is non-sensitive, `drive` is restricted)*
- Google OAuth2 token expiration: https://developers.google.com/identity/protocols/oauth2#expiration *(confirmed: 7-day expiry in Testing, 6-month inactivity expiry in production, 100 refresh tokens/client cap)*
- googleapis Node.js client — token handling: https://googleapis.dev/nodejs/googleapis/latest *(confirmed: `tokens` event, `access_type: offline` requirement)*
- Google Drive error handling: https://developers.google.com/workspace/drive/api/guides/handle-errors *(confirmed: exponential backoff required)*
- Google Identity CSP requirements: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy
