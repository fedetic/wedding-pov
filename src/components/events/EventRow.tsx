"use client";

import { useState, useRef } from "react";
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
  const [toggling, setToggling] = useState(false);
  const [photoLimit, setPhotoLimit] = useState(event.photoLimit);
  const [limitInput, setLimitInput] = useState(String(event.photoLimit));
  const [savingLimit, setSavingLimit] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const limitRef = useRef<HTMLInputElement>(null);

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
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
      setToggling(false);
    }
  }

  async function commitLimit() {
    const parsed = Number(limitInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100 || parsed === photoLimit) {
      setLimitInput(String(photoLimit)); // revert invalid / unchanged
      return;
    }
    setSavingLimit(true);
    try {
      const res = await fetch(`/api/events/${event.id}/limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoLimit: parsed }),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = (await res.json()) as { photoLimit: number };
      setPhotoLimit(data.photoLimit);
      setLimitInput(String(data.photoLimit));
    } catch {
      setLimitInput(String(photoLimit)); // revert on error
      onToggleError("Could not save photo limit. Please try again.");
    } finally {
      setSavingLimit(false);
    }
  }

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
        {/* Name */}
        <td className="px-4 py-3 text-sm font-medium">{event.name}</td>

        {/* Created */}
        <td className="px-4 py-3 text-sm text-gray-500">
          {event.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </td>

        {/* Status — read-only badge */}
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </td>

        {/* Actions — QR + Drive */}
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

        {/* Edit — toggle + limit */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Status toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label="Toggle event active"
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                toggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${isActive ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>

            {/* Limit input */}
            <div className="flex items-center gap-1">
              <input
                ref={limitRef}
                type="number"
                min={1}
                max={100}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                onBlur={commitLimit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") limitRef.current?.blur();
                  if (e.key === "Escape") {
                    setLimitInput(String(photoLimit));
                    limitRef.current?.blur();
                  }
                }}
                disabled={savingLimit}
                aria-label="Photo limit"
                className="w-14 rounded border border-gray-300 px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-50"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">photos</span>
            </div>
          </div>
        </td>
      </tr>
      {showQR && <QRModal event={event} onClose={() => setShowQR(false)} />}
    </>
  );
}
