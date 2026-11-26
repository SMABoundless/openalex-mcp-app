import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { PublisherSearchInputSchema, PublisherIdSchema } from "../schemas/common.js";
import { PUBLISHER_LIST_FIELDS, PUBLISHER_TOP_SOURCES } from "../constants.js";
import { openalexRequest, getEntity, extractPagination, shortId } from "../services/openalex-client.js";
import { listText, pageSummary, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import {
  formatPublisherJson,
  publisherListEntry,
  formatPublisherDetailJson,
  publisherDetailMarkdown
} from "../services/format-entities.js";
import type { Publisher, Source, OpenAlexListResponse } from "../types.js";
import type { SearchPublishersOutput } from "../output-types.js";

export function registerPublishersTools(server: McpServer): void {
  registerAppTool(server, "openalex_search_publishers", {
    title: "Search OpenAlex Publishers",
    description: `Search for publishers: the companies, societies and university presses that publish journals and books.

Use this to find a publisher's OpenAlex ID, then pass it to a works search as filter "primary_location.source.publisher_lineage:P4310320990" (works it published, including its imprints) or to a sources search as filter "host_organization_lineage:P4310320990" (its journals).

Supports name search plus filters:
- country_codes: e.g., "NL", "US"
- hierarchy_level: 0 for top-level publishers, 1 or more for imprints and subsidiaries
- works_count, cited_by_count: e.g., ">100000"

Args:
  - query (string): Publisher name or search terms
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): relevance_score:desc, cited_by_count:desc, works_count:desc
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)

Returns: Publishers with parent publisher, country, counts, h-index and OpenAlex ID. Use openalex_get_publisher for one publisher's full profile.

Examples:
  - "Elsevier"
  - "university press" with filter "country_codes:GB"`,
    inputSchema: PublisherSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-publishers.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Publisher>>({
        endpoint: "publishers",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
        select: PUBLISHER_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const publishers = data.results.map(p => formatPublisherJson(p, { compact: true }));
      const output: SearchPublishersOutput = { pagination, publishers };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Publishers matching "${query}"`,
        summary: pageSummary(pagination, "publishers"),
        entries: publishers.map((p, i) => publisherListEntry(p, start + i + 1)),
        pagination,
        emptyMessage: `No publishers found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching publishers", error);
    }
  });

  registerAppTool(server, "openalex_get_publisher", {
    title: "Get Publisher Details",
    description: `Retrieve the full profile of a single publisher.

Accepts multiple ID formats:
- OpenAlex ID: P4310320990 or https://openalex.org/P4310320990
- ROR: https://ror.org/02scfj030

Args:
  - id (string): Publisher identifier (OpenAlex ID or ROR)

Returns: The publisher's names, parent publisher, country, counts of works and citations, h-index, works per year, how many sources it publishes, its ${PUBLISHER_TOP_SOURCES} largest sources with their IDs, and its other OpenAlex records (for example, the same organisation as a funder).`,
    inputSchema: { id: PublisherIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-publisher.html" } },
  }, async ({ id }) => {
    try {
      const publisher = await getEntity<Publisher>("publishers", id);
      // The publisher record does not list its sources, so they come from a second,
      // metered request. If that fails (for example, the budget is spent) the
      // profile is still returned without them.
      let sources: { count: number; top: Source[] } | null = null;
      try {
        const data = await openalexRequest<OpenAlexListResponse<Source>>({
          endpoint: "sources",
          params: { filter: `host_organization_lineage:${shortId(publisher.id)}`, sort: "works_count:desc" },
          perPage: PUBLISHER_TOP_SOURCES,
          select: "id,display_name,type,is_oa,works_count,cited_by_count",
        });
        sources = { count: data.meta.count, top: data.results };
      } catch {
        sources = null;
      }
      const output = formatPublisherDetailJson(publisher, sources);
      return toolResult(publisherDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching publisher", error);
    }
  });
}
