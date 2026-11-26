import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOpenAlexId, pmcidOf } from "../server/services/openalex-client.js";
import {
  formatSourceJson,
  sourceListEntry,
  sourceDetailMarkdown,
  formatTopicJson,
  topicListEntry,
  formatFunderJson,
  funderListEntry,
  formatGroups,
  groupsAreYears,
  groupLine,
  percent,
  worksByYear,
  formatTopicDetailJson,
  topicDetailMarkdown,
  formatFunderDetailJson,
  funderDetailMarkdown,
  formatPublisherJson,
  formatPublisherDetailJson,
  publisherListEntry,
  publisherDetailMarkdown,
  resolveGroupBy,
  groupsAreBoolean
} from "../server/services/format-entities.js";
import type { Funder, Publisher, Source, Topic } from "../server/types.js";

const source = {
  id: "https://openalex.org/S1",
  issn_l: "2167-8359",
  issn: ["2167-8359"],
  display_name: "Journal of Examples",
  host_organization_name: "Example Press",
  type: "journal",
  is_oa: true,
  is_in_doaj: true,
  country_code: "US",
  homepage_url: "https://example.org",
  works_count: 58687,
  cited_by_count: 538430,
  summary_stats: { "2yr_mean_citedness": 3.92, h_index: 186, i10_index: 100 },
  topics: [{ id: "https://openalex.org/T1", display_name: "Example Studies", count: 30, field: { id: "f", display_name: "Field" }, domain: { id: "d", display_name: "Domain" } }],
  counts_by_year: [{ year: 2024, works_count: 10, cited_by_count: 99 }],
  apc_usd: 1395,
  works_api_url: "", ids: {}, created_date: "", updated_date: ""
} as unknown as Source;

test("normalizeOpenAlexId recognises an ISSN and does not mistake it for an ORCID or PMID", () => {
  assert.equal(normalizeOpenAlexId("2167-8359"), "issn:2167-8359");
  assert.equal(normalizeOpenAlexId("2296-701x"), "issn:2296-701X");
  assert.equal(normalizeOpenAlexId("0000-0002-1825-0097"), "https://orcid.org/0000-0002-1825-0097");
  assert.equal(normalizeOpenAlexId("S1983995261"), "https://openalex.org/S1983995261");
});

test("formatSourceJson keeps breakdowns for a single source and drops them in lists", () => {
  const full = formatSourceJson(source);
  assert.equal(full.publisher, "Example Press");
  assert.equal(full.h_index, 186);
  assert.equal(full.top_topics[0].name, "Example Studies");
  assert.equal(full.counts_by_year[0].works_count, 10);

  const compact = formatSourceJson(source, { compact: true });
  assert.deepEqual(compact.top_topics, []);
  assert.deepEqual(compact.counts_by_year, []);
  assert.equal(compact.apc_usd, 1395);
});

test("source text reports access and charges, including a zero charge and an unknown one", () => {
  const paid = formatSourceJson(source, { compact: true });
  assert.match(sourceListEntry(paid, 1), /open access \(in DOAJ\) · APC \$1,395/);
  assert.match(sourceListEntry(paid, 1), /S1 · ISSN 2167-8359/);
  assert.match(sourceDetailMarkdown(paid), /\*\*Article processing charge:\*\* \$1,395/);

  const free = formatSourceJson({ ...source, apc_usd: 0 } as Source);
  assert.match(sourceListEntry(free, 1), /no APC/);
  assert.match(sourceDetailMarkdown(free), /\*\*Article processing charge:\*\* none/);

  const unknown = formatSourceJson({ ...source, apc_usd: undefined, is_oa: false, is_in_doaj: false } as Source);
  assert.doesNotMatch(sourceListEntry(unknown, 1), /APC/);
  assert.match(sourceListEntry(unknown, 1), /not fully open access/);
});

test("formatTopicJson flattens the hierarchy and limits keywords", () => {
  const topic = {
    id: "https://openalex.org/T10102",
    display_name: "Bibliometrics",
    description: "About counting papers.",
    keywords: Array.from({ length: 20 }, (_, i) => ({ id: `k${i}`, display_name: `keyword ${i}` })),
    subfield: { id: "s", display_name: "Library and Information Sciences" },
    field: { id: "f", display_name: "Social Sciences" },
    domain: { id: "d", display_name: "Social Sciences" },
    works_count: 204123,
    cited_by_count: 2278296
  } as unknown as Topic;
  const out = formatTopicJson(topic);
  assert.equal(out.keywords.length, 8);
  assert.equal(out.subfield, "Library and Information Sciences");
  const entry = topicListEntry(out, 2);
  assert.match(entry, /^2\. \*\*Bibliometrics\*\*/);
  assert.match(entry, /Social Sciences > Social Sciences > Library and Information Sciences/);
  assert.match(entry, /204,123 works · 2,278,296 citations · T10102/);
});

test("formatFunderJson tolerates missing optional fields", () => {
  const out = formatFunderJson({ id: "https://openalex.org/F1", display_name: "Example Fund", works_count: 5, cited_by_count: 9 } as Funder);
  assert.equal(out.ror, null);
  assert.equal(out.awards_count, null);
  assert.deepEqual(out.alternate_titles, []);
  const entry = funderListEntry(out, 1);
  assert.match(entry, /5 funded works · 9 citations/);
  assert.doesNotMatch(entry, /awards/);
});

test("formatGroups computes each group's share of the total", () => {
  const groups = formatGroups(
    [{ key: "closed", key_display_name: "closed", count: 30 }, { key: "gold", key_display_name: "gold", count: 10 }],
    40
  );
  assert.deepEqual(groups.map(g => g.share), [0.75, 0.25]);
  assert.equal(formatGroups([{ key: "x", key_display_name: "x", count: 0 }], 0)[0].share, 0);
});

test("groupsAreYears is true only when every key is a year", () => {
  const g = (key: string) => ({ key, name: key, count: 1, share: 0 });
  assert.equal(groupsAreYears([g("2020"), g("2021")]), true);
  assert.equal(groupsAreYears([g("2020"), g("unknown")]), false);
  assert.equal(groupsAreYears([]), false);
});

test("groupLine includes an OpenAlex ID only for entity groups", () => {
  assert.equal(
    groupLine({ key: "https://openalex.org/S148561398", name: "Scientometrics", count: 7942, share: 0.0225 }),
    "- Scientometrics [S148561398]: 7,942 (2.3%)"
  );
  assert.equal(groupLine({ key: "gold", name: "gold", count: 10, share: 0.25 }), "- gold: 10 (25.0%)");
});

test("percent does not round a small non-zero share down to zero", () => {
  assert.equal(percent(0.0004), "<0.1%");
  assert.equal(percent(0), "0.0%");
  assert.equal(percent(1), "100.0%");
});

test("normalizeOpenAlexId accepts topic, funder and publisher IDs", () => {
  assert.equal(normalizeOpenAlexId("t10102"), "https://openalex.org/T10102");
  assert.equal(normalizeOpenAlexId("F4320306076"), "https://openalex.org/F4320306076");
  assert.equal(normalizeOpenAlexId("P4310320990"), "https://openalex.org/P4310320990");
  assert.equal(normalizeOpenAlexId("https://ror.org/021nxhr62"), "https://ror.org/021nxhr62");
});

test("worksByYear sorts oldest first, keeps the most recent years and drops future and invalid years", () => {
  const groups = [
    { key: "2024", key_display_name: "2024", count: 30 },
    { key: "2022", key_display_name: "2022", count: 10 },
    { key: "2027", key_display_name: "2027", count: 2 },
    { key: "2023", key_display_name: "2023", count: 20 },
    { key: "unknown", key_display_name: "unknown", count: 5 }
  ];
  assert.deepEqual(worksByYear(groups, 2, 2026), [
    { year: 2023, works_count: 20 },
    { year: 2024, works_count: 30 }
  ]);
  assert.deepEqual(worksByYear(undefined, 15, 2026), []);
});

test("a topic profile keeps every keyword and lists neighbouring topics with their IDs", () => {
  const topic = {
    id: "https://openalex.org/T10102",
    display_name: "Bibliometrics",
    keywords: Array.from({ length: 20 }, (_, i) => ({ id: `k${i}`, display_name: `keyword ${i}` })),
    subfield: { id: "s", display_name: "Library and Information Sciences" },
    field: { id: "f", display_name: "Social Sciences" },
    domain: { id: "d", display_name: "Social Sciences" },
    siblings: Array.from({ length: 12 }, (_, i) => ({ id: `https://openalex.org/T${i + 1}`, display_name: `Sibling ${i + 1}` })),
    ids: { wikipedia: "https://en.wikipedia.org/wiki/Bibliometrics" },
    works_count: 100,
    cited_by_count: 200
  } as unknown as Topic;
  const out = formatTopicDetailJson(topic, [{ year: 2024, works_count: 30 }]);
  assert.equal(out.keywords.length, 20);
  assert.equal(out.siblings.length, 12);
  const text = topicDetailMarkdown(out);
  assert.match(text, /\*\*Works per year:\*\* 2024: 30/);
  assert.match(text, /Sibling 1 \[T1\]; .*Sibling 10 \[T10\]; and 2 more/);
  assert.match(text, /filter "topics\.id:T10102"/);

  const bare = formatTopicDetailJson({ ...topic, siblings: undefined, ids: undefined } as unknown as Topic);
  assert.deepEqual(bare.works_by_year, []);
  assert.equal(bare.wikipedia_url, null);
  assert.doesNotMatch(topicDetailMarkdown(bare), /Works per year|Other topics/);
});

test("a funder profile leaves its own record out of the other roles", () => {
  const funder = {
    id: "https://openalex.org/F1",
    display_name: "Example Fund",
    alternate_titles: ["EF", "ExFund", "Ex. Fund", "The Fund", "Fund E", "Sixth Name"],
    works_count: 5,
    cited_by_count: 9,
    summary_stats: { "2yr_mean_citedness": 1.5, h_index: 3, i10_index: 1 },
    counts_by_year: [{ year: 2024, works_count: 2, cited_by_count: 4 }, { year: 2025, works_count: 3, cited_by_count: 5 }],
    roles: [
      { role: "funder", id: "https://openalex.org/F1", works_count: 5 },
      { role: "institution", id: "https://openalex.org/I7", works_count: 40 }
    ]
  } as unknown as Funder;
  const out = formatFunderDetailJson(funder);
  assert.equal(out.alternate_titles.length, 6);
  assert.deepEqual(out.other_roles, [{ role: "institution", id: "https://openalex.org/I7", works_count: 40 }]);
  const text = funderDetailMarkdown(out);
  assert.match(text, /\*\*Funded works per year:\*\* 2025: 3 · 2024: 2/);
  assert.match(text, /\*\*Also in OpenAlex as:\*\* institution \[I7\]/);
  assert.match(text, /filter "funders\.id:F1"/);

  const longHistory = Array.from({ length: 40 }, (_, i) => ({ year: 1985 + i, works_count: i, cited_by_count: 0 }));
  const trimmed = formatFunderDetailJson({ ...funder, counts_by_year: longHistory } as unknown as Funder);
  assert.equal(trimmed.counts_by_year.length, 15);
  assert.equal(trimmed.counts_by_year[0].year, 2024);
  assert.equal(trimmed.counts_by_year[14].year, 2010);

  const bare = formatFunderDetailJson({ id: "https://openalex.org/F2", display_name: "Bare", works_count: 0, cited_by_count: 0 } as Funder);
  assert.deepEqual(bare.other_roles, []);
  assert.deepEqual(bare.counts_by_year, []);
  assert.equal(bare.h_index, null);
});

const publisher = {
  id: "https://openalex.org/P2",
  display_name: "Imprint Press",
  alternate_titles: Array.from({ length: 14 }, (_, i) => `Name ${i + 1}`),
  hierarchy_level: 1,
  parent_publisher: { id: "https://openalex.org/P1", display_name: "Parent Group" },
  country_codes: ["US"],
  homepage_url: "https://example.org",
  works_count: 1000,
  cited_by_count: 5000,
  summary_stats: { "2yr_mean_citedness": 2.345, h_index: 50, i10_index: 10 },
  ids: { ror: null },
  counts_by_year: [{ year: 2025, works_count: 100, cited_by_count: 900 }],
  roles: [{ role: "publisher", id: "https://openalex.org/P2", works_count: 1000 }]
} as unknown as Publisher;

test("formatPublisherJson shortens long fields in lists and keeps them for a single publisher", () => {
  const compact = formatPublisherJson(publisher, { compact: true });
  assert.equal(compact.alternate_titles.length, 5);
  assert.deepEqual(compact.counts_by_year, []);
  assert.deepEqual(compact.parent, { id: "https://openalex.org/P1", name: "Parent Group" });
  assert.equal(compact.ror, null);
  const entry = publisherListEntry(compact, 3);
  assert.match(entry, /^3\. \*\*Imprint Press\*\*/);
  assert.match(entry, /part of Parent Group · US/);
  assert.match(entry, /1,000 works · 5,000 citations · h-index 50/);

  const full = formatPublisherJson(publisher);
  assert.equal(full.alternate_titles.length, 14);
  assert.equal(full.counts_by_year[0].works_count, 100);
  assert.deepEqual(full.other_roles, []);

  const topLevel = formatPublisherJson({ id: "https://openalex.org/P9", display_name: "Solo", works_count: 1, cited_by_count: 0 } as Publisher);
  assert.equal(topLevel.parent, null);
  assert.equal(topLevel.hierarchy_level, 0);
});

test("a publisher profile lists its largest sources, and works without them", () => {
  const sources = {
    count: 42,
    top: [{ id: "https://openalex.org/S5", display_name: "Journal of Examples", type: "journal", is_oa: true, works_count: 300, cited_by_count: 700 } as unknown as Source]
  };
  const withSources = formatPublisherDetailJson(publisher, sources);
  assert.equal(withSources.sources_count, 42);
  const text = publisherDetailMarkdown(withSources);
  assert.match(text, /\*\*Part of:\*\* Parent Group \[P1\]/);
  assert.match(text, /Name 10; and 4 more/);
  assert.match(text, /\*\*Sources published:\*\* 42/);
  assert.match(text, /- Journal of Examples \[S5\]: journal · 300 works · open access/);
  assert.match(text, /publisher_lineage:P2/);

  const without = formatPublisherDetailJson(publisher);
  assert.equal(without.sources_count, null);
  assert.deepEqual(without.top_sources, []);
  assert.doesNotMatch(publisherDetailMarkdown(without), /Sources published|Largest sources/);
});

test("resolveGroupBy maps short names to OpenAlex fields and passes other fields through", () => {
  assert.deepEqual(resolveGroupBy("publisher"), { field: "primary_location.source.publisher_lineage", label: "publisher" });
  assert.deepEqual(resolveGroupBy(" Year "), { field: "publication_year", label: "year" });
  assert.deepEqual(resolveGroupBy("publication_year"), { field: "publication_year", label: "year" });
  assert.deepEqual(resolveGroupBy("has_fulltext"), { field: "has_fulltext", label: "has_fulltext" });
});

test("yes/no groups are named Yes and No and recognised as boolean", () => {
  const groups = formatGroups(
    [{ key: "false", key_display_name: "false", count: 30 }, { key: "true", key_display_name: "true", count: 10 }],
    50
  );
  assert.deepEqual(groups.map(g => g.name), ["No", "Yes"]);
  assert.equal(groupsAreBoolean(groups), true);
  assert.equal(groupsAreBoolean([{ key: "gold", name: "gold", count: 1, share: 1 }]), false);
  assert.equal(groupsAreBoolean([]), false);
});

test("normalizeOpenAlexId accepts a PMCID in its usual forms and leaves a PMID alone", () => {
  assert.equal(normalizeOpenAlexId("PMC5815332"), "pmcid:PMC5815332");
  assert.equal(normalizeOpenAlexId("pmc5815332"), "pmcid:PMC5815332");
  assert.equal(normalizeOpenAlexId("pmcid:PMC5815332"), "pmcid:PMC5815332");
  assert.equal(normalizeOpenAlexId("https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5815332/"), "pmcid:PMC5815332");
  assert.equal(normalizeOpenAlexId("https://pmc.ncbi.nlm.nih.gov/articles/PMC5815332"), "pmcid:PMC5815332");
  assert.equal(normalizeOpenAlexId("29456894"), "pmid:29456894");
  assert.equal(pmcidOf("PMC12"), null);
  assert.equal(pmcidOf("W2741809807"), null);
  assert.equal(pmcidOf("see PMC5815332 for details"), null);
});
