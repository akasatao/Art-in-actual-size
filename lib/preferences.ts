"use client";

import { useSyncExternalStore } from "react";
import { subscribeStorage, writeStorage } from "@/lib/storage";

const SHOW_RULER_KEY = "showRuler";

export function saveShowRuler(value: boolean) {
  writeStorage(SHOW_RULER_KEY, String(value));
}

/** Defaults to on until the user turns it off. */
export function useShowRuler(): boolean {
  return useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(SHOW_RULER_KEY) !== "false",
    () => true,
  );
}
