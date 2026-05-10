"use client";

import { QRModal } from "./QRModal";
import { EditEventModal } from "./EditEventModal";
import { HistoryModal } from "./HistoryModal";
import { useEventItem } from "./useEventItem";
import type { EventData } from "./EventRow";

type Props = { event: EventData };

export function EventCard({ event }: Props) {
  const {
    isActive, setIsActive,
    photoLimit, setPhotoLimit,
    thankYouMessage, setThankYouMessage,
    showQR, setShowQR,
    showEdit, setShowEdit,
    showHistory, setShowHistory,
  } = useEventItem(event);

  return (
    <>
      <div className="border border-gray-200 rounded-xl p-4 bg-white">
        {/* Name + status */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 leading-snug">{event.name}</p>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Created date */}
        <p className="text-xs text-gray-400 mb-3">
          {event.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </p>

        {/* Action links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <button type="button" onClick={() => setShowQR(true)} className="font-semibold underline text-black hover:text-gray-500">QR code</button>
          {event.driveFolderId && (
            <a href={`https://drive.google.com/drive/folders/${event.driveFolderId}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline text-black hover:text-gray-500">Drive ↗</a>
          )}
          <button type="button" onClick={() => setShowHistory(true)} className="font-semibold underline text-black hover:text-gray-500">History</button>
          <button type="button" onClick={() => setShowEdit(true)} className="font-semibold underline text-black hover:text-gray-500">Edit</button>
        </div>
      </div>

      {showQR && <QRModal event={event} onClose={() => setShowQR(false)} />}
      {showHistory && <HistoryModal event={{ id: event.id, name: event.name }} onClose={() => setShowHistory(false)} />}
      {showEdit && (
        <EditEventModal
          event={{ id: event.id, name: event.name, isActive, photoLimit, thankYouMessage }}
          onSave={({ isActive: a, photoLimit: l, thankYouMessage: m }) => { setIsActive(a); setPhotoLimit(l); setThankYouMessage(m); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
