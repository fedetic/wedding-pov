import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!, // must match BETTER_AUTH_URL (no trailing slash)
});
