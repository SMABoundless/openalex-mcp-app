import type { Author, Institution } from "../types.js";

export function formatAuthorJson(author: Author): Record<string, unknown> {
  return {
    id: author.id,
    orcid: author.orcid,
    display_name: author.display_name,
    display_name_alternatives: author.display_name_alternatives,
    works_count: author.works_count,
    cited_by_count: author.cited_by_count,
    h_index: author.summary_stats?.h_index,
    i10_index: author.summary_stats?.i10_index,
    two_year_mean_citedness: author.summary_stats?.["2yr_mean_citedness"],
    last_known_institutions: author.last_known_institutions?.map(i => ({
      id: i.id, name: i.display_name, country: i.country_code, type: i.type
    })),
    affiliations: author.affiliations?.map(a => ({
      institution: { id: a.institution.id, name: a.institution.display_name, country: a.institution.country_code },
      years: a.years
    })),
    top_topics: author.topics?.slice(0, 10).map(t => ({
      name: t.display_name, id: t.id, count: t.count,
      field: t.field.display_name, domain: t.domain.display_name
    })),
    counts_by_year: author.counts_by_year
  };
}

export function formatInstitutionJson(institution: Institution): Record<string, unknown> {
  return {
    id: institution.id,
    ror: institution.ror,
    display_name: institution.display_name,
    display_name_alternatives: institution.display_name_alternatives,
    display_name_acronyms: institution.display_name_acronyms,
    type: institution.type,
    country_code: institution.country_code,
    geo: institution.geo ? {
      city: institution.geo.city, region: institution.geo.region,
      country: institution.geo.country, latitude: institution.geo.latitude, longitude: institution.geo.longitude
    } : null,
    works_count: institution.works_count,
    cited_by_count: institution.cited_by_count,
    h_index: institution.summary_stats?.h_index,
    i10_index: institution.summary_stats?.i10_index,
    two_year_mean_citedness: institution.summary_stats?.["2yr_mean_citedness"],
    homepage_url: institution.homepage_url,
    top_topics: institution.topics?.slice(0, 10).map(t => ({
      name: t.display_name, id: t.id, count: t.count,
      field: t.field.display_name, domain: t.domain.display_name
    })),
    associated_institutions: institution.associated_institutions?.map(i => ({
      id: i.id, name: i.display_name, relationship: i.relationship, country: i.country_code
    })),
    counts_by_year: institution.counts_by_year
  };
}
