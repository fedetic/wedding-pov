# Phase 2: Events + QR — Research

**Researched:** 2025-05-02  
**Domain:** Next.js 15 App Router, Drizzle ORM, Google Drive API, QR code generation  
**Confidence:** HIGH (schema verified from source, APIs verified via npm/registry, patterns verified from existing codebase)

---

## Executive Summary

**5 things the planner must know:**

1. **The schema is already deployed — no migration needed.** `events` table exists in Neon with all required columns: `id`, `organizerId`, `name`, `slug` (unique), `photoLimit`, `isActive`, `driveFolderId`, `createdAt`. Column name is `driveFolderId` (not `driveFolder`) and the FK column is `organizerId` (not `userId`). [VERIFIED: src/lib/db/schema.ts]

2. **Two npm packages must be installed in Wave 0.** `qrcode` (v1.5.4) and `@types/qrcode` (v1.5.6) are NOT in package.json. `nanoid` (v5.1.11) also not installed and is needed for slug generation. Install: `npm install qrcode @types/qrcode nanoid`. Note: nanoid v5 is ESM-only — works fine in Next.js 15 server contexts but must use `import` not `require`. [VERIFIED: npm registry]

3. **The toggle is a PATCH API route + client-state — not a Server Action.** The UI-SPEC explicitly calls for `PATCH /api/events/[id]/toggle` with optimistic client-side state via `useState` in `EventRow` (Client Component). Do not implement as a Server Action with `useOptimistic` — that diverges from the approved spec. [VERIFIED: 02-UI-SPEC.md line 199]

4. **Drive folder creation happens synchronously inside the create-event server action.** Must: (a) verify Drive is connected before proceeding, (b) decrypt the refresh token, (c) call `drive.files.create` with `mimeType: 'application/vnd.google-apps.folder'`, (d) store the returned folder ID in `driveFolderId`. If Drive is not connected, return an error — do NOT create the event row without a Drive folder. [VERIFIED: schema.ts + drive OAuth pattern from Phase 1]

5. **Middleware already protects `/dashboard/:path*`.** The new `/dashboard/events/new` route requires zero additional auth work — the existing middleware in `src/middleware.ts` catches it automatically. [VERIFIED: src/middleware.ts]

---

## Schema Verification

### events table — confirmed complete for Phase 2

```typescript
// VERIFIED: src/lib/db/schema.ts — no changes needed
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  organizerId: text("organizer_id")          // FK to users.id — use this for ownership queries
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),     // unique constraint already in DB
  photoLimit: integer("photo_limit").notNull().default(20),
  isActive: boolean("is_active").notNull().default(true),
  driveFolderId: text("drive_folder_id"),    // nullable until folder created; store Drive folder ID here
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

**Column name gotcha:** The column is `driveFolderId` in TypeScript / `drive_folder_id` in SQL. Earlier research questions referenced `driveFolder` — that name does not exist. [VERIFIED: schema.ts]

**No schema migration required.** The table was pushed to Neon in Phase 1, Plan 01-01. [VERIFIED: 01-01-SUMMARY.md]

---

## Key Technical Decisions

### 1. Slug Generation

**Decision:** `slugify(name) + "-" + nanoid(6)` — generates deterministic prefix + random suffix.

**Rationale:** Pure nanoid slugs (e.g. `V1StGXR8`) are unreadable when printed on QR code marketing. Event-name prefix (`our-wedding-Kj9mX2`) is human-readable and collision-safe.

**Implementation:**

```typescript
// Server-side only (API route or Server Action)
import { nanoid } from "nanoid"; // ESM — must use import, not require

function generateSlug(eventName: string): string {
  const base = eventName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")   // replace non-alphanumeric runs with hyphen
    .replace(/^-+|-+$/g, "");       // strip leading/trailing hyphens
  const suffix = nanoid(6);         // 6 URL-safe chars, ~1B combinations
  return `${base}-${suffix}`;
}
```

**Collision strategy:** The `slug` column has a UNIQUE constraint in Postgres. If insert fails with unique violation, retry with a new nanoid suffix (extremely rare — document as acceptable). No pre-check needed. [VERIFIED: schema.ts UNIQUE constraint + nanoid v5.1.11 registry]

**nanoid v5 ESM note:** nanoid v5 is pure ESM (`"type": "module"` in its package.json). Next.js 15 with `transpilePackages` or in server-side code handles this fine. Do NOT use `require('nanoid')` — it will throw. [VERIFIED: npm view nanoid]

---

### 2. Create Event — Server Action vs API Route

**Decision:** Use a Next.js Server Action for create event, a PATCH API Route for toggle.

**Rationale:**
- Create event form (`CreateEventForm.tsx`) is a Client Component that does `router.push("/dashboard")` on success. Server Actions work cleanly here: call the action, check the returned result, then call `router.push()` client-side.
- Toggle (`EventRow.tsx`) is specified in UI-SPEC as PATCH to `/api/events/[id]/toggle` — keep as API route to match spec.
- Existing codebase pattern: Drive OAuth uses API routes. Server Actions are net-new in this phase. Either pattern works; Server Action for create event is idiomatic with App Router and avoids an extra API file.

**Server Action for create event:**

```typescript
// src/app/actions/events.ts
"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { events, googleTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";
import { google } from "googleapis";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";

export async function createEvent(formData: {
  name: string;
  photoLimit: number;
  isActive: boolean;
}): Promise<{ success: true; slug: string } | { success: false; error: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { success: false, error: "Unauthorized" };

  // Verify Drive is connected
  const [tokenRow] = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.userId, session.user.id))
    .limit(1);

  if (!tokenRow) {
    return { success: false, error: "Please connect Google Drive before creating an event." };
  }

  // Create Drive folder
  const refreshToken = decrypt(tokenRow.encryptedRefreshToken);
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: "v3", auth: oauth2Client });

  let driveFolderId: string;
  try {
    const folder = await drive.files.create({
      requestBody: {
        name: formData.name,          // Drive allows duplicate names — no conflict
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    driveFolderId = folder.data.id!;
  } catch (e) {
    console.error("[createEvent] Drive folder creation failed:", e);
    return { success: false, error: "Failed to create Drive folder. Check Drive connection." };
  }

  // Generate slug and insert event
  const slug = generateSlug(formData.name);
  await db.insert(events).values({
    id: randomUUID(),
    organizerId: session.user.id,
    name: formData.name,
    slug,
    photoLimit: formData.photoLimit,
    isActive: formData.isActive,
    driveFolderId,
  });

  return { success: true, slug };
}
```

---

### 3. Drive Folder Creation Details

**Key facts:**
- Google Drive allows duplicate folder names — no uniqueness constraint. Two events named "Our Wedding" create two separate folders, each with a unique Drive folder ID. [ASSUMED — Drive does not enforce name uniqueness; this is consistent with Google Drive behavior]
- The `drive.file` scope (already used in Phase 1 OAuth) allows creating folders and files but only those created by this app. Sufficient for Phase 2 + 3. [VERIFIED: src/app/api/drive/connect/route.ts]
- `fields: "id"` in the create call is required — without it the API returns all metadata (wasteful) and `folder.data.id` may not be populated in some SDK versions.
- If `folder.data.id` is null/undefined despite success, throw — don't store a null folderId silently.

**Auth flow (complete path):**
1. Query `googleTokens` WHERE `userId = session.user.id`
2. `decrypt(tokenRow.encryptedRefreshToken)` → plaintext refresh token (from `src/lib/crypto.ts`)
3. `new google.auth.OAuth2(CLIENT_ID, SECRET, REDIRECT_URI)`
4. `oauth2Client.setCredentials({ refresh_token: plainTextToken })` — googleapis auto-refreshes access token
5. `google.drive({ version: "v3", auth: oauth2Client })`
6. `drive.files.create({ requestBody: { name, mimeType: "application/vnd.google-apps.folder" }, fields: "id" })`

[VERIFIED: Phase 1 OAuth pattern from src/app/api/drive/callback/route.ts + src/lib/crypto.ts]

---

### 4. QR Code Generation

**Package:** `qrcode` v1.5.4 + `@types/qrcode` v1.5.6 — NOT YET INSTALLED. [VERIFIED: package.json]

**Install command:**
```bash
npm install qrcode @types/qrcode nanoid
```

**Client-side generation (in QRModal.tsx — Client Component):**

```typescript
import QRCode from "qrcode";

// Inside useEffect or async handler:
const dataUrl = await QRCode.toDataURL(
  `${window.location.origin}/e/${slug}`,
  {
    errorCorrectionLevel: "M",  // Level M = 15% recovery — standard for print
    margin: 2,                  // 2 modules quiet zone ≈ 16px at 256px width
    width: 256,                 // 256×256px per UI-SPEC
  }
);
// Render: <img src={dataUrl} width={256} height={256} alt="QR code" />
```

**Download behavior** (per UI-SPEC):
```typescript
const link = document.createElement("a");
link.href = dataUrl;
link.download = `qr-${slug}.png`;
link.click();
```

**URL content:** Must be absolute URL with protocol — `https://{host}/e/{slug}`. Use `window.location.origin` in client component (safe — runs in browser only). [VERIFIED: 02-UI-SPEC.md line 234]

**Server-side QR generation (NOT used in this phase):** `qrcode` also has `toBuffer()` for Node.js environments. The approved UI-SPEC specifies client-side generation — stick to `toDataURL()` in the Client Component.

---

### 5. Toggle — Optimistic Update Pattern

**Route:** `PATCH /api/events/[id]/toggle`  
**Component:** `EventRow.tsx` (Client Component, per UI-SPEC component inventory)

```typescript
// src/app/api/events/[id]/toggle/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Ownership check — MUST filter by organizerId to prevent cross-tenant toggle
  const [event] = await db
    .select({ id: events.id, isActive: events.isActive })
    .from(events)
    .where(and(eq(events.id, id), eq(events.organizerId, session.user.id)))
    .limit(1);

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db
    .update(events)
    .set({ isActive: !event.isActive })
    .where(eq(events.id, id))
    .returning({ isActive: events.isActive });

  return NextResponse.json({ isActive: updated.isActive });
}
```

**Client-side optimistic pattern in EventRow:**

```typescript
"use client";
import { useState } from "react";

export function EventRow({ event }: { event: EventType }) {
  const [isActive, setIsActive] = useState(event.isActive);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setSaving(true);
    setError(null);
    const prev = isActive;
    setIsActive(!isActive);                    // optimistic flip
    try {
      const res = await fetch(`/api/events/${event.id}/toggle`, { method: "PATCH" });
      if (!res.ok) throw new Error("Toggle failed");
      const data = await res.json();
      setIsActive(data.isActive);              // sync with server truth
    } catch {
      setIsActive(prev);                       // revert on error
      setError("Could not update event status. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  // ...
}
```

---

### 6. Event Ownership — All Drizzle Queries

Every query touching `events` MUST filter by `organizerId`. Use `and()` for compound WHERE clauses.

```typescript
import { eq, and } from "drizzle-orm";

// Fetch organizer's events (for dashboard list)
const organizerEvents = await db
  .select()
  .from(events)
  .where(eq(events.organizerId, session.user.id))
  .orderBy(events.createdAt);

// Fetch single event with ownership check
const [event] = await db
  .select()
  .from(events)
  .where(and(eq(events.id, id), eq(events.organizerId, session.user.id)))
  .limit(1);
```

**Never** query `events` by ID alone — always include `organizerId` filter in any mutating operation to prevent IDOR vulnerabilities. [VERIFIED: standard multi-tenant Drizzle pattern]

---

### 7. Component Architecture

Per UI-SPEC component inventory (all hand-rolled Tailwind, no shadcn):

| Component | Path | Type | Responsibility |
|-----------|------|------|----------------|
| `EventList` | `src/components/events/EventList.tsx` | Server Component | Fetches events from DB, renders table |
| `EventRow` | `src/components/events/EventRow.tsx` | Client Component | Optimistic toggle, QR modal trigger |
| `CreateEventForm` | `src/components/events/CreateEventForm.tsx` | Client Component | Controlled form, calls Server Action |
| `QRModal` | `src/components/events/QRModal.tsx` | Client Component | Modal overlay, QR generation, download |
| `StatusBadge` | `src/components/events/StatusBadge.tsx` | Pure display | Active/Inactive badge |

`src/components/events/` does not exist yet — Wave 0 or Wave 1 creates it.  
`src/components/auth/` already exists from Phase 1. [VERIFIED: ls src/components/]

**Dashboard integration:** Replace the placeholder Events section in `src/app/(organizer)/dashboard/page.tsx` with `<EventList userId={session.user.id} />`. EventList is a Server Component — no prop drilling of sessions needed if it queries DB directly using `session.user.id` passed as prop.

---

### 8. New Page Routes

| Route | File | Type | Notes |
|-------|------|------|-------|
| `/dashboard/events/new` | `src/app/(organizer)/dashboard/events/new/page.tsx` | Server Component (shell) | Renders `<CreateEventForm />` client component |

Middleware already protects `/dashboard/:path*` — no auth changes needed. [VERIFIED: src/middleware.ts]

---

## Implementation Gotchas

### Gotcha 1: `organizerId` not `userId` in events table
The events schema uses `organizerId` not `userId`. If you write `eq(events.userId, ...)` TypeScript will error — the column doesn't exist by that name. Always use `events.organizerId`. [VERIFIED: schema.ts]

### Gotcha 2: nanoid v5 is ESM-only — no require()
```typescript
// ❌ WRONG — will throw at runtime
const { nanoid } = require("nanoid");

// ✅ CORRECT — top-level import in server action / API route
import { nanoid } from "nanoid";
```
Next.js 15 handles ESM imports transparently in server code. [VERIFIED: npm view nanoid]

### Gotcha 3: Drive `fields: "id"` is mandatory
If you omit `fields: "id"` in `drive.files.create()`, the response `data.id` may be undefined even on success (depends on API defaults). Always specify `fields: "id"`.

### Gotcha 4: QR content must be absolute URL
```typescript
// ❌ WRONG — relative path; QR scanners won't know the host
QRCode.toDataURL("/e/our-wedding-Kj9mX2")

// ✅ CORRECT — full URL for QR scanner compatibility
QRCode.toDataURL(`${window.location.origin}/e/${slug}`)
```
[VERIFIED: 02-UI-SPEC.md line 234]

### Gotcha 5: Drive connection check before event creation
If organizer hasn't connected Drive yet, `drive.files.create` will throw a `401 Unauthorized` from Google. Check for `googleTokens` row BEFORE the Drive API call and return a user-friendly error. The UI-SPEC does not show a "Drive required" warning on the create form — add it as an error banner with copy: "Please connect Google Drive before creating an event."

### Gotcha 6: Success banner on dashboard requires query param or flash state
The UI-SPEC says: "Event created." green banner on dashboard, auto-dismisses after 3 seconds. After `router.push("/dashboard")` from CreateEventForm, the dashboard needs to know to show this banner. Pattern: `router.push("/dashboard?event=created")` → dashboard reads `searchParams.event === "created"` and renders the banner. The dashboard page.tsx already handles this pattern for `?drive=connected`. [VERIFIED: src/app/(organizer)/dashboard/page.tsx]

### Gotcha 7: `params` in Next.js 15 App Router is a Promise
Next.js 15 changed dynamic route params to be async:
```typescript
// src/app/api/events/[id]/toggle/route.ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // ← Promise, not plain object
) {
  const { id } = await params;  // ← must await
```
[VERIFIED: existing pattern in drive/callback/route.ts — searchParams also awaited]

### Gotcha 8: EventList is a Server Component — can't use hooks
`EventList` fetches from DB (server-side). `EventRow` handles all client interactivity. Keep them separate — don't colocate DB queries and `useState` in the same component. The EventList passes event data as props to EventRow.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event CRUD (create, list) | API / Backend (Server Action) | — | Requires DB access + Drive API — server only |
| Toggle active/inactive | API / Backend (Route Handler) | Client (optimistic state) | PATCH endpoint owns truth; client mirrors for UX |
| Drive folder creation | API / Backend (Server Action) | — | Organizer tokens must never leave the server |
| QR code generation | Browser / Client | — | UI-SPEC specifies client-side; `window.location.origin` needed for URL |
| Slug generation | API / Backend | — | Happens at event creation time, server-side |
| Event list display | Frontend Server (SSR) | Client (toggle state) | EventList is Server Component; EventRow is Client |
| Auth guard | Frontend Server (Middleware) | — | Next.js middleware already covers `/dashboard/:path*` |

---

## Recommended Plan Structure

Given `granularity: coarse` from config.json, recommend **3 coarse plans**:

### Plan 02-01: Backend Foundation
**Install deps + Server Action + Toggle API Route**
- `npm install qrcode @types/qrcode nanoid`
- `src/app/actions/events.ts` — `createEvent()` Server Action (slug gen, Drive folder, DB insert)
- `src/app/api/events/[id]/toggle/route.ts` — PATCH toggle route
- Wave 0 smoke test: call createEvent() with test data via `curl` or script

### Plan 02-02: Dashboard + Create Event UI
**Replace dashboard placeholder, add create event page**
- `src/components/events/StatusBadge.tsx` — pure display
- `src/components/events/EventList.tsx` — Server Component, queries events by organizerId
- `src/components/events/EventRow.tsx` — Client Component, optimistic toggle
- `src/components/events/CreateEventForm.tsx` — Client Component, calls createEvent() action
- `src/app/(organizer)/dashboard/page.tsx` — replace placeholder Events section with EventList
- `src/app/(organizer)/dashboard/events/new/page.tsx` — page shell + CreateEventForm
- Handle `?event=created` query param for success banner on dashboard

### Plan 02-03: QR Modal
**QR code generation and download**
- `src/components/events/QRModal.tsx` — modal overlay, qrcode.toDataURL(), PNG download
- Wire QR modal trigger into EventRow
- Smoke test: open modal, verify QR renders, verify download creates `qr-{slug}.png`

---

## Validation Architecture

> `nyquist_validation: false` in config.json — formal test suite skipped. Manual smoke tests documented below.

### Smoke Tests Per Plan

**Plan 02-01 smoke tests:**
- [ ] `createEvent()` inserts a row in Neon `events` table (verify via Neon console or `psql`)
- [ ] Created Drive folder appears in organizer's Google Drive with the event name
- [ ] `driveFolderId` is populated in the event row (non-null)
- [ ] `PATCH /api/events/{id}/toggle` returns `{ isActive: false }` for previously-active event
- [ ] PATCH with wrong organizerId returns 404

**Plan 02-02 smoke tests:**
- [ ] `/dashboard/events/new` loads without 404 or TypeScript error
- [ ] Submitting Create Event form creates event and redirects to `/dashboard?event=created`
- [ ] Green "Event created." banner appears on dashboard and auto-dismisses
- [ ] Event appears in dashboard events table with correct name, limit, and Active status
- [ ] "Deactivate" button toggles to Inactive badge immediately (optimistic), confirmed on refresh
- [ ] Empty state shows "No events yet" when organizer has no events
- [ ] Form validation: empty name → shows field error; photo limit > 100 → shows error

**Plan 02-03 smoke tests:**
- [ ] Clicking "QR code" button opens modal overlay
- [ ] QR image renders at 256×256px
- [ ] QR content encodes `https://{host}/e/{slug}` (verify by scanning with phone)
- [ ] "Download QR code" creates `qr-{slug}.png` file in Downloads folder
- [ ] Pressing Escape closes modal
- [ ] Clicking backdrop closes modal
- [ ] Scanning QR code on actual phone opens `/e/{slug}` URL (may be 404 — Phase 3 builds that page)

---

## Environment Availability

| Dependency | Required By | Available | Version | Notes |
|------------|------------|-----------|---------|-------|
| Node.js | nanoid ESM | ✓ | (Railway/local) | ESM import works |
| Neon PostgreSQL | DB queries | ✓ | Deployed | events table already in DB |
| Google Drive API | INFRA-01 | ✓ | v3 via googleapis@171.4.0 | Already in package.json |
| `qrcode` npm | QR-01 | ✗ | — | `npm install qrcode @types/qrcode` |
| `nanoid` npm | Slug gen | ✗ | — | `npm install nanoid` |
| Drive OAuth tokens | Drive folder creation | ✓ | In google_tokens table | Organizer must have connected Drive in Phase 1 |

**Missing dependencies requiring install (blocking):**
- `qrcode` + `@types/qrcode` + `nanoid` — must be Wave 0 of Plan 02-01

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Google Drive allows duplicate folder names — creating two events with same name creates two separate folders without error | Drive folder creation | If Drive rejected duplicate folder names, we'd need to append a counter or suffix — low risk, Drive historically allows name duplication |
| A2 | `drive.file` scope is sufficient to create folders in the organizer's Drive root | Drive folder creation | If folders must be in a specific parent or scope is insufficient, we'd get 403 — verify during Plan 02-01 smoke test |

---

## Sources

### Primary (HIGH confidence)
- `src/lib/db/schema.ts` — events table columns verified directly
- `src/lib/crypto.ts` — encrypt/decrypt API verified directly
- `src/app/api/drive/connect/route.ts` + `callback/route.ts` — googleapis oauth2Client pattern verified
- `src/middleware.ts` — middleware matcher coverage verified
- `.planning/phases/02-events-qr/02-UI-SPEC.md` — component inventory, toggle API route spec, QR specs
- `package.json` — qrcode/nanoid NOT installed confirmed
- npm registry: `npm view qrcode version` → 1.5.4; `npm view nanoid` → 5.1.11, type: module

### Secondary (MEDIUM confidence)
- `01-01-SUMMARY.md` through `01-04-SUMMARY.md` — Phase 1 completion state verified
- `.planning/config.json` — granularity: coarse, nyquist_validation: false confirmed

### Tertiary (LOW — training knowledge)
- Drive folder API `mimeType: "application/vnd.google-apps.folder"` [ASSUMED — standard Drive API pattern]
- Drive allowing duplicate folder names [ASSUMED — consistent with known Drive behavior]

---

## Metadata

**Confidence breakdown:**
- Schema: HIGH — read directly from source
- Drive API pattern: HIGH — mirrors exact pattern from Phase 1 OAuth routes
- qrcode API: MEDIUM — package not installed; API documented in @types/qrcode which was verified via npm registry
- Slug generation: HIGH — nanoid v5 ESM confirmed, collision strategy is standard
- Architecture patterns: HIGH — mirrors existing codebase conventions

**Research date:** 2025-05-02  
**Valid until:** 2025-06-01 (stable stack — no fast-moving dependencies)
