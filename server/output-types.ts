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

export interface RelatedWorksOutput {
  source_work: { id: string; title: string; total_related: number };
  pagination: PaginationInfo;
  related_works: WorkOutput[];
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

// ---------- Sources (journals, repositories, conferences) ----------

// In search results top_topics and counts_by_year are left empty;
// openalex_get_source returns them.
export interface SourceOutput {
  id: string;
  display_name: string;
  type: string | null;
  issn_l: string | null;
  issn: string[];
  publisher: string | null;
  country_code: string | null;
  is_oa: boolean;
  is_in_doaj: boolean;
  apc_usd: number | null;
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
  two_year_mean_citedness: number | null;
  homepage_url: string | null;
  top_topics: TopicCount[];
  counts_by_year: YearCount[];
}

export interface SearchSourcesOutput {
  pagination: PaginationInfo;
  sources: SourceOutput[];
}

// ---------- Topics ----------

export interface TopicOutput {
  id: string;
  display_name: string;
  description: string | null;
  keywords: string[];
  subfield: string | null;
  field: string | null;
  domain: string | null;
  works_count: number;
  cited_by_count: number;
}

export interface SearchTopicsOutput {
  pagination: PaginationInfo;
  topics: TopicOutput[];
}

export interface NamedEntity {
  id: string;
  name: string;
}

// openalex_get_topic: every keyword, plus neighbouring topics and yearly output
export interface TopicDetailOutput extends TopicOutput {
  // Other topics in the same subfield
  siblings: NamedEntity[];
  wikipedia_url: string | null;
  // Works per year, oldest first. Empty when the count could not be fetched.
  works_by_year: { year: number; works_count: number }[];
}

// ---------- Funders ----------

export interface FunderOutput {
  id: string;
  display_name: string;
  alternate_titles: string[];
  country_code: string | null;
  description: string | null;
  homepage_url: string | null;
  ror: string | null;
  awards_count: number | null;
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
}

export interface SearchFundersOutput {
  pagination: PaginationInfo;
  funders: FunderOutput[];
}

// The same organisation listed elsewhere in OpenAlex, e.g. a funder that is also an institution
export interface RoleOutput {
  role: string;
  id: string;
  works_count: number;
}

// openalex_get_funder: every alternate name, plus yearly output and other roles
export interface FunderDetailOutput extends FunderOutput {
  i10_index: number | null;
  two_year_mean_citedness: number | null;
  counts_by_year: YearCount[];
  other_roles: RoleOutput[];
}

// ---------- Publishers ----------

// In search results counts_by_year and other_roles are left empty;
// openalex_get_publisher returns them.
export interface PublisherOutput {
  id: string;
  display_name: string;
  alternate_titles: string[];
  country_codes: string[];
  // The publisher this one belongs to, when it is an imprint or subsidiary
  parent: NamedEntity | null;
  hierarchy_level: number;
  homepage_url: string | null;
  ror: string | null;
  works_count: number;
  cited_by_count: number;
  h_index: number | null;
  two_year_mean_citedness: number | null;
  counts_by_year: YearCount[];
  other_roles: RoleOutput[];
}

export interface SearchPublishersOutput {
  pagination: PaginationInfo;
  publishers: PublisherOutput[];
}

export interface PublisherSourceOutput {
  id: string;
  name: string;
  type: string | null;
  is_oa: boolean;
  works_count: number;
  cited_by_count: number;
}

export interface PublisherDetailOutput extends PublisherOutput {
  // Journals and other sources published, including those of its imprints.
  // null and empty when the list could not be fetched.
  sources_count: number | null;
  top_sources: PublisherSourceOutput[];
}

// ---------- Grouping ----------

export interface GroupOutput {
  // The OpenAlex ID when grouping by an entity, otherwise the raw value
  key: string;
  name: string;
  count: number;
  // Share of all matching works, 0-1. Shares can sum to more than 1 when a
  // work can belong to several groups (for example, several institutions).
  share: number;
}

export interface GroupWorksOutput {
  // The OpenAlex field the works were counted by
  group_by: string;
  // A plain name for that field, e.g. "publisher"
  label: string;
  query: string | null;
  filter: string | null;
  // Number of works matching the query and filter
  total_works: number;
  groups: GroupOutput[];
  // True when there are more groups than were returned
  more_groups: boolean;
  // For yes/no fields only: works that have no value, so are in neither group
  works_without_value?: number;
}
