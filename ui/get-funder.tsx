import { render } from "preact";
import type { FunderDetailOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber, shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function FunderProfile({ funder }: { funder: FunderDetailOutput }) {
  const yearChartData = funder.counts_by_year
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((c) => ({ label: String(c.year), value: c.works_count ?? 0 }));

  return (
    <div class="detail-container">
      <h1 class="detail-title">{funder.display_name}</h1>
      <div class="detail-subtitle-row">
        <span class="type-badge">funder</span>
        {funder.description && <span>{funder.description}</span>}
        {funder.country_code && <span class="muted">{funder.country_code}</span>}
        <span class="muted">{shortId(funder.id)}</span>
      </div>

      <section class="metrics-row">
        <MetricBadge label="Funded works" value={funder.works_count} />
        {funder.awards_count != null && <MetricBadge label="Awards" value={funder.awards_count} />}
        <MetricBadge label="Citations" value={funder.cited_by_count} />
        {funder.h_index != null && <MetricBadge label="h-index" value={funder.h_index} />}
      </section>

      {funder.alternate_titles.length > 0 && (
        <section class="detail-section">
          <h3>Also Known As</h3>
          <div class="tags-container">
            {funder.alternate_titles.map((t) => <span class="tag" key={t}>{t}</span>)}
          </div>
        </section>
      )}

      {(funder.homepage_url || funder.ror) && (
        <section class="detail-section">
          <h3>Identifiers and Links</h3>
          <ul class="plain-list">
            {funder.homepage_url && (
              <li>
                <a href={funder.homepage_url} target="_blank" rel="noopener noreferrer" class="external-link">{funder.homepage_url}</a>
              </li>
            )}
            {funder.ror && (
              <li>
                <a href={funder.ror} target="_blank" rel="noopener noreferrer" class="external-link">{funder.ror}</a>
              </li>
            )}
          </ul>
        </section>
      )}

      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Funded Works per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}

      {funder.other_roles.length > 0 && (
        <section class="detail-section">
          <h3>Also in OpenAlex as</h3>
          <ul class="plain-list">
            {funder.other_roles.map((r) => (
              <li key={r.id}>
                {r.role} <span class="muted">{shortId(r.id)} · {formatNumber(r.works_count)} works</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

render(
  <AppShell<FunderDetailOutput> toolName="openalex_get_funder">{(data) => <FunderProfile funder={data} />}</AppShell>,
  document.getElementById("app")!
);
