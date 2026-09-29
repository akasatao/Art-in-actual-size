"use client";

import { useEffect, useSyncExternalStore } from "react";
import { subscribeStorage, writeStorage } from "@/lib/storage";

export type Locale = "ja" | "en";

export const LOCALES: Locale[] = ["ja", "en"];

const LOCALE_KEY = "locale";

const messages = {
  ja: {
    languageLabel: "言語",
    calibrationInstruction:
      "クレジットカードを画面に当て、赤い枠がカードの外形とぴったり重なるように調整してください。",
    cardFrame: "クレジットカードの外形枠",
    frameSize: "枠のサイズ",
    shrink: "縮小",
    enlarge: "拡大",
    cancel: "キャンセル",
    confirm: "決定",
    cmScale: "cm 目盛り",
    calibration: "キャリブレーション",
    close: "閉じる",
    loadFailed: "画像を読み込めませんでした",
    sortBy: "並び順",
    sortYear: "年代",
    sortSize: "大きさ",
    sortName: "名前",
    sortDirection: "順序",
    ascending: "昇順",
    descending: "降順",
  },
  en: {
    languageLabel: "Language",
    calibrationInstruction:
      "Hold a credit card against the screen and adjust until the red frame matches its outline exactly.",
    cardFrame: "Credit card outline",
    frameSize: "Frame size",
    shrink: "Smaller",
    enlarge: "Larger",
    cancel: "Cancel",
    confirm: "Done",
    cmScale: "cm scale",
    calibration: "Calibration",
    close: "Close",
    loadFailed: "Could not load the image",
    sortBy: "Sort by",
    sortYear: "Year",
    sortSize: "Size",
    sortName: "Name",
    sortDirection: "Order",
    ascending: "Ascending",
    descending: "Descending",
  },
} satisfies Record<Locale, Record<string, string>>;

export type Messages = (typeof messages)["ja"];

function read(): Locale {
  const stored = window.localStorage.getItem(LOCALE_KEY);
  if (stored === "ja" || stored === "en") return stored;
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function saveLocale(locale: Locale) {
  writeStorage(LOCALE_KEY, locale);
}

export function useLocale(): Locale {
  const locale = useSyncExternalStore(subscribeStorage, read, () => "ja" as const);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return locale;
}

export function useMessages(): Messages {
  return messages[useLocale()];
}
