import { render } from "preact";
import type { TopicDetailOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { BarChart } from "./shared/components/BarChart";
import { shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function TopicProfile({ topic }: { topic: TopicDetailOutput }) {
  const path = [topic.domain, topic.field, topic.subfield].filter(Boolean).join(" › ");
  const yearChartData = topic.works_by_year.map((y) => ({ label: String(y.year), value: y.works_count }));

  return (
    <div class="detail-container">
      <h1 class="detail-title">{topic.display_name}</h1>
      <div class="detail-subtitle-row">
        {path && <span>{path}</span>}
        <span class="muted">{shortId(topic.id)}</span>
      </div>

      <section class="metrics-row">
        <MetricBadge label="Works" value={topic.works_count} />
        <MetricBadge label="Citations" value={topic.cited_by_count} />
      </section>

      {topic.description && (
        <section class="detail-section">
          <h3>Description</h3>
          <p>{topic.description}</p>
          {topic.wikipedia_url && (
            <p>
              <a href={topic.wikipedia_url} target="_blank" rel="noopener noreferrer" class="external-link">Wikipedia</a>
            </p>
          )}
        </section>
      )}

      {topic.keywords.length > 0 && (
        <section class="detail-section">
          <h3>Keywords</h3>
          <div class="tags-container">
            {topic.keywords.map((k) => <span class="tag" key={k}>{k}</span>)}
          </div>
        </section>
      )}

      {yearChartData.length > 0 && (
        <section class="chart-section">
          <h3>Works per Year</h3>
          <BarChart data={yearChartData} />
        </section>
      )}

      {topic.siblings.length > 0 && (
        <section class="detail-section">
          <h3>Other Topics in This Subfield</h3>
          <ul class="plain-list">
            {topic.siblings.map((s) => (
              <li key={s.id}>
                {s.name} <span class="muted">{shortId(s.id)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

render(
  <AppShell<TopicDetailOutput> toolName="openalex_get_topic">{(data) => <TopicProfile topic={data} />}</AppShell>,
  document.getElementById("app")!
);
