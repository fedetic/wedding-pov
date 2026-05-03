"use client";

import { useState } from "react";
import { QRModal } from "./QRModal";
import { EditEventModal } from "./EditEventModal";

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

export function EventRow({ event, onToggleError: _onToggleError }: Props) {
  const [isActive, setIsActive] = useState(event.isActive);
  const [photoLimit, setPhotoLimit] = useState(event.photoLimit);
  const [showQR, setShowQR] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

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

        {/* Actions */}
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

        {/* Edit */}
        <td className="px-4 py-3 text-sm">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="font-semibold underline text-black hover:text-gray-500"
          >
            Edit
          </button>
        </td>
      </tr>

      {showQR && <QRModal event={event} onClose={() => setShowQR(false)} />}

      {showEdit && (
        <EditEventModal
          event={{ id: event.id, name: event.name, isActive, photoLimit }}
          onSave={({ isActive: newActive, photoLimit: newLimit }) => {
            setIsActive(newActive);
            setPhotoLimit(newLimit);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
