"use client";

import { useState } from "react";

type Props = {
  event: {
    id: string;
    name: string;
    isActive: boolean;
    photoLimit: number;
    thankYouMessage: string | null;
  };
  onSave: (updated: { isActive: boolean; photoLimit: number; thankYouMessage: string | null }) => void;
  onClose: () => void;
};

export function EditEventModal({ event, onSave, onClose }: Props) {
  const [isActive, setIsActive] = useState(event.isActive);
  const [limitInput, setLimitInput] = useState(String(event.photoLimit));
  const [thankYouMessage, setThankYouMessage] = useState(event.thankYouMessage ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limitNum = Number(limitInput);
  const limitValid = Number.isInteger(limitNum) && limitNum >= 1 && limitNum <= 100;

  async function handleSave() {
    if (!limitValid || saving) return;
    setSaving(true);
    setError(null);

    const newMessage = thankYouMessage.trim() || null;
    const messageChanged = newMessage !== event.thankYouMessage;

    try {
      const [toggleRes, limitRes, messageRes] = await Promise.all([
        isActive !== event.isActive
          ? fetch(`/api/events/${event.id}/toggle`, { method: "PATCH" })
          : Promise.resolve(null),
        limitNum !== event.photoLimit
          ? fetch(`/api/events/${event.id}/limit`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ photoLimit: limitNum }),
            })
          : Promise.resolve(null),
        messageChanged
          ? fetch(`/api/events/${event.id}/thank-you-message`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ thankYouMessage: newMessage }),
            })
          : Promise.resolve(null),
      ]);

      if (toggleRes && !toggleRes.ok) throw new Error("Failed to update status.");
      if (limitRes && !limitRes.ok) throw new Error("Failed to update photo limit.");
      if (messageRes && !messageRes.ok) throw new Error("Failed to update thank-you message.");

      const toggleData = toggleRes ? ((await toggleRes.json()) as { isActive: boolean }) : null;
      const limitData = limitRes ? ((await limitRes.json()) as { photoLimit: number }) : null;
      const messageData = messageRes ? ((await messageRes.json()) as { thankYouMessage: string | null }) : null;

      onSave({
        isActive: toggleData?.isActive ?? isActive,
        photoLimit: limitData?.photoLimit ?? limitNum,
        thankYouMessage: messageData !== null ? messageData.thankYouMessage : newMessage,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-lg font-semibold mb-1">{event.name}</h2>
        <p className="text-sm text-gray-500 mb-6">Edit event settings</p>

        {error && (
          <div className="mb-4 px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Status toggle */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-medium text-gray-900">Active</p>
            <p className="text-xs text-gray-400 mt-0.5">Guests can upload when active</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
              isActive ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Photo limit */}
        <div className="mb-5">
          <label htmlFor="photo-limit" className="block text-sm font-medium text-gray-900 mb-1">
            Photo limit per guest
          </label>
          <p className="text-xs text-gray-400 mb-2">Between 1 and 100</p>
          <input
            id="photo-limit"
            type="number"
            min={1}
            max={100}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              limitValid
                ? "border-gray-300 focus:ring-black"
                : "border-red-400 focus:ring-red-400"
            }`}
          />
          {!limitValid && (
            <p className="mt-1 text-xs text-red-500">Enter a number between 1 and 100.</p>
          )}
        </div>

        {/* Thank-you message */}
        <div className="mb-7">
          <label htmlFor="thank-you-message" className="block text-sm font-medium text-gray-900 mb-1">
            Thank-you message{" "}
            <span className="text-xs text-gray-400 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-gray-400 mb-2">Shown to guests after a successful upload</p>
          <textarea
            id="thank-you-message"
            maxLength={500}
            rows={3}
            value={thankYouMessage}
            onChange={(e) => setThankYouMessage(e.target.value)}
            placeholder="e.g. Thank you so much for celebrating with us! 💑"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !limitValid}
            className="flex-1 rounded-lg bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
