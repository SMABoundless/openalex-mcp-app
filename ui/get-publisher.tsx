import { render } from "preact";
import type { PublisherDetailOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber, shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

// Wikidata supplies names in many scripts; show a manageable number
const MAX_ALTERNATE_TITLES = 12;

function PublisherProfile({ publisher }: { publisher: PublisherDetailOutput }) {
  const yearChartData = publisher.counts_by_year
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((c) => ({ label: String(c.year), value: c.works_count ?? 0 }));
  const titles = publisher.alternate_titles.slice(0, MAX_ALTERNATE_TITLES);
  const moreTitles = publisher.alternate_titles.length - titles.length;

  return (
    <div class="detail-container">
      <h1 class="detail-title">{publisher.display_name}</h1>
      <div class="detail-subtitle-row">
        {publisher.parent && <span>Part of {publisher.parent.name}</span>}
        {publisher.country_codes.length > 0 && <span class="muted">{publisher.country_codes.join(", ")}</span>}
        <span class="muted">{shortId(publisher.id)}</span>
      </div>

      <section class="metrics-row">
        <MetricBadge label="Works" value={publisher.works_count} />
        <MetricBadge label="Citations" value={publisher.cited_by_count} />
        {publisher.sources_count != null && <MetricBadge label="Sources" value={publisher.sources_count} />}
        {publisher.h_index != null && <MetricBadge label="h-index" value={publisher.h_index} />}
      </section>

      {titles.length > 0 && (
        <section class="detail-section">
          <h3>Also Known As</h3>
          <div class="tags-container">
            {titles.map((t) => <span class="tag" key={t}>{t}</span>)}
            {moreTitles > 0 && <span class="muted"> and {moreTitles} more</span>}
          </div>
        </section>
      )}

      {(publisher.homepage_url || publisher.ror) && (
        <section class="detail-section">
          <h3>Identifiers and Links</h3>
          <ul class="plain-list">
            {publisher.homepage_url && (
              <li>
                <a href={publisher.homepage_url} target="_blank" rel="noopener noreferrer" class="external-link">{publisher.homepage_url}</a>
              </li>
            )}
            {publisher.ror && (
              <li>
                <a href={publisher.ror} target="_blank" rel="noopener noreferrer" class="external-link">{publisher.ror}</a>
              </li>
            )}
          </ul>
        </section>
      )}

      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Works per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}

      {publisher.top_sources.length > 0 && (
        <section class="detail-section">
          <h3>Largest Sources</h3>
          <table class="results-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th class="num">Works</th>
                <th class="num">Citations</th>
              </tr>
            </thead>
            <tbody>
              {publisher.top_sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name} <span class="muted">{shortId(s.id)}</span>
                  </td>
                  <td>{s.type ?? ""}{s.is_oa ? " · open access" : ""}</td>
                  <td class="num">{formatNumber(s.works_count)}</td>
                  <td class="num">{formatNumber(s.cited_by_count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {publisher.other_roles.length > 0 && (
        <section class="detail-section">
          <h3>Also in OpenAlex as</h3>
          <ul class="plain-list">
            {publisher.other_roles.map((r) => (
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
  <AppShell<PublisherDetailOutput> toolName="openalex_get_publisher">{(data) => <PublisherProfile publisher={data} />}</AppShell>,
  document.getElementById("app")!
);
