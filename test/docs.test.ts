import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DOC_TOPICS,
  DOC_TOPIC_KEYS,
  DOCS_HOST,
  docUrl,
  cleanMarkdown,
  parseHeadings,
  findSections,
  introduction,
  outline
} from "../server/services/docs.js";

const PAGE = [
  "# Search",
  "",
  "Intro paragraph.",
  "",
  "## Boolean operators",
  "",
  "Use AND, OR and NOT.",
  "",
  "```bash",
  "# Works about dna",
  "## not a heading either",
  "https://api.openalex.org/works?search=dna",
  "```",
  "",
  "### Wildcards",
  "",
  "A star matches any characters.",
  "",
  "### Proximity",
  "",
  "Words near each other.",
  "",
  "## Keywords in search",
  "",
  "A phrase can name a keyword.",
  "",
  "~~~",
  "# also code",
  "~~~",
  "",
  "## `key` versus name ##"
].join("\n");

test("every documentation topic points at a page on the help site", () => {
  assert.ok(DOC_TOPIC_KEYS.length >= 6);
  for (const key of DOC_TOPIC_KEYS) {
    assert.match(DOC_TOPICS[key].path, /^(access|api)\/[a-z-]+$/);
    assert.ok(DOC_TOPICS[key].title.length > 10);
    assert.equal(docUrl(key), `${DOCS_HOST}/${DOC_TOPICS[key].path}/`);
  }
  assert.equal(DOCS_HOST, "https://help.openalex.org");
});

test("cleanMarkdown removes front matter and editors\' comments", () => {
  const raw = "---\ntitle: Search\n---\n# Search\r\n\r\n<!-- HAND-MAINTAINED\nsince 2026 -->\n\n\n\nText.\n";
  assert.equal(cleanMarkdown(raw), "# Search\n\nText.");
  assert.equal(cleanMarkdown("# Plain"), "# Plain");
});

test("parseHeadings ignores heading-like lines inside code blocks", () => {
  assert.deepEqual(
    parseHeadings(PAGE).map(h => [h.level, h.text]),
    [[1, "Search"], [2, "Boolean operators"], [3, "Wildcards"], [3, "Proximity"], [2, "Keywords in search"], [2, "key versus name"]]
  );
});

test("findSections returns a section with its subsections, and stops at the next heading of its level", () => {
  const [boolean] = findSections(PAGE, "boolean");
  assert.match(boolean.text, /^## Boolean operators/);
  assert.match(boolean.text, /### Wildcards/);
  assert.match(boolean.text, /### Proximity/);
  assert.match(boolean.text, /# Works about dna/, "the code block stays inside its section");
  assert.doesNotMatch(boolean.text, /Keywords in search/);

  const [wildcards] = findSections(PAGE, "WILDCARD");
  assert.equal(wildcards.text, "### Wildcards\n\nA star matches any characters.");
});

test("findSections does not repeat a subsection already inside a match, and reports no match", () => {
  // "o" is in "Boolean operators" and in its subsection "Proximity"
  const found = findSections(PAGE, "o");
  assert.deepEqual(found.map(f => f.heading.text), ["Boolean operators", "Keywords in search"]);
  assert.deepEqual(findSections(PAGE, "nothing like this"), []);
  assert.deepEqual(findSections(PAGE, "  "), []);
});

test("introduction is the text before the first section, and outline indents by level", () => {
  assert.equal(introduction(PAGE), "# Search\n\nIntro paragraph.");
  assert.equal(introduction("# Only a title\n\nAll of it."), "# Only a title\n\nAll of it.");
  assert.equal(
    outline(parseHeadings(PAGE)),
    "- Search\n  - Boolean operators\n    - Wildcards\n    - Proximity\n  - Keywords in search\n  - key versus name"
  );
});
