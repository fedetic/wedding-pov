"use client";

import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { Capacitor } from "@capacitor/core";

/**
 * Reactive fullscreen offline overlay (NATIVE-04).
 *
 * Behavior (per CONTEXT.md):
 *   - Mount listener on native only — web users have browser-level offline UX
 *   - Show overlay whenever Network reports connected: false
 *   - Auto-dismiss when connectivity returns (no manual retry required)
 *   - Try again button re-checks via Network.getStatus(); if still offline,
 *     shows "Checking…" feedback for 1000ms before resetting label
 *
 * The overlay sits above the WebView — does not navigate away — so the app
 * resumes in place when connectivity is restored (CONTEXT.md line 44).
 */
export function OfflineOverlay() {
  const [isOffline, setIsOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    Network.getStatus().then(({ connected }) => {
      if (!cancelled) setIsOffline(!connected);
    });

    const listenerPromise = Network.addListener("networkStatusChange", ({ connected }) => {
      setIsOffline(!connected);
    });

    return () => {
      cancelled = true;
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, []);

  async function handleRetry() {
    if (checking) return;
    setChecking(true);
    try {
      const { connected } = await Network.getStatus();
      if (connected) {
        setIsOffline(false);
        return;
      }
      // Still offline — keep overlay; show "Checking…" feedback for 1s
      await new Promise((r) => setTimeout(r, 1000));
    } finally {
      setChecking(false);
    }
  }

  if (!isOffline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 z-50"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#171717"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M1 9a16 16 0 0 1 22 0" />
        <path d="M5 13a10 10 0 0 1 14 0" />
        <path d="M9 17a4 4 0 0 1 6 0" />
        <line x1="3" y1="3" x2="21" y2="21" />
      </svg>
      <h1 className="text-lg font-semibold text-center">No internet connection</h1>
      <p className="text-sm font-normal text-gray-500 text-center max-w-[280px]">
        Check your connection and try again
      </p>
      <button
        type="button"
        onClick={handleRetry}
        autoFocus
        disabled={checking}
        className="bg-black text-white text-sm font-semibold py-2 px-6 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {checking ? "Checking…" : "Try again"}
      </button>
    </div>
  );
}
