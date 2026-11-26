// Shapes of the structured data each tool returns.
// These are imported by both the server and the UI, so a field renamed here
// fails the UI type-check instead of silently rendering nothing.
// Keep this file free of runtime imports.

export interface PaginationInfo {
  total: number;
  count: number;
  page: number;
  perPage: number;
  hasMore: boolean;
  nextPage?: number;
  // Set when the request used cursor paging: there are no page numbers, and
  // the next batch is fetched by passing nextCursor back as `cursor`.
  cursorMode?: boolean;
  nextCursor?: string;
}

export interface YearCount {
  year: number;
  cited_by_count: number;
  works_count?: number;
}

// ---------- Works ----------

export interface WorkAuthorOutput {
  name: string;
  id: string;
  orcid: string | null;
  position: string;
  // Omitted in result lists to keep them small
  institutions?: { name: string; id: string; country: string | null }[];
}

export interface WorkOutput {
  id: string;
  doi: string | null;
  title: string;
  publication_year: number | null;
  publication_date: string | null;
  type: string | null;
  // In result lists only the first few authors are included; see authors_count
  authors: WorkAuthorOutput[];
  authors_count: number;
  source: { name: string; id: string; type: string | null; is_oa: boolean } | null;
  cited_by_count: number;
  open_access: { is_oa: boolean; status: string; url: string | null };
  abstract: string | null;
  // True when abstract was shortened for a result list
  abstract_truncated: boolean;
  topics: { name: string; id: string; score: number | null }[];
  referenced_works_count: number;
}

export interface SearchWorksOutput {
  pagination: PaginationInfo;
  works: WorkOutput[];
}

export interface CitationsOutput {
  cited_work: { id: string; title: string; total_citations: number; counts_by_year: YearCount[] };
  pagination: PaginationInfo;
  citing_works: WorkOutput[];
}

export interface ReferencesOutput {
  source_work: { id: string; title: string; total_references: number };
  pagination: PaginationInfo;
  references: WorkOutput[];
}

// ---------- Authors ----------

export interface TopicCount {
  name: string;
  id: string;
  count: number;
  field: string | null;
  domain: string | null;
}

// In search results the long fields (name variants, affiliation history,
// yearly counts) are left empty or shortened; the get_* tools return them in full.
export interface AuthorOutput {
  id: string;
  orcid: string | null;
  display_name: string;
  display_name_alternatives: string[];
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
  i10_index: number | null;
  two_year_mean_citedness: number | null;
  last_known_institutions: { id: string; name: string; country: string | null; type: string | null }[];
  affiliations: { institution: { id: string; name: string; country: string | null }; years: number[] }[];
  top_topics: TopicCount[];
  counts_by_year: YearCount[];
}

export interface SearchAuthorsOutput {
  pagination: PaginationInfo;
  authors: AuthorOutput[];
}

export interface AuthorWorksOutput {
  author: { id: string; name: string; total_works: number };
  pagination: PaginationInfo;
  works: WorkOutput[];
}

// ---------- Institutions ----------

export interface InstitutionOutput {
  id: string;
  ror: string | null;
  display_name: string;
  display_name_alternatives: string[];
  display_name_acronyms: string[];
  type: string | null;
  country_code: string | null;
  geo: { city: string | null; region: string | null; country: string | null } | null;
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
  i10_index: number | null;
  two_year_mean_citedness: number | null;
  homepage_url: string | null;
  top_topics: TopicCount[];
  associated_institutions: { id: string; name: string; relationship: string; country: string | null }[];
  counts_by_year: YearCount[];
}

export interface SearchInstitutionsOutput {
  pagination: PaginationInfo;
  institutions: InstitutionOutput[];
}

export interface InstitutionWorksOutput {
  institution: { id: string; name: string; total_works: number };
  pagination: PaginationInfo;
  works: WorkOutput[];
}
