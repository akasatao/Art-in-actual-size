import worksData from "@/data/works.json";
import type { Locale } from "@/lib/i18n";

type Caption = {
  title: string;
  artist: string;
  year: string;
};

/** English caption fields at the top level; other locales under their locale key. */
export type Artwork = Caption & {
  id: string;
  widthMm: number;
  heightMm: number;
  iiifUrl: string;
  ja: Caption;
};

/** Chronological by the first year in `year` (e.g. "c. 1474/1478" → 1474); ties keep file order. */
export const works: Artwork[] = [...worksData].sort((a, b) => startYear(a) - startYear(b));

function startYear(work: Artwork): number {
  const match = work.year.match(/\d{4}/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export function getWork(id: string): Artwork | undefined {
  return works.find((w) => w.id === id);
}

export function captionFor(work: Artwork, locale: Locale): Caption {
  return locale === "ja" ? work.ja : work;
}

export function iiifImageUrl(infoUrl: string, size: string): string {
  const base = infoUrl.replace(/\/info\.json$/, "");
  return `${base}/full/${size}/0/default.jpg`;
}
