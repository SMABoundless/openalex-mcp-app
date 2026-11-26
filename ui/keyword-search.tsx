import { render } from "preact";
import type { KeywordSearchOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { WorkCard } from "./shared/components/WorkCard";
import { QueryNote } from "./shared/components/QueryNote";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

const count = (n: number | null): string => (n == null ? "" : formatNumber(n));

function KeywordSearch({ data }: { data: KeywordSearchOutput }) {
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{formatNumber(data.total)} works match every part</h2>
        {data.filters.length > 0 && <p class="results-subtitle">Filters: {data.filters.join(" · ")}</p>}
      </header>

      <section class="metrics-row">
        <MetricBadge label="All parts" value={data.total} />
        {data.text_only != null && <MetricBadge label="Words alone" value={data.text_only} />}
        {data.added_by_keywords != null && <MetricBadge label="Added by keywords" value={data.added_by_keywords} />}
      </section>

      <table class="results-table">
        <thead>
          <tr>
            <th>Part</th>
            <th class="num">Words</th>
            <th class="num">Keywords</th>
            <th class="num">Either</th>
          </tr>
        </thead>
        <tbody>
          {data.parts.map((part) => (
            <tr key={part.label}>
              <td>
                <strong>{part.label}</strong>
                {part.text && <div class="muted part-detail">{part.text}</div>}
                {part.keywords.length > 0 && (
                  <div class="tags-container">
                    {part.keywords.map((k) => <span class="tag" key={k.id} title={k.id}>{k.name}</span>)}
                  </div>
                )}
              </td>
              <td class="num">{count(part.text_count)}</td>
              <td class="num">{count(part.keyword_count)}</td>
              <td class="num">{formatNumber(part.either_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.sample.length > 0 && (
        <section class="detail-section">
          <h3>Random Sample, to Check the Results Are on Topic</h3>
          {data.sample.map((w) => <WorkCard key={w.id} work={w} />)}
        </section>
      )}

      <QueryNote oql={data.oql} />
    </div>
  );
}

render(
  <AppShell<KeywordSearchOutput> toolName="openalex_keyword_search">{(data) => <KeywordSearch data={data} />}</AppShell>,
  document.getElementById("app")!
);
