import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { AnalyzeWorksInputSchema } from "../schemas/common.js";
import { WORK_LIST_FIELDS, REQUEST_CONCURRENCY } from "../constants.js";
import { openalexRequest } from "../services/openalex-client.js";
import { toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { mapLimit } from "../services/concurrency.js";
import {
  ANALYSIS_GROUPS,
  analysisMarkdown,
  analysisScope,
  buildAnalysis,
  type AnalysisGroupKey,
  type AnalysisParts
} from "../services/format-analysis.js";
import type { Work, OpenAlexListResponse, OpenAlexGroupResponse } from "../types.js";

/** Works listed under "most cited" */
const MOST_CITED = 5;

/** Groups that need every value, not just the largest few */
const FULL_GROUPS: ReadonlySet<AnalysisGroupKey> = new Set(["year", "oaStatus", "countriesCount", "top10"]);

export function registerAnalysisTools(server: McpServer): void {
  registerAppTool(server, "openalex_analyze_works", {
    title: "Summarise a Set of Works",
    description: `Profile a set of works in one call: how many there are, output per year, open access share, types, the leading fields, topics, authors, institutions, countries, journals and funders, the share with international co-authorship, the share that is highly cited, and the most cited works.

Use this for "give me an overview of..." questions about a subject, an institution, an author, a journal or a funder, instead of calling openalex_group_works many times.

Choose the works with a keyword query, a filter, or both. At least one is required.

Args:
  - query (string, optional): Keyword search choosing which works to summarise
  - filter (string, optional): OpenAlex filter syntax, e.g. "authorships.institutions.id:I111979921,publication_year:2020-2024"
  - top (number): Entries listed in each ranking (3-10, default: 5)

Returns: Totals, shares and rankings for the set. Ranked entries that are OpenAlex entities include their ID for use in further filters.

Cost: this makes 13 metered requests, about $0.0013 with a filter alone and about $0.013 with a keyword query. If some fail, the rest is returned and the missing parts are named.

Not included: total or average citations for the set. OpenAlex does not provide them.

Examples:
  - filter "topics.id:T10102,publication_year:2020-2024": a subject over five years
  - filter "authorships.institutions.id:I111979921,publication_year:2024": an institution's year
  - query "citation chaining": everything matching a phrase`,
    inputSchema: AnalyzeWorksInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/analyze-works.html" } },
  }, async ({ query, filter, top }) => {
    try {
      if (!query && !filter) {
        return toolError("summarising works", new Error("Give a query, a filter, or both, to choose which works to summarise."));
      }

      const parts: AnalysisParts = { groups: {} };
      let firstError: unknown;
      const keys = Object.keys(ANALYSIS_GROUPS) as AnalysisGroupKey[];
      const tasks: (() => Promise<void>)[] = keys.map(key => async () => {
        parts.groups[key] = await openalexRequest<OpenAlexGroupResponse>({
          endpoint: "works",
          params: { search: query, filter, group_by: ANALYSIS_GROUPS[key].field },
          perPage: FULL_GROUPS.has(key) ? 100 : top,
        });
      });
      tasks.push(async () => {
        const data = await openalexRequest<OpenAlexListResponse<Work>>({
          endpoint: "works",
          params: { search: query, filter, sort: "cited_by_count:desc" },
          perPage: MOST_CITED,
          select: WORK_LIST_FIELDS,
        });
        parts.mostCited = data.results;
      });

      // Each part is fetched on its own so that one failure does not lose the rest
      await mapLimit(tasks, REQUEST_CONCURRENCY, async task => {
        try {
          await task();
        } catch (error) {
          firstError ??= error;
        }
      });

      // With no counts at all there is nothing to report; say why
      if (Object.keys(parts.groups).length === 0) throw firstError;

      const output = buildAnalysis(parts, { query, filter, top });
      if (output.total_works === 0) {
        const scope = analysisScope(output);
        return toolResult(`No works found${scope ? ` ${scope}` : ""}, so there is nothing to summarise.`, output);
      }
      return toolResult(analysisMarkdown(output), output);
    } catch (error) {
      return toolError("summarising works", error);
    }
  });
}
