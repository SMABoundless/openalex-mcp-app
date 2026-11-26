import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { ResolveReferencesInputSchema } from "../schemas/common.js";
import { WORK_LIST_FIELDS, REQUEST_CONCURRENCY, SEMANTIC_INTERVAL_MS, MAX_REFERENCES } from "../constants.js";
import { openalexRequest, getEntity, OpenAlexError } from "../services/openalex-client.js";
import { formatWorkJson, workListEntry, toolResult, toolError, READ_ONLY_ANNOTATIONS } from "../services/format-utils.js";
import { percent } from "../services/format-entities.js";
import { mapLimit, spacedQueue } from "../services/concurrency.js";
import {
  parseReference,
  titleCandidates,
  titleSearchValue,
  bestCandidate,
  judgeIdentifiedWork,
  titleSaysRetracted,
  words
} from "../services/references.js";
import type { Work, OpenAlexListResponse } from "../types.js";
import type { ResolvedReference, ResolveReferencesOutput, ReferenceStatus } from "../output-types.js";

const REFERENCE_FIELDS = `${WORK_LIST_FIELDS},is_retracted`;

/** Title guesses tried per citation before falling back to semantic search */
const TITLE_ATTEMPTS = 2;
/** Candidates looked at per search */
const CANDIDATES = 5;

const ID_PREFIX = { doi: "", pmid: "pmid:", openalex_id: "" } as const;

type Found = Pick<ResolvedReference, "status" | "method" | "work" | "is_retracted" | "title_similarity" | "notes">;

const NOT_FOUND: Found = {
  status: "not_found", method: null, work: null, is_retracted: false, title_similarity: null, notes: []
};

function found(work: Work, method: Found["method"], status: ReferenceStatus, similarity: number, notes: string[]): Found {
  // OpenAlex's retraction flag misses some works whose title carries the publisher's retraction note
  const flagged = Boolean(work.is_retracted);
  const retracted = flagged || titleSaysRetracted(work.display_name ?? "");
  const retractionNote = flagged
    ? "This work has been retracted."
    : "The title of this work in OpenAlex marks it as retracted.";
  return {
    status,
    method,
    work: formatWorkJson(work, { compact: true }),
    is_retracted: retracted,
    title_similarity: similarity,
    notes: retracted ? [retractionNote, ...notes] : notes
  };
}

async function searchByTitle(reference: string, semantic: ReturnType<typeof spacedQueue>): Promise<Found> {
  const pick = (works: Work[], method: Found["method"]): Found | null => {
    const byId = new Map(works.map(w => [w.id, w]));
    const best = bestCandidate(works.map(w => formatWorkJson(w, { compact: true })), reference);
    if (!best || best.judgement.status === "not_found") return null;
    return found(byId.get(best.work.id)!, method, best.judgement.status, best.judgement.similarity, best.judgement.notes);
  };

  let fallback: Found | null = null;
  // A title search needs every word to be in the title, so try the likeliest pieces of the citation in turn
  for (const title of titleCandidates(reference).slice(0, TITLE_ATTEMPTS)) {
    const value = titleSearchValue(title);
    if (words(value).length < 2) continue;
    const data = await openalexRequest<OpenAlexListResponse<Work>>({
      endpoint: "works",
      params: { filter: `title.search:${value}` },
      perPage: CANDIDATES,
      select: REFERENCE_FIELDS,
    });
    const result = pick(data.results, "title_search");
    if (result?.status === "likely") return result;
    fallback ??= result;
  }

  // Citations without clear punctuation defeat the title guess; semantic search copes with those
  const data = await semantic(() => openalexRequest<OpenAlexListResponse<Work>>({
    endpoint: "works",
    params: { "search.semantic": reference },
    perPage: CANDIDATES,
    select: REFERENCE_FIELDS,
  }));
  const result = pick(data.results, "semantic_search");
  if (result?.status === "likely") return result;
  return fallback ?? result ?? NOT_FOUND;
}

async function resolveOne(reference: string, semantic: ReturnType<typeof spacedQueue>): Promise<Found> {
  const parsed = parseReference(reference);

  if (parsed.id) {
    try {
      const work = await getEntity<Work>("works", `${ID_PREFIX[parsed.id.kind]}${parsed.id.value}`, REFERENCE_FIELDS);
      const judgement = judgeIdentifiedWork(formatWorkJson(work, { compact: true }), reference, parsed.hasText);
      return found(work, parsed.id.kind, judgement.status, judgement.similarity, judgement.notes);
    } catch (error) {
      if (!(error instanceof OpenAlexError) || error.status !== 404) throw error;
      const label = parsed.id.kind === "doi" ? "DOI" : parsed.id.kind === "pmid" ? "PMID" : "OpenAlex ID";
      const note = `The ${label} ${parsed.id.value} is not in OpenAlex.`;
      if (!parsed.hasText) return { ...NOT_FOUND, notes: [note] };
      // The identifier may be mistyped; the rest of the citation can still be matched
      const byTitle = await searchByTitle(reference, semantic);
      return { ...byTitle, notes: [note, ...byTitle.notes] };
    }
  }

  return searchByTitle(reference, semantic);
}

const STATUS_LABEL: Record<ReferenceStatus, string> = {
  matched: "Found",
  likely: "Likely match",
  possible: "Possible match, check it",
  not_found: "Not found",
  error: "Could not be checked"
};

function referenceText(r: ResolvedReference): string {
  const shown = r.input.length > 200 ? `${r.input.slice(0, 200)}…` : r.input;
  const how = r.method === "title_search" || r.method === "semantic_search"
    ? ` (title match ${percent(r.title_similarity ?? 0)})`
    : "";
  const lines = [`${r.index}. **${STATUS_LABEL[r.status]}**${how}${r.is_retracted ? " · RETRACTED" : ""}`, `   Reference: ${shown}`];
  if (r.work) {
    // Reuse the list layout without its number or abstract
    const entry = workListEntry({ ...r.work, abstract: null }, 0).split("\n");
    lines.push(`   Work: ${entry[0].replace(/^0\. /, "")}`, ...entry.slice(1));
  }
  for (const note of r.notes) lines.push(`   Note: ${note}`);
  return lines.join("\n");
}

export function registerReferencesTools(server: McpServer): void {
  registerAppTool(server, "openalex_resolve_references", {
    title: "Check References Against OpenAlex",
    description: `Check a list of references against OpenAlex: confirm each one exists, get its correct details, and flag any that are retracted.

Use this to:
- Verify a reference list or bibliography, including references written by an AI model
- Turn loosely written citations into records with DOIs and OpenAlex IDs
- Spot retracted papers in a reference list

Each reference can be a DOI, a PMID, an OpenAlex ID, or a citation in any style. A citation containing a DOI is looked up by that DOI, and its title is compared with the work the DOI leads to. A citation without an identifier is matched by its title.

Args:
  - references (string[]): 1-${MAX_REFERENCES} references, one per item

Returns: For each reference, in the order given, a status and the matching work if there is one:
  - Found: located by its identifier
  - Likely match: located by title; nearly all of the title, an author and the year agree
  - Possible match: something similar exists but it differs (the notes say how); check it by hand
  - Not found: nothing close enough in OpenAlex. This does not prove the reference is invented: OpenAlex is large but not complete, and books and older works are less well covered.

Cost: references with an identifier are free. Each citation without one costs $0.001 to $0.003.`,
    inputSchema: ResolveReferencesInputSchema,
    annotations: READ_ONLY_ANNOTATIONS,
    _meta: { ui: { resourceUri: "ui://openalex/resolve-references.html" } },
  }, async ({ references }) => {
    try {
      const semantic = spacedQueue(SEMANTIC_INTERVAL_MS);
      let firstError: unknown;
      const results = await mapLimit(references, REQUEST_CONCURRENCY, async (input, i): Promise<ResolvedReference> => {
        try {
          return { index: i + 1, input, ...(await resolveOne(input, semantic)) };
        } catch (error) {
          firstError ??= error;
          const message = error instanceof Error ? error.message : String(error);
          return { index: i + 1, input, ...NOT_FOUND, status: "error", notes: [message] };
        }
      });

      // If nothing could be checked, report the cause as an error instead of a list of failures
      if (results.every(r => r.status === "error")) throw firstError;

      const count = (status: ReferenceStatus): number => results.filter(r => r.status === status).length;
      const output: ResolveReferencesOutput = {
        results,
        summary: {
          total: results.length,
          matched: count("matched"),
          likely: count("likely"),
          possible: count("possible"),
          not_found: count("not_found"),
          errors: count("error"),
          retracted: results.filter(r => r.is_retracted).length,
        },
      };

      const s = output.summary;
      const tally = [
        `${s.matched} found`,
        `${s.likely} likely`,
        `${s.possible} possible`,
        `${s.not_found} not found`,
        s.errors > 0 ? `${s.errors} could not be checked` : null,
      ].filter(Boolean).join(", ");
      const text = [
        `## ${s.total} reference${s.total === 1 ? "" : "s"} checked`,
        `${tally}.${s.retracted > 0 ? ` ${s.retracted} retracted.` : ""}`,
        "",
        results.map(referenceText).join("\n\n"),
      ].join("\n");
      return toolResult(text, output);
    } catch (error) {
      return toolError("checking references", error);
    }
  });
}
