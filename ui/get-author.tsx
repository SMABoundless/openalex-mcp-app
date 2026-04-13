import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetAuthorView() {
  return (
    <AppShell title="Author Profile">
      {(data: any) => <AuthorProfile data={data} />}
    </AppShell>
  );
}

function AuthorProfile({ data }: { data: any }) {
  const {
    display_name, orcid, works_count, cited_by_count, h_index, i10_index,
    two_year_mean_citedness, last_known_institutions, affiliations,
    top_topics, counts_by_year, display_name_alternatives
  } = data;

  // Topic chart data (horizontal bar by count)
  const topicChartData = (top_topics ?? [])
    .slice(0, 10)
    .map((t: any) => ({ label: t.name, value: t.count ?? 0 }));

  // Publications per year chart
  const yearChartData = (counts_by_year ?? [])
    .slice()
    .sort((a: any, b: any) => a.year - b.year)
    .map((c: any) => ({ label: String(c.year), value: c.works_count ?? c.cited_by_count ?? 0 }));

  return (
    <div class="detail-container">
      {/* Name + ORCID */}
      <h1 class="detail-title">{display_name}</h1>
      {display_name_alternatives && display_name_alternatives.length > 0 && (
        <p class="alt-names">Also known as: {display_name_alternatives.join(", ")}</p>
      )}
      {orcid && (
        <a
          href={orcid.startsWith("http") ? orcid : `https://orcid.org/${orcid}`}
          target="_blank" rel="noopener" class="orcid-link"
        >
          ORCID: {orcid}
        </a>
      )}

      {/* Metrics Row */}
      <section class="metrics-row">
        <MetricBadge label="Works" value={formatNumber(works_count ?? 0)} />
        <MetricBadge label="Citations" value={formatNumber(cited_by_count ?? 0)} />
        <MetricBadge label="h-index" value={String(h_index ?? "N/A")} />
        <MetricBadge label="i10-index" value={String(i10_index ?? "N/A")} />
        {two_year_mean_citedness != null && (
          <MetricBadge label="2yr Mean Citedness" value={two_year_mean_citedness.toFixed(2)} />
        )}
      </section>

      {/* Current Institutions */}
      {last_known_institutions && last_known_institutions.length > 0 && (
        <section class="detail-section">
          <h3>Current Institution{last_known_institutions.length > 1 ? "s" : ""}</h3>
          <ul class="institution-list">
            {last_known_institutions.map((inst: any, i: number) => (
              <li key={inst.id || i}>{inst.display_name || inst.name}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Affiliation Timeline */}
      {affiliations && affiliations.length > 0 && (
        <section class="detail-section">
          <h3>Affiliation History</h3>
          <ul class="affiliation-timeline">
            {affiliations.map((aff: any, i: number) => {
              const inst = aff.institution;
              const years = aff.years ?? [];
              const yearRange = years.length > 0
                ? `${Math.min(...years)}--${Math.max(...years)}`
                : "";
              return (
                <li key={i} class="affiliation-item">
                  <span class="affiliation-name">
                    {inst?.name || inst?.display_name || "Unknown"}
                    {inst?.country ? ` (${inst.country})` : ""}
                  </span>
                  {yearRange && <span class="affiliation-years">{yearRange}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Top Research Topics */}
      {topicChartData.length > 0 && (
        <section class="chart-section">
          <h3>Top Research Topics</h3>
          <BarChart data={topicChartData} />
        </section>
      )}

      {/* Publications per Year */}
      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Publications per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}
    </div>
  );
}

render(<GetAuthorView />, document.getElementById("app")!);
