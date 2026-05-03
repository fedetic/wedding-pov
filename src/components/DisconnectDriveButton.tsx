"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DisconnectDriveButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    setLoading(true);
    await fetch("/api/drive/disconnect", { method: "DELETE" });
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="text-sm">
        Are you sure?{" "}
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="font-semibold text-red-600 underline hover:text-red-800 disabled:opacity-50"
        >
          {loading ? "Disconnecting…" : "Yes, disconnect"}
        </button>
        {" · "}
        <button
          onClick={() => setConfirming(false)}
          className="text-gray-500 underline hover:text-black"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-sm text-gray-400 underline hover:text-red-600"
    >
      Disconnect
    </button>
  );
}
