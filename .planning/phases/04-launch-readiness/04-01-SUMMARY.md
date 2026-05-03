---
phase: 04-launch-readiness
plan: "01"
subsystem: gcp-oauth-production
tags: [gcp, oauth, token-refresh, production]
status: complete
completed_at: 2025-05-03
---

# Phase 4 — Plan 01: GCP OAuth Production Promotion — COMPLETE

## What was done

### Task 1 — GCP OAuth app promoted to Production
- Navigated to GCP Console → APIs & Services → OAuth consent screen
- Clicked "Publish App" → confirmed
- Status changed to **"In production"** immediately (no review required)
- `drive.file` scope (not full `drive`) expedited the promotion

### Task 2 — Drive reconnected under Production app
- Revoked old token at myaccount.google.com/permissions
- Deleted stale `google_tokens` row from Neon DB
- Reconnected Google Drive via dashboard OAuth flow
- New refresh token issued under Production app — confirmed in Neon (`connected_at` fresh)

### Task 3 — Token auto-refresh path verified
- Force-expired access token: `SET access_token_expires_at = NOW() - INTERVAL '1 hour'`
- Triggered real upload from phone → upload succeeded ✅
- `google_tokens.access_token_expires_at` updated to ~1 hour in future by `'tokens'` event listener ✅

## Outcome

| Check | Result |
|-------|--------|
| GCP Publishing status | **In production** |
| Refresh token expiry | **Non-expiring** (Production app) |
| Token auto-refresh path | **Verified** — googleapis silently refreshes, DB updated |

## ROADMAP SC-1 satisfied ✅
Google Drive OAuth app is in "Production" status — refresh tokens do not expire after 7 days.
