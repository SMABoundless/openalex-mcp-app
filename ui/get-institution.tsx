import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetInstitutionView() {
  return (
    <AppShell title="Institution Profile">
      {(data: any) => <InstitutionProfile data={data} />}
    </AppShell>
  );
}

function InstitutionProfile({ data }: { data: any }) {
  const {
    display_name, type, country_code, geo, works_count, cited_by_count,
    h_index, homepage_url, top_topics, associated_institutions,
    counts_by_year, ror, display_name_alternatives, display_name_acronyms
  } = data;

  // Location string
  const location = [geo?.city, geo?.region, geo?.country].filter(Boolean).join(", ")
    || country_code || "";

  // Topic chart data
  const topicChartData = (top_topics ?? [])
    .slice(0, 10)
    .map((t: any) => ({ label: t.name, value: t.count ?? 0 }));

  // Yearly output chart
  const yearChartData = (counts_by_year ?? [])
    .slice()
    .sort((a: any, b: any) => a.year - b.year)
    .map((c: any) => ({ label: String(c.year), value: c.works_count ?? 0 }));

  return (
    <div class="detail-container">
      {/* Name + Type + Location */}
      <h1 class="detail-title">{display_name}</h1>
      <div class="detail-subtitle-row">
        {type && <span class="type-badge">{type}</span>}
        {location && <span class="location-text">{location}</span>}
      </div>

      {display_name_acronyms && display_name_acronyms.length > 0 && (
        <p class="alt-names">Acronyms: {display_name_acronyms.join(", ")}</p>
      )}
      {display_name_alternatives && display_name_alternatives.length > 0 && (
        <p class="alt-names">Also known as: {display_name_alternatives.slice(0, 5).join(", ")}</p>
      )}

      {/* Metrics Row */}
      <section class="metrics-row">
        <MetricBadge label="Works" value={formatNumber(works_count ?? 0)} />
        <MetricBadge label="Citations" value={formatNumber(cited_by_count ?? 0)} />
        <MetricBadge label="h-index" value={String(h_index ?? "N/A")} />
      </section>

      {/* Homepage */}
      {homepage_url && (
        <section class="detail-section">
          <h3>Homepage</h3>
          <a href={homepage_url} target="_blank" rel="noopener" class="external-link">
            {homepage_url}
          </a>
        </section>
      )}

      {/* ROR */}
      {ror && (
        <section class="detail-section">
          <h3>ROR</h3>
          <a href={ror.startsWith("http") ? ror : `https://ror.org/${ror}`} target="_blank" rel="noopener" class="external-link">
            {ror}
          </a>
        </section>
      )}

      {/* Top Research Topics */}
      {topicChartData.length > 0 && (
        <section class="chart-section">
          <h3>Top Research Topics</h3>
          <BarChart data={topicChartData} />
        </section>
      )}

      {/* Associated Institutions */}
      {associated_institutions && associated_institutions.length > 0 && (
        <section class="detail-section">
          <h3>Associated Institutions</h3>
          <ul class="association-list">
            {associated_institutions.map((assoc: any, i: number) => (
              <li key={assoc.id || i} class="association-item">
                <span class="association-name">{assoc.display_name || assoc.name}</span>
                {assoc.relationship && (
                  <span class="association-type">{assoc.relationship}</span>
                )}
                {assoc.country_code && (
                  <span class="association-country">{assoc.country_code}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Yearly Output */}
      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Yearly Research Output</h3>
          <BarChart data={yearChartData} />
        </section>
      )}
    </div>
  );
}

render(<GetInstitutionView />, document.getElementById("app")!);
