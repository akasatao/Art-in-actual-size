"use client";

import { useSyncExternalStore } from "react";
import { subscribeStorage, writeStorage } from "@/lib/storage";
import { SORT_KEYS, SORT_ORDERS, type SortKey, type SortOrder } from "@/lib/works";

const SHOW_RULER_KEY = "showRuler";
const SORT_KEY_KEY = "sortKey";
const SORT_ORDER_KEY = "sortOrder";

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

export function saveSortKey(value: SortKey) {
  writeStorage(SORT_KEY_KEY, value);
}

export function saveSortOrder(value: SortOrder) {
  writeStorage(SORT_ORDER_KEY, value);
}

export function useSortKey(): SortKey {
  return useStoredChoice(SORT_KEY_KEY, SORT_KEYS, "year");
}

export function useSortOrder(): SortOrder {
  return useStoredChoice(SORT_ORDER_KEY, SORT_ORDERS, "asc");
}

function useStoredChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  return useSyncExternalStore(
    subscribeStorage,
    () => {
      const stored = window.localStorage.getItem(key);
      return choices.find((c) => c === stored) ?? fallback;
    },
    () => fallback,
  );
}
