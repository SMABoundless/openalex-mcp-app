// Exporting works as RIS, BibTeX or CSV, for reference managers and screening tools.
//
// These files are read by other people's software (Zotero, EndNote, Covidence,
// Rayyan), so the format details are the feature. The ones that bite:
//   - RIS tags are `XX  - value` with TWO spaces before the dash, records end
//     with `ER  - `, and lines end with CRLF.
//   - RIS and BibTeX want authors as "Surname, Given".
//   - BibTeX lowercases a title unless it is brace-protected, and treats several
//     characters as syntax.
//   - CSV needs quoting per RFC 4180.
// The approach follows the ReviewSeed MCP app's export, adapted to OpenAlex records.
//
// Pure (no network), so it can be tested directly.
import type { Work } from "../types.js";
import { libkeyUrl, reconstructAbstract } from "./format-utils.js";
import { shortId } from "./openalex-client.js";

const CRLF = "\r\n";

export type ExportFormat = "ris" | "bibtex" | "csv";

/** One work, reduced to what the export formats carry. */
export interface ExportRecord {
  id: string;
  doi: string | null;
  pmid: string | null;
  title: string;
  /** As OpenAlex displays them, e.g. "Heather Piwowar" */
  authors: string[];
  type: string | null;
  source: string | null;
  year: number | null;
  date: string | null;
  volume: string | null;
  issue: string | null;
  firstPage: string | null;
  lastPage: string | null;
  language: string | null;
  abstract: string | null;
  url: string;
  citedByCount: number;
  oaStatus: string | null;
}

/** Fields to request from OpenAlex for an export. */
export const EXPORT_FIELDS = [
  "id", "doi", "ids", "display_name", "type", "publication_year", "publication_date", "authorships",
  "primary_location", "biblio", "language", "abstract_inverted_index", "cited_by_count", "open_access"
].join(",");

/** A DOI without its resolver prefix. */
export function bareDoi(doi: string | null | undefined): string | null {
  const bare = (doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return bare || null;
}

export function toExportRecord(work: Work, options: { abstracts: boolean }): ExportRecord {
  const doi = bareDoi(work.doi);
  const pmid = (work.ids?.pmid ?? "").match(/(\d+)\/?$/)?.[1] ?? null;
  const id = shortId(work.id);
  return {
    id,
    doi,
    pmid,
    title: work.display_name || work.title || "Untitled",
    authors: (work.authorships ?? []).map(a => a.author?.display_name ?? "").filter(Boolean),
    type: work.type ?? null,
    source: work.primary_location?.source?.display_name ?? null,
    year: work.publication_year ?? null,
    date: work.publication_date ?? null,
    volume: work.biblio?.volume ?? null,
    issue: work.biblio?.issue ?? null,
    firstPage: work.biblio?.first_page ?? null,
    lastPage: work.biblio?.last_page ?? null,
    language: (work as Work & { language?: string | null }).language ?? null,
    abstract: options.abstracts ? reconstructAbstract(work.abstract_inverted_index) : null,
    url: doi ? `https://doi.org/${doi}` : work.primary_location?.landing_page_url ?? `https://openalex.org/${id}`,
    citedByCount: work.cited_by_count ?? 0,
    oaStatus: work.open_access?.oa_status ?? null
  };
}

// ============================================
// Author names
// ============================================

// Lower-case words that belong to a surname: "van Gogh", "de la Cruz", "al-Sayed"
const PARTICLES = new Set([
  "van", "von", "der", "den", "de", "del", "della", "di", "da", "das", "do", "dos", "du", "la", "le", "ter", "ten", "bin", "ibn", "al", "el", "y"
]);
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;

/**
 * "Heather Piwowar" -> "Piwowar, Heather", the form RIS and BibTeX expect.
 *
 * OpenAlex gives one display string per author, so the surname is a judgement:
 * the last word, plus any lower-case particles before it. A name already
 * containing a comma is left alone, and so is a single word. This will be
 * wrong for some names, such as those written family name first.
 */
export function surnameFirst(name: string): string {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.includes(",")) return clean;
  const parts = clean.split(" ");
  let suffix = "";
  if (parts.length > 2 && SUFFIX.test(parts[parts.length - 1])) suffix = parts.pop()!;
  if (parts.length < 2) return clean;
  let start = parts.length - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase()) && parts[start - 1] === parts[start - 1].toLowerCase()) start--;
  const surname = parts.slice(start).join(" ");
  const given = parts.slice(0, start).join(" ");
  return `${surname}, ${given}${suffix ? `, ${suffix}` : ""}`;
}

// ============================================
// RIS
// ============================================

const RIS_TYPES: Record<string, string> = {
  article: "JOUR", review: "JOUR", letter: "JOUR", editorial: "JOUR", erratum: "JOUR", retraction: "JOUR",
  "peer-review": "JOUR", preprint: "UNPB", book: "BOOK", "book-chapter": "CHAP", dissertation: "THES",
  dataset: "DATA", report: "RPRT", standard: "STAND", "reference-entry": "ENCYC"
};

/** RIS reference type for an OpenAlex work type; GEN when there is no close match. */
export function risType(type: string | null): string {
  return RIS_TYPES[type ?? ""] ?? "GEN";
}

const oneLine = (text: string): string => text.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
const risLine = (tag: string, value: string): string => `${tag}  - ${oneLine(value)}`;

function risRecord(r: ExportRecord): string {
  const lines = [risLine("TY", risType(r.type)), risLine("TI", r.title)];
  for (const author of r.authors) lines.push(risLine("AU", surnameFirst(author)));
  if (r.source) lines.push(risLine("T2", r.source));
  if (r.year != null) lines.push(risLine("PY", String(r.year)));
  if (r.date) lines.push(risLine("DA", r.date.replace(/-/g, "/")));
  if (r.volume) lines.push(risLine("VL", r.volume));
  if (r.issue) lines.push(risLine("IS", r.issue));
  if (r.firstPage) lines.push(risLine("SP", r.firstPage));
  if (r.lastPage && r.lastPage !== r.firstPage) lines.push(risLine("EP", r.lastPage));
  if (r.abstract) lines.push(risLine("AB", r.abstract));
  if (r.doi) lines.push(risLine("DO", r.doi));
  if (r.language) lines.push(risLine("LA", r.language));
  lines.push(risLine("AN", r.id), risLine("DB", "OpenAlex"), risLine("UR", r.url), "ER  - ");
  return lines.join(CRLF);
}

export function toRis(records: ExportRecord[]): string {
  if (records.length === 0) return "";
  return records.map(risRecord).join(CRLF + CRLF) + CRLF;
}

// ============================================
// BibTeX
// ============================================

// A backslash must become \textbackslash{}, but that text contains braces the
// next rule would escape again. So backslashes wait on a marker with no special
// characters and are put back last.
const BACKSLASH_MARKER = "\u0000BS\u0000";

/** Escapes the characters TeX treats as syntax. */
export function texEscape(text: string): string {
  return text
    .replace(/\\/g, BACKSLASH_MARKER)
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .split(BACKSLASH_MARKER).join("\\textbackslash{}");
}

const BIBTEX_TYPES: Record<string, string> = {
  article: "article", review: "article", letter: "article", editorial: "article", erratum: "article",
  book: "book", "book-chapter": "incollection", dissertation: "phdthesis", report: "techreport", preprint: "unpublished"
};

export function bibtexType(type: string | null): string {
  return BIBTEX_TYPES[type ?? ""] ?? "misc";
}

/**
 * Citation key: first author's surname, year and OpenAlex ID. The ID is there
 * because surname and year collide in any sizeable set, and BibTeX silently
 * drops a reference whose key is a duplicate.
 */
export function bibtexKey(r: ExportRecord): string {
  const surname = surnameFirst(r.authors[0] ?? "").split(",")[0]
    .normalize("NFKD").replace(/[^A-Za-z]/g, "").toLowerCase() || "anon";
  return `${surname}${r.year ?? "nd"}-${r.id}`;
}

function bibtexEntry(r: ExportRecord): string {
  const type = bibtexType(r.type);
  const fields: [string, string][] = [];
  // The extra braces keep the title's capitals
  fields.push(["title", `{${texEscape(oneLine(r.title))}}`]);
  if (r.authors.length > 0) fields.push(["author", r.authors.map(a => texEscape(surnameFirst(a))).join(" and ")]);
  if (r.source) {
    const field = type === "article" ? "journal" : type === "incollection" ? "booktitle" : type === "techreport" ? "institution" : type === "phdthesis" ? "school" : "howpublished";
    fields.push([field, texEscape(r.source)]);
  }
  if (r.year != null) fields.push(["year", String(r.year)]);
  if (r.volume) fields.push(["volume", texEscape(r.volume)]);
  if (r.issue) fields.push(["number", texEscape(r.issue)]);
  if (r.firstPage) fields.push(["pages", texEscape(r.lastPage && r.lastPage !== r.firstPage ? `${r.firstPage}--${r.lastPage}` : r.firstPage)]);
  if (r.doi) fields.push(["doi", texEscape(r.doi)]);
  fields.push(["url", texEscape(r.url)]);
  if (type === "unpublished") fields.push(["note", "Preprint"]);
  if (r.abstract) fields.push(["abstract", texEscape(oneLine(r.abstract))]);
  return `@${type}{${bibtexKey(r)},\n${fields.map(([k, v]) => `  ${k} = {${v}}`).join(",\n")}\n}`;
}

export function toBibtex(records: ExportRecord[]): string {
  if (records.length === 0) return "";
  return records.map(bibtexEntry).join("\n\n") + "\n";
}

// ============================================
// CSV
// ============================================

export const CSV_COLUMNS = [
  "openalex_id", "type", "title", "authors", "source", "year", "date", "volume", "issue", "pages",
  "doi", "pmid", "cited_by_count", "open_access", "url", "full_text_libkey", "abstract"
] as const;

/** RFC 4180: quote a value that holds a comma, quote or line break, doubling its quotes. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(records: ExportRecord[]): string {
  const rows = [CSV_COLUMNS.join(",")];
  for (const r of records) {
    rows.push([
      r.id,
      r.type ?? "",
      r.title,
      r.authors.join("; "),
      r.source ?? "",
      r.year != null ? String(r.year) : "",
      r.date ?? "",
      r.volume ?? "",
      r.issue ?? "",
      r.firstPage ? (r.lastPage && r.lastPage !== r.firstPage ? `${r.firstPage}-${r.lastPage}` : r.firstPage) : "",
      r.doi ?? "",
      r.pmid ?? "",
      String(r.citedByCount),
      r.oaStatus ?? "",
      r.url,
      libkeyUrl(r.doi) ?? "",
      r.abstract ?? ""
    ].map(csvCell).join(","));
  }
  // Some parsers drop the last row without a final line break
  return rows.join(CRLF) + CRLF;
}

// ============================================
// Deduplication and file details
// ============================================

export interface DedupeResult {
  records: ExportRecord[];
  /** IDs dropped as duplicates, so the count can be checked */
  removedIds: string[];
}

/**
 * Removes repeats within one export: first by DOI, then by OpenAlex ID.
 * A preprint and its published article have different DOIs and separate
 * OpenAlex records, so they are both kept; merging those is a screening-tool job.
 */
export function dedupeRecords(records: ExportRecord[]): DedupeResult {
  const seenDoi = new Set<string>();
  const seenId = new Set<string>();
  const kept: ExportRecord[] = [];
  const removedIds: string[] = [];
  for (const r of records) {
    const doi = r.doi?.toLowerCase() ?? "";
    if ((doi && seenDoi.has(doi)) || seenId.has(r.id)) {
      removedIds.push(r.id);
      continue;
    }
    if (doi) seenDoi.add(doi);
    seenId.add(r.id);
    kept.push(r);
  }
  return { records: kept, removedIds };
}

/** "W1 ×3, W2": the works that turned up more than once, with how many repeats of each were dropped. */
export function summariseRepeats(removedIds: string[]): string {
  const counts = new Map<string, number>();
  for (const id of removedIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => (n > 1 ? `${id} ×${n}` : id)).join(", ");
}

const FILE_DETAILS: Record<ExportFormat, { extension: string; mimeType: string; label: string }> = {
  ris: { extension: "ris", mimeType: "application/x-research-info-systems", label: "RIS" },
  bibtex: { extension: "bib", mimeType: "application/x-bibtex", label: "BibTeX" },
  csv: { extension: "csv", mimeType: "text/csv", label: "CSV" }
};

export function exportFile(records: ExportRecord[], format: ExportFormat, date: Date = new Date()): {
  content: string; filename: string; mimeType: string; label: string;
} {
  const details = FILE_DETAILS[format];
  const content = format === "ris" ? toRis(records) : format === "bibtex" ? toBibtex(records) : toCsv(records);
  return {
    content,
    filename: `openalex-export-${date.toISOString().slice(0, 10)}.${details.extension}`,
    mimeType: details.mimeType,
    label: details.label
  };
}

/** Sorts mixed identifiers into the OpenAlex filter each kind needs. */
export function groupIdentifiers(ids: string[]): { openalex_id: string[]; doi: string[]; pmid: string[]; pmcid: string[]; unknown: string[] } {
  const out = { openalex_id: [] as string[], doi: [] as string[], pmid: [] as string[], pmcid: [] as string[], unknown: [] as string[] };
  for (const raw of ids) {
    const id = raw.trim();
    const openalex = id.match(/^(?:https?:\/\/openalex\.org\/)?(W\d+)$/i);
    const doi = bareDoi(id.replace(/^doi:\s*/i, ""));
    const pmcid = id.match(/^(?:pmcid:\s*)?(PMC\d+)$/i);
    const pmid = id.match(/^(?:pmid:\s*)?(\d{4,9})$/i);
    if (openalex) out.openalex_id.push(openalex[1].toUpperCase());
    else if (doi && /^10\.\d{4,9}\/\S+$/.test(doi)) out.doi.push(doi);
    else if (pmcid) out.pmcid.push(pmcid[1].toUpperCase());
    else if (pmid) out.pmid.push(pmid[1]);
    else if (id) out.unknown.push(id);
  }
  return out;
}
