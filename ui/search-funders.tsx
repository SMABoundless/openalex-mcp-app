import { render } from "preact";
import type { SearchFundersOutput, FunderOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { ResultsPage } from "./shared/components/ResultsPage";
import { MetricBadge } from "./shared/components/MetricBadge";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function FunderCard({ funder }: { funder: FunderOutput }) {
  const meta = [funder.description, funder.country_code].filter(Boolean).join(" · ");
  return (
    <div class="card">
      <div class="card-title">
        {funder.homepage_url ? (
          <a href={funder.homepage_url} target="_blank" rel="noopener noreferrer">{funder.display_name}</a>
        ) : (
          funder.display_name
        )}
      </div>
      {meta && <div class="card-meta">{meta}</div>}
      <div class="metric-row">
        <MetricBadge label="Funded works" value={funder.works_count} />
        {funder.awards_count != null && <MetricBadge label="Awards" value={funder.awards_count} />}
        <MetricBadge label="Citations" value={funder.cited_by_count} />
      </div>
      {funder.alternate_titles.length > 0 && (
        <div class="card-meta card-footnote">Also known as: {funder.alternate_titles.slice(0, 3).join("; ")}</div>
      )}
    </div>
  );
}

render(
  <AppShell<SearchFundersOutput> toolName="openalex_search_funders">
    {(data, ctx) => (
      <ResultsPage pagination={data.pagination} ctx={ctx} noun="funders" isEmpty={data.funders.length === 0}>
        {data.funders.map((f) => <FunderCard key={f.id} funder={f} />)}
      </ResultsPage>
    )}
  </AppShell>,
  document.getElementById("app")!
);
