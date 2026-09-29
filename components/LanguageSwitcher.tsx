"use client";

import { LOCALES, saveLocale, useLocale, useMessages } from "@/lib/i18n";

const LABELS = { ja: "日本語", en: "EN" } as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useMessages();

  return (
    <div role="group" aria-label={t.languageLabel} className="flex h-10 items-center gap-0.5 px-1 text-xs">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={locale === l}
          onClick={() => saveLocale(l)}
          className={`rounded-full px-2.5 py-1.5 transition ${
            locale === l ? "bg-white/15 text-white" : "text-neutral-500 hover:text-white"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
