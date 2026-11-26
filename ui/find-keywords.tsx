import { render } from "preact";
import type { FindKeywordsOutput, KeywordOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function KeywordCard({ keyword }: { keyword: KeywordOutput }) {
  const how = [
    keyword.score != null ? `Matches the description (${keyword.score.toFixed(2)})` : null,
    keyword.found_by.length > 0 ? `Found by ${keyword.found_by.map((p) => `"${p}"`).join(", ")}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div class="card">
      <div class="card-title">{keyword.name}</div>
      <div class="card-meta">ID: <code>{keyword.id}</code></div>
      <div class="metric-row">
        <MetricBadge label="Works" value={keyword.works_count} />
      </div>
      {keyword.description && <div class="card-abstract">{keyword.description}</div>}
      {keyword.alternatives.length > 0 && (
        <div class="tags-container">
          {keyword.alternatives.slice(0, 8).map((a) => <span class="tag" key={a}>{a}</span>)}
        </div>
      )}
      {keyword.top_titles.length > 0 && (
        <>
          <div class="card-meta card-footnote">Most cited works with this keyword:</div>
          <ul class="plain-list">
            {keyword.top_titles.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </>
      )}
      {how && <div class="card-meta card-footnote">{how}</div>}
    </div>
  );
}

function Keywords({ data }: { data: FindKeywordsOutput }) {
  if (data.keywords.length === 0) {
    return (
      <div class="empty-state">
        <p>No OpenAlex keywords matched.</p>
      </div>
    );
  }
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{data.keywords.length} keyword{data.keywords.length === 1 ? "" : "s"} found</h2>
        <p class="results-subtitle">
          {data.phrases.length > 0 && <>Phrases: {data.phrases.join(", ")}</>}
          {data.phrases.length > 0 && data.used_description && " · "}
          {data.used_description && "matched to the description by meaning"}
        </p>
      </header>
      {data.keywords.map((k) => <KeywordCard key={k.id} keyword={k} />)}
      <p class="muted table-note">
        A keyword's name can be broader or narrower than it sounds. Its most cited works show what it covers.
        {data.truncated && " More keywords were found than are shown."}
      </p>
    </div>
  );
}

render(
  <AppShell<FindKeywordsOutput> toolName="openalex_find_keywords">{(data) => <Keywords data={data} />}</AppShell>,
  document.getElementById("app")!
);
