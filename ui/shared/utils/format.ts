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
