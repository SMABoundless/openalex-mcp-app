import { render } from "preact";
import type { SearchTopicsOutput, TopicOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { ResultsPage } from "./shared/components/ResultsPage";
import { MetricBadge } from "./shared/components/MetricBadge";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function TopicCard({ topic }: { topic: TopicOutput }) {
  const path = [topic.domain, topic.field, topic.subfield].filter(Boolean).join(" › ");
  return (
    <div class="card">
      <div class="card-title">{topic.display_name}</div>
      {path && <div class="card-meta">{path}</div>}
      <div class="metric-row">
        <MetricBadge label="Works" value={topic.works_count} />
        <MetricBadge label="Citations" value={topic.cited_by_count} />
      </div>
      {topic.description && <div class="card-abstract">{topic.description}</div>}
      {topic.keywords.length > 0 && (
        <div class="tags-container">
          {topic.keywords.map((k) => <span class="tag" key={k}>{k}</span>)}
        </div>
      )}
      <div class="card-meta card-footnote">{topic.id.replace("https://openalex.org/", "")}</div>
    </div>
  );
}

render(
  <AppShell<SearchTopicsOutput> toolName="openalex_search_topics">
    {(data, ctx) => (
      <ResultsPage pagination={data.pagination} ctx={ctx} noun="topics" isEmpty={data.topics.length === 0}>
        {data.topics.map((t) => <TopicCard key={t.id} topic={t} />)}
      </ResultsPage>
    )}
  </AppShell>,
  document.getElementById("app")!
);
