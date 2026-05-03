"use client";

import { QRModal } from "./QRModal";
import { EditEventModal } from "./EditEventModal";
import { HistoryModal } from "./HistoryModal";
import { useEventItem } from "./useEventItem";

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
  const {
    isActive, setIsActive,
    photoLimit, setPhotoLimit,
    showQR, setShowQR,
    showEdit, setShowEdit,
    showHistory, setShowHistory,
  } = useEventItem(event);

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3 text-sm font-medium">{event.name}</td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {event.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setShowQR(true)} className="font-semibold underline text-black hover:text-gray-500">QR code</button>
            {event.driveFolderId && (
              <a href={`https://drive.google.com/drive/folders/${event.driveFolderId}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline text-black hover:text-gray-500">Drive ↗</a>
            )}
            <button type="button" onClick={() => setShowHistory(true)} className="font-semibold underline text-black hover:text-gray-500">History</button>
          </div>
        </td>
        <td className="px-4 py-3 text-sm">
          <button type="button" onClick={() => setShowEdit(true)} className="font-semibold underline text-black hover:text-gray-500">Edit</button>
        </td>
      </tr>

      {showQR && <QRModal event={event} onClose={() => setShowQR(false)} />}
      {showHistory && <HistoryModal event={{ id: event.id, name: event.name }} onClose={() => setShowHistory(false)} />}
      {showEdit && (
        <EditEventModal
          event={{ id: event.id, name: event.name, isActive, photoLimit }}
          onSave={({ isActive: a, photoLimit: l }) => { setIsActive(a); setPhotoLimit(l); }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
