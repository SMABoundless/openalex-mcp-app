// OpenAlex API configuration
export const API_BASE_URL = "https://api.openalex.org";

// OpenAlex meters usage per API key. Without a key, requests share a small
// daily budget with everyone on the same IP address; a free key has its own
// larger budget. Get one at https://openalex.org/settings/api
// The old `mailto` "polite pool" was retired and is ignored by OpenAlex.
export const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY?.trim() || undefined;
export const API_KEY_URL = "https://openalex.org/settings/api";

// Response limits
export const DEFAULT_PER_PAGE = 25;
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
