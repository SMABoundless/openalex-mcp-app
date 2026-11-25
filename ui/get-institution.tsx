import { render } from "preact";
import type { InstitutionOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function InstitutionProfile({ inst }: { inst: InstitutionOutput }) {
  const location = [inst.geo?.city, inst.geo?.region, inst.geo?.country].filter(Boolean).join(", ")
    || inst.country_code || "";
  const topicChartData = inst.top_topics.map((t) => ({ label: t.name, value: t.count }));
  const yearChartData = inst.counts_by_year
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((c) => ({ label: String(c.year), value: c.works_count ?? 0 }));

  return (
    <div class="detail-container">
      <h1 class="detail-title">{inst.display_name}</h1>
      <div class="detail-subtitle-row">
        {inst.type && <span class="type-badge">{inst.type}</span>}
        {location && <span class="muted">{location}</span>}
      </div>

      {inst.display_name_acronyms.length > 0 && (
        <p class="alt-names">Acronyms: {inst.display_name_acronyms.join(", ")}</p>
      )}
      {inst.display_name_alternatives.length > 0 && (
        <p class="alt-names">Also known as: {inst.display_name_alternatives.slice(0, 5).join(", ")}</p>
      )}

      <section class="metrics-row">
        <MetricBadge label="Works" value={inst.works_count} />
        <MetricBadge label="Citations" value={inst.cited_by_count} />
        {inst.h_index != null && <MetricBadge label="h-index" value={inst.h_index} />}
      </section>

      {(inst.homepage_url || inst.ror) && (
        <section class="detail-section">
          <h3>Links</h3>
          <ul class="plain-list">
            {inst.homepage_url && (
              <li><a href={inst.homepage_url} target="_blank" rel="noopener noreferrer" class="external-link">{inst.homepage_url}</a></li>
            )}
            {inst.ror && (
              <li><a href={inst.ror.startsWith("http") ? inst.ror : `https://ror.org/${inst.ror}`} target="_blank" rel="noopener noreferrer" class="external-link">{inst.ror}</a></li>
            )}
          </ul>
        </section>
      )}

      {topicChartData.length > 0 && (
        <section class="chart-section">
          <h3>Top Research Topics (works)</h3>
          <BarChart data={topicChartData} horizontal />
        </section>
      )}

      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Yearly Research Output</h3>
          <BarChart data={yearChartData} />
        </section>
      )}

      {inst.associated_institutions.length > 0 && (
        <section class="detail-section">
          <h3>Associated Institutions</h3>
          <ul class="plain-list">
            {inst.associated_institutions.slice(0, 30).map((assoc) => (
              <li key={assoc.id} class="split-row">
                <span>{assoc.name}{assoc.country ? ` (${assoc.country})` : ""}</span>
                <span class="muted">{assoc.relationship}</span>
              </li>
            ))}
          </ul>
          {inst.associated_institutions.length > 30 && (
            <p class="muted">and {inst.associated_institutions.length - 30} more</p>
          )}
        </section>
      )}
    </div>
  );
}

render(
  <AppShell<InstitutionOutput> toolName="openalex_get_institution">{(data) => <InstitutionProfile inst={data} />}</AppShell>,
  document.getElementById("app")!
);
