"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";

export function BiometricToggle() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    Preferences.get({ key: "biometricEnabled" }).then(({ value }) => {
      setEnabled(value === "true");
    });
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (!enabled) {
        // Confirm capability + user can pass the prompt before enabling.
        const cap = await BiometricAuth.checkBiometry();
        if (!cap.isAvailable) {
          // Silent fallback per CONTEXT.md — toggle does not enable, no error UI.
          return;
        }
        try {
          await BiometricAuth.authenticate({
            reason: "Enable Face ID / Touch ID for Wedding POV",
            allowDeviceCredential: false,
          });
        } catch {
          return; // user cancelled or failed — toggle does not enable
        }
        await Preferences.set({ key: "biometricEnabled", value: "true" });
        setEnabled(true);
      } else {
        await Preferences.remove({ key: "biometricEnabled" });
        setEnabled(false);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!Capacitor.isNativePlatform()) return null; // toggle row is native-only per UI-SPEC §2

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Face ID / Touch ID</span>
        <span className="text-xs font-normal text-gray-500">Require biometric authentication on app launch</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Face ID / Touch ID"
        onClick={toggle}
        disabled={busy}
        className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-150 ${
          enabled ? "bg-black" : "bg-gray-200"
        } disabled:opacity-50`}
      >
        <span
          className={`absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full shadow transition-transform duration-150 ${
            enabled ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
