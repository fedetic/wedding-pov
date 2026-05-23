"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "confirming" | "deleting" | "stale" | "error";

export function DeleteAccountButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  async function handleDelete() {
    setStatus("deleting");
    setErrorMessage("");
    const { data, error } = await authClient.deleteUser({});
    if (error) {
      // better-auth surfaces SESSION_EXPIRED via error.code or error.message.
      // freshAge default = 24h; user must sign out and sign back in.
      const code = error.code ?? "";
      const msg = error.message ?? "";
      if (code === "SESSION_EXPIRED" || /session.*expired/i.test(msg) || /fresh/i.test(msg)) {
        setStatus("stale");
        return;
      }
      setErrorMessage(msg || "Could not delete account. Please try again.");
      setStatus("error");
      return;
    }
    if (data?.success) {
      router.push("/login");
      return;
    }
    setErrorMessage("Unexpected response from server.");
    setStatus("error");
  }

  if (status === "stale") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-700">
          For security, please sign out and sign in again before deleting your account.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm text-gray-500 hover:text-black underline self-start"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-700">{errorMessage}</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm text-gray-500 hover:text-black underline self-start"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (status === "confirming" || status === "deleting") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-700">
          This permanently deletes your account, Drive credentials, events, and all upload
          records. Photos already saved in your Google Drive remain in your Drive.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleDelete}
            disabled={status === "deleting"}
            className="text-sm text-red-600 hover:text-red-800 font-semibold disabled:opacity-50"
          >
            {status === "deleting" ? "Deleting…" : "Confirm delete"}
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            disabled={status === "deleting"}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // idle state
  return (
    <button
      type="button"
      onClick={() => setStatus("confirming")}
      className="text-sm text-red-600 hover:text-red-800 underline self-start"
    >
      Delete account
    </button>
  );
}
