// Reading OpenAlex's documentation pages.
//
// The pages live at help.openalex.org, which serves each one as Markdown at
// its address plus ".md". They are fetched when asked for and kept in memory
// for a day; no copy is stored in this repository. Only that one host is
// contacted, and only for the pages listed in DOC_TOPICS.
//
// The parsing below is pure and tested directly; fetchDoc does the network.

export const DOCS_HOST = "https://help.openalex.org";

/** The pages the tool can read: a key for the model, a title, and the page's path on the help site. */
export const DOC_TOPICS = {
  oql: { title: "OQL: the OpenAlex Query Language (overview and examples)", path: "access/oql" },
  oql_spec: { title: "OQL specification (every rule, with the errors a query can get)", path: "access/oql-spec" },
  api_quick_reference: { title: "OpenAlex API quick reference (entities, filters, syntax)", path: "api/llm-quick-reference" },
  filtering: { title: "Filtering: filter syntax and operators", path: "api/filtering" },
  searching: { title: "Searching: what is searched, Boolean syntax, keywords in search, re-ranking", path: "api/searching" },
  grouping: { title: "Grouping: counting by a field", path: "api/grouping" }
} as const;

export type DocTopic = keyof typeof DOC_TOPICS;
export const DOC_TOPIC_KEYS = Object.keys(DOC_TOPICS) as [DocTopic, ...DocTopic[]];

export function docUrl(topic: DocTopic): string {
  return `${DOCS_HOST}/${DOC_TOPICS[topic].path}/`;
}

export interface DocHeading {
  /** 1 for "#", 2 for "##", and so on */
  level: number;
  text: string;
  /** Index of the heading's line in the page */
  line: number;
}

/** Removes what is not documentation: YAML front matter and HTML comments (the pages carry editors' notes in them). */
export function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/^﻿?---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * The headings of a page. Lines inside fenced code blocks are skipped: the
 * pages' examples are full of "# comment" lines that look like headings.
 */
export function parseHeadings(markdown: string): DocHeading[] {
  const headings: DocHeading[] = [];
  let fence: string | null = null;
  markdown.split("\n").forEach((line, index) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (fence == null) fence = marker[0];
      else if (marker[0] === fence) fence = null;
      return;
    }
    if (fence != null) return;
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) headings.push({ level: heading[1].length, text: heading[2].replace(/`/g, ""), line: index });
  });
  return headings;
}

/**
 * The sections whose heading contains `wanted` (case-insensitive), each
 * running to the next heading of the same or a higher level, so a section
 * comes with its subsections. A section inside another match is not repeated.
 */
export function findSections(markdown: string, wanted: string): { heading: DocHeading; text: string }[] {
  const lines = markdown.split("\n");
  const headings = parseHeadings(markdown);
  const needle = wanted.trim().toLowerCase();
  if (!needle) return [];
  const found: { heading: DocHeading; text: string; end: number }[] = [];
  headings.forEach((heading, i) => {
    if (!heading.text.toLowerCase().includes(needle)) return;
    if (found.some(f => heading.line > f.heading.line && heading.line < f.end)) return;
    const next = headings.slice(i + 1).find(h => h.level <= heading.level);
    const end = next ? next.line : lines.length;
    found.push({ heading, text: lines.slice(heading.line, end).join("\n").trim(), end });
  });
  return found.map(({ heading, text }) => ({ heading, text }));
}

/** The page's opening: everything before its first heading below the title. */
export function introduction(markdown: string): string {
  const lines = markdown.split("\n");
  const first = parseHeadings(markdown).find(h => h.level > 1);
  return lines.slice(0, first ? first.line : lines.length).join("\n").trim();
}

/** The headings as an indented list, for choosing a section. */
export function outline(headings: DocHeading[]): string {
  const top = Math.min(...headings.map(h => h.level), 6);
  return headings.map(h => `${"  ".repeat(h.level - top)}- ${h.text}`).join("\n");
}

// ============================================
// Fetching
// ============================================

const CACHE_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 500_000;

const cache = new Map<DocTopic, { markdown: string; fetchedAt: number }>();

/** Forgets fetched pages. For tests. */
export function clearDocsCache(): void {
  cache.clear();
}

/** A documentation page as cleaned Markdown, from memory when it was fetched within the last day. */
export async function fetchDoc(topic: DocTopic, now: number = Date.now()): Promise<{ markdown: string; fetchedAt: number }> {
  const cached = cache.get(topic);
  if (cached && now - cached.fetchedAt < CACHE_MS) return cached;

  const url = `${DOCS_HOST}/${DOC_TOPICS[topic].path}.md`;
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "Accept": "text/markdown, text/plain", "User-Agent": "openalex-mcp-app/1.0.0" }
    });
  } catch {
    // A page fetched earlier is better than none, even if it is more than a day old
    if (cached) return cached;
    throw new Error(`Could not reach the OpenAlex documentation site. The page is at ${docUrl(topic)}`);
  }
  if (!response.ok) {
    if (cached) return cached;
    throw new Error(`The OpenAlex documentation site returned ${response.status} for this page. It is at ${docUrl(topic)}`);
  }
  const body = await response.text();
  if (body.length > MAX_BYTES) throw new Error(`The documentation page is larger than expected. Read it at ${docUrl(topic)}`);
  const entry = { markdown: cleanMarkdown(body), fetchedAt: now };
  cache.set(topic, entry);
  return entry;
}
