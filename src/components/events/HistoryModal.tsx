"use client";

import { useState, useEffect } from "react";

type UploadRecord = {
  id: string;
  guestNickname: string;
  fileName: string;
  fileSizeBytes: number | null;
  status: string;
  initiatedAt: string;
};

type Props = {
  event: { id: string; name: string };
  onClose: () => void;
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function HistoryModal({ event, onClose }: Props) {
  const [records, setRecords] = useState<UploadRecord[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${event.id}/uploads`)
      .then((r) => r.json())
      .then((data: { records: UploadRecord[] }) => setRecords(data.records))
      .catch(() => setError(true));
  }, [event.id]);

  // Group by guest nickname
  const grouped = records
    ? records.reduce<Record<string, UploadRecord[]>>((acc, r) => {
        if (!acc[r.guestNickname]) acc[r.guestNickname] = [];
        acc[r.guestNickname].push(r);
        return acc;
      }, {})
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold">{event.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload history</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-black text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          {error && (
            <p className="text-sm text-red-500">Failed to load history.</p>
          )}

          {!records && !error && (
            <p className="text-sm text-gray-400">Loading…</p>
          )}

          {records && records.length === 0 && (
            <p className="text-sm text-gray-500">No uploads yet.</p>
          )}

          {grouped && Object.keys(grouped).length > 0 && (
            <div className="space-y-5">
              {Object.entries(grouped).map(([nickname, uploads]) => (
                <div key={nickname}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-900">{nickname}</p>
                    <span className="text-xs text-gray-400">{uploads.length} photo{uploads.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-1">
                    {uploads.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between text-xs text-gray-500 py-1 border-b border-gray-50"
                      >
                        <span className="truncate max-w-[60%]">{r.fileName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {r.fileSizeBytes && (
                            <span className="text-gray-400">{formatBytes(r.fileSizeBytes)}</span>
                          )}
                          <span className="text-gray-300">·</span>
                          <span className="text-gray-400">
                            {new Date(r.initiatedAt).toLocaleString(undefined, {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400 text-right">
            {records ? `${records.length} total upload${records.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
