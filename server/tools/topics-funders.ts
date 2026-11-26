import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { TopicSearchInputSchema, FunderSearchInputSchema } from "../schemas/common.js";
import { TOPIC_LIST_FIELDS, FUNDER_LIST_FIELDS } from "../constants.js";
import { openalexRequest, extractPagination } from "../services/openalex-client.js";
import { listText, pageSummary, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { formatTopicJson, topicListEntry, formatFunderJson, funderListEntry } from "../services/format-entities.js";
import type { Topic, Funder, OpenAlexListResponse } from "../types.js";
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

Returns: Topics with their place in the hierarchy, description, keywords, counts and OpenAlex ID.

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

Returns: Funders with country, description, counts of funded works and awards, and OpenAlex ID.

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
}
