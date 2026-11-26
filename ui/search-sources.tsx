import { render } from "preact";
import type { SearchSourcesOutput, SourceOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { ResultsPage } from "./shared/components/ResultsPage";
import { MetricBadge } from "./shared/components/MetricBadge";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SourceCard({ source }: { source: SourceOutput }) {
  const meta = [source.type, source.publisher, source.country_code].filter(Boolean).join(" · ");
  return (
    <div class="card">
      <div class="card-title">
        {source.homepage_url ? (
          <a href={source.homepage_url} target="_blank" rel="noopener noreferrer">{source.display_name}</a>
        ) : (
          source.display_name
        )}
      </div>
      {meta && <div class="card-meta">{meta}</div>}
      <div class="metric-row">
        <MetricBadge label="Works" value={source.works_count} />
        <MetricBadge label="Citations" value={source.cited_by_count} />
        {source.h_index != null && <MetricBadge label="h-index" value={source.h_index} />}
      </div>
      <div class="tags-container">
        <span class={`badge ${source.is_oa ? "badge-gold" : "badge-closed"}`}>
          {source.is_oa ? "Open access" : "Not fully OA"}
        </span>{" "}
        {source.is_in_doaj && <span class="badge badge-green">DOAJ</span>}{" "}
        {source.apc_usd != null && (
          <span class="badge">{source.apc_usd === 0 ? "No APC" : `APC $${formatNumber(source.apc_usd)}`}</span>
        )}
      </div>
      {source.issn_l && <div class="card-meta card-footnote">ISSN {source.issn_l}</div>}
    </div>
  );
}

render(
  <AppShell<SearchSourcesOutput> toolName="openalex_search_sources">
    {(data, ctx) => (
      <ResultsPage pagination={data.pagination} ctx={ctx} noun="sources" isEmpty={data.sources.length === 0}>
        {data.sources.map((s) => <SourceCard key={s.id} source={s} />)}
      </ResultsPage>
    )}
  </AppShell>,
  document.getElementById("app")!
);
