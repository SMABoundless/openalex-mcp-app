import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { CHARACTER_LIMIT, DOCS_PAGE_LIMIT } from "../constants.js";
import { toolResult, toolError, num } from "../services/format-utils.js";
import {
  DOC_TOPICS,
  DOC_TOPIC_KEYS,
  docUrl,
  fetchDoc,
  findSections,
  introduction,
  outline,
  parseHeadings
} from "../services/docs.js";
import { truncateText } from "../services/text.js";
import type { ReadDocsOutput } from "../output-types.js";

const TOPIC_LIST = DOC_TOPIC_KEYS.map(key => `  - ${key}: ${DOC_TOPICS[key].title}`).join("\n");

export function registerDocsTools(server: McpServer): void {
  registerAppTool(server, "openalex_read_docs", {
    title: "Read OpenAlex Documentation",
    description: `Read a page of OpenAlex's own documentation, fetched from help.openalex.org. Use it to look up syntax instead of guessing: when a query written in OQL is refused and the error's hint is not enough, when choosing a filter or a field to group by, or when a search needs Boolean operators, phrases or wildcards.

Pages:
${TOPIC_LIST}

Args:
  - topic (string): Which page
  - section (string, optional): Part of a heading, e.g. "wildcards". Returns only the sections whose heading contains it, each with its subsections.

Returns: The page as Markdown, with its address. A page longer than ${num(DOCS_PAGE_LIMIT)} characters comes back as its opening and a list of its headings; call again with section to read a part. If no heading matches, the headings are listed.

Which to read: oql for how to phrase a query and for examples; oql_spec for the exact rule behind an error; api_quick_reference for entity types and common filters; filtering, searching and grouping for those three in detail.

Free. Reads the documentation site, not the OpenAlex API, so it uses none of the daily budget.`,
    inputSchema: {
      topic: z.enum(DOC_TOPIC_KEYS).describe("Which documentation page to read"),
      section: z.string().min(1).max(100).optional().describe(
        "Part of a heading. Only the sections whose heading contains it are returned (case does not matter)."
      ),
    },
    // Read-only, like every tool here, but the documentation is a fixed set of pages
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: "ui://openalex/read-docs.html" } },
  }, async ({ topic, section }) => {
    try {
      const { markdown, fetchedAt } = await fetchDoc(topic);
      const headings = parseHeadings(markdown);
      const base = {
        topic,
        title: DOC_TOPICS[topic].title,
        url: docUrl(topic),
        headings: headings.map(h => ({ level: h.level, text: h.text })),
        fetched_at: new Date(fetchedAt).toISOString(),
      };
      const header = `# ${base.title}\nSource: ${base.url}\n`;

      if (section) {
        const found = findSections(markdown, section);
        if (found.length === 0) {
          return toolError(
            "reading the documentation",
            new Error(`No heading on this page contains "${section}". Its headings are:\n${outline(headings)}`)
          );
        }
        const cut = truncateText(found.map(f => f.text).join("\n\n"), CHARACTER_LIMIT - header.length - 300);
        const output: ReadDocsOutput = { ...base, section, mode: "sections", content: cut.text, truncated: cut.truncated };
        const note = cut.truncated ? "\n\nThis was cut to fit. Ask for a narrower section by a more specific heading." : "";
        return toolResult(`${header}\n${cut.text}${note}`, output);
      }

      if (markdown.length <= DOCS_PAGE_LIMIT) {
        const output: ReadDocsOutput = { ...base, section: null, mode: "page", content: markdown, truncated: false };
        return toolResult(`${header}\n${markdown}`, output);
      }

      const opening = truncateText(introduction(markdown), DOCS_PAGE_LIMIT);
      const output: ReadDocsOutput = { ...base, section: null, mode: "overview", content: opening.text, truncated: true };
      const text = [
        header,
        opening.text,
        "",
        `This page is ${num(markdown.length)} characters, too long to return whole. Its sections are listed below; call again with section set to part of a heading.`,
        "",
        outline(headings),
      ].join("\n");
      return toolResult(text, output);
    } catch (error) {
      return toolError("reading the documentation", error);
    }
  });
}
