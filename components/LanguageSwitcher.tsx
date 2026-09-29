"use client";

import SegmentedControl from "@/components/SegmentedControl";
import { LOCALES, saveLocale, useLocale, useMessages } from "@/lib/i18n";

const LABELS = { ja: "日本語", en: "EN" } as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useMessages();

  return (
    <SegmentedControl
      label={t.languageLabel}
      options={LOCALES.map((l) => ({ value: l, label: LABELS[l] }))}
      value={locale}
      onChange={saveLocale}
      className="h-10 px-1"
    />
  );
}
