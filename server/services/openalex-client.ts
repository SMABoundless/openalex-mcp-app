import { API_BASE_URL, POLITE_EMAIL, DEFAULT_PER_PAGE, MAX_PER_PAGE } from "../constants.js";
import type { Work } from "../types.js";

// ============================================
// API Request Utilities
// ============================================

export interface RequestOptions {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  perPage?: number;
  page?: number;
}

/**
 * Make a request to the OpenAlex API
 */
export async function openalexRequest<T>(options: RequestOptions): Promise<T> {
  const url = new URL(`${API_BASE_URL}/${options.endpoint}`);
  
  // Add polite pool email for higher rate limits
  url.searchParams.set("mailto", POLITE_EMAIL);
  
  // Add pagination
  const perPage = Math.min(options.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE);
  url.searchParams.set("per-page", String(perPage));
  
  if (options.page) {
    url.searchParams.set("page", String(options.page));
  }
  
  // Add other params (skip undefined values)
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "openalex-mcp-server/1.0.0"
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenAlex API error (${response.status}): ${errorText}`);
  }
  
  return response.json() as Promise<T>;
}

/**
 * Fetch a single entity by ID
 */
export async function getEntity<T>(entityType: string, id: string): Promise<T> {
  // Normalize ID - remove URL prefix if present
  const normalizedId = normalizeOpenAlexId(id);
  
  return openalexRequest<T>({
    endpoint: `${entityType}/${normalizedId}`
  });
}

// ============================================
// ID Normalization
// ============================================

/**
 * Normalize various ID formats to OpenAlex ID
 * Accepts: OpenAlex ID, DOI, PMID, ORCID, ROR
 */
export function normalizeOpenAlexId(id: string): string {
  // Already an OpenAlex ID
  if (id.startsWith("https://openalex.org/")) {
    return id;
  }
  
  // Short OpenAlex ID (W123456789, A123456789, etc.)
  if (/^[WAICSPFT]\d+$/.test(id)) {
    return `https://openalex.org/${id}`;
  }
  
  // DOI
  if (id.startsWith("10.") || id.startsWith("https://doi.org/")) {
    const doi = id.replace("https://doi.org/", "");
    return `https://doi.org/${doi}`;
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

// ============================================
// Abstract Reconstruction
// ============================================

/**
 * Reconstruct abstract from inverted index
 * OpenAlex stores abstracts as {word: [positions]} for compression
 */
export function reconstructAbstract(invertedIndex: Record<string, number[]> | undefined): string | null {
  if (!invertedIndex || Object.keys(invertedIndex).length === 0) {
    return null;
  }
  
  const words: [string, number][] = [];
  
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words.push([word, pos]);
    }
  }
  
  // Sort by position and join
  words.sort((a, b) => a[1] - b[1]);
  return words.map(([word]) => word).join(" ");
}

// ============================================
// Response Formatting
// ============================================

export interface PaginationInfo {
  total: number;
  count: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  nextPage?: number;
}

export function extractPagination(meta: { count: number; page: number; per_page: number }): PaginationInfo {
  const total = meta.count;
  const page = meta.page;
  const perPage = meta.per_page;
  const hasMore = page * perPage < total;
  
  return {
    total,
    count: Math.min(perPage, total - (page - 1) * perPage),
    page,
    perPage,
    hasMore,
    ...(hasMore ? { nextPage: page + 1 } : {})
  };
}

/**
 * Format authors list for display
 */
export function formatAuthors(authorships: Work["authorships"], maxAuthors: number = 5): string {
  if (!authorships || authorships.length === 0) {
    return "Unknown authors";
  }
  
  const names = authorships.slice(0, maxAuthors).map(a => a.author.display_name);
  
  if (authorships.length > maxAuthors) {
    names.push(`et al. (${authorships.length} total)`);
  }
  
  return names.join(", ");
}

/**
 * Format a single work for markdown display
 */
export function formatWorkMarkdown(work: Work, includeAbstract: boolean = true): string {
  const lines: string[] = [];
  
  // Title and year
  const year = work.publication_year ? ` (${work.publication_year})` : "";
  lines.push(`### ${work.display_name}${year}`);
  lines.push("");
  
  // Authors
  lines.push(`**Authors:** ${formatAuthors(work.authorships)}`);
  
  // Source/Journal
  if (work.primary_location?.source) {
    lines.push(`**Source:** ${work.primary_location.source.display_name}`);
  }
  
  // Citations
  lines.push(`**Citations:** ${work.cited_by_count.toLocaleString()}`);
  
  // Open Access status
  if (work.open_access.is_oa) {
    lines.push(`**Open Access:** Yes (${work.open_access.oa_status})`);
    if (work.open_access.oa_url) {
      lines.push(`**OA Link:** ${work.open_access.oa_url}`);
    }
  }
  
  // DOI
  if (work.doi) {
    lines.push(`**DOI:** ${work.doi}`);
  }
  
  // OpenAlex ID
  lines.push(`**OpenAlex ID:** ${work.id}`);
  
  // Abstract
  if (includeAbstract) {
    const abstract = reconstructAbstract(work.abstract_inverted_index);
    if (abstract) {
      lines.push("");
      lines.push(`**Abstract:** ${abstract}`);
    }
  }
  
  // Topics/Concepts
  if (work.topics && work.topics.length > 0) {
    const topTopics = work.topics.slice(0, 3).map(t => t.display_name);
    lines.push(`**Topics:** ${topTopics.join(", ")}`);
  } else if (work.concepts && work.concepts.length > 0) {
    const topConcepts = work.concepts
      .filter(c => c.score > 0.5)
      .slice(0, 3)
      .map(c => c.display_name);
    if (topConcepts.length > 0) {
      lines.push(`**Concepts:** ${topConcepts.join(", ")}`);
    }
  }
  
  return lines.join("\n");
}

/**
 * Format work for JSON output (cleaned up structure)
 */
export function formatWorkJson(work: Work): Record<string, unknown> {
  return {
    id: work.id,
    doi: work.doi,
    title: work.display_name,
    publication_year: work.publication_year,
    publication_date: work.publication_date,
    type: work.type,
    authors: work.authorships.map(a => ({
      name: a.author.display_name,
      id: a.author.id,
      orcid: a.author.orcid,
      position: a.author_position,
      institutions: a.institutions.map(i => ({
        name: i.display_name,
        id: i.id,
        country: i.country_code
      }))
    })),
    source: work.primary_location?.source ? {
      name: work.primary_location.source.display_name,
      id: work.primary_location.source.id,
      type: work.primary_location.source.type,
      is_oa: work.primary_location.source.is_oa
    } : null,
    cited_by_count: work.cited_by_count,
    open_access: {
      is_oa: work.open_access.is_oa,
      status: work.open_access.oa_status,
      url: work.open_access.oa_url
    },
    abstract: reconstructAbstract(work.abstract_inverted_index),
    topics: work.topics?.slice(0, 5).map(t => ({
      name: t.display_name,
      id: t.id,
      score: t.score
    })),
    referenced_works_count: work.referenced_works?.length ?? 0,
    related_works_count: work.related_works?.length ?? 0
  };
}
