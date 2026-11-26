import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validationMessages,
  isTableResponse,
  parseTable,
  parseEntities,
  formatMeasure,
  tableMarkdown,
  entityLine,
  limitRows
} from "../server/services/format-query.js";

const oneSplit = {
  meta: {
    count: 3729,
    more_groups: false,
    measures: [{ key: "count", oql: "count" }, { key: "mean_cited_by_count", oql: "mean citations" }, { key: "percent_open_access_is_oa", oql: "percent open access" }],
    splits: [{ oql: "year" }]
  },
  summary: { all: { key: "all", count: 3729, mean_cited_by_count: 4.207, percent_open_access_is_oa: 73.4738 } },
  group_by: [
    { key: "2023", key_display_name: "2023", count: 681, mean_cited_by_count: 10.6417, percent_open_access_is_oa: 70 },
    { key: "2024", key_display_name: "2024", count: 710, mean_cited_by_count: null, percent_open_access_is_oa: 75.5 }
  ],
  results: []
};

test("validationMessages reads the fix hints from a refused query", () => {
  const body = JSON.stringify({ validation: { valid: false, errors: [{ type: "parse_error", message: 'unknown entity type "nonsense"  Fix: write `get works ...`' }] } });
  assert.deepEqual(validationMessages(body), ['unknown entity type "nonsense" Fix: write `get works ...`']);
  assert.deepEqual(validationMessages("not json"), []);
  assert.deepEqual(validationMessages("{}"), []);
});

test("a response is a table when it reports measures", () => {
  assert.equal(isTableResponse(oneSplit), true);
  assert.equal(isTableResponse({ meta: { count: 5 }, results: [{ id: "x" }] }), false);
});

test("parseTable reads columns, rows and the whole-set row", () => {
  const table = parseTable(oneSplit);
  assert.deepEqual(table.splits, ["year"]);
  assert.deepEqual(table.measures.map(m => m.label), ["count", "mean citations", "percent open access"]);
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.rows[1].values, { count: 710, mean_cited_by_count: null, percent_open_access_is_oa: 75.5 });
  assert.equal(table.summary?.count, 3729);
  assert.equal(table.more_rows, false);
});

test("parseTable keeps the nested rows of a two-way split and copes with no split", () => {
  const twoSplits = {
    meta: { count: 10, measures: [{ key: "count", oql: "count" }], splits: [{ oql: "country" }, { oql: "year" }], more_groups: true },
    group_by: [{
      key: "https://openalex.org/countries/US", key_display_name: "United States", count: 6,
      groups: [{ key: "2024", key_display_name: "2024", count: 4 }, { key: "2025", key_display_name: "2025", count: 2 }]
    }]
  };
  const table = parseTable(twoSplits);
  assert.deepEqual(table.splits, ["country", "year"]);
  assert.equal(table.rows[0].groups?.length, 2);
  assert.equal(table.rows[0].groups?.[1].values.count, 2);
  assert.equal(table.summary, null);
  assert.equal(table.more_rows, true);

  const noSplit = parseTable({ meta: { count: 5, measures: [{ key: "count", oql: "count" }], splits: [] }, summary: { all: { count: 5 } }, group_by: [] });
  assert.deepEqual(noSplit.rows, []);
  assert.deepEqual(noSplit.summary, { count: 5 });
});

test("formatMeasure shows whole numbers, decimals, percents and missing values", () => {
  assert.equal(formatMeasure({ key: "count", label: "count" }, 21164), "21,164");
  assert.equal(formatMeasure({ key: "mean_fwci", label: "mean FWCI" }, 1.6618), "1.66");
  assert.equal(formatMeasure({ key: "percent_open_access_is_oa", label: "percent open access" }, 73.4738), "73.47%");
  assert.equal(formatMeasure({ key: "mean_fwci", label: "mean FWCI" }, null), "n/a");
});

test("tableMarkdown lists the whole set, then each row with its ID when it is an entity", () => {
  const text = tableMarkdown(parseTable(oneSplit));
  assert.match(text, /^\*\*All works:\*\* count 3,729 · mean citations 4\.21 · percent open access 73\.47%/);
  assert.match(text, /By year:\n- 2023: count 681 · mean citations 10\.64 · percent open access 70%/);
  assert.match(text, /- 2024: count 710 · mean citations n\/a/);

  const nested = tableMarkdown(parseTable({
    meta: { measures: [{ key: "count", oql: "count" }], splits: [{ oql: "country" }, { oql: "year" }] },
    group_by: [{
      key: "https://openalex.org/countries/US", key_display_name: "United States", count: 30,
      groups: Array.from({ length: 12 }, (_, i) => ({ key: String(2010 + i), key_display_name: String(2010 + i), count: i }))
    }]
  }));
  assert.match(nested, /By country, then year:\n- United States \[countries\/US\]: count 30\n  - 2010: count 0/);
  assert.match(nested, /  - and 2 more/);
});

test("parseEntities and entityLine cope with records that lack counts", () => {
  const entities = parseEntities([
    { id: "https://openalex.org/I1", display_name: "Example University", works_count: 1200, cited_by_count: 34000 },
    { id: "https://openalex.org/fields/17", display_name: "Computer Science" }
  ]);
  assert.equal(entityLine(entities[0], 1), "1. **Example University**\n   1,200 works · 34,000 citations · I1");
  assert.equal(entityLine(entities[1], 2), "2. **Computer Science**\n   fields/17");
});

test("limitRows caps rows at every level and says when it cut", () => {
  const row = (key: string, inner = 0) => ({
    key, name: key, values: { count: 1 },
    ...(inner > 0 ? { groups: Array.from({ length: inner }, (_, i) => ({ key: `${key}-${i}`, name: `${i}`, values: { count: 1 } })) } : {})
  });
  const table = { splits: ["country", "year"], measures: [{ key: "count", label: "count" }], rows: [row("a", 5), row("b", 2), row("c"), row("d")], summary: null, more_rows: false };
  const cut = limitRows(table, 3);
  assert.equal(cut.rows.length, 3);
  assert.equal(cut.rows[0].groups?.length, 3);
  assert.equal(cut.rows[1].groups?.length, 2);
  assert.equal(cut.more_rows, true);

  const whole = limitRows(table, 10);
  assert.equal(whole.rows.length, 4);
  assert.equal(whole.more_rows, false);
});
