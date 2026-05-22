"use client";

import { useEffect, useState, useCallback } from "react";
import { BiometricAuth, BiometryError } from "@aparajita/capacitor-biometric-auth";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";

type LockState = "checking" | "locked" | "unlocked" | "fallback" | "skip";

/**
 * Reusable helper — runs the cold-launch lock check.
 * Returns:
 *   'skip'      — non-native platform OR biometricEnabled !== 'true' (user opted out)
 *   'fallback'  — biometrics unavailable on device OR user failed/cancelled the prompt
 *   'unlocked'  — user successfully authenticated
 *
 * Per CONTEXT.md decision: lock granularity is cold launch only — backgrounding
 * and resuming does NOT re-lock. This function should be invoked once when the
 * BiometricLockScreen component mounts (which happens once per cold start in layout).
 */
export async function checkAndLock(): Promise<"unlocked" | "fallback" | "skip"> {
  if (!Capacitor.isNativePlatform()) return "skip";

  const { value } = await Preferences.get({ key: "biometricEnabled" });
  if (value !== "true") return "skip";

  try {
    const result = await BiometricAuth.checkBiometry();
    if (!result.isAvailable) return "fallback";
  } catch {
    return "fallback";
  }

  try {
    await BiometricAuth.authenticate({
      reason: "Unlock Wedding POV",
      allowDeviceCredential: false,
    });
    return "unlocked";
  } catch (error) {
    // BiometryError covers user-cancel, lockout, no-enrollment, etc.
    // Per CONTEXT.md: do not show error UI for unavailability — silent fallback.
    if (error instanceof BiometryError) {
      return "fallback";
    }
    return "fallback";
  }
}

/**
 * Cold-launch lock gate. Renders a fullscreen overlay while authenticating;
 * unmounts itself on success or fallback. Per UI-SPEC §3:
 *   - role=dialog aria-modal=true
 *   - bg-white fullscreen, centered icon + heading + body + button
 *   - "Use password instead" link appears after 3 consecutive failures
 *
 * Mount once at layout level (plan 04 owns layout.tsx wiring).
 */
export function BiometricLockScreen() {
  const [state, setState] = useState<LockState>("checking");
  const [failureCount, setFailureCount] = useState(0);

  const attempt = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setState("skip");
      return;
    }

    const { value } = await Preferences.get({ key: "biometricEnabled" });
    if (value !== "true") {
      setState("skip");
      return;
    }

    try {
      const cap = await BiometricAuth.checkBiometry();
      if (!cap.isAvailable) {
        setState("fallback");
        return;
      }
    } catch {
      setState("fallback");
      return;
    }

    setState("locked");
    try {
      await BiometricAuth.authenticate({
        reason: "Unlock Wedding POV",
        allowDeviceCredential: false,
      });
      setState("unlocked");
    } catch {
      setFailureCount((c) => c + 1);
      setState("locked");
    }
  }, []);

  // Run once on cold launch — intentional single fire per mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void attempt(); }, [attempt]);

  if (state === "checking" || state === "skip" || state === "unlocked" || state === "fallback") {
    return null;
  }

  // state === "locked" — show overlay
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Biometric authentication required"
      className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-6 z-50"
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
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      <h1 className="text-2xl font-semibold text-center">Unlock Wedding POV</h1>
      <p className="text-sm font-normal text-gray-500 text-center max-w-[280px]">
        Use Face ID or Touch ID to continue
      </p>
      <button
        type="button"
        onClick={attempt}
        autoFocus
        className="bg-black text-white text-sm font-semibold py-2 px-6 rounded hover:bg-gray-800"
      >Authenticate</button>
      {failureCount >= 3 && (
        <button
          type="button"
          onClick={() => setState("fallback")}
          className="text-sm font-normal text-gray-500 underline hover:text-black"
        >Use password instead</button>
      )}
    </div>
  );
}
