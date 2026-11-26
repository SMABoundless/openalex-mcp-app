import { test } from "node:test";
import assert from "node:assert/strict";
import {
  openAccessShare,
  internationalShare,
  yesShare,
  buildAnalysis,
  analysisMarkdown,
  citationStats
} from "../server/services/format-analysis.js";
import type { OpenAlexGroupResponse, Work } from "../server/types.js";

const group = (count: number, rows: [string, string, number][]): OpenAlexGroupResponse => ({
  meta: { count, groups_count: rows.length },
  group_by: rows.map(([key, key_display_name, c]) => ({ key, key_display_name, count: c }))
});

test("openAccessShare counts everything that is not closed", () => {
  const groups = group(100, [["closed", "closed", 40], ["gold", "gold", 35], ["green", "green", 25]]).group_by;
  assert.equal(openAccessShare(groups, 100), 0.6);
  assert.equal(openAccessShare([], 100), null);
  assert.equal(openAccessShare(groups, 0), null);
});

test("internationalShare ignores works with no known country", () => {
  const groups = group(100, [["1", "1", 60], ["0", "0", 20], ["2", "2", 15], ["3", "3", 5]]).group_by;
  assert.deepEqual(internationalShare(groups), { share: 0.25, known: 80 });
  assert.deepEqual(internationalShare(group(5, [["0", "0", 5]]).group_by), { share: null, known: 0 });
});

test("yesShare is taken among works that have a value", () => {
  assert.equal(yesShare(group(100, [["false", "false", 60], ["true", "true", 20]]).group_by), 0.25);
  assert.equal(yesShare([]), null);
});

const parts = {
  groups: {
    year: group(100, [["2024", "2024", 60], ["2023", "2023", 30], ["2030", "2030", 10]]),
    oaStatus: group(100, [["closed", "closed", 40], ["gold", "gold", 60]]),
    author: group(100, [
      ["https://openalex.org/A1", "Ada Example", 9],
      ["https://openalex.org/A2", "Bo Example", 7],
      ["https://openalex.org/A3", "Cy Example", 5],
      ["https://openalex.org/A4", "Di Example", 3]
    ]),
    countriesCount: group(100, [["1", "1", 60], ["2", "2", 20], ["0", "0", 20]]),
    top10: group(100, [["false", "false", 72], ["true", "true", 18]])
  },
  mostCited: [{
    id: "https://openalex.org/W9", display_name: "A Much Cited Paper", publication_year: 2023, type: "article",
    cited_by_count: 500, authorships: [], open_access: { is_oa: true, oa_status: "gold" },
    abstract_inverted_index: { Hidden: [0], abstract: [1] }
  } as unknown as Work]
};

test("buildAnalysis assembles totals, shares and rankings, and names what is missing", () => {
  const a = buildAnalysis(parts, { filter: "topics.id:T1", top: 3, thisYear: 2026 });
  assert.equal(a.total_works, 100);
  assert.equal(a.open_access_share, 0.6);
  assert.equal(a.international_share, 0.25);
  assert.equal(a.works_with_known_countries, 80);
  assert.equal(a.top_10_percent_share, 0.2);
  assert.deepEqual(a.by_year, [{ year: 2023, works_count: 30 }, { year: 2024, works_count: 60 }]);
  assert.deepEqual(a.top_authors.map(g => g.name), ["Ada Example", "Bo Example", "Cy Example"]);
  assert.equal(a.top_authors[0].share, 0.09);
  assert.equal(a.most_cited[0].title, "A Much Cited Paper");
  assert.deepEqual(a.unavailable, ["types", "fields", "topics", "institutions", "countries", "journals and sources", "funders", "citation totals"]);
  assert.equal(a.citations, null);
  assert.equal(a.oql, null);
});

test("the summary text reports the headline figures and leaves abstracts out", () => {
  const text = analysisMarkdown(buildAnalysis(parts, { filter: "topics.id:T1", top: 3, thisYear: 2026 }));
  assert.match(text, /^## Summary of 100 works\nWorks with filter "topics\.id:T1"\./);
  assert.match(text, /\*\*Open access:\*\* 60\.0% \(closed 40\.0%, gold 60\.0%\)/);
  assert.match(text, /\*\*International collaboration:\*\* 25\.0% of the 80 works/);
  assert.match(text, /\*\*Highly cited:\*\* 20\.0%/);
  assert.match(text, /### Top authors\n- Ada Example \[A1\]: 9 \(9\.0%\)/);
  assert.match(text, /### Most cited\n1\. \*\*A Much Cited Paper\*\* \(2023\)/);
  assert.doesNotMatch(text, /Hidden abstract/);
  assert.doesNotMatch(text, /### Top funders/);
  assert.match(text, /Could not be fetched and left out: types, fields/);
});

test("buildAnalysis reports most cited works as missing only when they were not fetched", () => {
  const without = buildAnalysis({ groups: parts.groups }, { top: 3 });
  assert.ok(without.unavailable.includes("most cited works"));
  const empty = buildAnalysis({ groups: parts.groups, mostCited: [] }, { top: 3 });
  assert.ok(!empty.unavailable.includes("most cited works"));
});

test("citationStats reads the whole-set row and tolerates missing numbers", () => {
  assert.deepEqual(
    citationStats({ count: 100, sum_cited_by_count: 480, mean_cited_by_count: 4.8, median_cited_by_count: 1.1, mean_fwci: 1.66 }),
    { total: 480, mean: 4.8, median: 1.1, mean_fwci: 1.66 }
  );
  assert.deepEqual(citationStats({ sum_cited_by_count: 0, mean_fwci: null }), { total: 0, mean: null, median: null, mean_fwci: null });
  assert.equal(citationStats({ count: 5 }), undefined);
  assert.equal(citationStats(undefined), undefined);
});

test("the summary text reports citation totals and the query when they are available", () => {
  const a = buildAnalysis(
    { ...parts, citations: { total: 101590, mean: 4.8001, median: 1.1289, mean_fwci: 1.6618 }, oql: "get works from 2024, most cited first" },
    { top: 3, thisYear: 2026 }
  );
  assert.ok(!a.unavailable.includes("citation totals"));
  const text = analysisMarkdown(a);
  assert.match(text, /\*\*Citations:\*\* 101,590 in total \(mean 4\.8, median 1\.1 per work\)/);
  assert.match(text, /\*\*Field-weighted citation impact:\*\* 1\.66 on average/);
  assert.match(text, /Query in OQL \(paste into the OQL tab at openalex\.org to rerun or export it\): get works from 2024, most cited first$/);
});
