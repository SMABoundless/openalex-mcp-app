import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { SourceSearchInputSchema, SourceIdSchema } from "../schemas/common.js";
import { SOURCE_LIST_FIELDS } from "../constants.js";
import { openalexRequest, getEntity, extractPagination } from "../services/openalex-client.js";
import { listText, pageSummary, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { formatSourceJson, sourceListEntry, sourceDetailMarkdown } from "../services/format-entities.js";
import type { Source, OpenAlexListResponse } from "../types.js";
import type { SearchSourcesOutput } from "../output-types.js";

export function registerSourcesTools(server: McpServer): void {
  registerAppTool(server, "openalex_search_sources", {
    title: "Search OpenAlex Sources",
    description: `Search for sources: journals, repositories, conferences and book series.

Use this to find a journal's OpenAlex ID (for the primary_location.source.id works filter), or to compare journals by output, citations, open access status and article processing charge.

Supports name search plus filters:
- type: journal, repository, conference, ebook platform, book series
- is_oa: true/false (fully open access)
- is_in_doaj: true/false (listed in the Directory of Open Access Journals)
- apc_usd: article processing charge in US dollars (e.g., "0" for none, "<1000")
- country_code: e.g., "US", "GB"
- works_count, cited_by_count: e.g., ">1000"

Args:
  - query (string): Source name or search terms
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): relevance_score:desc, cited_by_count:desc, works_count:desc
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)

Returns: Sources with type, publisher, ISSN, counts, h-index, open access status, APC and OpenAlex ID.

Examples:
  - "PeerJ"
  - "ecology" with filter "type:journal,is_oa:true,apc_usd:0"`,
    inputSchema: SourceSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-sources.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Source>>({
        endpoint: "sources",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
        select: SOURCE_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const sources = data.results.map(s => formatSourceJson(s, { compact: true }));
      const output: SearchSourcesOutput = { pagination, sources };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Sources matching "${query}"`,
        summary: pageSummary(pagination, "sources"),
        entries: sources.map((s, i) => sourceListEntry(s, start + i + 1)),
        pagination,
        emptyMessage: `No sources found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching sources", error);
    }
  });

  registerAppTool(server, "openalex_get_source", {
    title: "Get Source Details",
    description: `Retrieve detailed information about a single source (journal, repository or conference).

Accepts multiple ID formats:
- OpenAlex ID: S1983995261 or https://openalex.org/S1983995261
- ISSN: 2167-8359

Args:
  - id (string): Source identifier (OpenAlex ID or ISSN)

Returns: Full source profile including publisher, ISSNs, open access status, article processing charge, metrics, top topics and yearly output.`,
    inputSchema: { id: SourceIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-source.html" } },
  }, async ({ id }) => {
    try {
      const source = await getEntity<Source>("sources", id);
      const output = formatSourceJson(source);
      return toolResult(sourceDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching source", error);
    }
  });
}
