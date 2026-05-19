import { createAuthClient } from "better-auth/client";

// Use the current page's origin at runtime so API calls always target the right
// server regardless of how NEXT_PUBLIC_APP_URL is set in Railway's env.
// Falls back to the env var during SSR (window not available).
const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL ?? "");

export const authClient = createAuthClient({ baseURL });
