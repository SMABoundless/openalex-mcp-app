import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

const UI_DIR = path.join(import.meta.dirname, "..", "..", "ui");

const UI_FILES = [
  "search-works", "get-work", "get-citations", "get-references",
  "search-authors", "get-author", "get-author-works",
  "search-institutions", "get-institution", "get-institution-works",
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
