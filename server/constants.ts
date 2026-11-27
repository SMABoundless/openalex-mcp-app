// OpenAlex API configuration
export const API_BASE_URL = "https://api.openalex.org";
// Stored full text (PDF and TEI XML) is served from a separate host
export const CONTENT_BASE_URL = "https://content.openalex.org";

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

// The same without abstracts and topics, for detail: "brief"
export const WORK_BRIEF_FIELDS = [
  "id", "doi", "display_name", "publication_year", "publication_date", "type",
  "authorships", "primary_location", "cited_by_count", "open_access", "referenced_works_count"
].join(",");

export const AUTHOR_LIST_FIELDS = [
  "id", "orcid", "display_name", "works_count", "cited_by_count",
  "summary_stats", "last_known_institutions", "affiliations", "topics"
].join(",");

export const SOURCE_LIST_FIELDS = [
  "id", "display_name", "type", "issn_l", "issn", "host_organization_name", "country_code",
  "is_oa", "is_in_doaj", "apc_usd", "works_count", "cited_by_count", "summary_stats", "homepage_url"
].join(",");

export const TOPIC_LIST_FIELDS = [
  "id", "display_name", "description", "keywords", "subfield", "field", "domain",
  "works_count", "cited_by_count"
].join(",");

export const FUNDER_LIST_FIELDS = [
  "id", "display_name", "alternate_titles", "country_code", "description", "homepage_url",
  "ids", "awards_count", "works_count", "cited_by_count", "summary_stats"
].join(",");

export const PUBLISHER_LIST_FIELDS = [
  "id", "display_name", "alternate_titles", "hierarchy_level", "parent_publisher", "country_codes",
  "homepage_url", "works_count", "cited_by_count", "summary_stats", "ids"
].join(",");

// A publisher's profile lists this many of its largest sources
export const PUBLISHER_TOP_SOURCES = 10;

// Topic, funder and publisher profiles report this many recent years.
// OpenAlex's own yearly counts for a funder can reach back to the 1800s.
export const PROFILE_YEARS = 15;

export const INSTITUTION_LIST_FIELDS = [
  "id", "ror", "display_name", "type", "country_code", "geo",
  "works_count", "cited_by_count", "summary_stats"
].join(",");

// openalex_analyze_works charts this many recent years
export const ANALYZE_YEARS = 25;

// openalex_resolve_references accepts this many references in one call
export const MAX_REFERENCES = 25;

// Requests in flight at once when a tool makes several. Higher values trip
// OpenAlex's per-second limit.
export const REQUEST_CONCURRENCY = 3;

// OpenAlex allows about one semantic search per second
export const SEMANTIC_INTERVAL_MS = 1100;

// openalex_get_reviews: reviews listed per call, and the most stored texts it
// will pay for in one call
export const MAX_REVIEWS = 25;
export const MAX_PAID_REVIEW_TEXTS = 5;

// Each review's text is cut to this many characters, and all the texts in one
// result together to REVIEW_TEXT_BUDGET
export const REVIEW_TEXT_LENGTH = 15000;
export const REVIEW_TEXT_BUDGET = 40000;

// openalex_find_keywords returns at most this many keywords, each with this many of its most cited titles
export const MAX_KEYWORDS = 30;
export const KEYWORD_TOP_TITLES = 3;

// openalex_export_works: records per file, by default and at most
export const EXPORT_DEFAULT_RECORDS = 100;
export const EXPORT_MAX_RECORDS = 500;
// A file up to this many characters is also given to the model as text
export const EXPORT_TEXT_LIMIT = 20000;

// openalex_keyword_search: seed papers checked per call, and keywords shown for each seed it misses
export const MAX_SEEDS = 25;
export const SEED_KEYWORDS = 8;

// openalex_read_docs returns a whole page up to this many characters; a longer
// page comes back as its opening and a list of sections to ask for
export const DOCS_PAGE_LIMIT = 30000;

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
