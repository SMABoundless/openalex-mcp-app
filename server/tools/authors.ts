import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { AuthorSearchInputSchema, AuthorIdSchema, PaginationSchema, WorkSortSchema, FilterSchema } from "../schemas/common.js";
import { openalexRequest, getEntity, extractPagination } from "../services/openalex-client.js";
import {
  formatWorkJson,
  formatAuthorJson,
  workListEntry,
  authorListEntry,
  authorDetailMarkdown,
  listText,
  pageSummary,
  toolResult,
  toolError,
  READ_ONLY_ANNOTATIONS
} from "../services/format-utils.js";
import type { Author, Work, OpenAlexListResponse } from "../types.js";
import type { SearchAuthorsOutput, AuthorWorksOutput } from "../output-types.js";

export function registerAuthorsTools(server: McpServer): void {
  // 1. search_authors
  registerAppTool(server, "openalex_search_authors", {
    title: "Search OpenAlex Authors",
    description: `Search for author profiles in OpenAlex.

Supports name search plus filters:
- last_known_institutions.id: Filter by institution
- works_count: Filter by publication count (e.g., ">50")
- cited_by_count: Filter by total citations (e.g., ">1000")
- has_orcid: true/false

Args:
  - query (string): Author name or search terms
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): Sort order (relevance_score:desc, cited_by_count:desc, works_count:desc)
  - limit (number): Results per page (1-100, default: 25)
  - page (number): Page number (default: 1)

Returns: Author profiles with names, current institution, publication counts, citations, h-index, and OpenAlex ID.

Examples:
  - "Fei-Fei Li" to find the computer vision researcher
  - "Smith" with filter "last_known_institutions.id:I27837315" for Smiths at a specific institution`,
    inputSchema: AuthorSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-authors.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Author>>({
        endpoint: "authors",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const authors = data.results.map(a => formatAuthorJson(a, { compact: true }));
      const output: SearchAuthorsOutput = { pagination, authors };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Authors matching "${query}"`,
        summary: pageSummary(pagination, "authors"),
        entries: authors.map((a, i) => authorListEntry(a, start + i + 1)),
        pagination,
        emptyMessage: `No authors found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching authors", error);
    }
  });

  // 2. get_author
  registerAppTool(server, "openalex_get_author", {
    title: "Get Author Details",
    description: `Retrieve detailed information about a single author.

Accepts multiple ID formats:
- OpenAlex ID: A5023888391 or https://openalex.org/A5023888391
- ORCID: 0000-0002-1825-0097 or https://orcid.org/0000-0002-1825-0097

Args:
  - id (string): Author identifier (OpenAlex ID or ORCID)

Returns: Full author profile including name variants, affiliations with years, publication metrics (h-index, i10-index), citation counts, and research topics.`,
    inputSchema: { id: AuthorIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-author.html" } },
  }, async ({ id }) => {
    try {
      const author = await getEntity<Author>("authors", id);
      const output = formatAuthorJson(author);
      return toolResult(authorDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching author", error);
    }
  });

  // 3. get_author_works
  registerAppTool(server, "openalex_get_author_works", {
    title: "Get Author Works",
    description: `Retrieve the list of works by a specific author.

Use this to:
- Get a researcher's publication list
- Find an author's most-cited papers
- Filter an author's works by year, type, or other criteria

Args:
  - id (string): Author identifier (OpenAlex ID or ORCID)
  - filter (string, optional): Additional OpenAlex filter (e.g., "publication_year:2023", "type:article")
  - sort (string): Sort order (cited_by_count:desc for most-cited, publication_date:desc for recent)
  - limit (number): Results per page (1-100, default: 25)
  - page (number): Page number (default: 1)

Returns: List of works by the author.`,
    inputSchema: {
      id: AuthorIdSchema,
      filter: FilterSchema,
      sort: WorkSortSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-author-works.html" } },
  }, async ({ id, filter, sort, limit, page }) => {
    try {
      const author = await getEntity<Author>("authors", id);
      const authorFilter = `authorships.author.id:${author.id}`;
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        // relevance_score only exists for searches; fall back to most-cited
        params: { filter: filter ? `${authorFilter},${filter}` : authorFilter, sort: sort === "relevance_score:desc" ? "cited_by_count:desc" : sort },
        perPage: limit,
        page,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const works = data.results.map(w => formatWorkJson(w, { compact: true }));
      const output: AuthorWorksOutput = {
        author: { id: author.id, name: author.display_name, total_works: author.works_count ?? 0 },
        pagination,
        works,
      };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Works by ${author.display_name}`,
        summary: pageSummary(pagination, "works"),
        entries: works.map((w, i) => workListEntry(w, start + i + 1)),
        pagination,
        emptyMessage: `No works found for ${author.display_name}${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("fetching author works", error);
    }
  });
}
