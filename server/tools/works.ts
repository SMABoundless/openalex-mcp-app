import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { WorkSearchInputSchema, WorkIdSchema, PaginationSchema, CursorSchema } from "../schemas/common.js";
import { WORK_LIST_FIELDS, SEMANTIC_MAX_RESULTS, MAX_PER_PAGE } from "../constants.js";
import { openalexRequest, getEntity, extractPagination, makePagination, queryOql } from "../services/openalex-client.js";
import {
  formatWorkJson,
  workListEntry,
  workDetailMarkdown,
  listText,
  rerankNote,
  pageSummary,
  firstIndex,
  toolResult,
  toolError,
  READ_ONLY_ANNOTATIONS
} from "../services/format-utils.js";
import type { Work, OpenAlexListResponse } from "../types.js";
import type { SearchWorksOutput, CitationsOutput, ReferencesOutput, RelatedWorksOutput, WorkOutput } from "../output-types.js";

const entries = (works: WorkOutput[], pageStart: number): string[] =>
  works.map((w, i) => workListEntry(w, pageStart + i + 1));

/** Fetches the works with these OpenAlex IDs and returns them in the order the IDs were given. */
async function fetchWorksInOrder(ids: string[]): Promise<WorkOutput[]> {
  if (ids.length === 0) return [];
  const data = await openalexRequest<OpenAlexListResponse<Work>>({
    endpoint: "works",
    params: { filter: `openalex_id:${ids.join("|")}` },
    perPage: ids.length,
    select: WORK_LIST_FIELDS,
  });
  const order = new Map(ids.map((workId, i) => [workId, i]));
  return data.results
    .slice()
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(w => formatWorkJson(w, { compact: true }));
}

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
  - query (string): Search query. In semantic mode this can be a sentence or a whole paragraph (up to 2,000 characters).
  - mode (string): "keyword" (default) matches words; "semantic" matches meaning and finds papers that use different wording. Semantic mode returns at most 50 results, ignores sort, page and cursor, and accepts only these filters: publication_year, type, language, is_oa, open_access.is_oa, has_abstract, has_fulltext, is_retracted, authorships.author.id, authorships.institutions.id, primary_location.source.id, funders.id.
  - rerank (boolean): Re-rank the best 100 keyword matches by how well each answers the query. It puts more relevant works first, and suits questions and longer queries. Doubles the search's cost ($0.002 instead of $0.001). Keyword mode in relevance order only. Default: false.
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): Sort order (relevance_score:desc, cited_by_count:desc, publication_date:desc, etc.)
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1). Paging reaches the first 10,000 results.
  - cursor (string, optional): For going past 10,000 results. Pass "*" to start, then the cursor from the previous response.

Returns: List of works with title, authors, source, citation count, open access status, DOI, OpenAlex ID, and a shortened abstract, followed by the query written in OQL for rerunning on openalex.org. Use openalex_get_work for the full abstract and author affiliations.

Examples:
  - "CRISPR gene therapy" with filter "publication_year:2023"
  - "climate change" with filter "cited_by_count:>1000,type:review"
  - "machine learning healthcare" with sort "publication_date:desc"`,
    inputSchema: WorkSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-works.html" } },
  }, async ({ query, mode, rerank, filter, sort, limit, page, cursor }) => {
    try {
      const semantic = mode === "semantic";
      const relevanceOrder = sort === "relevance_score:desc";
      // OpenAlex refuses re-ranking with any other sort, so it is only sent when it can apply
      const askRerank = rerank && !semantic && relevanceOrder;
      const data = await openalexRequest<OpenAlexListResponse<Work>>(
        semantic
          ? {
              endpoint: "works",
              params: { "search.semantic": query, filter },
              perPage: Math.min(limit, SEMANTIC_MAX_RESULTS),
              select: WORK_LIST_FIELDS,
            }
          : {
              endpoint: "works",
              params: { search: query, filter, sort, rerank: askRerank ? true : undefined },
              perPage: limit,
              page,
              cursor,
              select: WORK_LIST_FIELDS,
            }
      );
      const reranked = askRerank && data.meta.reranked === true;
      const note = rerankNote({ requested: rerank, applied: reranked, semantic, relevanceOrder });
      const works = data.results.map(w => formatWorkJson(w, { compact: true }));
      // Semantic search returns one ranked batch with nothing further to page through
      const pagination = semantic
        ? { total: data.meta.count, count: works.length, page: 1, perPage: data.meta.per_page, hasMore: false }
        : extractPagination(data.meta, works.length, Boolean(cursor));
      const oql = queryOql(data.meta);
      const output: SearchWorksOutput = { pagination, works, oql, reranked };
      const shownQuery = query.length > 120 ? `${query.slice(0, 120)}…` : query;
      const text = listText({
        heading: semantic ? `Works closest in meaning to "${shownQuery}"` : `Works matching "${shownQuery}"`,
        summary: semantic
          ? `Semantic search; ${works.length} of the ${pagination.total} closest works shown, most similar first.${note ? ` ${note}` : ""}`
          : `${pageSummary(pagination, "works")}${note ? ` ${note}` : ""}`,
        entries: entries(works, semantic ? 0 : firstIndex(page, limit, cursor)),
        pagination,
        emptyMessage: `No works found matching "${shownQuery}"${filter ? ` with filter "${filter}"` : ""}.`,
        oql,
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
- PMCID: PMC5815332 (PubMed Central ID)

Args:
  - id (string): Work identifier (OpenAlex ID, DOI, PMID or PMCID)

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
  - id (string): Work identifier (OpenAlex ID, DOI, PMID or PMCID)
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)
  - sort: Order by publication_date:desc, publication_date:asc, or cited_by_count:desc
  - cursor (string, optional): For going past 10,000 results. Pass "*" to start, then the cursor from the previous response.

Returns: List of works that cite the specified work, plus its total citation count.`,
    inputSchema: {
      id: WorkIdSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
      sort: z.enum(["publication_date:desc", "publication_date:asc", "cited_by_count:desc"])
        .default("publication_date:desc")
        .describe("Sort order for citing works"),
      cursor: CursorSchema,
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-citations.html" } },
  }, async ({ id, limit, page, sort, cursor }) => {
    try {
      const work = await getEntity<Work>("works", id, "id,display_name,cited_by_count,counts_by_year");
      const data = await openalexRequest<OpenAlexListResponse<Work>>({
        endpoint: "works",
        params: { filter: `cites:${work.id}`, sort },
        perPage: limit,
        page,
        cursor,
        select: WORK_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length, Boolean(cursor));
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
        oql: queryOql(data.meta),
      };
      const text = listText({
        heading: `Works citing "${title}"`,
        summary: pageSummary(pagination, "citing works"),
        entries: entries(citing, firstIndex(page, limit, cursor)),
        pagination,
        emptyMessage: `No citing works found for "${title}".`,
        oql: output.oql,
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
  - id (string): Work identifier (OpenAlex ID, DOI, PMID or PMCID)
  - limit (number): Results per page (1-100, default: 10)
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
      const work = await getEntity<Work>("works", id, "id,display_name,referenced_works");
      const allRefs = work.referenced_works ?? [];
      // The API returns works in its own order; fetchWorksInOrder restores the order of the reference list
      const references = await fetchWorksInOrder(allRefs.slice((page - 1) * limit, page * limit));
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

  // 5. get_related_works
  registerAppTool(server, "openalex_get_related_works", {
    title: "Get Works Related to a Work",
    description: `Find works that OpenAlex judges to be on a similar subject to a given work, whether or not they cite each other.

Use this to:
- Widen a search from one known paper to others like it
- Find similar work that citation tracking misses

OpenAlex lists only a handful of related works for each work (usually 10 to 20), most similar first. For a wider net, use openalex_search_works with mode "semantic".

Args:
  - id (string): Work identifier (OpenAlex ID, DOI, PMID or PMCID)
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)

Returns: List of works related to the specified work.`,
    inputSchema: {
      id: WorkIdSchema,
      limit: PaginationSchema.shape.limit,
      page: PaginationSchema.shape.page,
    },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-related-works.html" } },
  }, async ({ id, limit, page }) => {
    try {
      const work = await getEntity<Work>("works", id, "id,display_name,related_works");
      // Some listed IDs no longer resolve (merged or removed works). The list is
      // short, so fetch it whole, keep what exists, and page through that.
      const allRelated = await fetchWorksInOrder((work.related_works ?? []).slice(0, MAX_PER_PAGE));
      const related = allRelated.slice((page - 1) * limit, page * limit);
      const title = work.display_name || "Untitled";
      const pagination = makePagination(allRelated.length, page, limit, related.length);
      const output: RelatedWorksOutput = {
        source_work: { id: work.id, title, total_related: allRelated.length },
        pagination,
        related_works: related,
      };
      const text = listText({
        heading: `Works related to "${title}"`,
        summary: pageSummary(pagination, "related works"),
        entries: entries(related, (page - 1) * limit),
        pagination,
        emptyMessage: allRelated.length === 0
          ? `OpenAlex lists no related works for "${title}".`
          : `No related works on page ${page}. Total related works: ${allRelated.length}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("fetching related works", error);
    }
  });
}
