import type { WorkOutput } from "../../../server/output-types";

export function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("en-US");
}

export function formatAuthors(work: WorkOutput, max: number = 3): string {
  if (work.authors.length === 0) return "Unknown authors";
  const names = work.authors.slice(0, max).map((a) => a.name);
  return work.authors_count > names.length ? `${names.join(", ")}, et al.` : names.join(", ");
}

/** Count the works on the current page by publication year, oldest first. */
export function worksPerYear(works: WorkOutput[]): { label: string; value: number }[] {
  const counts = new Map<number, number>();
  for (const w of works) {
    if (w.publication_year) counts.set(w.publication_year, (counts.get(w.publication_year) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, count]) => ({ label: String(year), value: count }));
}

export function doiUrl(doi: string): string {
  return doi.startsWith("http") ? doi : `https://doi.org/${doi}`;
}

/** "https://openalex.org/T10102" -> "T10102" */
export function shortId(id: string): string {
  return id.replace("https://openalex.org/", "");
}

/**
 * A LibKey link for a DOI: full text through the reader's own library, or an
 * open copy. Null without a usable DOI. Mirrors libkeyUrl in the server's
 * format-utils; the link carries no library ID, so each reader gets their own.
 */
export function libkeyUrl(doi: string | null | undefined): string | null {
  const bare = (doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/\S+$/.test(bare) ? `https://libkey.io/${bare}` : null;
}
