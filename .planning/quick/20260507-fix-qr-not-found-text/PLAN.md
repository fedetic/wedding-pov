---
slug: fix-qr-not-found-text
created: 2026-05-07
---

# Fix misleading "QR code may be expired" text

## Objective

The `EventNotFound` page in `src/app/e/[slug]/page.tsx` displays:
> "This QR code may be expired or invalid."

This is misleading — slugs never expire. An event is not found only if it was deleted.
Fix the message to accurately reflect reality for users who print QR codes on flyers.

## Tasks

1. Update `EventNotFound` message to remove "expired" wording
2. Add code comment on the `slug` field in schema marking it as immutable
3. Commit
