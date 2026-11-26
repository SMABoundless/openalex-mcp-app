import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { ExportWorksInputSchema } from "../schemas/common.js";
import { CHARACTER_LIMIT, EXPORT_MAX_RECORDS, EXPORT_TEXT_LIMIT, REQUEST_CONCURRENCY } from "../constants.js";
import { openalexRequest, queryOql } from "../services/openalex-client.js";
import { num, oqlLine, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { mapLimit } from "../services/concurrency.js";
import {
  EXPORT_FIELDS,
  bareDoi,
  dedupeRecords,
  exportFile,
  groupIdentifiers,
  summariseRepeats,
  toExportRecord
} from "../services/export.js";
import type { Work, OpenAlexListResponse } from "../types.js";
import type { ExportWorksOutput } from "../output-types.js";

/** Identifiers looked up per request; OpenAlex accepts up to 100 values in one filter */
const ID_BATCH = 50;
const PAGE_SIZE = 100;

type IdKind = "openalex_id" | "doi" | "pmid" | "pmcid";

/** The value a work has for one kind of identifier, in the form groupIdentifiers produces. */
function identifierOf(work: Work, kind: IdKind): string | null {
  if (kind === "openalex_id") return work.id.replace("https://openalex.org/", "").toUpperCase();
  if (kind === "doi") return bareDoi(work.doi)?.toLowerCase() ?? null;
  const digits = (kind === "pmid" ? work.ids?.pmid : work.ids?.pmcid)?.match(/(\d+)\/?$/)?.[1];
  if (!digits) return null;
  return kind === "pmid" ? digits : `PMC${digits}`;
}

async function fetchByIds(ids: string[]): Promise<{ works: Work[]; notFound: string[] }> {
  const groups = groupIdentifiers(ids);
  const batches: { kind: IdKind; values: string[] }[] = [];
  for (const kind of ["openalex_id", "doi", "pmid", "pmcid"] as const) {
    for (let i = 0; i < groups[kind].length; i += ID_BATCH) batches.push({ kind, values: groups[kind].slice(i, i + ID_BATCH) });
  }
  const works: Work[] = [];
  const notFound = [...groups.unknown];
  const results = await mapLimit(batches, REQUEST_CONCURRENCY, batch =>
    openalexRequest<OpenAlexListResponse<Work>>({
      endpoint: "works",
      params: { filter: `${batch.kind}:${batch.values.join("|")}` },
      perPage: PAGE_SIZE,
      select: EXPORT_FIELDS,
    })
  );
  results.forEach((result, i) => {
    const { kind, values } = batches[i];
    const found = new Set(result.results.map(w => identifierOf(w, kind)).filter(Boolean));
    works.push(...result.results);
    for (const value of values) {
      if (!found.has(kind === "doi" ? value.toLowerCase() : value)) notFound.push(value);
    }
  });
  return { works, notFound };
}

async function fetchBySearch(
  query: string | undefined,
  filter: string | undefined,
  sort: string,
  max: number
): Promise<{ works: Work[]; matched: number; oql: string | null }> {
  // Relevance order only exists for a keyword search
  const order = !query && sort === "relevance_score:desc" ? "cited_by_count:desc" : sort;
  const works: Work[] = [];
  let cursor: string | undefined = "*";
  let matched = 0;
  let oql: string | null = null;
  while (cursor && works.length < max) {
    const data: OpenAlexListResponse<Work> = await openalexRequest<OpenAlexListResponse<Work>>({
      endpoint: "works",
      params: { search: query, filter, sort: order },
      perPage: Math.min(PAGE_SIZE, max - works.length),
      cursor,
      select: EXPORT_FIELDS,
    });
    if (works.length === 0) {
      matched = data.meta.count;
      oql = queryOql(data.meta);
    }
    works.push(...data.results);
    cursor = data.results.length > 0 ? data.meta.next_cursor ?? undefined : undefined;
  }
  return { works: works.slice(0, max), matched, oql };
}

export function registerExportTools(server: McpServer): void {
  registerAppTool(server, "openalex_export_works", {
    title: "Export Works as RIS, BibTeX or CSV",
    description: `Export works as a file for a reference manager, a screening tool or a spreadsheet.

Formats:
  - ris (default): Zotero, EndNote, Mendeley, Covidence, Rayyan
  - bibtex: LaTeX and BibTeX-based tools
  - csv: a spreadsheet, with a full-text link (LibKey) in each row

Choose the works in one of two ways:
  - ids: a list of OpenAlex IDs, DOIs, PMIDs or PMCIDs, for works already found
  - a search: query and/or filter, as in openalex_search_works. The filter can also name a set by its relation to a work or person:
      "cites:W2741809807" (works that cite a work), "cited_by:W2741809807" (its reference list),
      "authorships.author.id:A5048491430" (an author's works), "primary_location.source.id:S1983995261" (a journal)

Args:
  - format (string): ris, bibtex or csv
  - ids (string[], optional): Up to ${EXPORT_MAX_RECORDS} identifiers
  - query (string, optional): Keyword search
  - filter (string, optional): OpenAlex filter syntax
  - sort (string): Order for a search; the first max_records in this order are exported
  - max_records (number): Most records in the file for a search (1-${EXPORT_MAX_RECORDS}, default: 100)
  - abstracts (boolean): Include abstracts (default: true)
  - include_file (boolean, optional): Return the file's text in the reply. Unset, a file under ${num(EXPORT_TEXT_LIMIT)} characters is included and a larger one is not.

Returns: The file, with how many records it holds, how many works matched, how many duplicates were removed (by DOI, then OpenAlex ID) and which, and any identifiers that were not found. In a host that shows views, the file can be downloaded or copied from the view.

Limits to tell the user about:
  - Author names are turned into "Surname, Given" by rule, which is wrong for some names.
  - A preprint and its published version are separate records with different DOIs, so both are kept.
  - The numbers here cover identification only. Screening and inclusion counts for a PRISMA diagram come from the screening tool.

Cost: about $0.0001 per 100 records, or $0.001 per 100 with a keyword query.`,
    inputSchema: ExportWorksInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/export-works.html" } },
  }, async ({ format, ids, query, filter, sort, max_records, abstracts, include_file }) => {
    try {
      const byIds = Boolean(ids && ids.length > 0);
      const bySearch = Boolean(query || filter);
      if (byIds && bySearch) {
        return toolError("exporting works", new Error("Give either ids, or a search (query and/or filter), not both."));
      }
      if (!byIds && !bySearch) {
        return toolError("exporting works", new Error("Say which works to export: a list of ids, or a search (query and/or filter)."));
      }

      let works: Work[];
      let matched: number | null = null;
      let oql: string | null = null;
      let notFound: string[] = [];
      if (byIds) {
        ({ works, notFound } = await fetchByIds(ids!));
      } else {
        ({ works, matched, oql } = await fetchBySearch(query, filter, sort, max_records));
      }

      const { records, removedIds } = dedupeRecords(works.map(w => toExportRecord(w, { abstracts })));
      const now = new Date();
      const file = exportFile(records, format, now);
      const output: ExportWorksOutput = {
        format,
        filename: file.filename,
        mime_type: file.mimeType,
        content: file.content,
        records: records.length,
        matched,
        truncated: matched != null && matched > works.length,
        duplicates_removed: removedIds.length,
        removed_ids: removedIds,
        not_found: notFound,
        oql,
        exported_at: now.toISOString(),
        abstracts,
      };

      if (records.length === 0) {
        const why = notFound.length > 0 ? ` Not found: ${notFound.join(", ")}.` : "";
        return toolResult(`Nothing to export: no works were found.${why}`, output);
      }

      const lines = [
        `## ${file.label} export: ${num(records.length)} record${records.length === 1 ? "" : "s"}`,
        `File: ${file.filename} (${num(file.content.length)} characters${abstracts ? ", with abstracts" : ", without abstracts"}). Exported ${now.toISOString().slice(0, 10)} from OpenAlex.`,
      ];
      if (matched != null) {
        lines.push(
          output.truncated
            ? `The search matched ${num(matched)} works; the file holds the first ${num(works.length)} in the chosen order. Raise max_records (up to ${EXPORT_MAX_RECORDS}) or narrow the search to get the rest.`
            : `The search matched ${num(matched)} works, all exported.`
        );
      }
      if (removedIds.length > 0) {
        lines.push(`Repeats of works already in the file removed: ${removedIds.length} (${summariseRepeats(removedIds)}), matched by DOI, then OpenAlex ID.`);
      }
      if (notFound.length > 0) lines.push(`Not found in OpenAlex, so not in the file: ${notFound.join(", ")}.`);
      if (oql) lines.push(oqlLine(oql));

      const wanted = include_file ?? file.content.length <= EXPORT_TEXT_LIMIT;
      if (wanted && file.content.length <= CHARACTER_LIMIT) {
        lines.push("", "The file:", "", "```", file.content.trimEnd(), "```");
      } else if (wanted) {
        lines.push("", `The file is too large to include here (limit ${num(CHARACTER_LIMIT)} characters). Export fewer records, or turn abstracts off.`);
      } else {
        lines.push("", "The file's text is not repeated here. In a host that shows views, download or copy it from the view; otherwise call again with include_file: true.");
      }
      return toolResult(lines.join("\n"), output);
    } catch (error) {
      return toolError("exporting works", error);
    }
  });
}
