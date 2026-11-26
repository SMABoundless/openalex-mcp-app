import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeOpenAlexId, shortId, makePagination, extractPagination } from "../server/services/openalex-client.js";
import {
  reconstructAbstract,
  formatWorkJson,
  formatAuthorJson,
  workListEntry,
  workDetailMarkdown,
  listText,
  firstIndex,
  rerankNote,
  libkeyUrl,
  workListShape
} from "../server/services/format-utils.js";
import { ABSTRACT_SNIPPET_LENGTH, CHARACTER_LIMIT, LIST_AUTHORS, WORK_BRIEF_FIELDS, WORK_LIST_FIELDS } from "../server/constants.js";
import type { Author, Work } from "../server/types.js";

// ---------- fixtures ----------

function invertedIndex(text: string): Record<string, number[]> {
  const index: Record<string, number[]> = {};
  text.split(" ").forEach((word, i) => (index[word] ??= []).push(i));
  return index;
}

const LONG_ABSTRACT = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "https://openalex.org/W1",
    doi: "https://doi.org/10.1234/example",
    title: "An Example Work",
    display_name: "An Example Work",
    publication_year: 2021,
    publication_date: "2021-05-01",
    type: "article",
    open_access: { is_oa: true, oa_status: "gold", oa_url: "https://example.org/paper.pdf", any_repository_has_fulltext: false },
    authorships: Array.from({ length: 8 }, (_, i) => ({
      author_position: i === 0 ? "first" : i === 7 ? "last" : "middle",
      author: { id: `https://openalex.org/A${i}`, display_name: `Author ${i}` },
      institutions: [{ id: "https://openalex.org/I1", display_name: "Example University", country_code: "US" }]
    })),
    cited_by_count: 1234,
    cited_by_api_url: "",
    biblio: {},
    primary_location: { is_oa: true, source: { id: "https://openalex.org/S1", display_name: "Journal of Examples", type: "journal", is_oa: true } },
    locations: [],
    abstract_inverted_index: invertedIndex(LONG_ABSTRACT),
    topics: [{ id: "https://openalex.org/T1", display_name: "Example Studies", score: 0.9 }],
    related_works: [],
    referenced_works: ["https://openalex.org/W2", "https://openalex.org/W3"],
    counts_by_year: [],
    ids: {},
    created_date: "",
    updated_date: "",
    ...overrides
  } as Work;
}

// ---------- ID handling ----------

test("normalizeOpenAlexId recognises each identifier type", () => {
  assert.equal(normalizeOpenAlexId("W2741809807"), "https://openalex.org/W2741809807");
  assert.equal(normalizeOpenAlexId("w2741809807"), "https://openalex.org/W2741809807");
  assert.equal(normalizeOpenAlexId(" https://openalex.org/A5023888391 "), "https://openalex.org/A5023888391");
  assert.equal(normalizeOpenAlexId("10.7717/peerj.4375"), "https://doi.org/10.7717/peerj.4375");
  assert.equal(normalizeOpenAlexId("https://doi.org/10.7717/peerj.4375"), "https://doi.org/10.7717/peerj.4375");
  assert.equal(normalizeOpenAlexId("32908142"), "pmid:32908142");
  assert.equal(normalizeOpenAlexId("0000-0002-1825-0097"), "https://orcid.org/0000-0002-1825-0097");
  assert.equal(normalizeOpenAlexId("https://ror.org/000e0be47"), "https://ror.org/000e0be47");
});

test("normalizeOpenAlexId does not treat retired concept IDs as OpenAlex IDs", () => {
  assert.equal(normalizeOpenAlexId("C41008148"), "C41008148");
});

test("shortId strips the OpenAlex URL prefix", () => {
  assert.equal(shortId("https://openalex.org/W123"), "W123");
  assert.equal(shortId("W123"), "W123");
});

// ---------- pagination ----------

test("makePagination reports the next page while more results are reachable", () => {
  assert.deepEqual(makePagination(95, 1, 25, 25), { total: 95, count: 25, page: 1, perPage: 25, hasMore: true, nextPage: 2 });
  assert.equal(makePagination(95, 4, 25, 20).hasMore, false);
});

test("makePagination stops at the 10,000 results OpenAlex paging can reach", () => {
  assert.equal(makePagination(500000, 99, 100, 100).hasMore, true);
  assert.equal(makePagination(500000, 100, 100, 100).hasMore, false);
});

test("extractPagination in cursor mode carries the next cursor and no page number", () => {
  const more = extractPagination({ count: 1624, page: null, per_page: 3, next_cursor: "abc" }, 3, true);
  assert.equal(more.cursorMode, true);
  assert.equal(more.nextCursor, "abc");
  assert.equal(more.hasMore, true);
  assert.equal(more.nextPage, undefined);

  const end = extractPagination({ count: 1624, page: null, per_page: 3, next_cursor: null }, 0, true);
  assert.equal(end.hasMore, false);
  assert.equal(end.nextCursor, undefined);
});

test("firstIndex restarts numbering under cursor paging", () => {
  assert.equal(firstIndex(3, 10, undefined), 20);
  assert.equal(firstIndex(3, 10, "abc"), 0);
});

// ---------- abstracts ----------

test("reconstructAbstract restores word order, including repeated words", () => {
  assert.equal(reconstructAbstract({ the: [0, 2], cat: [1], hat: [3] }), "the cat the hat");
  assert.equal(reconstructAbstract(undefined), null);
  assert.equal(reconstructAbstract({}), null);
});

// ---------- works ----------

test("formatWorkJson returns the full record for a single work", () => {
  const out = formatWorkJson(makeWork());
  assert.equal(out.authors.length, 8);
  assert.equal(out.authors_count, 8);
  assert.equal(out.authors[0].institutions?.[0].name, "Example University");
  assert.equal(out.abstract, LONG_ABSTRACT);
  assert.equal(out.abstract_truncated, false);
  assert.equal(out.source?.name, "Journal of Examples");
  assert.deepEqual(out.open_access, { is_oa: true, status: "gold", url: "https://example.org/paper.pdf" });
  assert.equal(out.referenced_works_count, 2);
});

test("formatWorkJson in compact mode trims authors and abstract but keeps the true author count", () => {
  const out = formatWorkJson(makeWork(), { compact: true });
  assert.equal(out.authors.length, LIST_AUTHORS);
  assert.equal(out.authors_count, 8);
  assert.equal(out.authors[0].institutions, undefined);
  assert.equal(out.abstract_truncated, true);
  assert.ok(out.abstract!.length <= ABSTRACT_SNIPPET_LENGTH + 1);
  assert.ok(out.abstract!.endsWith("…"));
});

test("formatWorkJson prefers referenced_works_count when the list itself was not requested", () => {
  const out = formatWorkJson(makeWork({ referenced_works: undefined as unknown as string[], referenced_works_count: 44 }));
  assert.equal(out.referenced_works_count, 44);
});

test("formatWorkJson tolerates the gaps real records have", () => {
  const out = formatWorkJson(makeWork({
    doi: undefined,
    display_name: null as unknown as string,
    title: null as unknown as string,
    authorships: [],
    primary_location: undefined,
    abstract_inverted_index: undefined,
    topics: undefined,
    publication_year: undefined
  }));
  assert.equal(out.title, "Untitled");
  assert.equal(out.doi, null);
  assert.equal(out.source, null);
  assert.equal(out.abstract, null);
  assert.deepEqual(out.topics, []);
  assert.deepEqual(out.authors, []);
  // Neither formatter should throw on a sparse record
  assert.match(workListEntry(out, 1), /Unknown authors/);
  assert.match(workDetailMarkdown(out), /Untitled/);
});

test("workListEntry gives the model the identifiers it needs for follow-up calls", () => {
  const entry = workListEntry(formatWorkJson(makeWork(), { compact: true }), 7);
  assert.match(entry, /^7\. \*\*An Example Work\*\* \(2021\)/);
  assert.match(entry, /Author 0, Author 1, Author 2, et al\. \(8 authors\)/);
  assert.match(entry, /Journal of Examples · article · cited by 1,234 · OA: gold/);
  assert.match(entry, /https:\/\/doi\.org\/10\.1234\/example · W1/);
});

// ---------- authors ----------

test("formatAuthorJson in compact mode drops the long history fields", () => {
  const author = {
    id: "https://openalex.org/A1",
    display_name: "Ada Example",
    display_name_alternatives: ["A. Example"],
    works_count: 50,
    cited_by_count: 900,
    summary_stats: { "2yr_mean_citedness": 1.5, h_index: 12, i10_index: 15 },
    affiliations: [
      { institution: { id: "https://openalex.org/I1", display_name: "First U" }, years: [2020, 2021] },
      { institution: { id: "https://openalex.org/I2", display_name: "Second U" }, years: [2015] }
    ],
    last_known_institutions: [{ id: "https://openalex.org/I1", display_name: "First U", country_code: "US" }],
    counts_by_year: [{ year: 2021, cited_by_count: 10, works_count: 3 }],
    works_api_url: "", ids: {}, created_date: "", updated_date: ""
  } as Author;

  const full = formatAuthorJson(author);
  assert.equal(full.affiliations.length, 2);
  assert.equal(full.counts_by_year[0].works_count, 3);
  assert.equal(full.h_index, 12);

  const compact = formatAuthorJson(author, { compact: true });
  assert.equal(compact.affiliations.length, 1);
  assert.deepEqual(compact.counts_by_year, []);
  assert.deepEqual(compact.display_name_alternatives, []);
  assert.equal(compact.last_known_institutions[0].name, "First U");
});

// ---------- list text ----------

const page = (hasMore: boolean) => ({ total: 100, count: 3, page: 1, perPage: 3, hasMore, ...(hasMore ? { nextPage: 2 } : {}) });

test("listText returns the empty message when there are no entries", () => {
  const text = listText({ heading: "H", summary: "S", entries: [], pagination: page(false), emptyMessage: "Nothing found." });
  assert.equal(text, "Nothing found.");
});

test("listText tells the model how to get the next page", () => {
  const text = listText({ heading: "H", summary: "S", entries: ["1. a", "2. b"], pagination: page(true), emptyMessage: "" });
  assert.match(text, /^## H\nS\n\n1\. a\n\n2\. b/);
  assert.match(text, /use page=2\.$/);
});

test("listText under cursor paging hands back the cursor", () => {
  const pagination = { total: 100, count: 1, page: 1, perPage: 1, hasMore: true, cursorMode: true, nextCursor: "abc" };
  const text = listText({ heading: "H", summary: "S", entries: ["1. a"], pagination, emptyMessage: "" });
  assert.match(text, /pass cursor="abc"\.$/);
});

test("listText stays under the character limit and never cuts an entry in half", () => {
  const entry = "x".repeat(20000);
  const text = listText({ heading: "H", summary: "S", entries: [entry, entry, entry], pagination: page(false), emptyMessage: "" });
  assert.ok(text.length <= CHARACTER_LIMIT + 200);
  assert.equal(text.split(entry).length - 1, 2);
  assert.match(text, /showing 2 of the 3 results on this page/);
});

test("rerankNote says when re-ranking was applied, and why when it was asked for and was not", () => {
  const base = { requested: true, applied: false, semantic: false, relevanceOrder: true };
  assert.equal(rerankNote({ ...base, requested: false }), "");
  assert.match(rerankNote({ ...base, applied: true }), /^Re-ranked by OpenAlex/);
  assert.match(rerankNote({ ...base, semantic: true }), /semantic search already orders/);
  assert.match(rerankNote({ ...base, relevanceOrder: false }), /another sort was chosen/);
  assert.match(rerankNote(base), /past them/);
});

test("libkeyUrl builds a link from a DOI in either form and refuses anything else", () => {
  assert.equal(libkeyUrl("https://doi.org/10.7717/peerj.4375"), "https://libkey.io/10.7717/peerj.4375");
  assert.equal(libkeyUrl("10.7717/peerj.4375"), "https://libkey.io/10.7717/peerj.4375");
  assert.equal(libkeyUrl(null), null);
  assert.equal(libkeyUrl(""), null);
  assert.equal(libkeyUrl("W2741809807"), null);
  assert.equal(libkeyUrl("https://example.org/not-a-doi"), null);
});

test("the single-work text offers a LibKey link only when the work has a DOI", () => {
  const withDoi = workDetailMarkdown(formatWorkJson(makeWork()));
  assert.match(withDoi, /\(LibKey\):\*\* https:\/\/libkey\.io\/10\.1234\/example/);
  const without = workDetailMarkdown(formatWorkJson(makeWork({ doi: undefined })));
  assert.doesNotMatch(without, /LibKey/);
});

test("brief detail leaves out abstracts and topics, and asks OpenAlex for neither", () => {
  const work = makeWork({ abstract_inverted_index: invertedIndex(LONG_ABSTRACT) });
  const full = formatWorkJson(work, workListShape("full").options);
  const brief = formatWorkJson(work, workListShape("brief").options);
  assert.ok(full.abstract);
  assert.equal(brief.abstract, null);
  assert.equal(brief.abstract_truncated, false);
  assert.deepEqual(brief.topics, []);
  assert.equal(brief.title, full.title);
  assert.deepEqual(brief.authors, full.authors);
  assert.doesNotMatch(workListEntry(brief, 1), /Abstract:/);

  assert.equal(workListShape(undefined).select, WORK_LIST_FIELDS);
  assert.equal(workListShape("brief").select, WORK_BRIEF_FIELDS);
  assert.doesNotMatch(WORK_BRIEF_FIELDS, /abstract_inverted_index|topics/);
});
