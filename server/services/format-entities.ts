// Formatters for sources, topics, funders and grouped counts.
import type { Funder, Source, Topic, GroupByResult } from "../types.js";
import type { FunderOutput, GroupOutput, SourceOutput, TopicOutput } from "../output-types.js";
import { num, topicCounts, yearCounts } from "./format-utils.js";
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

// ============================================
// Grouping
// ============================================

export function formatGroups(groups: GroupByResult[], totalWorks: number): GroupOutput[] {
  return groups.map(g => ({
    key: String(g.key),
    name: String(g.key_display_name ?? g.key),
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
