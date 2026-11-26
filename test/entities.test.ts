import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOpenAlexId } from "../server/services/openalex-client.js";
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
  percent
} from "../server/services/format-entities.js";
import type { Funder, Source, Topic } from "../server/types.js";

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
