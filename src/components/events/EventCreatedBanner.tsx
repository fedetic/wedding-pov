"use client";

import { useEffect, useState } from "react";

export function EventCreatedBanner() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 px-3 py-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
      ✓ Event created.
    </div>
  );
}
