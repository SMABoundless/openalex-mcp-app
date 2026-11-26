import { render } from "preact";
import type { KeywordSearchOutput, SeedCheck } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { WorkCard } from "./shared/components/WorkCard";
import { QueryNote } from "./shared/components/QueryNote";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

const count = (n: number | null): string => (n == null ? "" : formatNumber(n));

function Seeds({ check }: { check: SeedCheck }) {
  const missed = check.results.filter((r) => !r.found);
  const hit = check.results.filter((r) => r.found);
  return (
    <section class="detail-section">
      <h3>Seed check: {check.found} of {check.total} known papers retrieved</h3>
      {missed.map((r) => (
        <div class="card" key={r.id}>
          <div class="metric-row">
            <span class="badge status-bad">Missed</span>
            <span class="muted">{r.id}</span>
          </div>
          <div class="card-title">{r.title}{r.year && <span class="detail-year"> ({r.year})</span>}</div>
          <div class="card-meta">
            {r.excluded_by_filters
              ? "Matches every part, so a filter is leaving it out."
              : <>Does not match: <strong>{r.missing_parts.join(", ")}</strong></>}
          </div>
          {!r.excluded_by_filters && r.keywords.length > 0 && (
            <>
              <div class="card-meta card-footnote">Its OpenAlex keywords, as candidates to add:</div>
              <div class="tags-container">
                {r.keywords.map((k) => <span class="tag" key={k.id} title={k.id}>{k.name}</span>)}
              </div>
            </>
          )}
        </div>
      ))}
      {hit.length > 0 && (
        <ul class="plain-list">
          {hit.map((r) => (
            <li key={r.id} class="id-row">
              <span>{r.title}{r.year && <span class="muted"> ({r.year})</span>}</span>
              <span class="badge status-good">Retrieved</span>
            </li>
          ))}
        </ul>
      )}
      {check.not_in_openalex.length > 0 && (
        <p class="muted table-note">Not in OpenAlex, so not checked: {check.not_in_openalex.join(", ")}</p>
      )}
      {missed.length > 0 && (
        <p class="muted table-note">
          A missed seed means similar papers are being missed too. Add words or keywords to the part it fails, then run
          the search again.
        </p>
      )}
    </section>
  );
}

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
        {data.seeds && data.seeds.total > 0 && (
          <MetricBadge label="Seeds retrieved" value={`${data.seeds.found} of ${data.seeds.total}`} />
        )}
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

      {data.seeds && <Seeds check={data.seeds} />}

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
