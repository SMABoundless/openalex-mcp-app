import { render } from "preact";
import type { AnalyzeWorksOutput, GroupOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { WorkCard } from "./shared/components/WorkCard";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function percent(share: number): string {
  const pct = share * 100;
  return pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`;
}

function Ranking({ title, groups }: { title: string; groups: GroupOutput[] }) {
  if (groups.length === 0) return null;
  return (
    <section class="chart-section">
      <h3>{title}</h3>
      <BarChart data={groups.map((g) => ({ label: g.name, value: g.count }))} horizontal />
    </section>
  );
}

function Summary({ data }: { data: AnalyzeWorksOutput }) {
  const scope = [data.query ? `matching "${data.query}"` : null, data.filter ? `filter: ${data.filter}` : null]
    .filter(Boolean)
    .join(" · ");

  if (data.total_works === 0) {
    return (
      <div class="empty-state">
        <p>No works found to summarise.</p>
      </div>
    );
  }

  const yearChartData = data.by_year.map((y) => ({ label: String(y.year), value: y.works_count }));

  return (
    <div class="detail-container">
      <h1 class="detail-title">Summary of {formatNumber(data.total_works)} works</h1>
      {scope && <div class="detail-subtitle-row"><span class="muted">{scope}</span></div>}

      <section class="metrics-row">
        <MetricBadge label="Works" value={data.total_works} />
        {data.open_access_share != null && <MetricBadge label="Open access" value={percent(data.open_access_share)} />}
        {data.international_share != null && (
          <MetricBadge label="International co-authorship" value={percent(data.international_share)} />
        )}
        {data.top_10_percent_share != null && (
          <MetricBadge label="In top 10% most cited" value={percent(data.top_10_percent_share)} />
        )}
      </section>

      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Works per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}

      <div class="chart-grid">
        <Ranking title="Open Access Status" groups={data.by_oa_status} />
        <Ranking title="Types" groups={data.by_type} />
        <Ranking title="Top Fields" groups={data.top_fields} />
        <Ranking title="Top Topics" groups={data.top_topics} />
        <Ranking title="Top Authors" groups={data.top_authors} />
        <Ranking title="Top Institutions" groups={data.top_institutions} />
        <Ranking title="Top Countries" groups={data.top_countries} />
        <Ranking title="Top Journals and Sources" groups={data.top_sources} />
        <Ranking title="Top Funders" groups={data.top_funders} />
      </div>

      {data.most_cited.length > 0 && (
        <section class="detail-section">
          <h3>Most Cited</h3>
          {data.most_cited.map((w) => <WorkCard key={w.id} work={w} compact />)}
        </section>
      )}

      <p class="muted table-note">
        International co-authorship is the share of works with known author countries that have authors in two or more
        countries. The top 10% share is among works that have a citation percentile.
      </p>
      {data.unavailable.length > 0 && (
        <p class="muted table-note">Could not be fetched and left out: {data.unavailable.join(", ")}.</p>
      )}
    </div>
  );
}

render(
  <AppShell<AnalyzeWorksOutput> toolName="openalex_analyze_works">{(data) => <Summary data={data} />}</AppShell>,
  document.getElementById("app")!
);
