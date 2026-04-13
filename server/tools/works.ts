import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { WorkSearchInputSchema, WorkIdSchema, PaginationSchema, WorkSortSchema } from "../schemas/common.js";
import { openalexRequest, getEntity, normalizeOpenAlexId, extractPagination, formatWorkJson } from "../services/openalex-client.js";
import type { Work, OpenAlexListResponse } from "../types.js";

export function registerWorksTools(server: McpServer): void {
  // 1. search_works
  registerAppTool(server, "openalex_search_works", {
    title: "Search OpenAlex Works",
    description: "Search across 250M+ scholarly works in OpenAlex. Supports full-text search plus powerful filters by year, open access status, citation count, type, institution, and more.",
    inputSchema: WorkSearchInputSchema,
    _meta: { ui: { resourceUri: "ui://openalex/search-works.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
      });
      const output = {
        pagination: extractPagination(data.meta),
        works: data.results.map(formatWorkJson),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error searching works: ${message}` }] };
    }
  });

  // 2. get_work
  registerAppTool(server, "openalex_get_work", {
    title: "Get Work Details",
    description: "Get detailed information about a scholarly work by its OpenAlex ID, DOI, or PMID.",
    inputSchema: { id: WorkIdSchema },
    _meta: { ui: { resourceUri: "ui://openalex/get-work.html" } },
  }, async ({ id }) => {
    try {
      const work = await getEntity<Work>("works", normalizeOpenAlexId(id));
      const output = formatWorkJson(work);
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching work: ${message}` }] };
    }
  });

  // 3. get_citations
  registerAppTool(server, "openalex_get_citations", {
    title: "Get Citations",
    description: "Find works that cite a given work (forward citation tracking). Useful for tracking how a paper has influenced the field.",
    inputSchema: {
      id: WorkIdSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
      sort: z.enum(["publication_date:desc", "publication_date:asc", "cited_by_count:desc"])
        .default("publication_date:desc")
        .describe("Sort order for citing works"),
    },
    _meta: { ui: { resourceUri: "ui://openalex/get-citations.html" } },
  }, async ({ id, limit, page, sort }) => {
    try {
      const work = await getEntity<Work>("works", normalizeOpenAlexId(id));
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { filter: `cites:${work.id}`, sort },
        perPage: limit,
        page,
      });
      const output = {
        cited_work: {
          id: work.id,
          title: work.display_name,
          total_citations: work.cited_by_count,
          counts_by_year: work.counts_by_year,
        },
        pagination: extractPagination(data.meta),
        citing_works: data.results.map(formatWorkJson),
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching citations: ${message}` }] };
    }
  });

  // 4. get_references
  registerAppTool(server, "openalex_get_references", {
    title: "Get References",
    description: "Find works cited by a given work (backward citation tracking / bibliography). Useful for exploring foundational literature behind a paper.",
    inputSchema: {
      id: WorkIdSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
    },
    _meta: { ui: { resourceUri: "ui://openalex/get-references.html" } },
  }, async ({ id, limit, page }) => {
    try {
      const work = await getEntity<Work>("works", normalizeOpenAlexId(id));
      const refIds = (work.referenced_works || []).slice((page - 1) * limit, page * limit);
      let references: Record<string, unknown>[] = [];
      if (refIds.length > 0) {
        const data = await openalexRequest<OpenAlexListResponse<Work>>({
          endpoint: "works",
          params: { filter: `openalex_id:${refIds.join("|")}` },
          perPage: limit,
        });
        references = data.results.map(formatWorkJson);
      }
      const total = work.referenced_works?.length ?? 0;
      const output = {
        source_work: { id: work.id, title: work.display_name, total_references: total },
        pagination: { total, count: references.length, page, perPage: limit, hasMore: page * limit < total },
        references,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(output) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { isError: true, content: [{ type: "text" as const, text: `Error fetching references: ${message}` }] };
    }
  });
}
