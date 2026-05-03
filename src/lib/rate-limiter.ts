import { RateLimiterMemory } from "rate-limiter-flexible";

/**
 * Upload rate limiter — 30 photos per IP:slug per 15 minutes.
 * On exhaustion, the key is blocked for an additional 10 minutes.
 */
export const uploadRateLimiter = new RateLimiterMemory({
  points: 30, // 30 photos per window
  duration: 900, // 15-minute window (seconds)
  blockDuration: 600, // block 10 minutes on exhaustion
});
