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
  createdAt: Date;
  driveFolderId: string | null;
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
        <td className="px-4 py-3 text-sm text-gray-500">
          {event.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </td>
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
          {event.driveFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${event.driveFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline font-semibold text-black hover:text-gray-600 mr-3"
            >
              Drive ↗
            </a>
          )}
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
