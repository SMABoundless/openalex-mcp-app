import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { InstitutionSearchInputSchema, InstitutionIdSchema, PaginationSchema, WorkSortSchema, FilterSchema, CursorSchema } from "../schemas/common.js";
import { INSTITUTION_LIST_FIELDS, WORK_LIST_FIELDS } from "../constants.js";
import { openalexRequest, getEntity, extractPagination } from "../services/openalex-client.js";
import {
  formatWorkJson,
  formatInstitutionJson,
  workListEntry,
  institutionListEntry,
  institutionDetailMarkdown,
  listText,
  pageSummary,
  firstIndex,
  toolResult,
  toolError,
  READ_ONLY_ANNOTATIONS
} from "../services/format-utils.js";
import type { Institution, Work, OpenAlexListResponse } from "../types.js";
import type { SearchInstitutionsOutput, InstitutionWorksOutput } from "../output-types.js";

export function registerInstitutionsTools(server: McpServer): void {
  // 1. search_institutions
  registerAppTool(server, "openalex_search_institutions", {
    title: "Search OpenAlex Institutions",
    description: `Search for institutions (universities, research institutes, companies) in OpenAlex.

Supports name search plus filters:
- type: Filter by type (education, company, healthcare, government, nonprofit, facility, archive, other)
- country_code: Filter by country (e.g., "US", "GB", "DE")
- works_count: Filter by publication count (e.g., ">10000")
- cited_by_count: Filter by total citations

Args:
  - query (string): Institution name or search terms
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): Sort order (relevance_score:desc, cited_by_count:desc, works_count:desc)
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)

Returns: Institution profiles with names, locations, types, publication counts, citations, and OpenAlex ID.

Examples:
  - "Northwestern University"
  - "Max Planck" with filter "country_code:DE"
  - "hospital" with filter "type:healthcare,country_code:US"`,
    inputSchema: InstitutionSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-institutions.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Institution>>({
        endpoint: "institutions",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
        select: INSTITUTION_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const institutions = data.results.map(i => formatInstitutionJson(i, { compact: true }));
      const output: SearchInstitutionsOutput = { pagination, institutions };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Institutions matching "${query}"`,
        summary: pageSummary(pagination, "institutions"),
        entries: institutions.map((inst, i) => institutionListEntry(inst, start + i + 1)),
        pagination,
        emptyMessage: `No institutions found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching institutions", error);
    }
  });

  // 2. get_institution
  registerAppTool(server, "openalex_get_institution", {
    title: "Get Institution Details",
    description: `Retrieve detailed information about a single institution.

Accepts multiple ID formats:
- OpenAlex ID: I27837315 or https://openalex.org/I27837315
- ROR: https://ror.org/000e0be47

Args:
  - id (string): Institution identifier (OpenAlex ID or ROR)

Returns: Full institution profile including name variants, location, type, research metrics, top research topics, and associated institutions.`,
    inputSchema: { id: InstitutionIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-institution.html" } },
  }, async ({ id }) => {
    try {
      const institution = await getEntity<Institution>("institutions", id);
      const output = formatInstitutionJson(institution);
      return toolResult(institutionDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching institution", error);
    }
  });

  // 3. get_institution_works
  registerAppTool(server, "openalex_get_institution_works", {
    title: "Get Institution Works",
    description: `Retrieve the list of works from a specific institution.

Use this to:
- Explore an institution's research output
- Find an institution's most-cited papers
- Filter works by year, type, or topic

Args:
  - id (string): Institution identifier (OpenAlex ID or ROR)
  - filter (string, optional): Additional OpenAlex filter (e.g., "publication_year:2023", "type:article")
  - sort (string): Sort order (cited_by_count:desc for most-cited, publication_date:desc for recent)
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1). Paging reaches the first 10,000 results.
  - cursor (string, optional): For going past 10,000 results. Pass "*" to start, then the cursor from the previous response.

Returns: List of works from the institution.`,
    inputSchema: {
      id: InstitutionIdSchema,
      filter: FilterSchema,
      sort: WorkSortSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
      cursor: CursorSchema,
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-institution-works.html" } },
  }, async ({ id, filter, sort, limit, page, cursor }) => {
    try {
      const institution = await getEntity<Institution>("institutions", id, "id,display_name,works_count");
      const instFilter = `authorships.institutions.id:${institution.id}`;
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        // relevance_score only exists for searches; fall back to most-cited
        params: { filter: filter ? `${instFilter},${filter}` : instFilter, sort: sort === "relevance_score:desc" ? "cited_by_count:desc" : sort },
        perPage: limit,
        page,
        cursor,
        select: WORK_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length, Boolean(cursor));
      const works = data.results.map(w => formatWorkJson(w, { compact: true }));
      const output: InstitutionWorksOutput = {
        institution: { id: institution.id, name: institution.display_name, total_works: institution.works_count ?? 0 },
        pagination,
        works,
      };
      const start = firstIndex(page, limit, cursor);
      const text = listText({
        heading: `Works from ${institution.display_name}`,
        summary: pageSummary(pagination, "works"),
        entries: works.map((w, i) => workListEntry(w, start + i + 1)),
        pagination,
        emptyMessage: `No works found for ${institution.display_name}${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("fetching institution works", error);
    }
  });
}
