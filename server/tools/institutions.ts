import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { InstitutionSearchInputSchema, InstitutionIdSchema, PaginationSchema, WorkSortSchema, FilterSchema } from "../schemas/common.js";
import { openalexRequest, getEntity, normalizeOpenAlexId, extractPagination, formatWorkJson } from "../services/openalex-client.js";
import { formatInstitutionJson } from "../services/format-utils.js";
import type { Institution, Work, OpenAlexListResponse } from "../types.js";

export function registerInstitutionsTools(server: McpServer): void {
  // 1. search_institutions
  registerAppTool(server, "openalex_search_institutions", {
    title: "Search OpenAlex Institutions",
    description: "Search for institutions (universities, research institutes, companies) in OpenAlex. Supports name search plus filters by type, country, publication count, and more.",
    inputSchema: InstitutionSearchInputSchema,
    _meta: { ui: { resourceUri: "ui://openalex/search-institutions.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Institution>>({
        endpoint: "institutions",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
      });
      const output = {
        pagination: extractPagination(data.meta),
        institutions: data.results.map(formatInstitutionJson),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error searching institutions: ${message}` }] };
    }
  });

  // 2. get_institution
  registerAppTool(server, "openalex_get_institution", {
    title: "Get Institution Details",
    description: "Get detailed profile for an institution by its OpenAlex ID or ROR. Returns name, location, type, research metrics, top topics, and associated institutions.",
    inputSchema: { id: InstitutionIdSchema },
    _meta: { ui: { resourceUri: "ui://openalex/get-institution.html" } },
  }, async ({ id }) => {
    try {
      const institution = await getEntity<Institution>("institutions", normalizeOpenAlexId(id));
      const output = formatInstitutionJson(institution);
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching institution: ${message}` }] };
    }
  });

  // 3. get_institution_works
  registerAppTool(server, "openalex_get_institution_works", {
    title: "Get Institution Works",
    description: "Get research output from a specific institution, optionally filtered by year, type, or other criteria.",
    inputSchema: {
      id: InstitutionIdSchema,
      filter: FilterSchema,
      sort: WorkSortSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
    },
    _meta: { ui: { resourceUri: "ui://openalex/get-institution-works.html" } },
  }, async ({ id, filter, sort, limit, page }) => {
    try {
      const institution = await getEntity<Institution>("institutions", normalizeOpenAlexId(id));
      const instFilter = `authorships.institutions.id:${institution.id}`;
      const combinedFilter = filter ? `${instFilter},${filter}` : instFilter;
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { filter: combinedFilter, sort },
        perPage: limit,
        page,
      });
      const output = {
        institution: { id: institution.id, name: institution.display_name, total_works: institution.works_count },
        pagination: extractPagination(data.meta),
        works: data.results.map(formatWorkJson),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching institution works: ${message}` }] };
    }
  });
}
