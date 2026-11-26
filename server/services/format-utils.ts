import { ABSTRACT_SNIPPET_LENGTH, CHARACTER_LIMIT, LIST_AUTHORS, WORK_LIST_FIELDS, WORK_BRIEF_FIELDS } from "../constants.js";
import type { Author, Institution, Work, CountByYear } from "../types.js";
import type {
  AuthorOutput,
  InstitutionOutput,
  PaginationInfo,
  TopicCount,
  WorkOutput,
  YearCount
} from "../output-types.js";
import { budgetNotice, shortId } from "./openalex-client.js";

// ============================================
// Shared helpers
// ============================================

export const num = (n: number | null | undefined): string => (n ?? 0).toLocaleString("en-US");

/**
 * Reconstruct abstract from inverted index.
 * OpenAlex stores abstracts as {word: [positions]}.
 */
export function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string | null {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return null;
  }
  const words: [string, number][] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  words.sort((a, b) => a[1] - b[1]);
  return words.map(([word]) => word).join(" ");
}

function snippet(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function yearCounts(counts: CountByYear[] | null | undefined): YearCount[] {
  return (counts ?? []).map(c => ({
    year: c.year,
    cited_by_count: c.cited_by_count,
    ...(c.works_count != null ? { works_count: c.works_count } : {})
  }));
}

export function topicCounts(
  topics: { id: string; display_name: string; count: number; field?: { display_name: string }; domain?: { display_name: string } }[] | null | undefined
): TopicCount[] {
  return (topics ?? []).slice(0, 10).map(t => ({
    name: t.display_name,
    id: t.id,
    count: t.count,
    field: t.field?.display_name ?? null,
    domain: t.domain?.display_name ?? null
  }));
}

// ============================================
// Works
// ============================================

/**
 * Structured work data for the UI.
 * `compact` is used for result lists: fewer authors, no affiliations, and a
 * shortened abstract.
 */
/**
 * `compact` is used for result lists: first few authors, shortened abstract.
 * `brief` goes further and leaves out the abstract and topics.
 */
export function formatWorkJson(work: Work, options: { compact?: boolean; brief?: boolean } = {}): WorkOutput {
  const compact = options.compact ?? false;
  const brief = options.brief ?? false;
  const authorships = work.authorships ?? [];
  const shown = compact ? authorships.slice(0, LIST_AUTHORS) : authorships;
  const fullAbstract = brief ? null : reconstructAbstract(work.abstract_inverted_index);
  const abstract = fullAbstract && compact ? snippet(fullAbstract, ABSTRACT_SNIPPET_LENGTH) : fullAbstract;
  const source = work.primary_location?.source;

  return {
    id: work.id,
    doi: work.doi ?? null,
    title: work.display_name || work.title || "Untitled",
    publication_year: work.publication_year ?? null,
    publication_date: work.publication_date ?? null,
    type: work.type ?? null,
    authors: shown.map(a => ({
      name: a.author?.display_name ?? "Unknown",
      id: a.author?.id ?? "",
      orcid: a.author?.orcid ?? null,
      position: a.author_position,
      ...(compact ? {} : {
        institutions: (a.institutions ?? []).map(i => ({
          name: i.display_name,
          id: i.id,
          country: i.country_code ?? null
        }))
      })
    })),
    authors_count: authorships.length,
    source: source ? {
      name: source.display_name,
      id: source.id,
      type: source.type ?? null,
      is_oa: Boolean(source.is_oa)
    } : null,
    cited_by_count: work.cited_by_count ?? 0,
    open_access: {
      is_oa: Boolean(work.open_access?.is_oa),
      status: work.open_access?.oa_status ?? "closed",
      url: work.open_access?.oa_url ?? null
    },
    abstract,
    abstract_truncated: Boolean(fullAbstract && abstract !== fullAbstract),
    topics: (brief ? [] : work.topics ?? []).slice(0, 5).map(t => ({
      name: t.display_name,
      id: t.id,
      score: t.score ?? null
    })),
    referenced_works_count: work.referenced_works_count ?? work.referenced_works?.length ?? 0
  };
}

function authorLine(w: WorkOutput, max: number): string {
  if (w.authors.length === 0) return "Unknown authors";
  const names = w.authors.slice(0, max).map(a => a.name);
  if (w.authors_count > names.length) names.push(`et al. (${w.authors_count} authors)`);
  return names.join(", ");
}

/** One work as a few compact lines, for result lists. */
export function workListEntry(w: WorkOutput, index: number): string {
  const year = w.publication_year ? ` (${w.publication_year})` : "";
  const facts = [
    w.source?.name,
    w.type,
    `cited by ${num(w.cited_by_count)}`,
    w.open_access.is_oa ? `OA: ${w.open_access.status}` : "closed access"
  ].filter(Boolean);
  const ids = [w.doi, shortId(w.id)].filter(Boolean);

  const lines = [
    `${index}. **${w.title}**${year}`,
    `   ${authorLine(w, 3)}`,
    `   ${facts.join(" · ")}`,
    `   ${ids.join(" · ")}`
  ];
  if (w.abstract) lines.push(`   Abstract: ${w.abstract}`);
  return lines.join("\n");
}

/** Full details of one work. */
export function workDetailMarkdown(w: WorkOutput): string {
  const year = w.publication_year ? ` (${w.publication_year})` : "";
  const lines = [`## ${w.title}${year}`, ""];

  const shown = w.authors.slice(0, 15).map(a => {
    const inst = a.institutions?.[0]?.name;
    return inst ? `${a.name} (${inst})` : a.name;
  });
  if (w.authors_count > shown.length) shown.push(`et al. (${w.authors_count} authors)`);
  lines.push(`**Authors:** ${shown.length > 0 ? shown.join("; ") : "Unknown"}`);

  if (w.source) lines.push(`**Source:** ${w.source.name}`);
  if (w.type) lines.push(`**Type:** ${w.type}`);
  if (w.publication_date) lines.push(`**Published:** ${w.publication_date}`);
  lines.push(`**Cited by:** ${num(w.cited_by_count)}`);
  lines.push(`**References:** ${num(w.referenced_works_count)}`);
  lines.push(
    w.open_access.is_oa
      ? `**Open access:** ${w.open_access.status}${w.open_access.url ? ` — ${w.open_access.url}` : ""}`
      : "**Open access:** no"
  );
  if (w.doi) lines.push(`**DOI:** ${w.doi}`);
  const libkey = libkeyUrl(w.doi);
  if (libkey) lines.push(`**Full text via the reader's library (LibKey):** ${libkey}`);
  lines.push(`**OpenAlex ID:** ${shortId(w.id)}`);
  if (w.topics.length > 0) lines.push(`**Topics:** ${w.topics.map(t => t.name).join(", ")}`);
  if (w.abstract) lines.push("", `**Abstract:** ${w.abstract}`);
  return lines.join("\n");
}

// ============================================
// Authors
// ============================================

/**
 * `compact` is used for search results, where only what a card shows is kept:
 * prolific authors carry long affiliation and yearly-count histories.
 */
export function formatAuthorJson(author: Author, options: { compact?: boolean } = {}): AuthorOutput {
  const compact = options.compact ?? false;
  const lastKnown = author.last_known_institutions ?? [];
  return {
    id: author.id,
    orcid: author.orcid ?? null,
    display_name: author.display_name,
    display_name_alternatives: compact ? [] : author.display_name_alternatives ?? [],
    works_count: author.works_count ?? 0,
    cited_by_count: author.cited_by_count ?? 0,
    h_index: author.summary_stats?.h_index ?? null,
    i10_index: author.summary_stats?.i10_index ?? null,
    two_year_mean_citedness: author.summary_stats?.["2yr_mean_citedness"] ?? null,
    last_known_institutions: lastKnown.map(i => ({
      id: i.id, name: i.display_name, country: i.country_code ?? null, type: i.type ?? null
    })),
    affiliations: (author.affiliations ?? []).slice(0, compact ? 1 : undefined).map(a => ({
      institution: { id: a.institution.id, name: a.institution.display_name, country: a.institution.country_code ?? null },
      years: a.years ?? []
    })),
    top_topics: topicCounts(author.topics).slice(0, compact ? 3 : undefined),
    counts_by_year: compact ? [] : yearCounts(author.counts_by_year)
  };
}

export function authorListEntry(a: AuthorOutput, index: number): string {
  const inst = a.last_known_institutions[0];
  const facts = [
    `${num(a.works_count)} works`,
    `${num(a.cited_by_count)} citations`,
    a.h_index != null ? `h-index ${a.h_index}` : null
  ].filter(Boolean);
  const ids = [shortId(a.id), a.orcid].filter(Boolean);
  const lines = [`${index}. **${a.display_name}**`];
  if (inst) lines.push(`   ${inst.name}${inst.country ? ` (${inst.country})` : ""}`);
  lines.push(`   ${facts.join(" · ")}`);
  lines.push(`   ${ids.join(" · ")}`);
  if (a.top_topics.length > 0) lines.push(`   Topics: ${a.top_topics.slice(0, 3).map(t => t.name).join(", ")}`);
  return lines.join("\n");
}

export function authorDetailMarkdown(a: AuthorOutput): string {
  const lines = [`## ${a.display_name}`, ""];
  if (a.orcid) lines.push(`**ORCID:** ${a.orcid}`);
  lines.push(`**Works:** ${num(a.works_count)}`);
  lines.push(`**Citations:** ${num(a.cited_by_count)}`);
  if (a.h_index != null) lines.push(`**h-index:** ${a.h_index}`);
  if (a.i10_index != null) lines.push(`**i10-index:** ${a.i10_index}`);
  if (a.last_known_institutions.length > 0) {
    lines.push(`**Current institution:** ${a.last_known_institutions.map(i => `${i.name}${i.country ? ` (${i.country})` : ""}`).join("; ")}`);
  }
  if (a.affiliations.length > 0) {
    const history = a.affiliations.slice(0, 8).map(af => {
      const years = af.years.length > 0 ? ` ${Math.min(...af.years)}–${Math.max(...af.years)}` : "";
      return `${af.institution.name}${years}`;
    });
    lines.push(`**Affiliation history:** ${history.join("; ")}`);
  }
  if (a.top_topics.length > 0) lines.push(`**Research areas:** ${a.top_topics.slice(0, 5).map(t => t.name).join(", ")}`);
  if (a.display_name_alternatives.length > 0) {
    lines.push(`**Also published as:** ${a.display_name_alternatives.slice(0, 5).join(", ")}`);
  }
  lines.push(`**OpenAlex ID:** ${shortId(a.id)}`);
  return lines.join("\n");
}

// ============================================
// Institutions
// ============================================

/** `compact` is used for search results, where only what a card shows is kept. */
export function formatInstitutionJson(institution: Institution, options: { compact?: boolean } = {}): InstitutionOutput {
  const compact = options.compact ?? false;
  return {
    id: institution.id,
    ror: institution.ror ?? null,
    display_name: institution.display_name,
    display_name_alternatives: compact ? [] : institution.display_name_alternatives ?? [],
    display_name_acronyms: compact ? [] : institution.display_name_acronyms ?? [],
    type: institution.type ?? null,
    country_code: institution.country_code ?? null,
    geo: institution.geo ? {
      city: institution.geo.city ?? null,
      region: institution.geo.region ?? null,
      country: institution.geo.country ?? null
    } : null,
    works_count: institution.works_count ?? 0,
    cited_by_count: institution.cited_by_count ?? 0,
    h_index: institution.summary_stats?.h_index ?? null,
    i10_index: institution.summary_stats?.i10_index ?? null,
    two_year_mean_citedness: institution.summary_stats?.["2yr_mean_citedness"] ?? null,
    homepage_url: institution.homepage_url ?? null,
    top_topics: compact ? [] : topicCounts(institution.topics),
    associated_institutions: (compact ? [] : institution.associated_institutions ?? []).map(i => ({
      id: i.id, name: i.display_name, relationship: i.relationship, country: i.country_code ?? null
    })),
    counts_by_year: compact ? [] : yearCounts(institution.counts_by_year)
  };
}

export function institutionLocation(i: InstitutionOutput): string {
  return [i.geo?.city, i.geo?.region, i.geo?.country].filter(Boolean).join(", ") || i.country_code || "";
}

export function institutionListEntry(i: InstitutionOutput, index: number): string {
  const where = institutionLocation(i);
  const facts = [i.type, where, `${num(i.works_count)} works`, `${num(i.cited_by_count)} citations`].filter(Boolean);
  const ids = [shortId(i.id), i.ror].filter(Boolean);
  return [`${index}. **${i.display_name}**`, `   ${facts.join(" · ")}`, `   ${ids.join(" · ")}`].join("\n");
}

export function institutionDetailMarkdown(i: InstitutionOutput): string {
  const lines = [`## ${i.display_name}`, ""];
  if (i.type) lines.push(`**Type:** ${i.type}`);
  const where = institutionLocation(i);
  if (where) lines.push(`**Location:** ${where}`);
  lines.push(`**Works:** ${num(i.works_count)}`);
  lines.push(`**Citations:** ${num(i.cited_by_count)}`);
  if (i.h_index != null) lines.push(`**h-index:** ${i.h_index}`);
  if (i.top_topics.length > 0) lines.push(`**Top topics:** ${i.top_topics.slice(0, 5).map(t => t.name).join(", ")}`);
  if (i.associated_institutions.length > 0) {
    const shown = i.associated_institutions.slice(0, 8).map(a => `${a.name} (${a.relationship})`);
    if (i.associated_institutions.length > shown.length) shown.push(`and ${i.associated_institutions.length - shown.length} more`);
    lines.push(`**Associated institutions:** ${shown.join("; ")}`);
  }
  if (i.ror) lines.push(`**ROR:** ${i.ror}`);
  if (i.homepage_url) lines.push(`**Website:** ${i.homepage_url}`);
  lines.push(`**OpenAlex ID:** ${shortId(i.id)}`);
  return lines.join("\n");
}

// ============================================
// List assembly and tool results
// ============================================

/**
 * Build the text the model reads for a result list. Entries are added whole
 * until the character limit is reached, so output is never cut mid-entry.
 */
export function listText(options: {
  heading: string;
  summary: string;
  entries: string[];
  pagination: PaginationInfo;
  emptyMessage: string;
  /** The query in OQL, shown after the results when given */
  oql?: string | null;
}): string {
  const { heading, summary, entries, pagination, emptyMessage, oql } = options;
  if (entries.length === 0) return emptyMessage;

  const parts = [`## ${heading}`, summary];
  let used = parts.join("\n").length;
  let included = 0;
  for (const entry of entries) {
    if (used + entry.length + 2 > CHARACTER_LIMIT) break;
    parts.push("", entry);
    used += entry.length + 2;
    included++;
  }

  const notes: string[] = [];
  if (included < entries.length) {
    notes.push(`Output limit reached: showing ${included} of the ${entries.length} results on this page. Use a smaller limit to see the rest.`);
  }
  if (pagination.hasMore) {
    notes.push(
      pagination.cursorMode
        ? `More results available: pass cursor="${pagination.nextCursor}".`
        : `More results available: use page=${pagination.nextPage}.`
    );
  }
  if (oql) notes.push(oqlLine(oql));
  if (notes.length > 0) parts.push("", ...notes);
  return parts.join("\n");
}

/**
 * A sentence about re-ranking for the result text: that it was applied, or why
 * it was asked for and not applied. Empty when it was not asked for.
 */
export function rerankNote(options: {
  requested: boolean;
  applied: boolean;
  semantic: boolean;
  relevanceOrder: boolean;
}): string {
  if (!options.requested) return "";
  if (options.applied) return "Re-ranked by OpenAlex: the best 100 matches are ordered by how well each answers the query.";
  if (options.semantic) return "Re-ranking was not applied: semantic search already orders results by meaning.";
  if (!options.relevanceOrder) return "Re-ranking was not applied: it only works in relevance order, and another sort was chosen.";
  return "Re-ranking was not applied: it covers only the best 100 matches, and this page is past them.";
}

/** The fields to request and the formatter options for a list of works at the chosen level of detail. */
export function workListShape(detail: "full" | "brief" | undefined): { select: string; options: { compact: true; brief: boolean } } {
  const brief = detail === "brief";
  return { select: brief ? WORK_BRIEF_FIELDS : WORK_LIST_FIELDS, options: { compact: true, brief } };
}

/** A LibKey link for a DOI: full text through the reader's own library, or an open copy. Null without a DOI. */
export function libkeyUrl(doi: string | null | undefined): string | null {
  const bare = (doi ?? "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return /^10\.\d{4,9}\/\S+$/.test(bare) ? `https://libkey.io/${bare}` : null;
}

/** One line giving a result's query in OQL and what it is for. */
export function oqlLine(oql: string): string {
  return `Query in OQL (paste into the OQL tab at openalex.org to rerun or export it): ${oql}`;
}

export function pageSummary(pagination: PaginationInfo, noun: string): string {
  const where = pagination.cursorMode ? "cursor paging" : `page ${pagination.page}`;
  return `${num(pagination.total)} ${noun} in total; ${where}, ${pagination.count} shown.`;
}

/** Position of the first entry on this page, for numbering. Unknown under cursor paging, so numbering restarts. */
export function firstIndex(page: number, limit: number, cursor: string | undefined): number {
  return cursor ? 0 : (page - 1) * limit;
}

type TextContent = { type: "text"; text: string };

/**
 * A successful tool result: concise text for the model, structured data for
 * the UI.
 */
export function toolResult<T extends object>(
  text: string,
  data: T
): { content: TextContent[]; structuredContent: Record<string, unknown> } {
  const notice = budgetNotice();
  return {
    content: [{ type: "text", text: notice ? `${text}\n\n${notice}` : text }],
    structuredContent: data as unknown as Record<string, unknown>
  };
}

export function toolError(action: string, error: unknown): { isError: true; content: TextContent[] } {
  const message = error instanceof Error ? error.message : String(error);
  return { isError: true, content: [{ type: "text", text: `Error ${action}: ${message}` }] };
}

export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
} as const;
