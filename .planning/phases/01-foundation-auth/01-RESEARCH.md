# Phase 1: Foundation + Auth — Research

**Researched:** 2025-05-02
**Domain:** Next.js 15 App Router · Better Auth 1.x · Drizzle ORM + Neon · Google OAuth (Drive) · Railway deployment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Organizer can create an account with email and password | Better Auth `emailAndPassword: { enabled: true }` + `signUp.email()` client method |
| AUTH-02 | Organizer can log in with email and password | Better Auth `signIn.email()` client method + DB-backed sessions |
| AUTH-03 | Organizer can connect their Google Drive account via OAuth immediately after signup, before creating their first event | Custom Google OAuth route handler (`/api/drive/connect` → `/api/drive/callback`) with `drive.file` scope, `access_type: offline`, `prompt: consent` + AES-256-GCM encrypted refresh token in `google_tokens` table |
</phase_requirements>

---

## Summary

Phase 1 bootstraps a greenfield Next.js 15 project (no `package.json` or `src/` exists yet) and delivers three capabilities: organizer registration, organizer login, and Google Drive connection. The system must be deployed and publicly reachable on Railway by end of phase.

The most nuanced requirement is AUTH-03: Google Drive connection is **not** organizer login. Google is used purely as a storage backend — organizers authenticate with email/password via Better Auth, and separately connect Drive via a fully custom OAuth route (not Better Auth's social provider flow). This keeps the auth session clean and lets us encrypt the Drive `refresh_token` with our own AES-256-GCM key before storing it in a dedicated `google_tokens` table.

The highest-risk implementation detail is the Google OAuth callback: `refresh_token` is only issued once (on first consent), so the callback must assert it is present and store it immediately. Missing it means the organizer must revoke access in Google Account settings and re-link.

**Primary recommendation:** Bootstrap with `create-next-app`, configure Better Auth for email/password only, implement Drive connection as a separate custom OAuth flow (`/api/drive/connect` → `/api/drive/callback`), and deploy on Railway via Nixpacks with no Dockerfile required.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Organizer registration (AUTH-01) | API/Backend (Server Action or Route Handler) | Browser (form UI) | Password hashing must happen server-side; Better Auth handles it |
| Organizer login (AUTH-02) | API/Backend (Better Auth route handler) | Browser (form UI) | Session token set via cookie; server owns session lifecycle |
| Session verification / route protection | API/Backend (Next.js middleware) | — | `auth.api.getSession()` called in middleware or Server Component |
| Google Drive OAuth initiation (AUTH-03) | API/Backend (Route Handler) | Browser (redirect) | Server generates auth URL with credentials; client just redirects |
| Google Drive OAuth callback | API/Backend (Route Handler) | — | Token exchange is server-only; client never sees tokens |
| Refresh token encryption + storage | API/Backend (custom `lib/crypto.ts`) | Database | AES-256-GCM in Node.js crypto; stored in `google_tokens` table |
| Dashboard UI | Browser (Client Component) + SSR | API/Backend (session check) | SSR for initial auth check; interactive UI is client |
| Database schema + migrations | Database (Drizzle ORM) | — | Drizzle Kit generates migrations; Neon hosts Postgres |
| Deployment | Railway (Nixpacks) | — | Auto-detects Next.js; no Dockerfile needed |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.1.11 | Full-stack framework (App Router) | App Router SSR + Route Handlers in one repo; no separate backend needed |
| TypeScript | 5.x | Type safety | Required for Drizzle schema, Better Auth types, googleapis response shapes |
| Tailwind CSS | 4.2.4 | Styling | Mobile-first utilities; fast iteration; no CSS bundle config needed |
| Better Auth | 1.6.9 | Organizer auth (email/password + DB sessions) | First-class `emailAndPassword`, DB-backed sessions (not JWT), Drizzle adapter, TypeScript-native |
| `@better-auth/drizzle-adapter` | 1.6.9 | Better Auth ↔ Drizzle bridge | Separate package; required for DB adapter |
| Drizzle ORM | 0.45.2 | ORM + schema definition | Lightweight, serverless-friendly, SQL-transparent, Drizzle Kit migrations |
| `@neondatabase/serverless` | 1.1.0 | Neon Postgres driver | Serverless HTTP driver; works in Railway Node.js runtime |
| drizzle-kit | 0.31.10 | Migration generation + push | Official Drizzle CLI for schema migrations |
| googleapis | 171.4.0 | Google OAuth2 + Drive API client | Official Google Node.js client; handles token exchange + refresh |

### Supporting (Phase 1 scope)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `crypto` (built-in) | Node 20.x | AES-256-GCM refresh token encryption | Built-in — no install needed; encrypt Drive `refresh_token` before DB write |
| `@types/node` | Latest | TypeScript types for Node builtins | Dev dependency; needed for `crypto`, `process.env` types |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Drive OAuth route | Better Auth `linkSocial` with `drive.file` scope | `linkSocial` stores tokens in Better Auth's `account` table unencrypted (unless `encryptOAuthTokens: true`); separate route gives full control over encryption key |
| Neon serverless HTTP driver | Neon WebSocket driver (`neon-websocket`) | HTTP driver works cleanly in Railway's persistent Node.js runtime; WS driver adds complexity for no benefit here |
| Drizzle Kit `push` (dev) | Drizzle Kit `generate` + `migrate` (production) | Use `push` for dev speed; use `generate` + commit migrations for production Railway deploys |

**Installation (greenfield bootstrap):**
```bash
# 1. Bootstrap Next.js 15 project
npx create-next-app@latest wedding-pov --typescript --tailwind --app --src-dir --no-git

# 2. Auth + DB
npm install better-auth @better-auth/drizzle-adapter drizzle-orm @neondatabase/serverless

# 3. Google Drive
npm install googleapis

# 4. Dev tooling
npm install -D drizzle-kit @types/node
```

**Version verification (confirmed via npm registry 2025-05-02):**
- `better-auth`: 1.6.9 [VERIFIED: npm registry]
- `@better-auth/drizzle-adapter`: 1.6.9 [VERIFIED: npm registry]
- `drizzle-orm`: 0.45.2 [VERIFIED: npm registry]
- `@neondatabase/serverless`: 1.1.0 [VERIFIED: npm registry]
- `googleapis`: 171.4.0 [VERIFIED: npm registry]
- `drizzle-kit`: 0.31.10 [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
Organizer Browser
  │
  ├─── POST /api/auth/[...all]  ──────► Better Auth handler
  │         (sign-up / sign-in)              │
  │                                          ├─► Drizzle → Neon: INSERT user / session
  │                                          └─► Set session cookie
  │
  ├─── GET  /dashboard          ──────► Next.js Server Component
  │                                          │
  │                                          └─► auth.api.getSession() → redirect /login if no session
  │
  ├─── GET  /api/drive/connect  ──────► Route Handler
  │         (logged-in org only)             │
  │                                          ├─► assert session
  │                                          └─► redirect → Google OAuth consent (drive.file scope)
  │
  └─── GET  /api/drive/callback ──────► Route Handler
            (Google redirects here)          │
                                             ├─► exchange code → {access_token, refresh_token}
                                             ├─► assert refresh_token present (or re-trigger)
                                             ├─► AES-256-GCM encrypt refresh_token
                                             ├─► Drizzle → Neon: UPSERT google_tokens
                                             └─► redirect /dashboard?drive=connected
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           # Sign-in form (client component)
│   │   └── register/page.tsx        # Sign-up form (client component)
│   ├── (organizer)/
│   │   └── dashboard/page.tsx       # Protected dashboard (server component)
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...all]/route.ts    # Better Auth catch-all handler
│   │   └── drive/
│   │       ├── connect/route.ts     # Initiates Google OAuth → redirects to Google
│   │       └── callback/route.ts    # Receives code, stores encrypted tokens
│   └── layout.tsx
├── lib/
│   ├── auth.ts                      # Better Auth server config + drizzleAdapter
│   ├── auth-client.ts               # createAuthClient() for browser use
│   ├── db/
│   │   ├── index.ts                 # neon() + drizzle() client export
│   │   └── schema.ts                # All Drizzle table definitions (BA + custom)
│   └── crypto.ts                    # AES-256-GCM encrypt/decrypt for refresh token
├── middleware.ts                    # Session check → redirect /login
└── components/
    ├── auth/
    │   ├── SignInForm.tsx
    │   └── RegisterForm.tsx
    └── dashboard/
        └── DriveConnectionStatus.tsx
```

### Pattern 1: Better Auth Server Configuration

**What:** Configure Better Auth for email/password only with Drizzle adapter pointing at Neon.
**When to use:** Single server-side auth instance shared across all Route Handlers and Server Components.

```typescript
// src/lib/auth.ts
// Source: https://www.better-auth.com/docs/installation + Context7 /better-auth/better-auth
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "./db/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL!, // e.g. https://yourapp.railway.app
  secret: process.env.BETTER_AUTH_SECRET!,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,      // map BA "user" model → our "users" table
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
});
```

### Pattern 2: Better Auth Client (Browser)

```typescript
// src/lib/auth-client.ts
// Source: Context7 /better-auth/better-auth — concepts/client
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!, // must match BETTER_AUTH_URL
});
```

**Sign-up usage:**
```typescript
// Source: Context7 /better-auth/better-auth
const { data, error } = await authClient.signUp.email({
  email,
  password,
  name,
  callbackURL: "/dashboard",
});
```

**Sign-in usage:**
```typescript
const { data, error } = await authClient.signIn.email({
  email,
  password,
  callbackURL: "/dashboard",
});
```

### Pattern 3: Better Auth Route Handler (Next.js App Router)

```typescript
// src/app/api/auth/[...all]/route.ts
// Source: Context7 /better-auth/better-auth — integrations/next
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Pattern 4: Session Protection in Server Component

```typescript
// src/app/(organizer)/dashboard/page.tsx
// Source: Context7 /better-auth/better-auth — integrations/next
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  return <div>Welcome {session.user.name}</div>;
}
```

### Pattern 5: Session Protection in Middleware (optimistic)

```typescript
// src/middleware.ts
// Source: Context7 /better-auth/better-auth — guides/workos-migration
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

### Pattern 6: Drizzle Schema (Better Auth core tables + custom)

```typescript
// src/lib/db/schema.ts
// Sources: Context7 /better-auth/better-auth (account/session field definitions)
//          Context7 /drizzle-team/drizzle-orm (pgTable)
import {
  pgTable, text, timestamp, boolean, integer,
} from "drizzle-orm/pg-core";

// ── Better Auth managed tables ───────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Custom tables ────────────────────────────────────────────────────────────

export const googleTokens = pgTable("google_tokens", {
  id: text("id").primaryKey(),                              // uuid
  userId: text("user_id").notNull().unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // AES-256-GCM encrypted: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  accessToken: text("access_token"),                        // short-lived; cached
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Phase 2 stub tables (create empty now for schema completeness) ────────────

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  organizerId: text("organizer_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  photoLimit: integer("photo_limit").notNull().default(20),
  isActive: boolean("is_active").notNull().default(true),
  driveFolderId: text("drive_folder_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const uploadRecords = pgTable("upload_records", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  organizerId: text("organizer_id").notNull(), // denormalized for fast isolation queries
  guestNickname: text("guest_nickname").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSizeBytes: integer("file_size_bytes"),
  driveFileId: text("drive_file_id"),
  status: text("status").notNull().default("pending"), // "pending" | "complete" | "failed"
  initiatedAt: timestamp("initiated_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});
```

### Pattern 7: Drizzle DB Client (Neon serverless HTTP)

```typescript
// src/lib/db/index.ts
// Source: Context7 /drizzle-team/drizzle-orm — Neon HTTP driver
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

neonConfig.fetchConnectionCache = true;

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

**`drizzle.config.ts` (root of project):**
```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### Pattern 8: Google Drive OAuth — Custom Route Handlers

**Why custom (not Better Auth `linkSocial`):** Better Auth's `account` table stores OAuth tokens; we need full control of encryption with our own `ENCRYPTION_KEY`. A separate route owns the entire token lifecycle.

```typescript
// src/app/api/drive/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.redirect(new URL("/login", request.url));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`, // must match GCP registered URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",            // request refresh token
    prompt: "select_account consent",  // force consent to always get refresh token
    scope: ["https://www.googleapis.com/auth/drive.file"],
    state: session.user.id,            // carry userId through OAuth round-trip
  });

  return NextResponse.redirect(authUrl);
}
```

```typescript
// src/app/api/drive/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { googleTokens } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // was set in connect route
  const error = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(new URL("/dashboard?drive=error", request.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.BETTER_AUTH_URL}/api/drive/callback`,
  );

  const { tokens } = await oauth2Client.getToken(code);

  // CRITICAL: assert refresh_token is present — only issued on first consent
  if (!tokens.refresh_token) {
    // User already connected; re-trigger with prompt: consent
    return NextResponse.redirect(new URL("/api/drive/connect?force=true", request.url));
  }

  const encryptedRefreshToken = encrypt(tokens.refresh_token);

  await db.insert(googleTokens).values({
    id: randomUUID(),
    userId,
    encryptedRefreshToken,
    accessToken: tokens.access_token ?? null,
    accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  }).onConflictDoUpdate({
    target: googleTokens.userId,
    set: {
      encryptedRefreshToken,
      accessToken: tokens.access_token ?? null,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      updatedAt: new Date(),
    },
  });

  return NextResponse.redirect(new URL("/dashboard?drive=connected", request.url));
}
```

### Pattern 9: AES-256-GCM Token Encryption

```typescript
// src/lib/crypto.ts
// Source: Node.js crypto docs [VERIFIED: node --version 20.x, tested locally]
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

/**
 * Encrypts using AES-256-GCM.
 * Output format: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16-byte authentication tag
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decrypt(stored: string): string {
  const iv = Buffer.from(stored.slice(0, 24), "hex");
  const tag = Buffer.from(stored.slice(24, 56), "hex");
  const ciphertext = Buffer.from(stored.slice(56), "hex");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
```

### Pattern 10: Railway Deployment (Nixpacks — no Dockerfile)

```json
// package.json scripts (standard Next.js)
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

Railway auto-detects Next.js via Nixpacks and runs `npm run build` then `npm start`. Next.js 15 automatically reads `PORT` from the environment (Railway injects it). No `Dockerfile` or `railway.json` required for basic deployment.

**Railway environment variables to configure via dashboard:**
```
DATABASE_URL           = postgresql://...@...neon.tech/wedding-pov?sslmode=require
BETTER_AUTH_SECRET     = <output of: openssl rand -base64 32>
BETTER_AUTH_URL        = https://<project>.railway.app  (no trailing slash)
NEXT_PUBLIC_APP_URL    = https://<project>.railway.app
GOOGLE_CLIENT_ID       = <from GCP console>
GOOGLE_CLIENT_SECRET   = <from GCP console>
ENCRYPTION_KEY         = <output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### Anti-Patterns to Avoid

- **Using Better Auth `linkSocial` for Drive:** Stores tokens in `account` table where encryption requires `BETTER_AUTH_SECRET` (not our own key). Use custom OAuth route instead.
- **Requesting `drive` scope (not `drive.file`):** Triggers weeks-long security review. Always use `https://www.googleapis.com/auth/drive.file`.
- **Omitting `access_type: "offline"` and `prompt: "consent"`:** No refresh token returned. Drive connection breaks after 60 minutes.
- **Not asserting `tokens.refresh_token` in callback:** Silent failure; `google_tokens` gets null refresh_token; uploads break 1 hour later.
- **Using `FileReader.readAsDataURL()` anywhere client-side:** Base64 bloat + full memory load. (Phase 3 concern, but avoid from the start.)
- **Using Vercel instead of Railway:** 4.5 MB body limit blocks photo uploads (Phase 3). Railway from day one.
- **Storing `ENCRYPTION_KEY` as anything other than 64 hex chars:** `Buffer.from(key, 'hex')` requires exactly 64 hex chars for a 32-byte AES key.
- **Using `drizzle-kit push` in production:** `push` can drop columns. Use `generate` + commit migration SQL + `migrate` in CI/CD.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | Better Auth `emailAndPassword` | Better Auth handles bcrypt rounds, timing-safe compare, salt automatically |
| Session tokens | Custom JWT or session ID gen | Better Auth sessions | Better Auth generates cryptographically secure session tokens, handles expiry, rotation |
| OAuth PKCE + state + nonce | Custom OAuth flow primitives | `google.auth.OAuth2` from `googleapis` | googleapis handles PKCE, state, token exchange edge cases |
| Database connection pooling | Manual pg pool | `@neondatabase/serverless` `neonConfig.fetchConnectionCache = true` | Neon's HTTP driver handles connection reuse in serverless/Railway correctly |
| Migration tracking | Custom migration table | Drizzle Kit (`drizzle-kit generate` + `migrate`) | Drizzle Kit tracks applied migrations, handles ordering, safe rollback |
| Refresh token encryption | Rolling your own IV/GCM | The `lib/crypto.ts` pattern above | GCM authentication tag prevents ciphertext tampering; pattern is well-established |

**Key insight:** Better Auth's biggest value in Phase 1 is not being clever — it handles all the bcrypt and session token edge cases so the app can focus on the novel Drive connection pattern.

---

## Common Pitfalls

### Pitfall 1: Refresh Token Absent from Callback (Silent Drive Break)
**What goes wrong:** `tokens.refresh_token` is `null` in the OAuth callback. Drive works for 60 minutes then silently fails.
**Why it happens:** Google only issues `refresh_token` on the **first** consent for a given app+user pair. If the user previously authorized and the token wasn't stored, subsequent OAuth flows return `null`.
**How to avoid:** Always set `access_type: "offline"` AND `prompt: "select_account consent"` in `generateAuthUrl()`. In the callback, `if (!tokens.refresh_token)` → re-trigger the flow (do NOT write null to DB).
**Warning signs:** `tokens.refresh_token === null` in server logs after a "successful" OAuth callback.

### Pitfall 2: GCP Redirect URI Mismatch
**What goes wrong:** `redirect_uri_mismatch` error from Google during callback.
**Why it happens:** The URI in `generateAuthUrl()` must exactly match a URI registered in GCP console → Credentials → OAuth 2.0 Client IDs.
**How to avoid:** Register all URIs upfront: `http://localhost:3000/api/drive/callback` and `https://<your>.railway.app/api/drive/callback`. Include the exact path `/api/drive/callback`.
**Warning signs:** OAuth flow redirects to Google but Google immediately redirects back with `error=redirect_uri_mismatch`.

### Pitfall 3: Wrong OAuth Scope (`drive` vs `drive.file`)
**What goes wrong:** App requires weeks-long Google security review. Cannot go to production.
**Why it happens:** `drive` scope grants full Drive access → restricted scope → mandatory security assessment.
**How to avoid:** Use `https://www.googleapis.com/auth/drive.file` exclusively. It only lets the app see/modify files it created — which is exactly what's needed.
**Warning signs:** GCP consent screen shows "See and download all your Google Drive files."

### Pitfall 4: GCP App in Testing Mode on Wedding Day
**What goes wrong:** Organizer's refresh token expires after 7 days. Drive connection silently breaks mid-event.
**Why it happens:** Google's Testing mode limits non-basic-profile scopes to 7-day token lifetimes.
**How to avoid:** Submit for OAuth App Verification before any real event. Add your own test account as a "Test User" in GCP console during development (prevents 7-day expiry for your dev account).
**Warning signs:** `invalid_grant` errors in server logs when calling Google's token endpoint.

### Pitfall 5: Better Auth Table Name Mismatch with Drizzle Adapter
**What goes wrong:** Better Auth throws "table not found" or silently fails to write sessions.
**Why it happens:** Better Auth's internal model names (`user`, `session`, `account`, `verification`) must be mapped to your Drizzle table names if they differ.
**How to avoid:** In `drizzleAdapter()`, pass `schema` with explicit mapping: `{ ...schema, user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications }`.
**Warning signs:** Login appears to succeed but no session row appears in DB; `auth.api.getSession()` returns null.

### Pitfall 6: `ENCRYPTION_KEY` Wrong Format
**What goes wrong:** `Buffer.from(key, 'hex')` produces a buffer of wrong length; `createCipheriv` throws "Invalid key length."
**Why it happens:** AES-256 needs exactly 32 bytes. A 32-character string is only 32 bytes if it's ASCII — but hex encoding of 32 bytes is 64 characters.
**How to avoid:** Generate key as: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` → 64 chars. Validate on startup: `if (process.env.ENCRYPTION_KEY?.length !== 64) throw new Error(...)`.
**Warning signs:** Startup crash with "Invalid key length" from the crypto module.

### Pitfall 7: `BETTER_AUTH_URL` Trailing Slash or Wrong Value
**What goes wrong:** Better Auth can't resolve its own endpoints; cookie domain mismatches; redirect loops.
**Why it happens:** Better Auth uses `baseURL` to construct its own API paths and set cookie domains. A trailing slash or mismatched value breaks these.
**How to avoid:** Set `BETTER_AUTH_URL=https://yourapp.railway.app` (no trailing slash). Set `NEXT_PUBLIC_APP_URL` to the same value for client code.
**Warning signs:** Sign-in POST fails with 404; session cookie not set.

---

## Code Examples

### Complete Better Auth + Drizzle Setup Verification

```typescript
// Quick smoke test: run in Railway or locally
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

// Test DB connection
const allUsers = await db.select().from(users).limit(1);
console.log("DB connected:", allUsers !== undefined);

// Test auth config
console.log("Auth configured:", !!auth.options.secret);
```

### Drizzle Kit Commands

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations to Neon (dev: use push for speed)
npx drizzle-kit push

# Apply committed migrations (production CI/CD)
npx drizzle-kit migrate
```

### Better Auth CLI Schema Generation (reference — use to verify Drizzle schema is complete)

```bash
# Generates auth schema SQL for inspection — compare against your Drizzle schema
npx @better-auth/cli generate --config src/lib/auth.ts
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth (JWT sessions) | Better Auth (DB sessions) | 2024 | Cleaner session revocation; tokens stored in DB |
| Prisma (binary engine) | Drizzle ORM (JS runtime) | 2023–2024 | Serverless-friendly; no native binary needed |
| Vercel hosting | Railway hosting | Architecture decision | No 4.5 MB body limit; persistent Node.js process |
| `googleapis` OAuth manual flow | `google.auth.OAuth2` client | Stable | Official Google client handles all edge cases |

**Deprecated/outdated:**
- `next-auth` v4: Use Better Auth or Auth.js v5 instead; v4 is maintenance-only
- Drizzle `push` in production: Use `generate` + commit migrations; `push` can be destructive

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Railway Nixpacks auto-detects Next.js and uses `npm run build` + `npm start` without any `railway.json` | Architecture Patterns (Deployment) | May need a `railway.json` with `startCommand` — low risk, easy fix during deployment task |
| A2 | Better Auth `@better-auth/drizzle-adapter` is the correct separate package (not bundled in `better-auth`) | Standard Stack | Install command wrong; easy to verify with `npm install` output |
| A3 | Next.js 15 reads `PORT` env var automatically when Railway injects it | Architecture Patterns (Deployment) | May need `next start -p $PORT` explicitly in `package.json` start script |

---

## Open Questions (RESOLVED)

1. **Email verification requirement for AUTH-01/02**
   - What we know: Better Auth supports `requireEmailVerification: true` but that needs an email provider (Resend, Nodemailer, etc.)
   - What's unclear: Is email verification required for v1, or is instant account access acceptable?
   - Recommendation: Disable email verification for v1 (set `requireEmailVerification: false`). Add email verification in a later hardening phase. This unblocks Phase 1 without needing an email provider.
   - RESOLVED: Email verification disabled for v1 (`requireEmailVerification: false`). Implemented in Plan 02 Better Auth config.

2. **GCP OAuth App Verification timing**
   - What we know: Testing mode causes 7-day refresh token expiry. Verification required before any real event.
   - What's unclear: How long does `drive.file` (non-sensitive) verification take? (Google states "a few days" but varies.)
   - Recommendation: Submit verification as soon as GCP credentials exist (during Phase 1 deployment task). Flag as a launch gate.
   - RESOLVED: Submit for verification during Phase 1 deployment (Plan 04). Flagged as a hard launch gate in Phase 4. `drive.file` is non-sensitive scope — basic verification only, no security audit.

3. **Drizzle `push` vs `migrate` for development workflow**
   - What we know: `push` is faster for dev but can be destructive; `migrate` is safe for production
   - What's unclear: What's the team's preference for local dev schema changes during Phase 1?
   - Recommendation: Use `push` during Phase 1 development (schema is still being defined); switch to `generate` + `migrate` from Phase 2 onwards.
   - RESOLVED: Use `drizzle-kit push` for Phase 1 (schema still being defined). Switch to `drizzle-kit generate` + `drizzle-kit migrate` from Phase 2 onwards. Implemented as [BLOCKING] task in Plan 01.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js runtime | ✓ | 20.19.6 | — |
| npm | Package installation | ✓ | 11.6.4 | — |
| git | Version control | ✓ | 2.53.0 | — |
| Neon Postgres | Database | Must create account | — | Use local Postgres with `drizzle-kit push` |
| Google Cloud Project + OAuth 2.0 credentials | AUTH-03 | Must create | — | Cannot do Drive OAuth without GCP credentials |
| Railway account | Deployment (success criterion 5) | Must create | — | Cannot verify public URL without deployment |

**Missing dependencies with no fallback:**
- GCP OAuth 2.0 credentials (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) — must be created before the Drive connection task can be verified
- Railway account + project — required for success criterion 5 ("reachable at a public Railway URL")

**Missing dependencies with fallback:**
- Neon account: Can use a local Postgres instance during development; switch to Neon for Railway deployment

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Better Auth bcrypt password hashing + DB sessions |
| V3 Session Management | YES | Better Auth DB-backed sessions with expiry; HttpOnly cookie |
| V4 Access Control | YES | `auth.api.getSession()` in middleware + server components |
| V5 Input Validation | YES | Better Auth validates email format, min password length (8 chars) |
| V6 Cryptography | YES | AES-256-GCM for refresh tokens; `BETTER_AUTH_SECRET` for session signing; never hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stolen refresh token from DB | Information Disclosure | AES-256-GCM encryption at rest (`lib/crypto.ts`); `ENCRYPTION_KEY` in Railway env var |
| Session fixation | Elevation of Privilege | Better Auth rotates session token on sign-in |
| OAuth state parameter missing | Spoofing | `state` parameter carries `userId` through OAuth round-trip; verify in callback |
| Drive token in client response | Information Disclosure | Drive tokens never returned to browser; all Drive calls are server-side only |
| Replay of OAuth authorization code | Tampering | `googleapis` `getToken()` is single-use; code expires immediately after exchange |
| Brute-force login | Denial of Service | Better Auth rate-limiting is not built-in — consider adding `next-rate-limit` middleware on `/api/auth/sign-in/email` for Phase 4 hardening |

---

## Sources

### Primary (HIGH confidence)
- Context7 `/better-auth/better-auth` — email/password config, Drizzle adapter, Next.js handler, session patterns, account table schema, client methods [VERIFIED: Context7]
- Context7 `/llmstxt/better-auth_llms_txt` — linkSocial, OAuth concepts, account linking, env vars [VERIFIED: Context7]
- Context7 `/drizzle-team/drizzle-orm` — Neon HTTP driver setup, pgTable schema, Drizzle Kit migration commands [VERIFIED: Context7]
- npm registry — all package versions verified 2025-05-02 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — stack decisions and rationale (researched 2025-05-02) [CITED: project research]
- `.planning/research/ARCHITECTURE.md` — data flow patterns, table schemas, OAuth token lifecycle [CITED: project research]
- `.planning/research/PITFALLS.md` — Google OAuth pitfalls (Testing mode, scope, redirect URI) [CITED: project research]
- Node.js crypto docs — AES-256-GCM pattern verified locally with Node 20.x [VERIFIED: local node test]

### Tertiary (LOW confidence)
- Railway Nixpacks auto-detection behavior for Next.js — inferred from nixpacks.com (HTML, not parseable) [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions npm-verified; patterns Context7-verified
- Architecture: HIGH — based on verified project research + Better Auth docs
- Pitfalls: HIGH — documented pitfalls sourced from official Google OAuth docs + project research
- Railway deployment: MEDIUM — general pattern is well-known; exact Nixpacks behavior for Next.js 15 is ASSUMED

**Research date:** 2025-05-02
**Valid until:** 2025-06-01 (Better Auth and googleapis are actively maintained; verify versions if planning extends beyond this date)
