import { z } from "zod";
import { MAX_PER_PAGE, DEFAULT_PER_PAGE } from "../constants.js";

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

// ============================================
// Grouping
// ============================================

export const GroupWorksInputSchema = {
  group_by: z.string()
    .min(1)
    .max(100)
    .describe("The works field to count by, e.g. publication_year, type, open_access.oa_status, primary_topic.field.id"),
  query: z.string().min(1).max(500).optional().describe("Optional keyword search to restrict which works are counted"),
  filter: FilterSchema,
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Maximum number of groups to return, largest first (1-100, default: 25)"),
};
