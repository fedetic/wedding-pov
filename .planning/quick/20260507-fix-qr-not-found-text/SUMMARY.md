---
slug: fix-qr-not-found-text
status: complete
completed: 2026-05-07
---

# Summary

Investigated QR code stability for flyer printing use case.

**Finding:** QR codes are already static. The slug (`/e/{slug}`) is generated once at event creation via `generateSlug()` + `nanoid(6)`, stored in the DB, and has no update path — no API route or server action can change it.

**Fixed:** The `EventNotFound` page previously showed "This QR code may be expired or invalid" — slugs cannot expire, so this was misleading. Updated to: "This link is not recognised. The event may have been removed."

**Also:** Added a comment in `schema.ts` marking `slug` as immutable for future maintainers.

**Domain note:** The QR URL includes the deployment domain. If the Railway URL ever changes, printed QR codes will break. A custom domain permanently locks this.

Commit: ca5dca0
