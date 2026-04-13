// OpenAlex API configuration
export const API_BASE_URL = "https://api.openalex.org";

// Set your email for polite pool access (higher rate limits)
export const POLITE_EMAIL = process.env.OPENALEX_EMAIL || "user@example.com";

// Response limits
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;

// OpenAlex entity prefixes for ID resolution
export const OPENALEX_PREFIXES = {
  work: "W",
  author: "A",
  institution: "I",
  concept: "C",
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
