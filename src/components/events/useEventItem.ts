"use client";

import { useState } from "react";
import type { EventData } from "./EventRow";

export function useEventItem(event: EventData) {
  const [isActive, setIsActive] = useState(event.isActive);
  const [photoLimit, setPhotoLimit] = useState(event.photoLimit);
  const [showQR, setShowQR] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return {
    isActive, setIsActive,
    photoLimit, setPhotoLimit,
    showQR, setShowQR,
    showEdit, setShowEdit,
    showHistory, setShowHistory,
  };
}
