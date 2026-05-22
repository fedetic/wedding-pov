"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";

/**
 * Universal Link / App Link handler.
 *
 * Listens for appUrlOpen events with https:// URLs matching /e/ (guest upload links).
 * Routes the organizer to /dashboard — per CONTEXT.md locked decision, the /e/[slug]
 * path is guest-only; an organizer opening such a link should land in the dashboard.
 *
 * The existing OAuth listener in ConnectDriveButton.tsx handles com.weddingpov.app://
 * URLs and is unaffected — both listeners coexist (each handles its own URL pattern).
 *
 * This component renders nothing. Mount it once at layout level (done in plan 04).
 */
export function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("appUrlOpen", (data) => {
      // Universal Links arrive with https://; OAuth callbacks arrive with
      // com.weddingpov.app:// and are handled by ConnectDriveButton's listener.
      if (data.url.startsWith("https://") && data.url.includes("/e/")) {
        router.push("/dashboard");
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, [router]);

  return null;
}
