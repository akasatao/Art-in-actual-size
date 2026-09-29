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
  /** "round": the painting is the ellipse inscribed in the image (a tondo); the corners are scan background. */
  shape?: "round";
  iiifUrl: string;
  ja: Caption;
};

export type SortKey = "year" | "size" | "name";
export type SortOrder = "asc" | "desc";

export const SORT_KEYS: SortKey[] = ["year", "size", "name"];
export const SORT_ORDERS: SortOrder[] = ["asc", "desc"];

export const works: Artwork[] = sortWorks(worksData as Artwork[], "year", "asc", "en");

/** Stable: ties fall back to year, then keep file order. */
export function sortWorks(
  list: Artwork[],
  key: SortKey,
  order: SortOrder,
  locale: Locale,
): Artwork[] {
  const direction = order === "asc" ? 1 : -1;
  const compare = (a: Artwork, b: Artwork) => {
    switch (key) {
      case "year":
        return startYear(a) - startYear(b);
      case "size":
        return a.widthMm * a.heightMm - b.widthMm * b.heightMm;
      case "name":
        return captionFor(a, locale).title.localeCompare(captionFor(b, locale).title, locale);
    }
  };
  return [...list].sort(
    (a, b) => direction * compare(a, b) || startYear(a) - startYear(b),
  );
}

/** First year in `year`, e.g. "c. 1474/1478" → 1474. */
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
