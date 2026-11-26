import {
  API_BASE_URL,
  API_KEY_URL,
  OPENALEX_API_KEY,
  DEFAULT_PER_PAGE,
  MAX_PER_PAGE,
  MAX_PAGED_RESULTS
} from "../constants.js";
import type { PaginationInfo } from "../output-types.js";

// ============================================
// Usage budget (read from OpenAlex rate-limit headers)
// ============================================

export interface Budget {
  remainingUsd: number;
  limitUsd: number;
  resetSeconds: number | null;
}

let lastBudget: Budget | null = null;

const MAX_RETRIES = 3;

function readBudget(headers: Headers): Budget | null {
  const remaining = Number.parseFloat(headers.get("x-ratelimit-remaining-usd") ?? "");
  const limit = Number.parseFloat(headers.get("x-ratelimit-limit-usd") ?? "");
  if (!Number.isFinite(remaining) || !Number.isFinite(limit)) return null;
  const reset = Number.parseInt(headers.get("x-ratelimit-reset") ?? "", 10);
  return { remainingUsd: remaining, limitUsd: limit, resetSeconds: Number.isFinite(reset) ? reset : null };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(m, 1)}m`;
}

function describeBudget(b: Budget): string {
  const reset = b.resetSeconds != null ? `, resets in ${formatDuration(b.resetSeconds)}` : "";
  return `$${b.remainingUsd.toFixed(3)} of $${b.limitUsd.toFixed(2)} daily OpenAlex budget remaining${reset}`;
}

const KEY_HINT = OPENALEX_API_KEY
  ? ""
  : ` No OPENALEX_API_KEY is set, so requests share one small daily budget with everyone on this IP address. A free key has its own larger budget: get one at ${API_KEY_URL} and set the OPENALEX_API_KEY environment variable.`;

/**
 * A short warning to append to tool output when the daily budget is nearly
 * used up, or an empty string when there is nothing to report.
 */
export function budgetNotice(): string {
  if (!lastBudget || lastBudget.limitUsd <= 0) return "";
  if (lastBudget.remainingUsd / lastBudget.limitUsd > 0.2) return "";
  return `Note: ${describeBudget(lastBudget)}.${KEY_HINT}`;
}

// ============================================
// Errors
// ============================================

export class OpenAlexError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "OpenAlexError";
  }
}

function buildError(status: number, body: string, budget: Budget | null): OpenAlexError {
  const detail = body.replace(/\s+/g, " ").trim().slice(0, 300);
  const budgetText = budget ? ` (${describeBudget(budget)})` : "";

  if (status === 429) {
    // 429 covers two cases: the daily budget is spent, or too many requests per second
    if (budget && budget.remainingUsd <= 0) {
      return new OpenAlexError(
        `OpenAlex daily budget used up${budgetText}.${KEY_HINT || " Wait for the reset or add credit to the key."}`,
        status
      );
    }
    return new OpenAlexError(
      `OpenAlex is rate-limiting requests right now${budgetText}. Try again in a few seconds.${KEY_HINT}`,
      status
    );
  }
  if (status === 401 || status === 403) {
    return new OpenAlexError(
      OPENALEX_API_KEY
        ? `OpenAlex rejected the configured OPENALEX_API_KEY. Check the key at ${API_KEY_URL}.`
        : `OpenAlex refused the request.${KEY_HINT}`,
      status
    );
  }
  if (status === 404) {
    return new OpenAlexError("Not found in OpenAlex. Check that the ID is valid.", status);
  }
  return new OpenAlexError(`OpenAlex API error (${status}): ${detail || "no details"}`, status);
}

// ============================================
// API Request Utilities
// ============================================

export interface RequestOptions {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  perPage?: number;
  page?: number;
  /** Cursor paging: "*" to start, then the next_cursor from the previous response. Replaces page. */
  cursor?: string;
  /** Comma-separated top-level fields to return. */
  select?: string;
}

/**
 * Make a request to the OpenAlex API
 */
export async function openalexRequest<T>(options: RequestOptions): Promise<T> {
  const url = new URL(`${API_BASE_URL}/${options.endpoint}`);

  if (OPENALEX_API_KEY) url.searchParams.set("api_key", OPENALEX_API_KEY);

  const perPage = Math.min(options.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE);
  url.searchParams.set("per_page", String(perPage));

  if (options.cursor) {
    url.searchParams.set("cursor", options.cursor);
  } else if (options.page) {
    url.searchParams.set("page", String(options.page));
  }
  if (options.select) {
    url.searchParams.set("select", options.select);
  }

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  // Short bursts can trip the per-second limit; those are worth a brief retry.
  // A spent daily budget is not, so it fails immediately.
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "openalex-mcp-app/1.0.0"
        }
      });
    } catch {
      // Deliberately not including the cause: it can contain the request URL,
      // which carries the API key.
      throw new OpenAlexError("Could not reach the OpenAlex API (network error).", 0);
    }

    const budget = readBudget(response.headers);
    if (budget) lastBudget = budget;

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    const budgetSpent = budget != null && budget.remainingUsd <= 0;
    if (response.status === 429 && !budgetSpent && attempt < MAX_RETRIES) {
      await response.body?.cancel().catch(() => {});
      const retryAfter = Number.parseFloat(response.headers.get("retry-after") ?? "");
      const waitMs = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 5000) : 600 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, waitMs + Math.random() * 250));
      continue;
    }

    const errorText = await response.text().catch(() => "");
    throw buildError(response.status, errorText, budget);
  }
}

/**
 * Fetch a single entity by ID
 */
export async function getEntity<T>(entityType: string, id: string, select?: string): Promise<T> {
  return openalexRequest<T>({
    endpoint: `${entityType}/${normalizeOpenAlexId(id)}`,
    select
  });
}

// ============================================
// ID Normalization
// ============================================

/**
 * Normalize various ID formats to something the OpenAlex API accepts.
 * Accepts: OpenAlex ID, DOI, PMID, ORCID, ROR, ISSN
 */
export function normalizeOpenAlexId(rawId: string): string {
  const id = rawId.trim();

  // Already an OpenAlex ID
  if (id.startsWith("https://openalex.org/")) {
    return id;
  }

  // Short OpenAlex ID (W123456789, A123456789, etc.)
  if (/^[WAISPFT]\d+$/i.test(id)) {
    return `https://openalex.org/${id.toUpperCase()}`;
  }

  // DOI
  if (id.startsWith("10.") || id.startsWith("https://doi.org/")) {
    const doi = id.replace("https://doi.org/", "");
    return `https://doi.org/${doi}`;
  }

  // ISSN
  if (/^\d{4}-\d{3}[\dXx]$/.test(id)) {
    return `issn:${id.toUpperCase()}`;
  }

  // PMID
  if (/^\d+$/.test(id) && id.length >= 6 && id.length <= 9) {
    return `pmid:${id}`;
  }

  // ORCID
  if (id.includes("orcid.org") || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id)) {
    const orcid = id.replace("https://orcid.org/", "");
    return `https://orcid.org/${orcid}`;
  }

  // ROR
  if (id.startsWith("https://ror.org/") || /^0[a-z0-9]{8}$/.test(id)) {
    const ror = id.replace("https://ror.org/", "");
    return `https://ror.org/${ror}`;
  }

  // Return as-is and let the API handle it
  return id;
}

/** "https://openalex.org/W123" -> "W123" */
export function shortId(id: string): string {
  return id.replace("https://openalex.org/", "");
}

// ============================================
// Pagination
// ============================================

export function makePagination(total: number, page: number, perPage: number, count: number): PaginationInfo {
  const reachable = Math.min(total, MAX_PAGED_RESULTS);
  const hasMore = page * perPage < reachable;
  return {
    total,
    count,
    page,
    perPage,
    hasMore,
    ...(hasMore ? { nextPage: page + 1 } : {})
  };
}

export function extractPagination(
  meta: { count: number; page: number | null; per_page: number; next_cursor?: string | null },
  count: number,
  usedCursor: boolean = false
): PaginationInfo {
  if (usedCursor) {
    const nextCursor = count > 0 && meta.next_cursor ? meta.next_cursor : undefined;
    return {
      total: meta.count,
      count,
      page: 1,
      perPage: meta.per_page,
      hasMore: Boolean(nextCursor),
      cursorMode: true,
      ...(nextCursor ? { nextCursor } : {})
    };
  }
  return makePagination(meta.count, meta.page ?? 1, meta.per_page, count);
}
