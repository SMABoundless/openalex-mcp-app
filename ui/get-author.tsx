import { render } from "preact";
import type { AuthorOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function AuthorProfile({ author }: { author: AuthorOutput }) {
  const topicChartData = author.top_topics.map((t) => ({ label: t.name, value: t.count }));
  const yearChartData = author.counts_by_year
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((c) => ({ label: String(c.year), value: c.works_count ?? 0 }));

  return (
    <div class="detail-container">
      <h1 class="detail-title">{author.display_name}</h1>
      {author.display_name_alternatives.length > 0 && (
        <p class="alt-names">Also known as: {author.display_name_alternatives.slice(0, 5).join(", ")}</p>
      )}
      {author.orcid && (
        <a
          href={author.orcid.startsWith("http") ? author.orcid : `https://orcid.org/${author.orcid}`}
          target="_blank" rel="noopener noreferrer" class="external-link"
        >
          ORCID: {author.orcid.replace("https://orcid.org/", "")}
        </a>
      )}

      <section class="metrics-row">
        <MetricBadge label="Works" value={author.works_count} />
        <MetricBadge label="Citations" value={author.cited_by_count} />
        {author.h_index != null && <MetricBadge label="h-index" value={author.h_index} />}
        {author.i10_index != null && <MetricBadge label="i10-index" value={author.i10_index} />}
        {author.two_year_mean_citedness != null && (
          <MetricBadge label="2yr Mean Citedness" value={author.two_year_mean_citedness.toFixed(2)} />
        )}
      </section>

      {author.last_known_institutions.length > 0 && (
        <section class="detail-section">
          <h3>Current Institution{author.last_known_institutions.length > 1 ? "s" : ""}</h3>
          <ul class="plain-list">
            {author.last_known_institutions.map((inst) => (
              <li key={inst.id}>{inst.name}</li>
            ))}
          </ul>
        </section>
      )}

      {author.affiliations.length > 0 && (
        <section class="detail-section">
          <h3>Affiliation History</h3>
          <ul class="plain-list">
            {author.affiliations.map((aff, i) => (
              <li key={i} class="split-row">
                <span>
                  {aff.institution.name}
                  {aff.institution.country ? ` (${aff.institution.country})` : ""}
                </span>
                {aff.years.length > 0 && (
                  <span class="muted">{Math.min(...aff.years)}–{Math.max(...aff.years)}</span>
                )}
              </li>
            ))}
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
          <h3>Publications per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}
    </div>
  );
}

render(
  <AppShell<AuthorOutput> toolName="openalex_get_author">{(data) => <AuthorProfile author={data} />}</AppShell>,
  document.getElementById("app")!
);
