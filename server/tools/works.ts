import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { WorkSearchInputSchema, WorkIdSchema, PaginationSchema } from "../schemas/common.js";
import { openalexRequest, getEntity, extractPagination, makePagination } from "../services/openalex-client.js";
import {
  formatWorkJson,
  workListEntry,
  workDetailMarkdown,
  listText,
  pageSummary,
  toolResult,
  toolError,
  READ_ONLY_ANNOTATIONS
} from "../services/format-utils.js";
import type { Work, OpenAlexListResponse } from "../types.js";
import type { SearchWorksOutput, CitationsOutput, ReferencesOutput, WorkOutput } from "../output-types.js";

const entries = (works: WorkOutput[], pageStart: number): string[] =>
  works.map((w, i) => workListEntry(w, pageStart + i + 1));

export function registerWorksTools(server: McpServer): void {
  // 1. search_works
  registerAppTool(server, "openalex_search_works", {
    title: "Search OpenAlex Works",
    description: `Search scholarly works in OpenAlex (articles, books, datasets, preprints and more).

Supports full-text search plus filters using OpenAlex filter syntax:
- publication_year: Filter by year (e.g., "2023" or "2020-2024")
- open_access.is_oa: true/false for open access status
- cited_by_count: Filter by citation count (e.g., ">100", "<10")
- type: Filter by work type (article, book, preprint, dataset, review, etc.)
- authorships.institutions.id: Filter by institution OpenAlex ID
- authorships.author.id: Filter by author OpenAlex ID
- primary_location.source.id: Filter by journal/source

Combine multiple filters with commas, e.g., "publication_year:2023,open_access.is_oa:true"

Args:
  - query (string): Full-text search query
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): Sort order (relevance_score:desc, cited_by_count:desc, publication_date:desc, etc.)
  - limit (number): Results per page (1-100, default: 25)
  - page (number): Page number (default: 1)

Returns: List of works with title, authors, source, citation count, open access status, DOI, OpenAlex ID, and a shortened abstract. Use openalex_get_work for the full abstract and author affiliations.

Examples:
  - "CRISPR gene therapy" with filter "publication_year:2023"
  - "climate change" with filter "cited_by_count:>1000,type:review"
  - "machine learning healthcare" with sort "publication_date:desc"`,
    inputSchema: WorkSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-works.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const works = data.results.map(w => formatWorkJson(w, { compact: true }));
      const output: SearchWorksOutput = { pagination, works };
      const text = listText({
        heading: `Works matching "${query}"`,
        summary: pageSummary(pagination, "works"),
        entries: entries(works, (page - 1) * limit),
        pagination,
        emptyMessage: `No works found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching works", error);
    }
  });

  // 2. get_work
  registerAppTool(server, "openalex_get_work", {
    title: "Get Work Details",
    description: `Retrieve detailed information about a single scholarly work.

Accepts multiple ID formats:
- OpenAlex ID: W2741809807 or https://openalex.org/W2741809807
- DOI: 10.1038/s41586-020-2649-2 or https://doi.org/10.1038/s41586-020-2649-2
- PMID: 32908142 (PubMed ID)

Args:
  - id (string): Work identifier (OpenAlex ID, DOI, or PMID)

Returns: Full work details including title, authors with affiliations, full abstract, citation count, reference count, open access status, and topics.`,
    inputSchema: { id: WorkIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-work.html" } },
  }, async ({ id }) => {
    try {
      const work = await getEntity<Work>("works", id);
      const output = formatWorkJson(work);
      return toolResult(workDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching work", error);
    }
  });

  // 3. get_citations
  registerAppTool(server, "openalex_get_citations", {
    title: "Get Works Citing This Work",
    description: `Find works that cite a given work (forward citation tracking).

Use this to:
- Track how a seminal paper has influenced the field
- Find recent papers building on foundational research
- Discover research directions inspired by a work

Args:
  - id (string): Work identifier (OpenAlex ID, DOI, or PMID)
  - limit (number): Results per page (1-100, default: 25)
  - page (number): Page number (default: 1)
  - sort: Order by publication_date:desc, publication_date:asc, or cited_by_count:desc

Returns: List of works that cite the specified work, plus its total citation count.`,
    inputSchema: {
      id: WorkIdSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
      sort: z.enum(["publication_date:desc", "publication_date:asc", "cited_by_count:desc"])
        .default("publication_date:desc")
        .describe("Sort order for citing works"),
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-citations.html" } },
  }, async ({ id, limit, page, sort }) => {
    try {
      const work = await getEntity<Work>("works", id);
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { filter: `cites:${work.id}`, sort },
        perPage: limit,
        page,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const citing = data.results.map(w => formatWorkJson(w, { compact: true }));
      const title = work.display_name || "Untitled";
      const output: CitationsOutput = {
        cited_work: {
          id: work.id,
          title,
          total_citations: work.cited_by_count ?? 0,
          counts_by_year: (work.counts_by_year ?? []).map(c => ({ year: c.year, cited_by_count: c.cited_by_count })),
        },
        pagination,
        citing_works: citing,
      };
      const text = listText({
        heading: `Works citing "${title}"`,
        summary: pageSummary(pagination, "citing works"),
        entries: entries(citing, (page - 1) * limit),
        pagination,
        emptyMessage: `No citing works found for "${title}".`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("fetching citations", error);
    }
  });

  // 4. get_references
  registerAppTool(server, "openalex_get_references", {
    title: "Get References of a Work",
    description: `Find works cited by a given work (backward citation tracking / bibliography).

Use this to:
- Explore the foundational literature behind a paper
- Build reading lists from a key paper's bibliography
- Understand the intellectual lineage of research

Args:
  - id (string): Work identifier (OpenAlex ID, DOI, or PMID)
  - limit (number): Results per page (1-100, default: 25)
  - page (number): Page number (default: 1)

Returns: List of works cited in the specified work's references.`,
    inputSchema: {
      id: WorkIdSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-references.html" } },
  }, async ({ id, limit, page }) => {
    try {
      const work = await getEntity<Work>("works", id);
      const allRefs = work.referenced_works ?? [];
      const refIds = allRefs.slice((page - 1) * limit, page * limit);
      let references: WorkOutput[] = [];
      if (refIds.length > 0) {
        const data = await openalexRequest<OpenAlexListResponse<Work>>({
          endpoint: "works",
          params: { filter: `openalex_id:${refIds.join("|")}` },
          perPage: limit,
        });
        // The API returns these in its own order; restore the order of the reference list
        const order = new Map(refIds.map((refId, i) => [refId, i]));
        references = data.results
          .slice()
          .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .map(w => formatWorkJson(w, { compact: true }));
      }
      const title = work.display_name || "Untitled";
      const pagination = makePagination(allRefs.length, page, limit, references.length);
      const output: ReferencesOutput = {
        source_work: { id: work.id, title, total_references: allRefs.length },
        pagination,
        references,
      };
      const text = listText({
        heading: `References in "${title}"`,
        summary: pageSummary(pagination, "references"),
        entries: entries(references, (page - 1) * limit),
        pagination,
        emptyMessage: allRefs.length === 0
          ? `No references found for "${title}".`
          : `No references on page ${page}. Total references: ${allRefs.length}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("fetching references", error);
    }
  });
}
