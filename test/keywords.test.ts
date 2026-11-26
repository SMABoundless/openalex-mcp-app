import { test } from "node:test";
import assert from "node:assert/strict";
import {
  keywordSlug,
  textProblem,
  cleanParts,
  partClause,
  filterClauses,
  buildKeywordQueries,
  sampleQuery,
  restrictToWorks,
  partQuery,
  diagnoseSeeds
} from "../server/services/keywords.js";

test("keywordSlug accepts a full ID, a prefixed ID or a bare slug", () => {
  assert.equal(keywordSlug("https://openalex.org/keywords/citation-analysis"), "citation-analysis");
  assert.equal(keywordSlug("keywords/Citation-Analysis"), "citation-analysis");
  assert.equal(keywordSlug(" bibliometrics "), "bibliometrics");
});

test("textProblem catches words that would break the query", () => {
  assert.equal(textProblem('"citation chaining" or snowballing or (a and b)'), null);
  assert.match(textProblem('"citation chaining or snowballing') ?? "", /unmatched double quote/);
  assert.match(textProblem("(citation or snowballing") ?? "", /unclosed parenthesis/);
  assert.match(textProblem("citation) or (snowballing") ?? "", /closing parenthesis/);
  assert.match(textProblem("kelp; then, sample 5") ?? "", /semicolons/);
});

test("cleanParts normalises parts and rejects an empty part or a malformed keyword ID", () => {
  const ok = cleanParts([
    { label: " method ", text: " snowballing ", keyword_ids: ["keywords/Citation-Searching", "citation-searching"] },
    { label: "setting", keyword_ids: ["https://openalex.org/keywords/systematic-reviews"] }
  ]);
  assert.equal(ok.problem, null);
  assert.deepEqual(ok.parts, [
    { label: "method", text: "snowballing", keywordIds: ["citation-searching"] },
    { label: "setting", text: null, keywordIds: ["systematic-reviews"] }
  ]);
  assert.match(cleanParts([{ label: "empty", text: "  " }]).problem ?? "", /neither words nor keywords/);
  assert.match(cleanParts([{ label: "bad", keyword_ids: ["citation analysis)"] }]).problem ?? "", /not a keyword ID/);
  assert.match(cleanParts([{ label: "quote", text: '"open' }]).problem ?? "", /unmatched double quote/);
});

const method = { label: "method", text: '"citation chaining" or snowballing', keywordIds: ["citation-searching", "snowballing"] };
const setting = { label: "setting", text: '"systematic review"', keywordIds: [] };
const subject = { label: "subject", text: null, keywordIds: ["bibliometrics"] };

test("partClause joins a part's words and keywords with or", () => {
  assert.equal(partClause(method, "text"), 'title-abstract-keywords has ("citation chaining" or snowballing)');
  assert.equal(partClause(method, "keywords"), "keyword is (citation-searching or snowballing)");
  assert.equal(
    partClause(method, "either"),
    '(title-abstract-keywords has ("citation chaining" or snowballing) or keyword is (citation-searching or snowballing))'
  );
  assert.equal(partClause(setting, "either"), 'title-abstract-keywords has ("systematic review")');
  assert.equal(partClause(setting, "keywords"), null);
  assert.equal(partClause(subject, "either"), "keyword is (bibliometrics)");
  assert.equal(partClause(subject, "text"), null);
});

test("filterClauses writes each filter as a condition and in words", () => {
  assert.deepEqual(filterClauses({}), { oql: [], words: [] });
  const all = filterClauses({ from_year: 2015, to_year: 2024, types: ["article", "review"], open_access_only: true, language: "en" });
  assert.deepEqual(all.oql, ["year >= (2015)", "year <= (2024)", "type is (article or review)", "open access is (true)", "language is (en)"]);
  assert.deepEqual(all.words, ["from 2015", "to 2024", "type: article, review", "open access only", "language: en"]);
  assert.deepEqual(filterClauses({ open_access_only: false, types: [] }).oql, []);
});

test("buildKeywordQueries requires every part and applies the filters to each query", () => {
  const q = buildKeywordQueries([method, setting], { from_year: 2020 });
  assert.equal(
    q.combined,
    'get works where (title-abstract-keywords has ("citation chaining" or snowballing) or keyword is (citation-searching or snowballing)) ' +
    'and title-abstract-keywords has ("systematic review") and year >= (2020)'
  );
  assert.equal(
    q.textOnly,
    'get works where title-abstract-keywords has ("citation chaining" or snowballing) and title-abstract-keywords has ("systematic review") and year >= (2020)'
  );
  assert.equal(q.perPart[0].keywords, "get works where keyword is (citation-searching or snowballing) and year >= (2020)");
  assert.equal(q.perPart[1].keywords, null);
  assert.equal(q.perPart[1].text, q.perPart[1].either);
});

test("the words-only query is left out when a part has no words or no part has keywords", () => {
  assert.equal(buildKeywordQueries([method, subject], {}).textOnly, null);
  assert.equal(buildKeywordQueries([setting], {}).textOnly, null);
  assert.equal(buildKeywordQueries([setting], {}).combined, 'get works where title-abstract-keywords has ("systematic review")');
});

test("sampleQuery appends the random-sample step", () => {
  assert.equal(sampleQuery("get works where keyword is (bibliometrics)", 5), "get works where keyword is (bibliometrics) sample 5");
});

test("restrictToWorks narrows a query to the given works, and partQuery leaves the filters off", () => {
  assert.equal(
    restrictToWorks("get works where keyword is (bibliometrics) and year >= (2020)", ["W1", "W2"]),
    "get works where keyword is (bibliometrics) and year >= (2020) and openalex id is (W1 or W2)"
  );
  assert.equal(partQuery(subject), "get works where keyword is (bibliometrics)");
  assert.equal(
    partQuery(method),
    'get works where (title-abstract-keywords has ("citation chaining" or snowballing) or keyword is (citation-searching or snowballing))'
  );
});

test("diagnoseSeeds names the parts a missed seed fails, or says a filter excluded it", () => {
  const out = diagnoseSeeds(
    ["W1", "W2", "W3", "W4"],
    new Set(["W1"]),
    [method, setting],
    [new Set(["W2", "W4"]), new Set(["W3", "W4"])]
  );
  assert.deepEqual(out, [
    { id: "W1", found: true, missingParts: [], excludedByFilters: false },
    { id: "W2", found: false, missingParts: ["setting"], excludedByFilters: false },
    { id: "W3", found: false, missingParts: ["method"], excludedByFilters: false },
    { id: "W4", found: false, missingParts: [], excludedByFilters: true }
  ]);
  const neither = diagnoseSeeds(["W9"], new Set(), [method, setting], [new Set(), new Set()]);
  assert.deepEqual(neither[0].missingParts, ["method", "setting"]);
});
