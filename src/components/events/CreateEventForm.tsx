"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEvent } from "@/app/actions/events";

export function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [photoLimit, setPhotoLimit] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createEvent({ name, photoLimit, isActive });

    if (!result.success) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Redirect to dashboard with event=created query param for success banner
    router.push("/dashboard?event=created");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="event-name"
          className="block text-sm font-semibold mb-1"
        >
          Event name <span aria-hidden="true">*</span>
        </label>
        <input
          id="event-name"
          type="text"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Our Wedding"
          className="border border-gray-300 rounded px-3 py-2 w-full text-base outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
        />
      </div>

      <div>
        <label
          htmlFor="photo-limit"
          className="block text-sm font-semibold mb-1"
        >
          Photo limit <span aria-hidden="true">*</span>
        </label>
        <input
          id="photo-limit"
          type="number"
          required
          min={1}
          max={100}
          value={photoLimit}
          onChange={(e) => setPhotoLimit(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2 w-full text-base outline-none focus:ring-2 focus:ring-black focus:ring-offset-1"
        />
        <p className="text-sm text-gray-500 mt-1">Up to 100 photos per guest</p>
      </div>

      <div className="flex items-start gap-3">
        <input
          id="is-active"
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="mt-0.5"
        />
        <div>
          <label htmlFor="is-active" className="text-sm font-semibold">
            Active
          </label>
          <p className="text-sm text-gray-500">
            Guests can upload photos to active events.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className={`bg-black text-white rounded px-4 py-2 text-sm font-semibold hover:bg-gray-800 ${
          submitting ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {submitting ? "Creating…" : "Create event"}
      </button>

      {error && (
        <div className="px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {error}
        </div>
      )}
    </form>
  );
}
