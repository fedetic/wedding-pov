"use client";

import { useState } from "react";
import { EventRow, EventData } from "./EventRow";

type Props = { initialEvents: EventData[] };

export function EventListClient({ initialEvents }: Props) {
  const [toggleError, setToggleError] = useState<string | null>(null);

  if (initialEvents.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-semibold text-gray-700 mb-1">No events yet</p>
        <p className="text-sm text-gray-500 mb-4">
          Create your first event to get a QR code guests can scan to upload photos.
        </p>
        <a
          href="/dashboard/events/new"
          className="text-sm font-semibold underline text-black hover:text-gray-600"
        >
          Create event →
        </a>
      </div>
    );
  }

  return (
    <>
      {toggleError && (
        <div className="mb-3 px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          {toggleError}
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
              Name
            </th>
            <th className="text-left text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
              Created
            </th>
            <th className="text-left text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 w-20">
              Limit
            </th>
            <th className="text-left text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 w-28">
              Status
            </th>
            <th className="text-left text-sm font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {initialEvents.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              onToggleError={setToggleError}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}
