"use client";

import { OfflineOverlay } from "./OfflineOverlay";
import { DeepLinkHandler } from "./DeepLinkHandler";
import { BiometricLockScreen } from "./BiometricLockScreen";

/**
 * Single client-side wrapper mounting all native-only effects.
 *
 * Mounted once at the root of app/layout.tsx. Each child component internally
 * gates its behavior with Capacitor.isNativePlatform() — so on web all three
 * render as no-ops (null DOM, no listeners attached).
 *
 * Layered z-index priority (when both overlays would show simultaneously):
 *   - OfflineOverlay (z-50)  — outermost, blocks all interaction
 *   - BiometricLockScreen (z-50) — also z-50; the offline overlay's later mount
 *     order in this component means it visually sits on top, which is the
 *     intended priority: a device that is offline AND requires biometric
 *     unlock should show the offline message first because biometric cannot
 *     succeed without the network anyway (BiometricAuth itself is offline-OK,
 *     but the dashboard it gates is network-dependent).
 *
 * DeepLinkHandler renders null — it is a listener-only component.
 */
export function NativeShell() {
  return (
    <>
      <DeepLinkHandler />
      <BiometricLockScreen />
      <OfflineOverlay />
    </>
  );
}
