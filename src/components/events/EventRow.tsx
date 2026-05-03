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
        {/* Status column — toggle switch */}
        <td className="px-4 py-3 w-32">
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={handleToggle}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              saving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            } ${isActive ? "bg-green-500" : "bg-gray-300"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
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
