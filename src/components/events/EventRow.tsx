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

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="relative group">
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {label}
      </span>
    </span>
  );
}

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
        <td className="px-4 py-3">
          <StatusBadge isActive={isActive} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {/* QR code */}
            <Tooltip label="QR code">
              <button
                type="button"
                onClick={() => setShowQR(true)}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  <rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>
                </svg>
              </button>
            </Tooltip>

            {/* Drive folder */}
            {event.driveFolderId && (
              <Tooltip label="Open in Drive">
                <a
                  href={`https://drive.google.com/drive/folders/${event.driveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </a>
              </Tooltip>
            )}

            {/* Divider */}
            <span className="w-px h-4 bg-gray-200 mx-1" />

            {/* Toggle active/inactive */}
            <Tooltip label={isActive ? "Deactivate" : "Activate"}>
              <button
                type="button"
                onClick={handleToggle}
                disabled={saving}
                className={`p-1.5 rounded transition-colors ${
                  saving
                    ? "opacity-40 cursor-not-allowed text-gray-400"
                    : isActive
                    ? "hover:bg-red-50 text-gray-500 hover:text-red-600"
                    : "hover:bg-green-50 text-gray-500 hover:text-green-600"
                }`}
              >
                {saving ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                ) : isActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                )}
              </button>
            </Tooltip>
          </div>
        </td>
      </tr>
      {showQR && <QRModal event={event} onClose={() => setShowQR(false)} />}
    </>
  );
}
