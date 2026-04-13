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
  .max(500)
  .describe("Full-text search query. Searches titles, abstracts, and full text where available.");

// ============================================
// Composite Schemas for Tools (no response_format — apps always return JSON)
// ============================================

export const WorkSearchInputSchema = {
  query: SearchQuerySchema,
  filter: FilterSchema,
  sort: WorkSortSchema,
  limit: PaginationSchema.shape.limit,
  page: PaginationSchema.shape.page,
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
