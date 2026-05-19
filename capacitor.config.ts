import type { CapacitorConfig } from "@capacitor/cli";

// server.url points to the live Railway deployment.
// The app binary is a thin native shell; all SSR, auth, and API calls run on Railway.
// DO NOT set output: 'export' in next.config.ts — Server Actions and Better Auth cookies
// are incompatible with static export (per D-01 decision).
const config: CapacitorConfig = {
  appId: "com.weddingpov.app",
  appName: "Wedding POV",
  webDir: "out", // fallback placeholder — not used when server.url is set
  server: {
    url: "https://pov.jjwedding.nl",
    cleartext: false, // Railway is HTTPS; no plaintext HTTP allowed
  },
  ios: {
    contentInset: "automatic",
  },
  plugins: {
    // Belt-and-suspenders alongside better-auth-capacitor plugin (Plan 03)
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
