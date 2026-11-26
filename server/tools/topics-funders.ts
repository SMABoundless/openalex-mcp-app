import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { TopicSearchInputSchema, FunderSearchInputSchema, TopicIdSchema, FunderIdSchema } from "../schemas/common.js";
import { TOPIC_LIST_FIELDS, FUNDER_LIST_FIELDS, PROFILE_YEARS } from "../constants.js";
import { openalexRequest, getEntity, extractPagination, shortId } from "../services/openalex-client.js";
import { listText, pageSummary, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import {
  formatTopicJson,
  topicListEntry,
  formatTopicDetailJson,
  topicDetailMarkdown,
  worksByYear,
  formatFunderJson,
  funderListEntry,
  formatFunderDetailJson,
  funderDetailMarkdown
} from "../services/format-entities.js";
import type { Topic, Funder, OpenAlexListResponse, OpenAlexGroupResponse } from "../types.js";
import type { SearchTopicsOutput, SearchFundersOutput } from "../output-types.js";

export function registerTopicsAndFundersTools(server: McpServer): void {
  registerAppTool(server, "openalex_search_topics", {
    title: "Search OpenAlex Topics",
    description: `Search OpenAlex's topics: about 4,500 research subjects arranged as domain > field > subfield > topic.

Use this to find a topic's OpenAlex ID, then pass it to a works search as filter "topics.id:T10001" (any of a work's topics) or "primary_topic.id:T10001" (its main topic). This finds works on a subject more reliably than keywords alone.

Args:
  - query (string): Subject name or search terms
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): relevance_score:desc, cited_by_count:desc, works_count:desc
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)

Returns: Topics with their place in the hierarchy, description, keywords, counts and OpenAlex ID. Use openalex_get_topic for one topic's full profile.

Examples:
  - "bibliometrics"
  - "machine learning" with sort "works_count:desc"`,
    inputSchema: TopicSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-topics.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Topic>>({
        endpoint: "topics",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
        select: TOPIC_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const topics = data.results.map(formatTopicJson);
      const output: SearchTopicsOutput = { pagination, topics };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Topics matching "${query}"`,
        summary: pageSummary(pagination, "topics"),
        entries: topics.map((t, i) => topicListEntry(t, start + i + 1)),
        pagination,
        emptyMessage: `No topics found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching topics", error);
    }
  });

  registerAppTool(server, "openalex_get_topic", {
    title: "Get Topic Details",
    description: `Retrieve the full profile of a single OpenAlex topic.

Args:
  - id (string): Topic identifier: OpenAlex ID (T10102) or https://openalex.org/T10102

Returns: The topic's place in the hierarchy (domain > field > subfield), description, all keywords, counts of works and citations, works per year, the other topics in the same subfield with their IDs, and a Wikipedia link.`,
    inputSchema: { id: TopicIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-topic.html" } },
  }, async ({ id }) => {
    try {
      const topic = await getEntity<Topic>("topics", id);
      // The topic record has no yearly counts, so they come from a second, metered
      // request. If that fails (for example, the budget is spent) the profile is
      // still returned without them.
      let byYear: ReturnType<typeof worksByYear> = [];
      try {
        const grouped = await openalexRequest<OpenAlexGroupResponse>({
          endpoint: "works",
          params: { filter: `topics.id:${shortId(topic.id)}`, group_by: "publication_year" },
          perPage: 100,
        });
        byYear = worksByYear(grouped.group_by, PROFILE_YEARS);
      } catch {
        byYear = [];
      }
      const output = formatTopicDetailJson(topic, byYear);
      return toolResult(topicDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching topic", error);
    }
  });

  registerAppTool(server, "openalex_search_funders", {
    title: "Search OpenAlex Funders",
    description: `Search for research funders: government agencies, foundations and companies that fund research.

Use this to find a funder's OpenAlex ID, then pass it to a works search as filter "funders.id:F4320306076" to find the research it funded.

Supports name search plus filters:
- country_code: e.g., "US", "GB"
- works_count, cited_by_count: e.g., ">10000"

Args:
  - query (string): Funder name or search terms
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): relevance_score:desc, cited_by_count:desc, works_count:desc
  - limit (number): Results per page (1-100, default: 10)
  - page (number): Page number (default: 1)

Returns: Funders with country, description, counts of funded works and awards, and OpenAlex ID. Use openalex_get_funder for one funder's full profile.

Examples:
  - "National Science Foundation"
  - "cancer" with filter "country_code:GB"`,
    inputSchema: FunderSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/search-funders.html" } },
  }, async ({ query, filter, sort, limit, page }) => {
    try {
      const data = await openalexRequest<OpenAlexListResponse<Funder>>({
        endpoint: "funders",
        params: { search: query, filter, sort },
        perPage: limit,
        page,
        select: FUNDER_LIST_FIELDS,
      });
      const pagination = extractPagination(data.meta, data.results.length);
      const funders = data.results.map(formatFunderJson);
      const output: SearchFundersOutput = { pagination, funders };
      const start = (page - 1) * limit;
      const text = listText({
        heading: `Funders matching "${query}"`,
        summary: pageSummary(pagination, "funders"),
        entries: funders.map((f, i) => funderListEntry(f, start + i + 1)),
        pagination,
        emptyMessage: `No funders found matching "${query}"${filter ? ` with filter "${filter}"` : ""}.`,
      });
      return toolResult(text, output);
    } catch (error) {
      return toolError("searching funders", error);
    }
  });

  registerAppTool(server, "openalex_get_funder", {
    title: "Get Funder Details",
    description: `Retrieve the full profile of a single research funder.

Accepts multiple ID formats:
- OpenAlex ID: F4320306076 or https://openalex.org/F4320306076
- ROR: https://ror.org/021nxhr62

Args:
  - id (string): Funder identifier (OpenAlex ID or ROR)

Returns: The funder's names, country, description, counts of funded works, awards and citations, h-index, funded works per year, and its other OpenAlex records (for example, the same organisation as an institution).`,
    inputSchema: { id: FunderIdSchema },
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/get-funder.html" } },
  }, async ({ id }) => {
    try {
      const funder = await getEntity<Funder>("funders", id);
      const output = formatFunderDetailJson(funder);
      return toolResult(funderDetailMarkdown(output), output);
    } catch (error) {
      return toolError("fetching funder", error);
    }
  });
}
