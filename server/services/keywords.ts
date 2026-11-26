// Building a high-recall search from words and OpenAlex keywords.
//
// A topic is split into parts ("method", "population", ...). A work must match
// every part. Within a part it can match the part's words, or carry any of the
// keywords chosen for it: authors who never use the words are still found when
// OpenAlex tagged their work with the keyword. Combining a text search with a
// keyword filter by "or" cannot be written as an ordinary filter URL, so the
// queries are written in OQL.
//
// Pure (no network), so it can be tested directly.

export interface KeywordPartInput {
  label: string;
  text?: string;
  keyword_ids?: string[];
}

export interface KeywordFilters {
  from_year?: number;
  to_year?: number;
  types?: readonly string[];
  open_access_only?: boolean;
  language?: string;
}

/** "https://openalex.org/keywords/citation-analysis" or "keywords/citation-analysis" -> "citation-analysis" */
export function keywordSlug(id: string): string {
  return id.trim().replace(/^https?:\/\/openalex\.org\//i, "").replace(/^keywords\//i, "").toLowerCase();
}

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** A problem with a part's words that would break the query, or null when they are usable. */
export function textProblem(text: string): string | null {
  if ((text.match(/"/g) ?? []).length % 2 !== 0) return "has an unmatched double quote";
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return "has a closing parenthesis without an opening one";
  }
  if (depth !== 0) return "has an unclosed parenthesis";
  if (/[\n\r;]/.test(text)) return "must be on one line, without semicolons";
  return null;
}

export interface CleanPart {
  label: string;
  text: string | null;
  keywordIds: string[];
}

/** Trims the parts, normalises keyword IDs, and reports the first problem found. */
export function cleanParts(parts: KeywordPartInput[]): { parts: CleanPart[]; problem: string | null } {
  const clean: CleanPart[] = [];
  for (const part of parts) {
    const label = part.label.trim() || "part";
    const text = part.text?.trim() || null;
    const keywordIds = [...new Set((part.keyword_ids ?? []).map(keywordSlug).filter(Boolean))];
    if (!text && keywordIds.length === 0) {
      return { parts: [], problem: `The part "${label}" has neither words nor keywords. Give it text, keyword_ids, or both.` };
    }
    if (text) {
      const problem = textProblem(text);
      if (problem) return { parts: [], problem: `The text of the part "${label}" ${problem}.` };
    }
    const bad = keywordIds.find(id => !SLUG.test(id));
    if (bad) return { parts: [], problem: `"${bad}" in the part "${label}" is not a keyword ID. Keyword IDs look like "citation-analysis"; find them with openalex_find_keywords.` };
    clean.push({ label, text, keywordIds });
  }
  return { parts: clean, problem: null };
}

const textClause = (text: string): string => `title-abstract-keywords has (${text})`;
const keywordClause = (ids: string[]): string => `keyword is (${ids.join(" or ")})`;

/** The condition for one part: its words, its keywords, or either. */
export function partClause(part: CleanPart, which: "text" | "keywords" | "either"): string | null {
  const text = part.text ? textClause(part.text) : null;
  const keywords = part.keywordIds.length > 0 ? keywordClause(part.keywordIds) : null;
  if (which === "text") return text;
  if (which === "keywords") return keywords;
  if (text && keywords) return `(${text} or ${keywords})`;
  return text ?? keywords;
}

/** The filters as OQL conditions, and the same in words for showing to people. */
export function filterClauses(filters: KeywordFilters): { oql: string[]; words: string[] } {
  const oql: string[] = [];
  const words: string[] = [];
  if (filters.from_year != null) {
    oql.push(`year >= (${filters.from_year})`);
    words.push(`from ${filters.from_year}`);
  }
  if (filters.to_year != null) {
    oql.push(`year <= (${filters.to_year})`);
    words.push(`to ${filters.to_year}`);
  }
  if (filters.types && filters.types.length > 0) {
    oql.push(`type is (${filters.types.join(" or ")})`);
    words.push(`type: ${filters.types.join(", ")}`);
  }
  if (filters.open_access_only) {
    oql.push("open access is (true)");
    words.push("open access only");
  }
  if (filters.language) {
    oql.push(`language is (${filters.language})`);
    words.push(`language: ${filters.language}`);
  }
  return { oql, words };
}

function query(conditions: string[]): string {
  return `get works where ${conditions.join(" and ")}`;
}

export interface KeywordQueries {
  /** Every part must match, by its words or its keywords */
  combined: string;
  /** The same on words alone; null when some part has no words */
  textOnly: string | null;
  /** For each part, in order: its words, its keywords and either, each with the filters applied */
  perPart: { text: string | null; keywords: string | null; either: string }[];
}

export function buildKeywordQueries(parts: CleanPart[], filters: KeywordFilters): KeywordQueries {
  const extra = filterClauses(filters).oql;
  const either = parts.map(p => partClause(p, "either")!);
  const allHaveText = parts.every(p => p.text);
  const anyKeywords = parts.some(p => p.keywordIds.length > 0);
  return {
    combined: query([...either, ...extra]),
    // Without keywords the search on words alone is the combined search
    textOnly: allHaveText && anyKeywords ? query([...parts.map(p => partClause(p, "text")!), ...extra]) : null,
    perPart: parts.map(p => {
      const text = partClause(p, "text");
      const keywords = partClause(p, "keywords");
      return {
        text: text ? query([text, ...extra]) : null,
        keywords: keywords ? query([keywords, ...extra]) : null,
        either: query([partClause(p, "either")!, ...extra])
      };
    })
  };
}

/** Appends OQL's random-sample step to a query. */
export function sampleQuery(oql: string, size: number): string {
  return `${oql} sample ${size}`;
}

// ============================================
// Checking a search against seed papers
// ============================================
//
// A thorough search should retrieve the papers already known to be relevant.
// Seeds it misses show where it is too narrow: each miss is traced to the part
// of the topic it fails, or to a filter.

/** Narrows a query to the works with these OpenAlex IDs. */
export function restrictToWorks(oql: string, ids: string[]): string {
  return `${oql} and openalex id is (${ids.join(" or ")})`;
}

/** One part's condition on its own, without the filters, as a query. */
export function partQuery(part: CleanPart): string {
  return `get works where ${partClause(part, "either")}`;
}

export interface SeedDiagnosis {
  id: string;
  found: boolean;
  /** Labels of the parts this seed does not match; empty when it was found */
  missingParts: string[];
  /** True when the seed matches every part and was left out by a filter */
  excludedByFilters: boolean;
}

/**
 * Works out why each seed was or was not retrieved.
 * `found` holds the seeds the whole search retrieved; `matchedByPart[i]` holds
 * the seeds that match part i when the filters are left off.
 */
export function diagnoseSeeds(
  seedIds: string[],
  found: ReadonlySet<string>,
  parts: CleanPart[],
  matchedByPart: ReadonlySet<string>[]
): SeedDiagnosis[] {
  return seedIds.map(id => {
    if (found.has(id)) return { id, found: true, missingParts: [], excludedByFilters: false };
    const missingParts = parts.filter((_, i) => !matchedByPart[i]?.has(id)).map(p => p.label);
    return { id, found: false, missingParts, excludedByFilters: missingParts.length === 0 };
  });
}
