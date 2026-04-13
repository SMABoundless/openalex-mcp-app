// OpenAlex API Response Types
// Based on: https://docs.openalex.org/api-entities

// ============================================
// Common Types
// ============================================

export interface OpenAlexMeta {
  count: number;
  db_response_time_ms: number;
  page: number;
  per_page: number;
  next_cursor?: string;
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
  
  // Concepts and topics
  concepts: WorkConcept[];
  topics?: WorkTopic[];
  keywords?: Keyword[];
  
  // Related works
  related_works: string[];
  referenced_works: string[];
  
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

export interface WorkConcept {
  id: string;
  wikidata?: string;
  display_name: string;
  level: number;
  score: number;
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
  keyword: string;
  score: number;
}

export interface CountByYear {
  year: number;
  cited_by_count: number;
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
  last_known_institution?: DehydratedInstitution;
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
// Concept Types (deprecated but still available)
// ============================================

export interface Concept {
  id: string;
  wikidata?: string;
  display_name: string;
  level: number;
  description?: string;
  
  // Metrics
  works_count: number;
  cited_by_count: number;
  
  // URLs
  image_url?: string;
  image_thumbnail_url?: string;
  works_api_url: string;
  
  // Hierarchy
  ancestors: DehydratedConcept[];
  related_concepts: RelatedConcept[];
  
  // Counts over time
  counts_by_year: CountByYear[];
  
  // IDs
  ids: ExternalIds;
  
  // Timestamps
  created_date: string;
  updated_date: string;
}

export interface DehydratedConcept {
  id: string;
  wikidata?: string;
  display_name: string;
  level: number;
}

export interface RelatedConcept extends DehydratedConcept {
  score: number;
}

// ============================================
// Topic Types (newer replacement for concepts)
// ============================================

export interface Topic {
  id: string;
  display_name: string;
  description?: string;
  
  // Hierarchy
  subfield: DehydratedEntity;
  field: DehydratedEntity;
  domain: DehydratedEntity;
  
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
