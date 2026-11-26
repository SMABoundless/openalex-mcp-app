import { z } from "zod";
import { MAX_PER_PAGE, DEFAULT_PER_PAGE, MAX_REFERENCES, MAX_REVIEWS, MAX_PAID_REVIEW_TEXTS } from "../constants.js";

// ============================================
// Common Parameter Schemas
// ============================================

export const PaginationSchema = z.object({
  limit: z.number()
    .int()
    .min(1)
    .max(MAX_PER_PAGE)
    .default(DEFAULT_PER_PAGE)
    .describe(`Maximum results to return (1-${MAX_PER_PAGE}, default: ${DEFAULT_PER_PAGE})`),
  page: z.number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination (starts at 1)")
});

export const CursorSchema = z.string()
  .min(1)
  .optional()
  .describe(
    "Cursor paging, for going past the first 10,000 results. Pass \"*\" to start, then the cursor " +
    "returned with the previous response. When set, page is ignored. Needs an API key after the first batch."
  );

// Sort options
export const WorkSortSchema = z.enum([
  "relevance_score:desc",
  "cited_by_count:desc",
  "cited_by_count:asc",
  "publication_date:desc",
  "publication_date:asc",
  "publication_year:desc",
  "publication_year:asc"
]).default("relevance_score:desc")
  .describe("Sort order for results");

export const AuthorSortSchema = z.enum([
  "relevance_score:desc",
  "cited_by_count:desc",
  "cited_by_count:asc",
  "works_count:desc",
  "works_count:asc"
]).default("relevance_score:desc")
  .describe("Sort order for author results");

export const InstitutionSortSchema = z.enum([
  "relevance_score:desc",
  "cited_by_count:desc",
  "cited_by_count:asc",
  "works_count:desc",
  "works_count:asc"
]).default("relevance_score:desc")
  .describe("Sort order for institution results");

// ============================================
// ID Schemas
// ============================================

export const WorkIdSchema = z.string()
  .min(1)
  .describe(
    "Work identifier. Accepts: OpenAlex ID (W2741809807), DOI (10.1038/s41586-020-2649-2), " +
    "or full URLs (https://doi.org/..., https://openalex.org/W...)"
  );

export const AuthorIdSchema = z.string()
  .min(1)
  .describe(
    "Author identifier. Accepts: OpenAlex ID (A5023888391), ORCID (0000-0002-1825-0097), " +
    "or full URLs (https://orcid.org/..., https://openalex.org/A...)"
  );

export const InstitutionIdSchema = z.string()
  .min(1)
  .describe(
    "Institution identifier. Accepts: OpenAlex ID (I27837315), ROR (https://ror.org/...), " +
    "or full URL (https://openalex.org/I...)"
  );

// ============================================
// Filter & Search Schemas
// ============================================

export const FilterSchema = z.string()
  .optional()
  .describe(
    "OpenAlex filter syntax for advanced filtering. Examples:\n" +
    "- 'publication_year:2023' - Single year\n" +
    "- 'open_access.is_oa:true' - Open access only\n" +
    "- 'cited_by_count:>100' - Highly cited\n" +
    "Multiple filters can be combined with commas."
  );

export const SearchQuerySchema = z.string()
  .min(1)
  .max(2000)
  .describe("Full-text search query. Searches titles, abstracts, and full text where available.");

// ============================================
// Composite Schemas for Tools (no response_format — apps always return JSON)
// ============================================

export const SearchModeSchema = z.enum(["keyword", "semantic"])
  .default("keyword")
  .describe(
    "keyword: match the words in titles, abstracts and full text (default). " +
    "semantic: match by meaning, for when the right papers may use different wording; " +
    "returns at most 50 results, cannot be sorted or paged, and accepts only some filters."
  );

export const WorkSearchInputSchema = {
  query: SearchQuerySchema,
  mode: SearchModeSchema,
  filter: FilterSchema,
  sort: WorkSortSchema,
  limit: PaginationSchema.shape.limit,
  page: PaginationSchema.shape.page,
  cursor: CursorSchema,
};

export const AuthorSearchInputSchema = {
  query: SearchQuerySchema,
  filter: FilterSchema,
  sort: AuthorSortSchema,
  limit: PaginationSchema.shape.limit,
  page: PaginationSchema.shape.page,
};

export const InstitutionSearchInputSchema = {
  query: SearchQuerySchema,
  filter: FilterSchema,
  sort: InstitutionSortSchema,
  limit: PaginationSchema.shape.limit,
  page: PaginationSchema.shape.page,
};

// ============================================
// Sources, topics, funders
// ============================================

const CountSortSchema = z.enum([
  "relevance_score:desc",
  "cited_by_count:desc",
  "cited_by_count:asc",
  "works_count:desc",
  "works_count:asc"
]).default("relevance_score:desc");

export const SourceIdSchema = z.string()
  .min(1)
  .describe("Source identifier. Accepts: OpenAlex ID (S1983995261), ISSN (2167-8359), or full URL (https://openalex.org/S...)");

export const TopicIdSchema = z.string()
  .min(1)
  .describe("Topic identifier. Accepts: OpenAlex ID (T10102) or full URL (https://openalex.org/T10102)");

export const FunderIdSchema = z.string()
  .min(1)
  .describe("Funder identifier. Accepts: OpenAlex ID (F4320306076), ROR (https://ror.org/021nxhr62), or full URL (https://openalex.org/F...)");

export const PublisherIdSchema = z.string()
  .min(1)
  .describe("Publisher identifier. Accepts: OpenAlex ID (P4310320990), ROR (https://ror.org/02scfj030), or full URL (https://openalex.org/P...)");

const entitySearchSchema = (what: string) => ({
  query: z.string().min(1).max(500).describe(`Name or search terms for the ${what}`),
  filter: FilterSchema,
  sort: CountSortSchema.describe(`Sort order for ${what} results`),
  limit: PaginationSchema.shape.limit,
  page: PaginationSchema.shape.page,
});

export const SourceSearchInputSchema = entitySearchSchema("source");
export const TopicSearchInputSchema = entitySearchSchema("topic");
export const FunderSearchInputSchema = entitySearchSchema("funder");
export const PublisherSearchInputSchema = entitySearchSchema("publisher");

// ============================================
// Set summary and reference checking
// ============================================

export const AnalyzeWorksInputSchema = {
  query: z.string().min(1).max(500).optional().describe("Keyword search choosing which works to summarise"),
  filter: FilterSchema,
  top: z.number()
    .int()
    .min(3)
    .max(10)
    .default(5)
    .describe("How many entries to list in each ranking (3-10, default: 5)"),
};

export const ResolveReferencesInputSchema = {
  references: z.array(z.string().min(1).max(1500))
    .min(1)
    .max(MAX_REFERENCES)
    .describe(
      `The references to check, one per item (1-${MAX_REFERENCES}). Each can be a DOI, a PMID, an OpenAlex ID, ` +
      "or a citation in any style. A citation that contains a DOI is looked up by that DOI."
    ),
};

// ============================================
// Queries written in OQL
// ============================================

export const QueryInputSchema = {
  oql: z.string()
    .min(5)
    .max(4000)
    .describe("The query, written in OQL. It starts with \"get\". See the tool description for the syntax."),
  limit: z.number()
    .int()
    .min(1)
    .max(MAX_PER_PAGE)
    .default(25)
    .describe(`Rows to return: results for a list, groups for a table (1-${MAX_PER_PAGE}, default: 25)`),
  page: PaginationSchema.shape.page,
};

// ============================================
// Open peer reviews
// ============================================

export const GetReviewsInputSchema = {
  id: WorkIdSchema,
  limit: z.number()
    .int()
    .min(1)
    .max(MAX_REVIEWS)
    .default(10)
    .describe(`Maximum reviews to return (1-${MAX_REVIEWS}, default: 10)`),
  include_text: z.boolean()
    .default(false)
    .describe("Also fetch each review's text where its publisher serves it (eLife and Review Commons). Free."),
  paid_text: z.boolean()
    .default(false)
    .describe(
      `With include_text: for reviews from other publishers, also download the full text OpenAlex stores, at $0.01 each ` +
      `(at most ${MAX_PAID_REVIEW_TEXTS} per call). The charge applies even when the stored text turns out not to be the review.`
    ),
};

// ============================================
// Grouping
// ============================================

export const GroupWorksInputSchema = {
  group_by: z.string()
    .min(1)
    .max(100)
    .describe(
      "What to count by. A short name (year, type, oa_status, author, institution, country, journal, publisher, " +
      "funder, topic, subfield, field, domain, keyword, language, sdg, license, top_10_percent, top_1_percent) " +
      "or any OpenAlex works field that supports grouping, e.g. primary_topic.field.id"
    ),
  query: z.string().min(1).max(500).optional().describe("Optional keyword search to restrict which works are counted"),
  filter: FilterSchema,
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum number of groups to return, largest first (1-100, default: 25)"),
};
