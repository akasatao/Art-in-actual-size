"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { subscribeStorage, writeStorage } from "@/lib/storage";

export const CARD_WIDTH_MM = 85.6;
export const CARD_HEIGHT_MM = 53.98;
export const CARD_CORNER_RADIUS_MM = 3.18;

const STORAGE_KEY = "pxPerMm";

function read(): number | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function savePxPerMm(value: number) {
  writeStorage(STORAGE_KEY, String(value));
}

/**
 * `undefined` until hydrated on the client, `null` when not yet calibrated.
 */
export function usePxPerMm(): number | null | undefined {
  return useSyncExternalStore(subscribeStorage, read, () => undefined);
}

/** Redirects to the calibration screen when no calibration is stored. */
export function useRequiredPxPerMm(): number | undefined {
  const pxPerMm = usePxPerMm();
  const router = useRouter();

  useEffect(() => {
    if (pxPerMm === null) router.replace("/calibrate");
  }, [pxPerMm, router]);

  return pxPerMm ?? undefined;
}
