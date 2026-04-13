import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { AuthorSearchInputSchema, AuthorIdSchema, PaginationSchema, WorkSortSchema, FilterSchema } from "../schemas/common.js";
import { openalexRequest, getEntity, normalizeOpenAlexId, extractPagination, formatWorkJson } from "../services/openalex-client.js";
import { formatAuthorJson } from "../services/format-utils.js";
import type { Author, Work, OpenAlexListResponse } from "../types.js";

export function registerAuthorsTools(server: McpServer): void {
  // 1. search_authors
  registerAppTool(server, "openalex_search_authors", {
    title: "Search OpenAlex Authors",
    description: "Search for authors across 90M+ researcher profiles in OpenAlex. Supports name search plus filters by institution, publication count, citation count, and more.",
    inputSchema: AuthorSearchInputSchema,
    _meta: { ui: { resourceUri: "ui://openalex/search-authors.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Author>>({
        endpoint: "authors",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
      });
      const output = {
        pagination: extractPagination(data.meta),
        authors: data.results.map(formatAuthorJson),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error searching authors: ${message}` }] };
    }
  });

  // 2. get_author
  registerAppTool(server, "openalex_get_author", {
    title: "Get Author Details",
    description: "Get detailed profile for an author by their OpenAlex ID or ORCID. Returns name, affiliations, h-index, publication metrics, and research topics.",
    inputSchema: { id: AuthorIdSchema },
    _meta: { ui: { resourceUri: "ui://openalex/get-author.html" } },
  }, async ({ id }) => {
    try {
      const author = await getEntity<Author>("authors", normalizeOpenAlexId(id));
      const output = formatAuthorJson(author);
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching author: ${message}` }] };
    }
  });

  // 3. get_author_works
  registerAppTool(server, "openalex_get_author_works", {
    title: "Get Author Works",
    description: "Get all publications by a specific author, optionally filtered by year, type, or other criteria.",
    inputSchema: {
      id: AuthorIdSchema,
      filter: FilterSchema,
      sort: WorkSortSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
    },
    _meta: { ui: { resourceUri: "ui://openalex/get-author-works.html" } },
  }, async ({ id, filter, sort, limit, page }) => {
    try {
      const author = await getEntity<Author>("authors", normalizeOpenAlexId(id));
      const authorFilter = `authorships.author.id:${author.id}`;
      const combinedFilter = filter ? `${authorFilter},${filter}` : authorFilter;
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { filter: combinedFilter, sort },
        perPage: limit,
        page,
      });
      const output = {
        author: { id: author.id, name: author.display_name, total_works: author.works_count },
        pagination: extractPagination(data.meta),
        works: data.results.map(formatWorkJson),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching author works: ${message}` }] };
    }
  });
}
