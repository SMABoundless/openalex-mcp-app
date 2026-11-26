import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { QueryInputSchema } from "../schemas/common.js";
import { openalexPost, extractPagination, OpenAlexError } from "../services/openalex-client.js";
import {
  formatWorkJson,
  workListEntry,
  workListShape,
  listText,
  pageSummary,
  num,
  toolResult,
  toolError,
  READ_ONLY_ANNOTATIONS
} from "../services/format-utils.js";
import {
  entityLine,
  isTableResponse,
  limitRows,
  parseEntities,
  parseTable,
  tableMarkdown,
  validationMessages,
  type QueryResponse
} from "../services/format-query.js";
import type { Work, OpenAlexMeta } from "../types.js";
import type { QueryOutput } from "../output-types.js";

/** What OpenAlex returns when asked to check a query without running it. */
interface QueryCheck {
  oql_oneline?: string;
  oql?: string;
  oqo?: { get_rows?: string; calculate?: unknown[]; group_by?: unknown[]; [key: string]: unknown } | null;
}

const ENTITY_LIST_FIELDS = "id,display_name,works_count,cited_by_count";

/** Runs the query, asking for only the fields the formatters use when the result is a list. */
async function run(oql: string, limit: number, page: number, select: string | null): Promise<QueryResponse> {
  const body = { oql, per_page: limit, page };
  if (!select) return openalexPost<QueryResponse>("", body);
  try {
    return await openalexPost<QueryResponse>("", { ...body, select });
  } catch (error) {
    // Some record types lack one of the fields asked for; fall back to whole records
    if (error instanceof OpenAlexError && error.status === 400) return openalexPost<QueryResponse>("", body);
    throw error;
  }
}

export function registerQueryTools(server: McpServer): void {
  registerAppTool(server, "openalex_query", {
    title: "Run an OpenAlex Query (OQL)",
    description: `Run a query written in OQL, OpenAlex's plain-English query language. Use this when the other tools cannot express the question: several numbers at once (count, mean citations, percent open access), a breakdown by two things, rows kept only above a threshold, or lists of authors, institutions, publishers or funders.

A query is one sentence starting with "get". It is either a list or a table.

LISTS: get <things> <conditions>, <order>
  get works about kelp since 2020, most cited first
  get articles from [Northwestern University](I111979921) from 2024 where it's open access
  get works by [Heather Piwowar](A5048491430) in [PeerJ](S1983995261)
  get works funded by [National Science Foundation](F4320306076) in the topic (T10102)
  get works citing (W2741809807), newest first
  get works where title-abstract has "climate change" and published after 2020
  get institutions in [Norway](NO), most cited first
  get authors at (I111979921) with an h-index above 50
Things: works (or articles, reviews, preprints, books, datasets, dissertations ...), authors, institutions, sources (journals and repositories), publishers, funders, topics, fields, subfields, countries.

TABLES: get the <numbers> of <works ...> by <split>, <order>. <Only ...>
  get the count of works about kelp by year since 2000
  get the count and mean citations of works about kelp by country and year since 2024
  get the count, sum of citations, mean FWCI and percent open access of (I111979921)'s works by field
  get the count and mean FWCI of works about kelp by institution in [Sweden](SE), highest mean FWCI first. Only institutions with at least 10 works about kelp.
  get the count and median citations of works from 2024 in the topic (T10102)   (no "by": one row of totals)
Numbers: count, share, sum of citations, mean citations, median citations, mean FWCI, median FWCI, sum of APCs paid, percent open access, percent retracted, percent top 10% cited, percent top 1% cited, percent with an abstract. Join them with "and".
Splits (at most two): year, type, language, open access, open access status, license, topic, subfield, field, domain, keyword, SDG, author, institution, institution type, country, continent, journal, source, publisher, funder.

RULES
- Entities need their OpenAlex ID in parentheses, with or without a name: [Kenya](KE), (I63966007). A name alone is refused; find the ID first with a search tool. Countries use two-letter codes, languages [English](en), types [review](review).
- Dates: since 2020 (2020 or later), from 2022 (that year), before 2010, from 2018 through 2025. In a where clause: published since 2015, published in 2015, published after 2020.
- Text: about kelp (title, abstract, keywords); with kelp in the title; where title has kelp; where full text has "exact phrase". Two or more bare words need parentheses or quotes. Inside a search use capital AND, OR, NOT: about ((asthma OR wheeze) AND child*). Between conditions use lowercase and, or, not.
- Choices: type is ([article](article) or [review](review)), never commas.
- Other conditions: where citation count is at least 100; where it's open access; where language is [English](en); where it has a DOI.
- Order: the words after the last comma. Lists: most cited first, newest first, oldest first, highest FWCI first, best matches first. Tables: most works first, highest <number> first, lowest <number> first, newest first.

Args:
  - oql (string): The query
  - limit (number): Results for a list, or groups for a table (1-100, default: 25)
  - page (number): Page number (default: 1)
  - detail (string): For lists of works, "full" (default) or "brief", which leaves out abstracts and topics

Returns: For a list, the records. For a table, one row per group with each number, plus the same numbers for the whole set. The query is echoed back as OpenAlex understood it.

Cost: the same as the equivalent search, $0.0001, or $0.001 when the query searches text. A refused query is free and its error says how to fix it, so correct it and try again.

OQL is under active development at OpenAlex, so syntax can change. Trust the error messages over this description.`,
    inputSchema: QueryInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/query.html" } },
  }, async ({ oql, limit, page, detail }) => {
    try {
      // Checking first is free. It rejects a bad query with a hint, and says
      // what kind of thing the query returns, which decides the fields to ask for.
      let check: QueryCheck;
      try {
        check = await openalexPost<QueryCheck>("query", { oql });
      } catch (error) {
        const messages = error instanceof OpenAlexError && error.status === 400 ? validationMessages(error.body) : [];
        if (messages.length === 0) throw error;
        return toolError("running the query", new Error(`OpenAlex could not read this OQL. ${messages.join(" ")}`));
      }

      const entity = check.oqo?.get_rows ?? "works";
      const looksLikeTable = Boolean(check.oqo?.calculate?.length || check.oqo?.group_by?.length);
      const shape = workListShape(detail);
      const select = looksLikeTable ? null : entity === "works" ? shape.select : ENTITY_LIST_FIELDS;
      const data = await run(oql, limit, page, select);

      const echoed = data.meta?.x_query?.oql ?? check.oql_oneline ?? check.oql ?? oql;
      const base = {
        oql: echoed.replace(/\s+/g, " ").trim(),
        entity,
        total: data.meta?.count ?? 0,
        cost_usd: typeof data.meta?.cost_usd === "number" ? data.meta.cost_usd : null,
      };
      const queryLine = `Query as OpenAlex read it: ${base.oql}`;

      if (isTableResponse(data)) {
        const table = limitRows(parseTable(data), limit);
        const output: QueryOutput = { ...base, kind: "table", pagination: null, works: [], entities: [], table };
        const body = tableMarkdown(table);
        const text = [`## Query result: ${num(base.total)} ${entity} counted`, body || "The query returned no rows.", "", queryLine].join("\n");
        return toolResult(text, output);
      }

      const results = data.results ?? [];
      const pagination = extractPagination(data.meta as unknown as OpenAlexMeta, results.length);
      const start = (page - 1) * limit;
      if (entity === "works") {
        const works = (results as unknown as Work[]).map(w => formatWorkJson(w, shape.options));
        const output: QueryOutput = { ...base, kind: "works", pagination, works, entities: [], table: null };
        const text = listText({
          heading: "Query result: works",
          summary: pageSummary(pagination, "works"),
          entries: works.map((w, i) => workListEntry(w, start + i + 1)),
          pagination,
          emptyMessage: `The query matched no works.\n\n${queryLine}`,
        });
        return toolResult(works.length > 0 ? `${text}\n\n${queryLine}` : text, output);
      }

      const entities = parseEntities(results);
      const output: QueryOutput = { ...base, kind: "entities", pagination, works: [], entities, table: null };
      const text = listText({
        heading: `Query result: ${entity}`,
        summary: pageSummary(pagination, entity),
        entries: entities.map((e, i) => entityLine(e, start + i + 1)),
        pagination,
        emptyMessage: `The query matched no ${entity}.\n\n${queryLine}`,
      });
      return toolResult(entities.length > 0 ? `${text}\n\n${queryLine}` : text, output);
    } catch (error) {
      return toolError("running the query", error);
    }
  });
}
