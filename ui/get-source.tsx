import { render } from "preact";
import type { SourceOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SourceProfile({ source }: { source: SourceOutput }) {
  const topicChartData = source.top_topics.map((t) => ({ label: t.name, value: t.count }));
  const yearChartData = source.counts_by_year
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((c) => ({ label: String(c.year), value: c.works_count ?? 0 }));

  return (
    <div class="detail-container">
      <h1 class="detail-title">{source.display_name}</h1>
      <div class="detail-subtitle-row">
        {source.type && <span class="type-badge">{source.type}</span>}
        {source.publisher && <span>{source.publisher}</span>}
        {source.country_code && <span class="muted">{source.country_code}</span>}
      </div>

      <section class="metrics-row">
        <MetricBadge label="Works" value={source.works_count} />
        <MetricBadge label="Citations" value={source.cited_by_count} />
        {source.h_index != null && <MetricBadge label="h-index" value={source.h_index} />}
        {source.two_year_mean_citedness != null && (
          <MetricBadge label="2yr Mean Citedness" value={source.two_year_mean_citedness.toFixed(2)} />
        )}
      </section>

      <section class="detail-section">
        <h3>Access</h3>
        <div class="tags-container">
          <span class={`badge ${source.is_oa ? "badge-gold" : "badge-closed"}`}>
            {source.is_oa ? "Open access" : "Not fully open access"}
          </span>{" "}
          {source.is_in_doaj && <span class="badge badge-green">Listed in DOAJ</span>}{" "}
          {source.apc_usd != null && (
            <span class="badge">
              {source.apc_usd === 0 ? "No article processing charge" : `APC $${formatNumber(source.apc_usd)}`}
            </span>
          )}
        </div>
      </section>

      {(source.issn.length > 0 || source.homepage_url) && (
        <section class="detail-section">
          <h3>Identifiers and Links</h3>
          <ul class="plain-list">
            {source.issn.length > 0 && <li>ISSN {source.issn.join(", ")}</li>}
            {source.homepage_url && (
              <li>
                <a href={source.homepage_url} target="_blank" rel="noopener noreferrer" class="external-link">
                  {source.homepage_url}
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      {topicChartData.length > 0 && (
        <section class="chart-section">
          <h3>Top Topics (works)</h3>
          <BarChart data={topicChartData} horizontal />
        </section>
      )}

      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Works per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}
    </div>
  );
}

render(
  <AppShell<SourceOutput> toolName="openalex_get_source">{(data) => <SourceProfile source={data} />}</AppShell>,
  document.getElementById("app")!
);
