"use client";

import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { QRModal } from "./QRModal";

export type EventData = {
  id: string;
  name: string;
  slug: string;
  photoLimit: number;
  isActive: boolean;
};

type Props = {
  event: EventData;
  onToggleError: (msg: string | null) => void;
};

export function EventRow({ event, onToggleError }: Props) {
  const [isActive, setIsActive] = useState(event.isActive);
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);

  async function handleToggle() {
    if (saving) return;
    setSaving(true);
    onToggleError(null);
    const prev = isActive;
    setIsActive(!isActive); // optimistic flip
    try {
      const res = await fetch(`/api/events/${event.id}/toggle`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Toggle failed");
      const data = (await res.json()) as { isActive: boolean };
      setIsActive(data.isActive); // sync with server truth
    } catch {
      setIsActive(prev); // revert on error
      onToggleError("Could not update event status. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="border-t border-gray-100">
        <td className="px-4 py-3 text-sm">{event.name}</td>
        <td className="px-4 py-3 text-sm w-20 text-center">{event.photoLimit}</td>
        <td className="px-4 py-3 w-28">
          <StatusBadge isActive={isActive} />
        </td>
        <td className="px-4 py-3 text-sm">
          <button
            type="button"
            data-slug={event.slug}
            data-qr-trigger="true"
            className="text-sm underline font-semibold text-black hover:text-gray-600 mr-3"
            onClick={() => setShowQR(true)}
          >
            QR code
          </button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`text-sm font-semibold text-black ${
              saving
                ? "opacity-50 cursor-not-allowed no-underline"
                : "underline hover:text-gray-600"
            }`}
          >
            {saving ? "Saving…" : isActive ? "Deactivate" : "Activate"}
          </button>
        </td>
      </tr>
      {showQR && (
        <QRModal event={event} onClose={() => setShowQR(false)} />
      )}
    </>
  );
}
