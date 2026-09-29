"use client";

import Link from "next/link";
import { useMemo } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SegmentedControl from "@/components/SegmentedControl";
import { useRequiredPxPerMm } from "@/lib/calibration";
import { useLocale, useMessages, type Locale } from "@/lib/i18n";
import {
  saveShowRuler,
  saveSortKey,
  saveSortOrder,
  useShowRuler,
  useSortKey,
  useSortOrder,
} from "@/lib/preferences";
import { captionFor, iiifImageUrl, sortWorks, type Artwork } from "@/lib/works";

export default function WorkGrid({ works }: { works: Artwork[] }) {
  const pxPerMm = useRequiredPxPerMm();
  const showRuler = useShowRuler();
  const sortKey = useSortKey();
  const sortOrder = useSortOrder();
  const locale = useLocale();
  const t = useMessages();
  const sortedWorks = useMemo(
    () => sortWorks(works, sortKey, sortOrder, locale),
    [works, sortKey, sortOrder, locale],
  );
  if (pxPerMm === undefined) return <div className="h-dvh bg-black" />;

  return (
    <main className="min-h-dvh bg-black px-6 py-16 sm:px-12">
      <div className="fixed top-4 right-4 z-10 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur">
        <LanguageSwitcher />
        <button
          type="button"
          role="switch"
          aria-checked={showRuler}
          onClick={() => saveShowRuler(!showRuler)}
          className="flex h-10 items-center gap-2.5 rounded-full px-3 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          <RulerIcon />
          <span>{t.cmScale}</span>
          <span
            className={`relative h-4 w-7 rounded-full transition ${showRuler ? "bg-white" : "bg-neutral-700"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-3 rounded-full bg-black transition-transform ${
                showRuler ? "translate-x-3" : ""
              }`}
            />
          </span>
        </button>
        <Link
          href="/calibrate"
          aria-label={t.calibration}
          className="flex size-10 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          <CardIcon />
        </Link>
      </div>

      <div className="mx-auto mb-8 flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 pt-4">
        <span className="text-xs text-neutral-500">{t.sortBy}</span>
        <SegmentedControl
          label={t.sortBy}
          options={[
            { value: "year", label: t.sortYear },
            { value: "size", label: t.sortSize },
            { value: "name", label: t.sortName },
          ]}
          value={sortKey}
          onChange={saveSortKey}
        />
        <span aria-hidden className="h-4 w-px bg-neutral-800" />
        <SegmentedControl
          label={t.sortDirection}
          options={[
            { value: "asc", label: t.ascending },
            { value: "desc", label: t.descending },
          ]}
          value={sortOrder}
          onChange={saveSortOrder}
        />
      </div>

      <ul className="mx-auto grid max-w-6xl grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {sortedWorks.map((work) => (
          <li key={work.id}>
            <Link href={`/view/${work.id}`} className="group block">
              <div className="flex aspect-square items-center justify-center bg-neutral-950 p-6">
                <img
                  src={iiifImageUrl(work.iiifUrl, "843,")}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className={`max-h-full max-w-full object-contain transition duration-500 group-hover:scale-[1.03] ${
                    work.shape === "round" ? "rounded-full" : ""
                  }`}
                  style={{ aspectRatio: `${work.widthMm} / ${work.heightMm}` }}
                />
              </div>
              <Caption work={work} locale={locale} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function Caption({ work, locale }: { work: Artwork; locale: Locale }) {
  const { title, artist, year } = captionFor(work, locale);
  const separator = locale === "ja" ? "、" : ", ";

  return (
    <div className="mt-4 space-y-1 break-words">
      <p className="text-sm leading-snug text-neutral-200 transition group-hover:text-white">
        {title}
      </p>
      <p className="text-xs text-neutral-500">{`${artist}${separator}${year}`}</p>
    </div>
  );
}

function RulerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2.5" y="7.5" width="19" height="9" rx="1" />
      <path d="M6.5 7.5v3M10.5 7.5v4.5M14.5 7.5v3M18.5 7.5v4.5" strokeLinecap="round" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="1.5" />
      <path d="M6.5 7h11" />
    </svg>
  );
}
