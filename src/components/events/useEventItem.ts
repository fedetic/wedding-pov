"use client";

import { useState } from "react";
import type { EventData } from "./EventRow";

export function useEventItem(event: EventData) {
  const [isActive, setIsActive] = useState(event.isActive);
  const [photoLimit, setPhotoLimit] = useState(event.photoLimit);
  const [thankYouMessage, setThankYouMessage] = useState(event.thankYouMessage);
  const [showQR, setShowQR] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return {
    isActive, setIsActive,
    photoLimit, setPhotoLimit,
    thankYouMessage, setThankYouMessage,
    showQR, setShowQR,
    showEdit, setShowEdit,
    showHistory, setShowHistory,
  };
}
