"use client";

import { useState } from "react";
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
    setIsActive(!isActive);
    try {
      const res = await fetch(`/api/events/${event.id}/toggle`, { method: "PATCH" });
      if (!res.ok) throw new Error("Toggle failed");
      const data = (await res.json()) as { isActive: boolean };
      setIsActive(data.isActive);
    } catch {
      setIsActive(prev);
      onToggleError("Could not update event status. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-sm font-medium">{event.name}</td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {event.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="px-4 py-3 text-sm text-center text-gray-500">{event.photoLimit}</td>
        {/* Status column is now the toggle */}
        <td className="px-4 py-3 w-32">
          <button
            type="button"
            onClick={handleToggle}
            disabled={saving}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold transition-colors ${
              saving
                ? "opacity-50 cursor-not-allowed bg-gray-100 text-gray-400"
                : isActive
                ? "bg-green-100 text-green-800 hover:bg-red-100 hover:text-red-700 cursor-pointer"
                : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-800 cursor-pointer"
            }`}
          >
            {saving ? "Saving…" : isActive ? "Active" : "Inactive"}
          </button>
        </td>
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowQR(true)}
              className="font-semibold underline text-black hover:text-gray-500"
            >
              QR code
            </button>
            {event.driveFolderId && (
              <a
                href={`https://drive.google.com/drive/folders/${event.driveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline text-black hover:text-gray-500"
              >
                Drive ↗
              </a>
            )}
          </div>
        </td>
      </tr>
      {showQR && <QRModal event={event} onClose={() => setShowQR(false)} />}
    </>
  );
}
