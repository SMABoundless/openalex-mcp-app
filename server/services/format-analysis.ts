// Builds the one-call summary of a set of works from several grouped counts.
// Pure (no network), so it can be tested directly.
import type { GroupByResult, OpenAlexGroupResponse, Work } from "../types.js";
import type { AnalyzeWorksOutput, GroupOutput } from "../output-types.js";
import { ANALYZE_YEARS } from "../constants.js";
import { formatWorkJson, num, workListEntry } from "./format-utils.js";
import { formatGroups, groupLine, percent, worksByYear } from "./format-entities.js";

/** The grouped counts the summary is built from: a name for messages and the field to group by. */
export const ANALYSIS_GROUPS = {
  year: { name: "works per year", field: "publication_year" },
  oaStatus: { name: "open access status", field: "open_access.oa_status" },
  type: { name: "types", field: "type" },
  field: { name: "fields", field: "primary_topic.field.id" },
  topic: { name: "topics", field: "primary_topic.id" },
  author: { name: "authors", field: "authorships.author.id" },
  institution: { name: "institutions", field: "authorships.institutions.id" },
  country: { name: "countries", field: "authorships.countries" },
  source: { name: "journals and sources", field: "primary_location.source.id" },
  funder: { name: "funders", field: "funders.id" },
  countriesCount: { name: "international collaboration", field: "countries_distinct_count" },
  top10: { name: "highly cited share", field: "citation_normalized_percentile.is_in_top_10_percent" }
} as const;

export type AnalysisGroupKey = keyof typeof ANALYSIS_GROUPS;

export interface AnalysisParts {
  groups: Partial<Record<AnalysisGroupKey, OpenAlexGroupResponse>>;
  /** undefined when the list could not be fetched */
  mostCited?: Work[];
}

/** Share of works that are open access in any form: everything except "closed". */
export function openAccessShare(groups: GroupByResult[], total: number): number | null {
  if (total <= 0 || groups.length === 0) return null;
  const closed = groups.find(g => String(g.key) === "closed")?.count ?? 0;
  return Math.min(1, Math.max(0, (total - closed) / total));
}

/**
 * From counts of works by number of author countries: how many works have a
 * known country, and the share of those with two or more.
 */
export function internationalShare(groups: GroupByResult[]): { share: number | null; known: number } {
  let known = 0;
  let international = 0;
  for (const g of groups) {
    const countries = Number(g.key);
    if (!Number.isFinite(countries) || countries < 1) continue;
    known += g.count;
    if (countries >= 2) international += g.count;
  }
  return { share: known > 0 ? international / known : null, known };
}

/** From a yes/no count: the share of "yes" among works that have a value. */
export function yesShare(groups: GroupByResult[]): number | null {
  const yes = groups.find(g => String(g.key) === "true")?.count ?? 0;
  const no = groups.find(g => String(g.key) === "false")?.count ?? 0;
  return yes + no > 0 ? yes / (yes + no) : null;
}

export function buildAnalysis(
  parts: AnalysisParts,
  options: { query?: string; filter?: string; top: number; thisYear?: number }
): AnalyzeWorksOutput {
  const g = parts.groups;
  const total = Object.values(g).find(r => r != null)?.meta.count ?? 0;
  const top = (key: AnalysisGroupKey): GroupOutput[] =>
    formatGroups((g[key]?.group_by ?? []).slice(0, options.top), total);
  const collaboration = internationalShare(g.countriesCount?.group_by ?? []);

  const unavailable: string[] = (Object.keys(ANALYSIS_GROUPS) as AnalysisGroupKey[])
    .filter(key => g[key] == null)
    .map(key => ANALYSIS_GROUPS[key].name);
  if (parts.mostCited == null) unavailable.push("most cited works");

  return {
    query: options.query ?? null,
    filter: options.filter ?? null,
    total_works: total,
    open_access_share: openAccessShare(g.oaStatus?.group_by ?? [], total),
    by_oa_status: formatGroups(g.oaStatus?.group_by ?? [], total),
    by_year: worksByYear(g.year?.group_by, ANALYZE_YEARS, options.thisYear),
    by_type: top("type"),
    top_fields: top("field"),
    top_topics: top("topic"),
    top_authors: top("author"),
    top_institutions: top("institution"),
    top_countries: top("country"),
    top_sources: top("source"),
    top_funders: top("funder"),
    international_share: collaboration.share,
    works_with_known_countries: collaboration.known,
    top_10_percent_share: yesShare(g.top10?.group_by ?? []),
    most_cited: (parts.mostCited ?? []).map(w => formatWorkJson(w, { compact: true })),
    unavailable
  };
}

const YEARS_IN_TEXT = 10;

export function analysisScope(a: Pick<AnalyzeWorksOutput, "query" | "filter">): string {
  return [a.query ? `matching "${a.query}"` : null, a.filter ? `with filter "${a.filter}"` : null]
    .filter(Boolean)
    .join(" ");
}

export function analysisMarkdown(a: AnalyzeWorksOutput): string {
  const scope = analysisScope(a);
  const lines = [`## Summary of ${num(a.total_works)} works`, scope ? `Works ${scope}.` : "", ""].filter(
    (line, i) => i !== 1 || line !== ""
  );

  if (a.open_access_share != null) {
    const mix = a.by_oa_status.map(s => `${s.name} ${percent(s.share)}`).join(", ");
    lines.push(`**Open access:** ${percent(a.open_access_share)} (${mix})`);
  }
  if (a.international_share != null) {
    lines.push(
      `**International collaboration:** ${percent(a.international_share)} of the ` +
      `${num(a.works_with_known_countries)} works with known author countries have authors in two or more countries`
    );
  }
  if (a.top_10_percent_share != null) {
    lines.push(
      `**Highly cited:** ${percent(a.top_10_percent_share)} of works with a citation percentile are in the top 10% for their year and subfield`
    );
  }
  if (a.by_year.length > 0) {
    const recent = a.by_year.slice(-YEARS_IN_TEXT).map(y => `${y.year}: ${num(y.works_count)}`);
    lines.push(`**Works per year:** ${recent.join(" · ")}`);
  }

  const section = (heading: string, groups: GroupOutput[]): void => {
    if (groups.length === 0) return;
    lines.push("", `### ${heading}`, ...groups.map(groupLine));
  };
  section("Types", a.by_type);
  section("Top fields", a.top_fields);
  section("Top topics", a.top_topics);
  section("Top authors", a.top_authors);
  section("Top institutions", a.top_institutions);
  section("Top countries", a.top_countries);
  section("Top journals and sources", a.top_sources);
  section("Top funders", a.top_funders);

  if (a.most_cited.length > 0) {
    lines.push("", "### Most cited");
    // Abstracts are left out here to keep the summary short; they are in the structured data
    a.most_cited.forEach((w, i) => lines.push(workListEntry({ ...w, abstract: null }, i + 1)));
  }

  lines.push(
    "",
    "Shares in the rankings are of all the works summarised. A work can have several authors, institutions, countries and funders, so those shares can add up to more than 100%."
  );
  if (a.unavailable.length > 0) {
    lines.push("", `Could not be fetched and left out: ${a.unavailable.join(", ")}.`);
  }
  return lines.join("\n");
}
