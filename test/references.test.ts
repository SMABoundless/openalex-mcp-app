import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseReference,
  normalizeText,
  titleSimilarity,
  yearsIn,
  titleCandidates,
  titleSearchValue,
  judgeSearchCandidate,
  judgeIdentifiedWork,
  bestCandidate,
  titleWithoutNotes,
  titleSaysRetracted
} from "../server/services/references.js";
import { mapLimit, spacedQueue } from "../server/services/concurrency.js";
import type { WorkOutput } from "../server/output-types.js";

const work = (title: string, year: number | null, authors: string[]): WorkOutput => ({
  id: `https://openalex.org/W${title.length}${year ?? 0}`,
  doi: null,
  title,
  publication_year: year,
  publication_date: null,
  type: "article",
  authors: authors.map(name => ({ name, id: "", orcid: null, position: "middle" })),
  authors_count: authors.length,
  source: null,
  cited_by_count: 0,
  open_access: { is_oa: false, status: "closed", url: null },
  abstract: null,
  abstract_truncated: false,
  topics: [],
  referenced_works_count: 0
});

const STATE_OF_OA =
  "Piwowar H, Priem J, Larivière V, et al. The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles. PeerJ. 2018;6:e4375.";

test("parseReference recognises bare identifiers", () => {
  assert.deepEqual(parseReference("10.7717/peerj.4375"), { id: { kind: "doi", value: "10.7717/peerj.4375" }, hasText: false });
  assert.deepEqual(parseReference("https://doi.org/10.7717/peerj.4375"), { id: { kind: "doi", value: "10.7717/peerj.4375" }, hasText: false });
  assert.deepEqual(parseReference(" w2741809807 "), { id: { kind: "openalex_id", value: "W2741809807" }, hasText: false });
  assert.deepEqual(parseReference("https://openalex.org/W2741809807"), { id: { kind: "openalex_id", value: "W2741809807" }, hasText: false });
  assert.deepEqual(parseReference("29456894"), { id: { kind: "pmid", value: "29456894" }, hasText: false });
  assert.deepEqual(parseReference("PMID: 29456894"), { id: { kind: "pmid", value: "29456894" }, hasText: false });
});

test("parseReference picks a DOI out of a citation and drops trailing punctuation", () => {
  const parsed = parseReference(`${STATE_OF_OA} doi:10.7717/peerj.4375.`);
  assert.deepEqual(parsed, { id: { kind: "doi", value: "10.7717/peerj.4375" }, hasText: true });
});

test("parseReference treats a citation without an identifier as text, even with numbers in it", () => {
  assert.deepEqual(parseReference(STATE_OF_OA), { id: null, hasText: true });
  assert.deepEqual(parseReference("Science 122, no. 3159 (1955): 108–11."), { id: null, hasText: true });
});

test("normalizeText removes accents and punctuation", () => {
  assert.equal(normalizeText("Björk, B.-C. & Larivière!"), "bjork b c lariviere");
  assert.equal(titleSearchValue("The state of OA: a large-scale analysis, part|two"), "the state of oa a large scale analysis part two");
});

test("titleSimilarity is the share of the title's words found in the citation", () => {
  assert.equal(titleSimilarity("Anatomy of green open access", "Björk (2014). Anatomy of green open access. JASIST"), 1);
  assert.equal(titleSimilarity("Green open access policies", "Anatomy of green open access"), 0.75);
  assert.equal(titleSimilarity("", "anything"), 0);
});

test("yearsIn finds four-digit years and ignores page and volume numbers", () => {
  assert.deepEqual(yearsIn("Science 122, no. 3159 (1955): 108–11."), [1955]);
  assert.deepEqual(yearsIn("PeerJ. 2018;6:e4375."), [2018]);
  assert.deepEqual(yearsIn("no year here 12345"), []);
});

test("titleCandidates puts the title first across citation styles", () => {
  const first = (citation: string): string => titleCandidates(citation)[0];
  assert.equal(first(STATE_OF_OA), "The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles");
  assert.equal(
    first("Björk, B.-C., Laakso, M., Welling, P., & Paetau, P. (2014). Anatomy of green open access. JASIST, 65(2), 237-250."),
    "Anatomy of green open access"
  );
  assert.equal(
    first('Garfield, Eugene. "Citation Indexes for Science: A New Dimension in Documentation through Association of Ideas." Science 122, no. 3159 (1955): 108–11.'),
    "Citation Indexes for Science: A New Dimension in Documentation through Association of Ideas"
  );
  assert.equal(
    first('[12] J. Priem, H. Piwowar, and R. Orr, "OpenAlex: A fully-open index of scholarly works, authors, venues, institutions, and concepts," arXiv preprint arXiv:2205.01833, 2022.'),
    "OpenAlex: A fully-open index of scholarly works, authors, venues, institutions, and concepts"
  );
  // When the venue is longer than the title, the title is still among the first two
  const vaswani = titleCandidates("Vaswani, A. et al. Attention is all you need. Advances in Neural Information Processing Systems 30 (2017).");
  assert.ok(vaswani.slice(0, 2).includes("Attention is all you need"));
});

test("a search candidate is likely only when title, author and year all agree", () => {
  const right = work("The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles", 2018, ["Heather Piwowar", "Jason Priem"]);
  assert.equal(judgeSearchCandidate(right, STATE_OF_OA).status, "likely");

  const wrongYear = judgeSearchCandidate({ ...right, publication_year: 2011 }, STATE_OF_OA);
  assert.equal(wrongYear.status, "possible");
  assert.match(wrongYear.notes.join(" "), /year differs/);

  const wrongAuthor = judgeSearchCandidate({ ...right, authors: [{ name: "Someone Else", id: "", orcid: null, position: "first" }] }, STATE_OF_OA);
  assert.equal(wrongAuthor.status, "possible");
  assert.match(wrongAuthor.notes.join(" "), /authors is named/);

  // Preprints are often dated a year before the journal version
  assert.equal(judgeSearchCandidate({ ...right, publication_year: 2017 }, STATE_OF_OA).status, "likely");
});

test("a search candidate with a partial or unrelated title is possible or not found", () => {
  const invented = "Jones, A. & Patel, R. (2019). Deep learning for citation recommendation in digital libraries: a randomized trial. Journal of Imaginary Results, 12(3), 45-67.";
  const similar = work("Deep learning in citation recommendation models survey", 2020, ["Zafar Ali"]);
  assert.equal(judgeSearchCandidate(similar, invented).status, "possible");
  const unrelated = work("Quantum social science: a non-mathematical motivation", 2013, ["Emmanuel Haven"]);
  assert.equal(judgeSearchCandidate(unrelated, invented).status, "not_found");
});

test("a very short title cannot be a likely match on its own", () => {
  const short = work("Open access", 2018, ["Heather Piwowar"]);
  const judged = judgeSearchCandidate(short, STATE_OF_OA);
  assert.equal(judged.status, "possible");
  assert.match(judged.notes.join(" "), /very short/);
});

test("a work found by identifier is checked against the citation's title", () => {
  const right = work("The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles", 2018, ["Heather Piwowar"]);
  assert.equal(judgeIdentifiedWork(right, "10.7717/peerj.4375", false).status, "matched");
  assert.equal(judgeIdentifiedWork(right, `${STATE_OF_OA} doi:10.7717/peerj.4375`, true).status, "matched");
  const other = work("Anatomy of green open access", 2014, ["Bo-Christer Björk"]);
  const mismatch = judgeIdentifiedWork(other, `${STATE_OF_OA} doi:10.1002/asi.22963`, true);
  assert.equal(mismatch.status, "possible");
  assert.match(mismatch.notes[0], /does not match the citation/);
});

test("bestCandidate prefers a likely match over a closer-ranked possible one", () => {
  const possible = work("The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles", 2009, ["Other Person"]);
  const likely = work("The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles", 2018, ["Heather Piwowar"]);
  const best = bestCandidate([possible, likely], STATE_OF_OA);
  assert.equal(best?.judgement.status, "likely");
  assert.equal(best?.work.publication_year, 2018);
  assert.equal(bestCandidate([], STATE_OF_OA), null);
});

test("mapLimit keeps order and never runs more than the limit at once", async () => {
  let running = 0;
  let peak = 0;
  const out = await mapLimit([30, 5, 20, 1, 10], 2, async (ms, i) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, ms));
    running--;
    return i;
  });
  assert.deepEqual(out, [0, 1, 2, 3, 4]);
  assert.equal(peak, 2);
  assert.deepEqual(await mapLimit([], 3, async () => 1), []);
});

test("spacedQueue runs tasks in order, spaced apart, and survives a failing task", async () => {
  const queue = spacedQueue(40);
  const starts: number[] = [];
  const run = (fail = false) => queue(async () => {
    starts.push(Date.now());
    if (fail) throw new Error("boom");
    return starts.length;
  });
  const results = await Promise.allSettled([run(), run(true), run()]);
  assert.deepEqual(results.map(r => r.status), ["fulfilled", "rejected", "fulfilled"]);
  assert.ok(starts[1] - starts[0] >= 35, `gap was ${starts[1] - starts[0]}ms`);
  assert.ok(starts[2] - starts[1] >= 35, `gap was ${starts[2] - starts[1]}ms`);
});

const WAKEFIELD =
  "Wakefield AJ, Murch SH, Anthony A, et al. Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children. Lancet. 1998;351(9103):637-641.";
const WAKEFIELD_TITLE = "Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children";

test("retraction notes a publisher attached to a title are ignored when matching, and detected", () => {
  const noted = `${WAKEFIELD_TITLE} (Retracted article. See vol 375, pg 445, 2010)`;
  assert.equal(titleWithoutNotes(noted), WAKEFIELD_TITLE);
  assert.equal(titleWithoutNotes("RETRACTED: A study of things"), "A study of things");
  assert.equal(titleWithoutNotes("Retraction—A study of things"), "A study of things");
  assert.equal(titleWithoutNotes("Retraction in practice (a review)"), "Retraction in practice (a review)");
  assert.equal(titleSaysRetracted(noted), true);
  assert.equal(titleSaysRetracted("RETRACTED: A study of things"), true);
  assert.equal(titleSaysRetracted("Retraction—A study of things"), false);
  assert.equal(titleSaysRetracted("Why papers are retracted"), false);
  assert.equal(titleSimilarity(noted, WAKEFIELD), 1);
});

test("among records with the same title, the one whose authors and year agree wins", () => {
  const letter = work(WAKEFIELD_TITLE, 1998, ["Aderbal Sabrá", "Joseph A. Bellanti"]);
  const notice = work(`Retraction—${WAKEFIELD_TITLE}`, 2010, ["The Lancet"]);
  const original = work(`${WAKEFIELD_TITLE} (Retracted article. See vol 375, pg 445, 2010)`, 1998, ["Andrew J. Wakefield", "SIMON H MURCH"]);
  const best = bestCandidate([notice, letter, original], WAKEFIELD);
  assert.equal(best?.judgement.status, "likely");
  assert.equal(best?.work.authors[0].name, "Andrew J. Wakefield");
});

test("a partial match on only a couple of words is not reported", () => {
  const judged = judgeSearchCandidate(work("Prof. Smith's Paper.", 1894, ["A Person"]), "Smith J. A completely invented paper. doi:10.9999/fake.123");
  assert.equal(judged.status, "not_found");
});

test("between equally good candidates the more cited record is preferred", () => {
  const title = "The state of OA: a large-scale analysis of the prevalence and impact of Open Access articles";
  const minor = { ...work(title, 2018, ["Heather Piwowar"]), id: "https://openalex.org/W1", cited_by_count: 3 };
  const main = { ...work(title, 2018, ["Heather Piwowar"]), id: "https://openalex.org/W2", cited_by_count: 1700 };
  assert.equal(bestCandidate([minor, main], STATE_OF_OA)?.work.id, "https://openalex.org/W2");
});
