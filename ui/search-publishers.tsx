import { render } from "preact";
import type { SearchPublishersOutput, PublisherOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { ResultsPage } from "./shared/components/ResultsPage";
import { MetricBadge } from "./shared/components/MetricBadge";
import { shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function PublisherCard({ publisher }: { publisher: PublisherOutput }) {
  const meta = [
    publisher.parent ? `Part of ${publisher.parent.name}` : null,
    publisher.country_codes.join(", ") || null,
  ].filter(Boolean).join(" · ");
  return (
    <div class="card">
      <div class="card-title">
        {publisher.homepage_url ? (
          <a href={publisher.homepage_url} target="_blank" rel="noopener noreferrer">{publisher.display_name}</a>
        ) : (
          publisher.display_name
        )}
      </div>
      {meta && <div class="card-meta">{meta}</div>}
      <div class="metric-row">
        <MetricBadge label="Works" value={publisher.works_count} />
        <MetricBadge label="Citations" value={publisher.cited_by_count} />
        {publisher.h_index != null && <MetricBadge label="h-index" value={publisher.h_index} />}
      </div>
      {publisher.alternate_titles.length > 0 && (
        <div class="card-meta card-footnote">Also known as: {publisher.alternate_titles.slice(0, 3).join("; ")}</div>
      )}
      <div class="card-meta card-footnote">{shortId(publisher.id)}</div>
    </div>
  );
}

render(
  <AppShell<SearchPublishersOutput> toolName="openalex_search_publishers">
    {(data, ctx) => (
      <ResultsPage pagination={data.pagination} ctx={ctx} noun="publishers" isEmpty={data.publishers.length === 0}>
        {data.publishers.map((p) => <PublisherCard key={p.id} publisher={p} />)}
      </ResultsPage>
    )}
  </AppShell>,
  document.getElementById("app")!
);
