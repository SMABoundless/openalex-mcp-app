import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const UI_DIR = path.join(import.meta.dirname, "..", "..", "ui");

const UI_FILES = [
  "search-works", "get-work", "get-citations", "get-references",
  "search-authors", "get-author", "get-author-works",
  "search-institutions", "get-institution", "get-institution-works",
  "search-sources", "get-source", "search-topics", "search-funders", "group-works",
  "get-related-works", "get-topic", "get-funder", "search-publishers", "get-publisher",
  "analyze-works", "resolve-references", "get-reviews", "query",
  "find-keywords", "keyword-search",
];

export function registerAllUiResources(server: McpServer): void {
  for (const name of UI_FILES) {
    const uri = `ui://openalex/${name}.html`;
    registerAppResource(server, `OpenAlex ${name}`, uri, {}, async () => {
      const html = await fs.readFile(path.join(UI_DIR, `${name}.html`), "utf-8");
      return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
    });
  }
}
