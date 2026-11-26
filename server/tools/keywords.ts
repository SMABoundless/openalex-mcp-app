import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { FindKeywordsInputSchema, KeywordSearchInputSchema } from "../schemas/common.js";
import { WORK_LIST_FIELDS, REQUEST_CONCURRENCY, MAX_KEYWORDS, KEYWORD_TOP_TITLES } from "../constants.js";
import { openalexRequest, openalexPost, queryOql } from "../services/openalex-client.js";
import {
  formatWorkJson,
  workListEntry,
  num,
  oqlLine,
  toolResult,
  toolError,
  READ_ONLY_ANNOTATIONS
} from "../services/format-utils.js";
import { percent } from "../services/format-entities.js";
import { mapLimit } from "../services/concurrency.js";
import { buildKeywordQueries, cleanParts, filterClauses, keywordSlug, sampleQuery } from "../services/keywords.js";
import type { Work, OpenAlexListResponse, OpenAlexMeta } from "../types.js";
import type { FindKeywordsOutput, KeywordOutput, KeywordSearchOutput, KeywordSearchPart } from "../output-types.js";

interface KeywordRecord {
  id: string;
  display_name: string;
  description?: string | null;
  display_name_alternatives?: string[] | null;
}

interface SuggestedKeywords {
  keywords?: { id: string; display_name: string; score?: number }[];
}

const KEYWORD_FIELDS = "id,display_name,description,display_name_alternatives";

/** Runs a query for its count alone. */
async function countOf(oql: string): Promise<{ count: number; meta: OpenAlexMeta }> {
  const data = await openalexPost<{ meta: OpenAlexMeta }>("", { oql, per_page: 1, select: "id" });
  return { count: data.meta.count, meta: data.meta };
}

function keywordText(k: KeywordOutput, index: number): string {
  const how = [
    k.score != null ? `matches the description (${k.score.toFixed(2)})` : null,
    k.found_by.length > 0 ? `found by ${k.found_by.map(p => `"${p}"`).join(", ")}` : null
  ].filter(Boolean).join("; ");
  const lines = [`${index}. **${k.name}** · ID: ${k.id} · ${num(k.works_count)} works`];
  if (k.description) lines.push(`   ${k.description}`);
  if (k.alternatives.length > 0) lines.push(`   Also covers: ${k.alternatives.slice(0, 8).join("; ")}`);
  if (k.top_titles.length > 0) lines.push(`   Most cited: ${k.top_titles.join(" | ")}`);
  if (how) lines.push(`   ${how[0].toUpperCase()}${how.slice(1)}`);
  return lines.join("\n");
}

export function registerKeywordsTools(server: McpServer): void {
  registerAppTool(server, "openalex_find_keywords", {
    title: "Find OpenAlex Keywords for a Topic",
    description: `Find the OpenAlex keywords that fit a topic. OpenAlex tags works with keywords from a fixed list, so a keyword finds works on a subject even when their authors used different words. This is the first step of a thorough search: choose the keywords that mean your topic, then pass their IDs to openalex_keyword_search.

Give key phrases, a description, or both:
  - phrases are searched among keyword names and descriptions
  - a description is matched by meaning, and finds keywords the phrases miss

Args:
  - phrases (string[]): Up to 12 key phrases, e.g. ["citation chaining", "snowballing"]
  - description (string, optional): One or two sentences describing the topic. Adds $0.01.
  - per_phrase (number): Keywords taken from each phrase (1-10, default: 5)

Returns: Up to ${MAX_KEYWORDS} keywords, each with its ID, description, the other phrasings it covers, how many works carry it, and its ${KEYWORD_TOP_TITLES} most cited works. Read the titles before choosing: a keyword's name can be broader or narrower than it sounds.

Cost: $0.001 per phrase, $0.01 for a description, and about $0.0001 per keyword returned.`,
    inputSchema: FindKeywordsInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/find-keywords.html" } },
  }, async ({ phrases, description, per_phrase }) => {
    try {
      const wanted = [...new Set(phrases.map(p => p.trim()).filter(Boolean))];
      if (wanted.length === 0 && !description) {
        return toolError("finding keywords", new Error("Give at least one phrase, or a description of the topic."));
      }

      // Keywords in the order they will be shown: those matching the description first
      const found = new Map<string, KeywordOutput>();
      const add = (id: string, name: string): KeywordOutput => {
        const slug = keywordSlug(id);
        let keyword = found.get(slug);
        if (!keyword) {
          keyword = { id: slug, name, description: null, alternatives: [], works_count: 0, top_titles: [], found_by: [], score: null };
          found.set(slug, keyword);
        }
        return keyword;
      };
      const describe = (record: KeywordRecord): void => {
        const keyword = add(record.id, record.display_name);
        keyword.description = record.description ?? null;
        keyword.alternatives = record.display_name_alternatives ?? [];
      };

      if (description) {
        const suggested = await openalexRequest<SuggestedKeywords>({ endpoint: "text/keywords", params: { title: description } });
        for (const k of (suggested.keywords ?? []).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0))) {
          add(k.id, k.display_name).score = typeof k.score === "number" ? k.score : null;
        }
      }

      const searches = await mapLimit(wanted, REQUEST_CONCURRENCY, phrase =>
        openalexRequest<OpenAlexListResponse<KeywordRecord>>({
          endpoint: "keywords",
          params: { search: phrase },
          perPage: per_phrase,
          select: KEYWORD_FIELDS,
        })
      );
      searches.forEach((result, i) => {
        for (const record of result.results) {
          describe(record);
          add(record.id, record.display_name).found_by.push(wanted[i]);
        }
      });

      const all = [...found.values()];
      const keywords = all.slice(0, MAX_KEYWORDS);

      // Keywords that came only from the description still need their details
      const bare = keywords.filter(k => k.description == null && k.found_by.length === 0);
      if (bare.length > 0) {
        const details = await openalexRequest<OpenAlexListResponse<KeywordRecord>>({
          endpoint: "keywords",
          params: { filter: `id:${bare.map(k => k.id).join("|")}` },
          perPage: bare.length,
          select: KEYWORD_FIELDS,
        });
        details.results.forEach(describe);
      }

      // How many works carry each keyword, and which are most cited
      await mapLimit(keywords, REQUEST_CONCURRENCY, async keyword => {
        try {
          const works = await openalexRequest<OpenAlexListResponse<Work>>({
            endpoint: "works",
            params: { filter: `keywords.id:${keyword.id}`, sort: "cited_by_count:desc" },
            perPage: KEYWORD_TOP_TITLES,
            select: "display_name,publication_year",
          });
          keyword.works_count = works.meta.count;
          keyword.top_titles = works.results.map(w => `${w.display_name || "Untitled"}${w.publication_year ? ` (${w.publication_year})` : ""}`);
        } catch {
          // Left at zero works; the keyword is still listed
        }
      });

      const output: FindKeywordsOutput = {
        keywords,
        phrases: wanted,
        used_description: Boolean(description),
        truncated: all.length > keywords.length,
      };
      if (keywords.length === 0) {
        return toolResult("No OpenAlex keywords matched. Try shorter or more general phrases, or add a description of the topic.", output);
      }
      const lines = [
        `## ${keywords.length} keyword${keywords.length === 1 ? "" : "s"} found`,
        "",
        keywords.map((k, i) => keywordText(k, i + 1)).join("\n\n"),
        "",
        "Choose the keywords whose most cited works are on your topic, then pass their IDs to openalex_keyword_search.",
      ];
      if (output.truncated) lines.push(`Only the first ${MAX_KEYWORDS} of ${all.length} are shown; use fewer phrases or a lower per_phrase to narrow them.`);
      return toolResult(lines.join("\n"), output);
    } catch (error) {
      return toolError("finding keywords", error);
    }
  });

  registerAppTool(server, "openalex_keyword_search", {
    title: "Thorough Search with Words and Keywords",
    description: `Run a thorough (high-recall) search that combines words with OpenAlex keywords, and report how much each piece contributes. Use it for systematic or scoping searches, where missing relevant work matters more than a short result list. For a quick search, use openalex_search_works.

Split the topic into parts, such as the method and the population. A work must match every part. Within a part, a work matches if the part's words appear in its title, abstract or keywords, or if it carries one of the keywords you chose for that part with openalex_find_keywords.

Args:
  - parts (object[]): 1-6 parts, each with:
      - label (string): a short name, e.g. "method"
      - text (string, optional): words for the part. Join alternatives with or, put phrases in double quotes, and quote wildcards: "citation chaining" or snowballing or "snowball*"
      - keyword_ids (string[], optional): keyword IDs for the part, e.g. ["citation-searching"]
    Each part needs text, keyword_ids, or both.
  - from_year, to_year (number, optional): Publication years to include
  - types (string[], optional): Work types, e.g. ["article", "review"]
  - open_access_only (boolean): Only open access works
  - language (string, optional): Language code, e.g. "en"
  - sample_size (number): Random matching works to return (0-25, default: 5)

Returns: The number of works matching all parts; how many the words alone find and how many the keywords add; for each part, the works matching its words, its keywords, and either; a random sample of the results for checking that they are on topic; and the query in OQL, for rerunning or exporting on openalex.org.

If the sample is off topic, look at the per-part counts: a part whose keywords add far more than its words is usually carrying a keyword that is too broad.

Cost: up to 3 requests per part plus 3, about $0.001 each when the part has words. Around 1 cent for a two-part search.`,
    inputSchema: KeywordSearchInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/keyword-search.html" } },
  }, async ({ parts, from_year, to_year, types, open_access_only, language, sample_size }) => {
    try {
      const cleaned = cleanParts(parts);
      if (cleaned.problem) return toolError("running the keyword search", new Error(cleaned.problem));
      if (from_year != null && to_year != null && from_year > to_year) {
        return toolError("running the keyword search", new Error("from_year is later than to_year."));
      }
      const filters = { from_year, to_year, types, open_access_only, language };

      // Check the keyword IDs exist, and get their names
      const ids = [...new Set(cleaned.parts.flatMap(p => p.keywordIds))];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const known = await openalexRequest<OpenAlexListResponse<{ id: string; display_name: string }>>({
          endpoint: "keywords",
          params: { filter: `id:${ids.join("|")}` },
          perPage: ids.length,
          select: "id,display_name",
        });
        for (const k of known.results) names.set(keywordSlug(k.id), k.display_name);
        const unknown = ids.filter(id => !names.has(id));
        if (unknown.length > 0) {
          return toolError(
            "running the keyword search",
            new Error(`Not OpenAlex keyword IDs: ${unknown.join(", ")}. Find keyword IDs with openalex_find_keywords.`)
          );
        }
      }

      const queries = buildKeywordQueries(cleaned.parts, filters);

      // Several of these queries can be identical (a part with only words, a
      // search with one part), so each distinct query is run once
      const distinct = [...new Set([
        queries.combined,
        ...(queries.textOnly ? [queries.textOnly] : []),
        ...queries.perPart.flatMap(q => [q.text, q.keywords, q.either].filter((x): x is string => x != null)),
      ])];
      const results = await mapLimit(distinct, REQUEST_CONCURRENCY, countOf);
      const counts = new Map(distinct.map((oql, i) => [oql, results[i]]));
      const count = (oql: string | null): number | null => (oql == null ? null : counts.get(oql)!.count);

      const total = count(queries.combined)!;
      const textOnly = count(queries.textOnly);
      const outputParts: KeywordSearchPart[] = cleaned.parts.map((part, i) => ({
        label: part.label,
        text: part.text,
        keywords: part.keywordIds.map(id => ({ id, name: names.get(id) ?? id })),
        text_count: count(queries.perPart[i].text),
        keyword_count: count(queries.perPart[i].keywords),
        either_count: count(queries.perPart[i].either)!,
      }));

      let sample: Work[] = [];
      if (sample_size > 0 && total > 0) {
        const data = await openalexPost<{ results?: Work[] }>("", {
          oql: sampleQuery(queries.combined, sample_size),
          per_page: sample_size,
          select: WORK_LIST_FIELDS,
        });
        sample = data.results ?? [];
      }

      const output: KeywordSearchOutput = {
        total,
        text_only: textOnly,
        added_by_keywords: textOnly != null ? Math.max(0, total - textOnly) : null,
        parts: outputParts,
        filters: filterClauses(filters).words,
        sample: sample.map(w => formatWorkJson(w, { compact: true })),
        oql: queryOql(counts.get(queries.combined)!.meta) ?? queries.combined,
      };

      const lines = [`## Keyword search: ${num(total)} works`];
      if (output.filters.length > 0) lines.push(`Filters: ${output.filters.join("; ")}.`);
      if (output.text_only != null && output.added_by_keywords != null) {
        const share = total > 0 ? ` (${percent(output.added_by_keywords / total)} of the total)` : "";
        lines.push(`The words alone find ${num(output.text_only)}; the chosen keywords add ${num(output.added_by_keywords)}${share}.`);
      }
      lines.push("", "### Parts (a work must match every one)");
      for (const part of outputParts) {
        const pieces = [
          part.text_count != null ? `words ${num(part.text_count)}` : null,
          part.keyword_count != null ? `keywords ${num(part.keyword_count)}` : null,
          `either ${num(part.either_count)}`
        ].filter(Boolean).join(" · ");
        lines.push(`- **${part.label}**: ${pieces}`);
        if (part.text) lines.push(`  Words: ${part.text}`);
        if (part.keywords.length > 0) lines.push(`  Keywords: ${part.keywords.map(k => `${k.name} [${k.id}]`).join("; ")}`);
      }
      if (output.sample.length > 0) {
        lines.push("", `### Random sample of ${output.sample.length}, to check the results are on topic`);
        output.sample.forEach((w, i) => lines.push(workListEntry(w, i + 1)));
      }
      lines.push("", oqlLine(output.oql));
      return toolResult(lines.join("\n"), output);
    } catch (error) {
      return toolError("running the keyword search", error);
    }
  });
}
