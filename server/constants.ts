// OpenAlex API configuration
export const API_BASE_URL = "https://api.openalex.org";

// OpenAlex meters usage per API key. Without a key, requests share a small
// daily budget with everyone on the same IP address; a free key has its own
// larger budget. Get one at https://openalex.org/settings/api
// The old `mailto` "polite pool" was retired and is ignored by OpenAlex.
export const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY?.trim() || undefined;
export const API_KEY_URL = "https://openalex.org/settings/api";

// Response limits
export const DEFAULT_PER_PAGE = 10;
export const MAX_PER_PAGE = 100;

// OpenAlex basic paging stops at 10,000 results (page * per_page)
export const MAX_PAGED_RESULTS = 10000;

// Text sent to the model is capped at this many characters
export const CHARACTER_LIMIT = 50000;

// Abstracts are shortened to this many characters in result lists;
// openalex_get_work returns the full abstract
export const ABSTRACT_SNIPPET_LENGTH = 300;

// Authors listed per work in result lists
export const LIST_AUTHORS = 5;

// Semantic search returns at most this many results and cannot be paged
export const SEMANTIC_MAX_RESULTS = 50;

// Fields requested for result lists. Asking only for what the formatters use
// keeps responses small and fast. Only top-level fields can be selected.
export const WORK_LIST_FIELDS = [
  "id", "doi", "display_name", "publication_year", "publication_date", "type",
  "authorships", "primary_location", "cited_by_count", "open_access",
  "abstract_inverted_index", "topics", "referenced_works_count"
].join(",");

export const AUTHOR_LIST_FIELDS = [
  "id", "orcid", "display_name", "works_count", "cited_by_count",
  "summary_stats", "last_known_institutions", "affiliations", "topics"
].join(",");

export const INSTITUTION_LIST_FIELDS = [
  "id", "ror", "display_name", "type", "country_code", "geo",
  "works_count", "cited_by_count", "summary_stats"
].join(",");

// OpenAlex entity prefixes for ID resolution
export const OPENALEX_PREFIXES = {
  work: "W",
  author: "A",
  institution: "I",
  source: "S",
  publisher: "P",
  funder: "F",
  topic: "T"
} as const;

// Common work types in OpenAlex
export const WORK_TYPES = [
  "article",
  "book",
  "book-chapter",
  "dataset",
  "dissertation",
  "editorial",
  "erratum",
  "letter",
  "paratext",
  "peer-review",
  "preprint",
  "reference-entry",
  "report",
  "review",
  "standard",
  "other"
] as const;
