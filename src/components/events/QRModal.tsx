"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type QRModalProps = {
  event: { name: string; slug: string };
  onClose: () => void;
};

export function QRModal({ event, onClose }: QRModalProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [guestUrl, setGuestUrl] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/e/${event.slug}`;
    setGuestUrl(url);
    QRCode.toDataURL(url, { width: 256, margin: 2 })
      .then((result) => {
        setDataUrl(result);
        setGenerating(false);
      })
      .catch(() => {
        setGenerating(false);
      });
  }, [event.slug]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) onClose();
  }

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${event.slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(guestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg p-6 max-w-xs w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-black">QR Code</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-normal text-gray-500 hover:text-black"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm font-normal text-gray-600 mb-4">{event.name}</p>

        {/* QR image */}
        <div className="flex items-center justify-center mb-4 min-h-[256px]">
          {generating ? (
            <p className="text-sm font-normal text-gray-400">Generating…</p>
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={`QR code for ${event.name}`}
              width={256}
              height={256}
            />
          ) : (
            <p className="text-sm font-normal text-red-500">
              Failed to generate QR code.
            </p>
          )}
        </div>

        {/* Shareable URL */}
        {guestUrl && (
          <div className="flex items-center gap-2 mb-4 border border-gray-200 rounded px-3 py-2">
            <span className="flex-1 text-xs text-gray-500 truncate">{guestUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 text-xs font-semibold text-black hover:text-gray-500"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!dataUrl}
            className="w-full bg-black text-white text-sm font-semibold py-2 px-4 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Download QR code
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-sm font-normal text-gray-500 hover:text-black py-1"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
