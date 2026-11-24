// OpenAlex API configuration
export const API_BASE_URL = "https://api.openalex.org";

// OpenAlex API key (free; required since Feb 2026 for more than ~100 credits/day).
// Get one at https://openalex.org/settings/api and set OPENALEX_API_KEY.
// The old `mailto` "polite pool" was retired and is ignored by OpenAlex.
export const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY?.trim() || undefined;

// Response limits
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;

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
