"use client";

import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { useEffect } from "react";

export function ConnectDriveButton() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = App.addListener("appUrlOpen", (data) => {
      if (data.url.startsWith("com.weddingpov.app://oauth-callback")) {
        Browser.close().catch(() => {});
        window.location.reload();
      }
    });

    return () => {
      listenerPromise.then((l) => l.remove()).catch(() => {});
    };
  }, []);

  if (Capacitor.isNativePlatform()) {
    return (
      <button
        onClick={async () => {
          await Browser.open({
            url: `${window.location.origin}/api/drive/connect?mobile=1`,
            presentationStyle: "popover",
          });
        }}
        className="inline-block bg-black text-white rounded px-4 py-2 text-sm font-semibold hover:bg-gray-800"
      >
        Connect Google Drive
      </button>
    );
  }

  return (
    <a
      href="/api/drive/connect"
      className="inline-block bg-black text-white rounded px-4 py-2 text-sm font-semibold hover:bg-gray-800"
    >
      Connect Google Drive
    </a>
  );
}
