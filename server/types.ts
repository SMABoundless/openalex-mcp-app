// OpenAlex API Response Types
// Based on: https://docs.openalex.org/api-entities

// ============================================
// Common Types
// ============================================

/** The query a response answered, echoed back by OpenAlex in its query language (OQL). */
export interface QueryEcho {
  oql?: string | null;
  /** The same query as structured JSON */
  oqo?: { get_rows?: string; filter_rows?: unknown[]; [key: string]: unknown } | null;
  url?: string | null;
}

export interface OpenAlexMeta {
  x_query?: QueryEcho | null;
  cost_usd?: number;
  // Present when re-ranking was asked for: whether it was applied, and if not, why
  reranked?: boolean;
  rerank_reason?: string | null;
  count: number;
  db_response_time_ms: number;
  // null when cursor paging is used
  page: number | null;
  per_page: number;
  next_cursor?: string | null;
}

export interface OpenAlexListResponse<T> {
  meta: OpenAlexMeta;
  results: T[];
  group_by?: GroupByResult[];
}

export interface GroupByResult {
  key: string;
  key_display_name: string;
  count: number;
}

/** A group-by request returns counts instead of results. */
export interface OpenAlexGroupResponse {
  meta: { count: number; groups_count: number | null; x_query?: QueryEcho | null };
  group_by: GroupByResult[];
}

/** The same organisation can appear in OpenAlex as a funder, an institution and a publisher. */
export interface EntityRole {
  role: string;
  id: string;
  works_count: number;
}

export interface DehydratedEntity {
  id: string;
  display_name: string;
}

export interface ExternalIds {
  openalex?: string;
  doi?: string;
  pmid?: string;
  pmcid?: string;
  mag?: string;
  orcid?: string;
  ror?: string;
  wikidata?: string;
  wikipedia?: string;
  scopus?: string;
}

// ============================================
// Work (Publication) Types
// ============================================

export interface Work {
  id: string;
  doi?: string;
  title: string;
  display_name: string;
  publication_year?: number;
  publication_date?: string;
  type: string;
  type_crossref?: string;
  
  // Open Access
  open_access: {
    is_oa: boolean;
    oa_status: string;
    oa_url?: string;
    any_repository_has_fulltext: boolean;
  };
  
  // Authorship
  authorships: Authorship[];
  
  // Citation metrics
  cited_by_count: number;
  cited_by_api_url: string;
  
  // Biblio info
  biblio: {
    volume?: string;
    issue?: string;
    first_page?: string;
    last_page?: string;
  };
  
  // Source (journal/venue)
  primary_location?: Location;
  locations: Location[];
  best_oa_location?: Location;
  
  // Abstract
  abstract_inverted_index?: Record<string, number[]>;
  
  // Topics
  topics?: WorkTopic[];
  keywords?: Keyword[];
  
  is_retracted?: boolean;
  language?: string | null;

  // Related works
  related_works: string[];
  referenced_works: string[];
  referenced_works_count?: number;
  
  // Counts
  counts_by_year: CountByYear[];
  
  // IDs
  ids: ExternalIds;
  
  // Timestamps
  created_date: string;
  updated_date: string;
}

export interface Authorship {
  author_position: "first" | "middle" | "last";
  author: DehydratedAuthor;
  institutions: DehydratedInstitution[];
  countries?: string[];
  is_corresponding?: boolean;
  raw_author_name?: string;
  raw_affiliation_strings?: string[];
}

export interface DehydratedAuthor {
  id: string;
  display_name: string;
  orcid?: string;
}

export interface DehydratedInstitution {
  id: string;
  display_name: string;
  ror?: string;
  country_code?: string;
  type?: string;
}

export interface Location {
  is_oa: boolean;
  landing_page_url?: string;
  pdf_url?: string;
  source?: DehydratedSource;
  license?: string;
  version?: string;
  is_accepted?: boolean;
  is_published?: boolean;
}

export interface DehydratedSource {
  id: string;
  display_name: string;
  issn_l?: string;
  issn?: string[];
  is_oa: boolean;
  is_in_doaj: boolean;
  host_organization?: string;
  host_organization_name?: string;
  host_organization_lineage?: string[];
  host_organization_lineage_names?: string[];
  type: string;
}

export interface WorkTopic {
  id: string;
  display_name: string;
  score: number;
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
}

export interface Keyword {
  id: string;
  display_name: string;
  score?: number;
}

export interface CountByYear {
  year: number;
  cited_by_count: number;
  // Present on authors and institutions, absent on works
  works_count?: number;
}

// ============================================
// Author Types
// ============================================

export interface Author {
  id: string;
  orcid?: string;
  display_name: string;
  display_name_alternatives?: string[];
  
  // Metrics
  works_count: number;
  cited_by_count: number;
  summary_stats: {
    "2yr_mean_citedness": number;
    h_index: number;
    i10_index: number;
  };
  
  // Affiliations
  affiliations: AuthorAffiliation[];
  last_known_institutions?: DehydratedInstitution[];
  
  // Topics
  topics?: AuthorTopic[];
  topic_share?: TopicShare[];
  
  // Counts over time
  counts_by_year: CountByYear[];
  works_api_url: string;
  
  // IDs
  ids: ExternalIds;
  
  // Timestamps
  created_date: string;
  updated_date: string;
}

export interface AuthorAffiliation {
  institution: DehydratedInstitution;
  years: number[];
}

export interface AuthorTopic {
  id: string;
  display_name: string;
  count: number;
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
}

export interface TopicShare {
  id: string;
  display_name: string;
  value: number;
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
}

// ============================================
// Institution Types
// ============================================

export interface Institution {
  id: string;
  ror?: string;
  display_name: string;
  display_name_alternatives?: string[];
  display_name_acronyms?: string[];
  
  // Location
  country_code?: string;
  geo?: {
    city?: string;
    geonames_city_id?: string;
    region?: string;
    country_code?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  
  // Type and relationships
  type?: string;
  type_id?: string;
  lineage?: string[];
  lineage_names?: string[];
  associated_institutions?: AssociatedInstitution[];
  
  // Metrics
  works_count: number;
  cited_by_count: number;
  summary_stats: {
    "2yr_mean_citedness": number;
    h_index: number;
    i10_index: number;
  };
  
  // URLs
  homepage_url?: string;
  image_url?: string;
  image_thumbnail_url?: string;
  works_api_url: string;
  
  // Topics
  topics?: InstitutionTopic[];
  topic_share?: TopicShare[];
  
  // Counts over time
  counts_by_year: CountByYear[];
  
  // IDs
  ids: ExternalIds;
  
  // Timestamps
  created_date: string;
  updated_date: string;
}

export interface AssociatedInstitution extends DehydratedInstitution {
  relationship: "parent" | "child" | "related";
}

export interface InstitutionTopic {
  id: string;
  display_name: string;
  count: number;
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
}

// ============================================
// Topic Types
// ============================================

export interface Topic {
  id: string;
  display_name: string;
  description?: string;
  
  // Hierarchy
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
  
  keywords?: { id: string; display_name: string; score?: number }[];

  // Related
  siblings: DehydratedEntity[];
  
  // Metrics
  works_count: number;
  cited_by_count: number;
  
  // URLs
  works_api_url: string;
  
  // IDs
  ids: ExternalIds;
  
  // Timestamps
  created_date: string;
  updated_date: string;
}

// ============================================
// Source (Journal/Venue) Types
// ============================================

export interface Source {
  id: string;
  issn_l?: string;
  issn?: string[];
  display_name: string;
  
  // Publisher
  host_organization?: string;
  host_organization_name?: string;
  host_organization_lineage?: string[];
  host_organization_lineage_names?: string[];
  
  // Type and access
  type: string;
  is_oa: boolean;
  is_in_doaj: boolean;
  country_code?: string;
  
  // URLs
  homepage_url?: string;
  works_api_url: string;
  
  // Metrics
  works_count: number;
  cited_by_count: number;
  summary_stats: {
    "2yr_mean_citedness": number;
    h_index: number;
    i10_index: number;
  };
  
  // Topics
  topics?: SourceTopic[];
  topic_share?: TopicShare[];
  
  // Counts over time
  counts_by_year: CountByYear[];
  
  // APC
  apc_usd?: number;
  apc_prices?: { currency: string; price: number }[];
  
  // IDs
  ids: ExternalIds;
  
  // Timestamps
  created_date: string;
  updated_date: string;
}

export interface SourceTopic {
  id: string;
  display_name: string;
  count: number;
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
}

// ============================================
// Funder Types
// ============================================

export interface Funder {
  id: string;
  display_name: string;
  alternate_titles?: string[];
  country_code?: string;
  description?: string;
  homepage_url?: string;
  awards_count?: number;
  works_count: number;
  cited_by_count: number;
  summary_stats?: {
    "2yr_mean_citedness": number;
    h_index: number;
    i10_index: number;
  };
  ids?: ExternalIds;
  counts_by_year?: CountByYear[];
  roles?: EntityRole[];
}

// ============================================
// Publisher Types
// ============================================

export interface Publisher {
  id: string;
  display_name: string;
  alternate_titles?: string[];
  // 0 for a top-level publisher, 1 or more for an imprint or subsidiary
  hierarchy_level?: number;
  parent_publisher?: DehydratedEntity | null;
  lineage?: string[];
  country_codes?: string[];
  homepage_url?: string;
  works_count: number;
  cited_by_count: number;
  summary_stats?: {
    "2yr_mean_citedness": number;
    h_index: number;
    i10_index: number;
  };
  ids?: ExternalIds;
  counts_by_year?: CountByYear[];
  roles?: EntityRole[];
}
