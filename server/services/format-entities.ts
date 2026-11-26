// Formatters for sources, topics, funders, publishers and grouped counts.
import type { EntityRole, Funder, Publisher, Source, Topic, GroupByResult } from "../types.js";
import type {
  FunderDetailOutput,
  FunderOutput,
  GroupOutput,
  PublisherDetailOutput,
  PublisherOutput,
  PublisherSourceOutput,
  RoleOutput,
  SourceOutput,
  TopicDetailOutput,
  TopicOutput
} from "../output-types.js";
import { num, topicCounts, yearCounts } from "./format-utils.js";
import { PROFILE_YEARS } from "../constants.js";
import { shortId } from "./openalex-client.js";

// ============================================
// Sources
// ============================================

/** `compact` is used for search results: no topic or yearly breakdowns. */
export function formatSourceJson(source: Source, options: { compact?: boolean } = {}): SourceOutput {
  const compact = options.compact ?? false;
  return {
    id: source.id,
    display_name: source.display_name,
    type: source.type ?? null,
    issn_l: source.issn_l ?? null,
    issn: source.issn ?? [],
    publisher: source.host_organization_name ?? null,
    country_code: source.country_code ?? null,
    is_oa: Boolean(source.is_oa),
    is_in_doaj: Boolean(source.is_in_doaj),
    apc_usd: source.apc_usd ?? null,
    works_count: source.works_count ?? 0,
    cited_by_count: source.cited_by_count ?? 0,
    h_index: source.summary_stats?.h_index ?? null,
    two_year_mean_citedness: source.summary_stats?.["2yr_mean_citedness"] ?? null,
    homepage_url: source.homepage_url ?? null,
    top_topics: compact ? [] : topicCounts(source.topics),
    counts_by_year: compact ? [] : yearCounts(source.counts_by_year)
  };
}

function sourceAccess(s: SourceOutput): string {
  if (!s.is_oa) return "not fully open access";
  return s.is_in_doaj ? "open access (in DOAJ)" : "open access";
}

function sourceApc(s: SourceOutput): string | null {
  if (s.apc_usd == null) return null;
  return s.apc_usd === 0 ? "no APC" : `APC $${num(s.apc_usd)}`;
}

export function sourceListEntry(s: SourceOutput, index: number): string {
  const what = [s.type, s.publisher, s.country_code].filter(Boolean).join(" · ");
  const facts = [
    `${num(s.works_count)} works`,
    `${num(s.cited_by_count)} citations`,
    s.h_index != null ? `h-index ${s.h_index}` : null,
    sourceAccess(s),
    sourceApc(s)
  ].filter(Boolean);
  const ids = [shortId(s.id), s.issn_l ? `ISSN ${s.issn_l}` : null].filter(Boolean);
  const lines = [`${index}. **${s.display_name}**`];
  if (what) lines.push(`   ${what}`);
  lines.push(`   ${facts.join(" · ")}`, `   ${ids.join(" · ")}`);
  return lines.join("\n");
}

export function sourceDetailMarkdown(s: SourceOutput): string {
  const lines = [`## ${s.display_name}`, ""];
  if (s.type) lines.push(`**Type:** ${s.type}`);
  if (s.publisher) lines.push(`**Publisher:** ${s.publisher}`);
  if (s.country_code) lines.push(`**Country:** ${s.country_code}`);
  if (s.issn.length > 0) lines.push(`**ISSN:** ${s.issn.join(", ")}${s.issn_l ? ` (linking ISSN ${s.issn_l})` : ""}`);
  lines.push(`**Access:** ${sourceAccess(s)}`);
  const apc = sourceApc(s);
  if (apc) lines.push(`**Article processing charge:** ${apc === "no APC" ? "none" : `$${num(s.apc_usd)}`}`);
  lines.push(`**Works:** ${num(s.works_count)}`);
  lines.push(`**Citations:** ${num(s.cited_by_count)}`);
  if (s.h_index != null) lines.push(`**h-index:** ${s.h_index}`);
  if (s.two_year_mean_citedness != null) {
    lines.push(`**2-year mean citedness:** ${s.two_year_mean_citedness.toFixed(2)}`);
  }
  if (s.top_topics.length > 0) lines.push(`**Top topics:** ${s.top_topics.slice(0, 5).map(t => t.name).join(", ")}`);
  if (s.homepage_url) lines.push(`**Website:** ${s.homepage_url}`);
  lines.push(`**OpenAlex ID:** ${shortId(s.id)}`);
  return lines.join("\n");
}

// ============================================
// Topics
// ============================================

export function formatTopicJson(topic: Topic): TopicOutput {
  return {
    id: topic.id,
    display_name: topic.display_name,
    description: topic.description ?? null,
    keywords: (topic.keywords ?? []).slice(0, 8).map(k => k.display_name),
    subfield: topic.subfield?.display_name ?? null,
    field: topic.field?.display_name ?? null,
    domain: topic.domain?.display_name ?? null,
    works_count: topic.works_count ?? 0,
    cited_by_count: topic.cited_by_count ?? 0
  };
}

export function topicListEntry(t: TopicOutput, index: number): string {
  const path = [t.domain, t.field, t.subfield].filter(Boolean).join(" > ");
  const lines = [`${index}. **${t.display_name}**`];
  if (path) lines.push(`   ${path}`);
  lines.push(`   ${num(t.works_count)} works · ${num(t.cited_by_count)} citations · ${shortId(t.id)}`);
  if (t.keywords.length > 0) lines.push(`   Keywords: ${t.keywords.join(", ")}`);
  if (t.description) lines.push(`   ${t.description}`);
  return lines.join("\n");
}

/**
 * Turns a group-by-year response into works per year, oldest first, keeping
 * the most recent `maxYears`. Years after `thisYear` are dropped: OpenAlex
 * holds a few works dated in the future.
 */
export function worksByYear(
  groups: GroupByResult[] | null | undefined,
  maxYears: number,
  thisYear: number = new Date().getFullYear()
): { year: number; works_count: number }[] {
  return (groups ?? [])
    .map(g => ({ year: Number(g.key), works_count: g.count }))
    .filter(g => Number.isInteger(g.year) && g.year > 0 && g.year <= thisYear)
    .sort((a, b) => a.year - b.year)
    .slice(-maxYears);
}

export function formatTopicDetailJson(
  topic: Topic,
  byYear: { year: number; works_count: number }[] = []
): TopicDetailOutput {
  return {
    ...formatTopicJson(topic),
    keywords: (topic.keywords ?? []).map(k => k.display_name),
    siblings: (topic.siblings ?? []).map(s => ({ id: s.id, name: s.display_name })),
    wikipedia_url: topic.ids?.wikipedia ?? null,
    works_by_year: byYear
  };
}

const SIBLINGS_IN_TEXT = 10;
const YEARS_IN_TEXT = 5;

export function topicDetailMarkdown(t: TopicDetailOutput): string {
  const id = shortId(t.id);
  const lines = [`## ${t.display_name}`, ""];
  const path = [t.domain, t.field, t.subfield].filter(Boolean).join(" > ");
  if (path) lines.push(`**Hierarchy:** ${path}`);
  if (t.description) lines.push(`**Description:** ${t.description}`);
  lines.push(`**Works:** ${num(t.works_count)}`);
  lines.push(`**Citations:** ${num(t.cited_by_count)}`);
  if (t.keywords.length > 0) lines.push(`**Keywords:** ${t.keywords.join(", ")}`);
  if (t.works_by_year.length > 0) {
    const recent = t.works_by_year.slice(-YEARS_IN_TEXT).map(y => `${y.year}: ${num(y.works_count)}`);
    lines.push(`**Works per year:** ${recent.join(" · ")}`);
  }
  if (t.siblings.length > 0) {
    const shown = t.siblings.slice(0, SIBLINGS_IN_TEXT).map(s => `${s.name} [${shortId(s.id)}]`);
    const more = t.siblings.length - shown.length;
    lines.push(`**Other topics in this subfield:** ${shown.join("; ")}${more > 0 ? `; and ${more} more` : ""}`);
  }
  if (t.wikipedia_url) lines.push(`**Wikipedia:** ${t.wikipedia_url}`);
  lines.push(`**OpenAlex ID:** ${id}`);
  lines.push("", `To find works on this topic, search works with filter "topics.id:${id}" or "primary_topic.id:${id}".`);
  return lines.join("\n");
}

// ============================================
// Funders
// ============================================

export function formatFunderJson(funder: Funder): FunderOutput {
  return {
    id: funder.id,
    display_name: funder.display_name,
    alternate_titles: (funder.alternate_titles ?? []).slice(0, 5),
    country_code: funder.country_code ?? null,
    description: funder.description ?? null,
    homepage_url: funder.homepage_url ?? null,
    ror: funder.ids?.ror ?? null,
    awards_count: funder.awards_count ?? null,
    works_count: funder.works_count ?? 0,
    cited_by_count: funder.cited_by_count ?? 0,
    h_index: funder.summary_stats?.h_index ?? null
  };
}

export function funderListEntry(f: FunderOutput, index: number): string {
  const what = [f.description, f.country_code].filter(Boolean).join(" · ");
  const facts = [
    `${num(f.works_count)} funded works`,
    f.awards_count != null ? `${num(f.awards_count)} awards` : null,
    `${num(f.cited_by_count)} citations`
  ].filter(Boolean);
  const ids = [shortId(f.id), f.ror].filter(Boolean);
  const lines = [`${index}. **${f.display_name}**`];
  if (what) lines.push(`   ${what}`);
  lines.push(`   ${facts.join(" · ")}`, `   ${ids.join(" · ")}`);
  if (f.alternate_titles.length > 0) lines.push(`   Also known as: ${f.alternate_titles.slice(0, 3).join("; ")}`);
  return lines.join("\n");
}

/** Yearly counts for the most recent `maxYears` years on record, newest first. */
export function recentYearCounts(counts: Funder["counts_by_year"], maxYears: number = PROFILE_YEARS) {
  return yearCounts(counts)
    .sort((a, b) => b.year - a.year)
    .slice(0, maxYears);
}

/** The other records OpenAlex holds for the same organisation, leaving out the record itself. */
export function otherRoles(roles: EntityRole[] | null | undefined, ownId: string): RoleOutput[] {
  return (roles ?? [])
    .filter(r => r.id !== ownId)
    .map(r => ({ role: r.role, id: r.id, works_count: r.works_count ?? 0 }));
}

function rolesText(roles: RoleOutput[]): string {
  return roles.map(r => `${r.role} [${shortId(r.id)}]`).join(", ");
}

function recentYearsText(counts: { year: number; works_count?: number }[]): string | null {
  const recent = counts
    .filter(c => c.works_count != null)
    .slice()
    .sort((a, b) => b.year - a.year)
    .slice(0, YEARS_IN_TEXT)
    .map(c => `${c.year}: ${num(c.works_count)}`);
  return recent.length > 0 ? recent.join(" · ") : null;
}

export function formatFunderDetailJson(funder: Funder): FunderDetailOutput {
  return {
    ...formatFunderJson(funder),
    alternate_titles: funder.alternate_titles ?? [],
    i10_index: funder.summary_stats?.i10_index ?? null,
    two_year_mean_citedness: funder.summary_stats?.["2yr_mean_citedness"] ?? null,
    counts_by_year: recentYearCounts(funder.counts_by_year),
    other_roles: otherRoles(funder.roles, funder.id)
  };
}

export function funderDetailMarkdown(f: FunderDetailOutput): string {
  const id = shortId(f.id);
  const lines = [`## ${f.display_name}`, ""];
  if (f.description) lines.push(`**Description:** ${f.description}`);
  if (f.country_code) lines.push(`**Country:** ${f.country_code}`);
  if (f.alternate_titles.length > 0) lines.push(`**Also known as:** ${f.alternate_titles.join("; ")}`);
  lines.push(`**Funded works:** ${num(f.works_count)}`);
  if (f.awards_count != null) lines.push(`**Awards:** ${num(f.awards_count)}`);
  lines.push(`**Citations:** ${num(f.cited_by_count)}`);
  if (f.h_index != null) lines.push(`**h-index:** ${f.h_index}`);
  const years = recentYearsText(f.counts_by_year);
  if (years) lines.push(`**Funded works per year:** ${years}`);
  if (f.other_roles.length > 0) lines.push(`**Also in OpenAlex as:** ${rolesText(f.other_roles)}`);
  if (f.homepage_url) lines.push(`**Website:** ${f.homepage_url}`);
  if (f.ror) lines.push(`**ROR:** ${f.ror}`);
  lines.push(`**OpenAlex ID:** ${id}`);
  lines.push("", `To find the works it funded, search works with filter "funders.id:${id}".`);
  return lines.join("\n");
}

// ============================================
// Publishers
// ============================================

/** `compact` is used for search results: no yearly counts or other roles, fewer alternate names. */
export function formatPublisherJson(publisher: Publisher, options: { compact?: boolean } = {}): PublisherOutput {
  const compact = options.compact ?? false;
  const titles = publisher.alternate_titles ?? [];
  return {
    id: publisher.id,
    display_name: publisher.display_name,
    alternate_titles: compact ? titles.slice(0, 5) : titles,
    country_codes: publisher.country_codes ?? [],
    parent: publisher.parent_publisher
      ? { id: publisher.parent_publisher.id, name: publisher.parent_publisher.display_name }
      : null,
    hierarchy_level: publisher.hierarchy_level ?? 0,
    homepage_url: publisher.homepage_url ?? null,
    ror: publisher.ids?.ror ?? null,
    works_count: publisher.works_count ?? 0,
    cited_by_count: publisher.cited_by_count ?? 0,
    h_index: publisher.summary_stats?.h_index ?? null,
    two_year_mean_citedness: publisher.summary_stats?.["2yr_mean_citedness"] ?? null,
    counts_by_year: compact ? [] : recentYearCounts(publisher.counts_by_year),
    other_roles: compact ? [] : otherRoles(publisher.roles, publisher.id)
  };
}

export function formatPublisherSource(source: Source): PublisherSourceOutput {
  return {
    id: source.id,
    name: source.display_name,
    type: source.type ?? null,
    is_oa: Boolean(source.is_oa),
    works_count: source.works_count ?? 0,
    cited_by_count: source.cited_by_count ?? 0
  };
}

export function formatPublisherDetailJson(
  publisher: Publisher,
  sources: { count: number; top: Source[] } | null = null
): PublisherDetailOutput {
  return {
    ...formatPublisherJson(publisher),
    sources_count: sources ? sources.count : null,
    top_sources: sources ? sources.top.map(formatPublisherSource) : []
  };
}

export function publisherListEntry(p: PublisherOutput, index: number): string {
  const what = [p.parent ? `part of ${p.parent.name}` : null, p.country_codes.join(", ") || null].filter(Boolean).join(" · ");
  const facts = [
    `${num(p.works_count)} works`,
    `${num(p.cited_by_count)} citations`,
    p.h_index != null ? `h-index ${p.h_index}` : null
  ].filter(Boolean);
  const lines = [`${index}. **${p.display_name}**`];
  if (what) lines.push(`   ${what}`);
  lines.push(`   ${facts.join(" · ")}`, `   ${shortId(p.id)}`);
  if (p.alternate_titles.length > 0) lines.push(`   Also known as: ${p.alternate_titles.slice(0, 3).join("; ")}`);
  return lines.join("\n");
}

const ALTERNATE_TITLES_IN_TEXT = 10;

export function publisherDetailMarkdown(p: PublisherDetailOutput): string {
  const id = shortId(p.id);
  const lines = [`## ${p.display_name}`, ""];
  if (p.parent) lines.push(`**Part of:** ${p.parent.name} [${shortId(p.parent.id)}]`);
  if (p.country_codes.length > 0) lines.push(`**Country:** ${p.country_codes.join(", ")}`);
  if (p.alternate_titles.length > 0) {
    const shown = p.alternate_titles.slice(0, ALTERNATE_TITLES_IN_TEXT);
    const more = p.alternate_titles.length - shown.length;
    lines.push(`**Also known as:** ${shown.join("; ")}${more > 0 ? `; and ${more} more` : ""}`);
  }
  lines.push(`**Works:** ${num(p.works_count)}`);
  lines.push(`**Citations:** ${num(p.cited_by_count)}`);
  if (p.h_index != null) lines.push(`**h-index:** ${p.h_index}`);
  if (p.two_year_mean_citedness != null) lines.push(`**2-year mean citedness:** ${p.two_year_mean_citedness.toFixed(2)}`);
  const years = recentYearsText(p.counts_by_year);
  if (years) lines.push(`**Works per year:** ${years}`);
  if (p.sources_count != null) lines.push(`**Sources published:** ${num(p.sources_count)} (including imprints)`);
  if (p.other_roles.length > 0) lines.push(`**Also in OpenAlex as:** ${rolesText(p.other_roles)}`);
  if (p.homepage_url) lines.push(`**Website:** ${p.homepage_url}`);
  if (p.ror) lines.push(`**ROR:** ${p.ror}`);
  lines.push(`**OpenAlex ID:** ${id}`);
  if (p.top_sources.length > 0) {
    lines.push("", "### Largest sources");
    for (const s of p.top_sources) {
      const facts = [s.type, `${num(s.works_count)} works`, s.is_oa ? "open access" : null].filter(Boolean).join(" · ");
      lines.push(`- ${s.name} [${shortId(s.id)}]: ${facts}`);
    }
  }
  lines.push(
    "",
    `To find its works, search works with filter "primary_location.source.publisher_lineage:${id}". ` +
    `To list its journals, search sources with filter "host_organization_lineage:${id}".`
  );
  return lines.join("\n");
}

// ============================================
// Grouping
// ============================================

/** Short names accepted for group_by, each with the OpenAlex field it stands for and a plain label. */
export const GROUP_BY_FIELDS: Record<string, { field: string; label: string }> = {
  year: { field: "publication_year", label: "year" },
  type: { field: "type", label: "type" },
  oa_status: { field: "open_access.oa_status", label: "open access status" },
  is_oa: { field: "open_access.is_oa", label: "open access" },
  author: { field: "authorships.author.id", label: "author" },
  institution: { field: "authorships.institutions.id", label: "institution" },
  institution_type: { field: "authorships.institutions.type", label: "institution type" },
  country: { field: "authorships.countries", label: "country" },
  journal: { field: "primary_location.source.id", label: "journal or source" },
  source: { field: "primary_location.source.id", label: "journal or source" },
  publisher: { field: "primary_location.source.publisher_lineage", label: "publisher" },
  funder: { field: "funders.id", label: "funder" },
  topic: { field: "primary_topic.id", label: "topic" },
  subfield: { field: "primary_topic.subfield.id", label: "subfield" },
  field: { field: "primary_topic.field.id", label: "field" },
  domain: { field: "primary_topic.domain.id", label: "domain" },
  keyword: { field: "keywords.id", label: "keyword" },
  language: { field: "language", label: "language" },
  sdg: { field: "sustainable_development_goals.id", label: "UN Sustainable Development Goal" },
  license: { field: "best_oa_location.license", label: "licence" },
  top_10_percent: { field: "citation_normalized_percentile.is_in_top_10_percent", label: "top 10% most cited" },
  top_1_percent: { field: "citation_normalized_percentile.is_in_top_1_percent", label: "top 1% most cited" },
  retracted: { field: "is_retracted", label: "retracted" }
};

/** Accepts a short name or a raw OpenAlex field; returns the field to send and a plain label for it. */
export function resolveGroupBy(input: string): { field: string; label: string } {
  const key = input.trim();
  const alias = GROUP_BY_FIELDS[key.toLowerCase()];
  if (alias) return alias;
  const known = Object.values(GROUP_BY_FIELDS).find(g => g.field === key);
  return { field: key, label: known?.label ?? key };
}

/** True when the groups are the two answers to a yes/no field. */
export function groupsAreBoolean(groups: GroupOutput[]): boolean {
  return groups.length > 0 && groups.every(g => g.key === "true" || g.key === "false");
}

function groupName(g: GroupByResult): string {
  const key = String(g.key);
  if (key === "true") return "Yes";
  if (key === "false") return "No";
  return String(g.key_display_name ?? g.key);
}

export function formatGroups(groups: GroupByResult[], totalWorks: number): GroupOutput[] {
  return groups.map(g => ({
    key: String(g.key),
    name: groupName(g),
    count: g.count,
    share: totalWorks > 0 ? g.count / totalWorks : 0
  }));
}

/** True when every group key is a four-digit year, so the groups read best in date order. */
export function groupsAreYears(groups: GroupOutput[]): boolean {
  return groups.length > 0 && groups.every(g => /^\d{4}$/.test(g.key));
}

export function percent(share: number): string {
  const pct = share * 100;
  return pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`;
}

export function groupLine(g: GroupOutput): string {
  // Show the ID when the group is an OpenAlex entity, so it can be used in a filter
  const id = g.key.startsWith("https://openalex.org/") ? ` [${shortId(g.key)}]` : "";
  return `- ${g.name}${id}: ${num(g.count)} (${percent(g.share)})`;
}
