import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, markupToText, teiTitle, teiBodyText, truncateText } from "../server/services/text.js";
import {
  elifeReviewRef,
  isReviewCommonsDoi,
  bareDoi,
  findElifeReview,
  findReviewCommonsReview,
  preprintDoiFromRedirect,
  judgeStoredText
} from "../server/services/review-text.js";
import { queryOql } from "../server/services/openalex-client.js";

test("decodeEntities handles named, decimal and hexadecimal entities and leaves unknown ones", () => {
  assert.equal(decodeEntities("Smith &amp; Jones &lt;2020&gt; &quot;x&quot; &#233; &#xe9; &bogus;"), 'Smith & Jones <2020> "x" é é &bogus;');
});

test("markupToText keeps paragraph breaks and drops tags, scripts and extra space", () => {
  const html = "<div><p>First   paragraph <b>bold</b>.</p><p>Second<br/>line.</p><script>alert(1)</script></div>";
  assert.equal(markupToText(html), "First paragraph bold .\n\nSecond\nline.");
});

const tei = (title: string, body: string): string =>
  `<TEI><teiHeader><titleStmt><title level="a" type="main">${title}</title></titleStmt></teiHeader><text><body>${body}</body></text></TEI>`;

test("teiTitle and teiBodyText read a TEI document, including an empty one", () => {
  const doc = tei("A &quot;quoted&quot; title", "<div><head>Intro</head><p>Some text.</p></div>");
  assert.equal(teiTitle(doc), 'A "quoted" title');
  assert.equal(teiBodyText(doc), "Intro\n\nSome text.");
  assert.equal(teiBodyText("<TEI><text><body/></text></TEI>"), "");
  assert.equal(teiTitle("<TEI></TEI>"), "");
});

test("truncateText cuts at a boundary and reports that it cut", () => {
  assert.deepEqual(truncateText("short", 100), { text: "short", truncated: false });
  const cut = truncateText("word ".repeat(100), 52);
  assert.equal(cut.truncated, true);
  assert.ok(cut.text.length <= 53);
  assert.ok(cut.text.endsWith("word…"));
});

test("review DOIs from eLife and Review Commons are recognised, others are not", () => {
  assert.deepEqual(elifeReviewRef("https://doi.org/10.7554/eLife.106896.2.sa3"), { article: "106896", version: "2" });
  assert.equal(elifeReviewRef("10.7554/elife.05005.028"), null);
  assert.equal(elifeReviewRef("10.7554/eLife.106896"), null);
  assert.equal(elifeReviewRef(null), null);
  assert.equal(isReviewCommonsDoi("https://doi.org/10.15252/rc.2023484681"), true);
  assert.equal(isReviewCommonsDoi("10.15252/embj.2023484681"), false);
  assert.equal(bareDoi("HTTPS://DOI.ORG/10.7554/eLife.1"), "10.7554/elife.1");
});

test("findElifeReview picks the review with the matching DOI and converts its HTML", () => {
  const record = {
    article: {
      peerReview: {
        evaluationSummary: { doi: "10.7554/eLife.1.2.sa4", text: "<p>Assessment.</p>" },
        reviews: [
          { doi: "10.7554/eLife.1.2.sa3", text: "<p>Reviewer #1.</p><p>Convincing.</p>" },
          { doi: "10.7554/eLife.1.2.sa2", text: "<p>Reviewer #2.</p>" }
        ],
        authorResponse: { doi: "10.7554/eLife.1.2.sa0", text: "<p>We thank the reviewers.</p>" }
      }
    }
  };
  assert.equal(findElifeReview(record, "https://doi.org/10.7554/elife.1.2.sa3"), "Reviewer #1.\n\nConvincing.");
  assert.equal(findElifeReview(record, "10.7554/eLife.1.2.sa4"), "Assessment.");
  assert.equal(findElifeReview(record, "10.7554/eLife.1.2.sa0"), "We thank the reviewers.");
  assert.equal(findElifeReview(record, "10.7554/eLife.1.2.sa9"), null);
  assert.equal(findElifeReview({ article: {} }, "10.7554/eLife.1.2.sa3"), null);
  assert.equal(findElifeReview(null, "10.7554/eLife.1.2.sa3"), null);
});

test("findReviewCommonsReview reads reviews and the author reply from a preprint record", () => {
  const record = [{
    review_process: {
      reviews: [{ doi: "10.15252/rc.111", text: "**Note:** review one" }, { doi: "10.15252/rc.222", text: "review two" }],
      response: { doi: "10.15252/rc.333", text: "author reply" },
      annot: []
    }
  }];
  assert.equal(findReviewCommonsReview(record, "https://doi.org/10.15252/RC.222"), "review two");
  assert.equal(findReviewCommonsReview(record, "10.15252/rc.333"), "author reply");
  assert.equal(findReviewCommonsReview(record, "10.15252/rc.999"), null);
  assert.equal(findReviewCommonsReview([], "10.15252/rc.111"), null);
});

test("preprintDoiFromRedirect accepts only an Early Evidence Base preprint address", () => {
  assert.equal(preprintDoiFromRedirect("https://eeb.embo.org/doi/10.1101/2022.12.01.518663#rev0-ar"), "10.1101/2022.12.01.518663");
  assert.equal(preprintDoiFromRedirect("https://evil.example/doi/10.1101/2022.12.01.518663"), null);
  assert.equal(preprintDoiFromRedirect("http://eeb.embo.org/doi/10.1101/2022.12.01.518663"), null);
  assert.equal(preprintDoiFromRedirect("https://eeb.embo.org/somewhere/else"), null);
  assert.equal(preprintDoiFromRedirect("not a url"), null);
  assert.equal(preprintDoiFromRedirect(null), null);
});

test("judgeStoredText rejects an empty file and one that is the reviewed article", () => {
  const reviewed = "Human giant GTPase GVIN1 forms an antimicrobial coatomer around the intracellular bacterial pathogen";
  const long = "A sentence of the text. ".repeat(20);

  const empty = judgeStoredText("<TEI><text><body/></text></TEI>", reviewed);
  assert.equal(empty.text, null);
  assert.match(empty.problem ?? "", /empty/);

  const article = judgeStoredText(tei(reviewed, `<p>${long}</p>`), reviewed);
  assert.equal(article.text, null);
  assert.match(article.problem ?? "", /reviewed article, not the review/);

  const review = judgeStoredText(tei("", `<p>Review of the paper. ${long}</p>`), reviewed);
  assert.equal(review.problem, null);
  assert.match(review.text ?? "", /^Review of the paper\./);

  const titled = judgeStoredText(tei("Review of: a study of things", `<p>${long}</p>`), reviewed);
  assert.equal(titled.problem, null);
});

test("queryOql returns the echoed query on one line, or null when there is none", () => {
  assert.equal(queryOql({ x_query: { oql: "get works where x;\nthen, group those works by y" } }), "get works where x; then, group those works by y");
  assert.equal(queryOql({ x_query: { oql: "  " } }), null);
  assert.equal(queryOql({ x_query: null }), null);
  assert.equal(queryOql({}), null);
  assert.equal(queryOql(undefined), null);
});
