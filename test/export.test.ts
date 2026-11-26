import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toExportRecord,
  surnameFirst,
  risType,
  toRis,
  texEscape,
  bibtexKey,
  bibtexType,
  toBibtex,
  csvCell,
  toCsv,
  CSV_COLUMNS,
  dedupeRecords,
  exportFile,
  groupIdentifiers,
  summariseRepeats,
  bareDoi,
  type ExportRecord
} from "../server/services/export.js";
import type { Work } from "../server/types.js";

const record = (overrides: Partial<ExportRecord> = {}): ExportRecord => ({
  id: "W2741809807",
  doi: "10.7717/peerj.4375",
  pmid: "29456894",
  title: "The state of OA: a large-scale analysis",
  authors: ["Heather Piwowar", "Vincent Larivière"],
  type: "article",
  source: "PeerJ",
  year: 2018,
  date: "2018-02-13",
  volume: "6",
  issue: null,
  firstPage: "e4375",
  lastPage: "e4375",
  language: "en",
  abstract: "Despite growing interest\nin Open Access.",
  url: "https://doi.org/10.7717/peerj.4375",
  citedByCount: 1772,
  oaStatus: "gold",
  ...overrides
});

test("toExportRecord reads an OpenAlex work, with and without abstracts", () => {
  const work = {
    id: "https://openalex.org/W1",
    doi: "https://doi.org/10.1234/ABC",
    display_name: "A Title",
    type: "article",
    publication_year: 2020,
    publication_date: "2020-05-01",
    authorships: [{ author: { display_name: "Ada Lovelace" } }, { author: { display_name: "" } }],
    primary_location: { source: { display_name: "Journal of Examples" }, landing_page_url: "https://example.org/a" },
    biblio: { volume: "3", issue: "2", first_page: "10", last_page: "20" },
    ids: { pmid: "https://pubmed.ncbi.nlm.nih.gov/12345678" },
    language: "en",
    abstract_inverted_index: { Two: [0], words: [1] },
    cited_by_count: 7,
    open_access: { oa_status: "green" }
  } as unknown as Work;
  const full = toExportRecord(work, { abstracts: true });
  assert.equal(full.id, "W1");
  assert.equal(full.doi, "10.1234/ABC");
  assert.equal(full.pmid, "12345678");
  assert.deepEqual(full.authors, ["Ada Lovelace"]);
  assert.equal(full.abstract, "Two words");
  assert.equal(full.url, "https://doi.org/10.1234/ABC");
  assert.equal(toExportRecord(work, { abstracts: false }).abstract, null);

  const bare = toExportRecord({ id: "https://openalex.org/W2", display_name: "No DOI" } as unknown as Work, { abstracts: true });
  assert.equal(bare.doi, null);
  assert.equal(bare.url, "https://openalex.org/W2");
  assert.deepEqual(bare.authors, []);
});

test("surnameFirst handles plain names, particles, suffixes and names it should leave alone", () => {
  assert.equal(surnameFirst("Heather Piwowar"), "Piwowar, Heather");
  assert.equal(surnameFirst("Jason R Priem"), "Priem, Jason R");
  assert.equal(surnameFirst("Ludo van der Waltman"), "van der Waltman, Ludo");
  assert.equal(surnameFirst("Jaime A. Teixeira da Silva"), "da Silva, Jaime A. Teixeira");
  assert.equal(surnameFirst("Martin Luther King Jr."), "King, Martin Luther, Jr.");
  assert.equal(surnameFirst("Piwowar, Heather"), "Piwowar, Heather");
  assert.equal(surnameFirst("Aristotle"), "Aristotle");
  assert.equal(surnameFirst("The Lancet"), "Lancet, The");
});

test("RIS uses two spaces before the dash, CRLF line ends and a closing ER line", () => {
  const ris = toRis([record(), record({ id: "W2", type: "book-chapter", doi: null, abstract: null })]);
  const lines = ris.split("\r\n");
  assert.equal(lines[0], "TY  - JOUR");
  assert.ok(lines.includes("AU  - Piwowar, Heather"));
  assert.ok(lines.includes("AU  - Larivière, Vincent"));
  assert.ok(lines.includes("AB  - Despite growing interest in Open Access."));
  assert.ok(lines.includes("DA  - 2018/02/13"));
  assert.ok(lines.includes("SP  - e4375"));
  assert.ok(!lines.some(l => l.startsWith("EP  - ")), "an end page equal to the start page is left out");
  assert.ok(lines.includes("DO  - 10.7717/peerj.4375"));
  assert.ok(lines.includes("AN  - W2741809807"));
  assert.ok(lines.includes("TY  - CHAP"));
  assert.equal(lines.filter(l => l === "ER  - ").length, 2);
  assert.ok(ris.endsWith("ER  - \r\n"));
  assert.ok(!/[^\r]\n/.test(ris), "no bare line feeds");
  assert.equal(toRis([]), "");
});

test("risType and bibtexType map OpenAlex types, with a fallback", () => {
  assert.equal(risType("review"), "JOUR");
  assert.equal(risType("dissertation"), "THES");
  assert.equal(risType("preprint"), "UNPB");
  assert.equal(risType("something-new"), "GEN");
  assert.equal(risType(null), "GEN");
  assert.equal(bibtexType("book-chapter"), "incollection");
  assert.equal(bibtexType("dataset"), "misc");
});

test("texEscape escapes TeX's special characters without mangling a backslash", () => {
  assert.equal(texEscape("R&D: 50% of $x_1 #1 {a}"), "R\\&D: 50\\% of \\$x\\_1 \\#1 \\{a\\}");
  assert.equal(texEscape("a\\b"), "a\\textbackslash{}b");
  assert.equal(texEscape("~x^2"), "\\textasciitilde{}x\\textasciicircum{}2");
});

test("BibTeX entries have unique keys, a brace-protected title and surname-first authors", () => {
  const bib = toBibtex([record(), record({ id: "W9", title: "50% of R&D", type: "preprint", source: "bioRxiv" })]);
  assert.match(bib, /^@article\{piwowar2018-W2741809807,\n/);
  assert.match(bib, /  title = \{\{The state of OA: a large-scale analysis\}\}/);
  assert.match(bib, /  author = \{Piwowar, Heather and Larivière, Vincent\}/);
  assert.match(bib, /  journal = \{PeerJ\}/);
  assert.match(bib, /  pages = \{e4375\}/);
  assert.match(bib, /@unpublished\{piwowar2018-W9,/);
  assert.match(bib, /  title = \{\{50\\% of R\\&D\}\}/);
  assert.match(bib, /  note = \{Preprint\}/);
  assert.equal(bibtexKey(record({ authors: [], year: null })), "anon" + "nd-W2741809807");
  assert.equal(bibtexKey(record({ authors: ["Ludo van der Waltman"] })), "vanderwaltman2018-W2741809807");
  assert.equal(toBibtex([]), "");
});

test("CSV quotes what needs quoting and has one row per record plus a header", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('a "quoted", value'), '"a ""quoted"", value"');
  assert.equal(csvCell("two\nlines"), '"two\nlines"');
  const csv = toCsv([record(), record({ id: "W2", doi: null, firstPage: "10", lastPage: "20" })]);
  const rows = csv.split("\r\n");
  assert.equal(rows[0], CSV_COLUMNS.join(","));
  assert.equal(rows.length, 4, "header, two records, and an empty string after the final line break");
  assert.match(rows[1], /^W2741809807,article,The state of OA: a large-scale analysis,Heather Piwowar; Vincent Larivière,PeerJ,2018,/);
  assert.match(rows[1], /https:\/\/libkey\.io\/10\.7717\/peerj\.4375/);
  assert.match(rows[2], /,10-20,,29456894,/);
});

test("dedupeRecords removes repeats by DOI, ignoring case, then by ID, and reports them", () => {
  const out = dedupeRecords([
    record(),
    record({ id: "W5", doi: "10.7717/PEERJ.4375" }),
    record({ id: "W6", doi: null }),
    record({ id: "W6", doi: null }),
    record({ id: "W7", doi: "10.1/other" })
  ]);
  assert.deepEqual(out.records.map(r => r.id), ["W2741809807", "W6", "W7"]);
  assert.deepEqual(out.removedIds, ["W5", "W6"]);
});

test("exportFile names the file by date and format", () => {
  const date = new Date("2026-11-26T12:00:00Z");
  assert.equal(exportFile([record()], "ris", date).filename, "openalex-export-2026-11-26.ris");
  assert.equal(exportFile([record()], "bibtex", date).filename, "openalex-export-2026-11-26.bib");
  const csv = exportFile([record()], "csv", date);
  assert.equal(csv.mimeType, "text/csv");
  assert.ok(csv.content.startsWith("openalex_id,"));
});

test("groupIdentifiers sorts mixed identifiers into the filter each needs", () => {
  const groups = groupIdentifiers([
    "W2741809807", "https://openalex.org/w1560783210", "10.7717/peerj.4375", "https://doi.org/10.1002/asi.22963",
    "doi: 10.1234/x", "29456894", "pmid:16060722", "PMC5815332", "pmcid: pmc123456", "not an id", " "
  ]);
  assert.deepEqual(groups.openalex_id, ["W2741809807", "W1560783210"]);
  assert.deepEqual(groups.doi, ["10.7717/peerj.4375", "10.1002/asi.22963", "10.1234/x"]);
  assert.deepEqual(groups.pmid, ["29456894", "16060722"]);
  assert.deepEqual(groups.pmcid, ["PMC5815332", "PMC123456"]);
  assert.deepEqual(groups.unknown, ["not an id"]);
  assert.equal(bareDoi("https://doi.org/10.1/x"), "10.1/x");
  assert.equal(bareDoi(null), null);
});

test("summariseRepeats counts how often each work was repeated", () => {
  assert.equal(summariseRepeats(["W1", "W2", "W1", "W1"]), "W1 ×3, W2");
  assert.equal(summariseRepeats([]), "");
});
