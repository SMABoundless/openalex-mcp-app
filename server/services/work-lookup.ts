// Fetching works from a list of mixed identifiers (OpenAlex IDs, DOIs, PMIDs, PMCIDs).
import { REQUEST_CONCURRENCY } from "../constants.js";
import { openalexRequest } from "./openalex-client.js";
import { mapLimit } from "./concurrency.js";
import { bareDoi, groupIdentifiers } from "./export.js";
import type { Work, OpenAlexListResponse } from "../types.js";

/** Identifiers looked up per request; OpenAlex accepts up to 100 values in one filter */
const ID_BATCH = 50;

type IdKind = "openalex_id" | "doi" | "pmid" | "pmcid";

/** The value a work has for one kind of identifier, in the form groupIdentifiers produces. */
function identifierOf(work: Work, kind: IdKind): string | null {
  if (kind === "openalex_id") return work.id.replace("https://openalex.org/", "").toUpperCase();
  if (kind === "doi") return bareDoi(work.doi)?.toLowerCase() ?? null;
  const digits = (kind === "pmid" ? work.ids?.pmid : work.ids?.pmcid)?.match(/(\d+)\/?$/)?.[1];
  if (!digits) return null;
  return kind === "pmid" ? digits : `PMC${digits}`;
}

/**
 * Looks up works by identifier, a batch per kind of identifier. `select` must
 * include `id`, `doi` and `ids` so that results can be matched back to what was
 * asked for. Returns the works found and the identifiers that found nothing.
 */
export async function fetchWorksByIdentifiers(ids: string[], select: string): Promise<{ works: Work[]; notFound: string[] }> {
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
      perPage: 100,
      select,
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
