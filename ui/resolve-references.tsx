import { render } from "preact";
import type { ResolveReferencesOutput, ResolvedReference, ReferenceStatus } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { formatAuthors, formatNumber, doiUrl, shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

const STATUS: Record<ReferenceStatus, { label: string; cls: string }> = {
  matched: { label: "Found", cls: "status-good" },
  likely: { label: "Likely match", cls: "status-good" },
  possible: { label: "Possible match · check it", cls: "status-warn" },
  not_found: { label: "Not found", cls: "status-bad" },
  error: { label: "Could not be checked", cls: "status-bad" },
};

const METHOD: Record<NonNullable<ResolvedReference["method"]>, string> = {
  doi: "by DOI",
  pmid: "by PMID",
  openalex_id: "by OpenAlex ID",
  title_search: "by title",
  semantic_search: "by meaning",
};

function ReferenceRow({ item }: { item: ResolvedReference }) {
  const status = STATUS[item.status];
  const work = item.work;
  return (
    <div class="card">
      <div class="metric-row">
        <span class="muted">{item.index}.</span>
        <span class={`badge ${status.cls}`}>{status.label}</span>
        {item.is_retracted && <span class="badge status-bad">Retracted</span>}
        {item.method && <span class="muted">{METHOD[item.method]}</span>}
      </div>
      <div class="card-meta reference-input">{item.input}</div>
      {work && (
        <div class="reference-work">
          <div class="card-title">
            {work.doi ? (
              <a href={doiUrl(work.doi)} target="_blank" rel="noopener noreferrer">{work.title}</a>
            ) : (
              work.title
            )}
          </div>
          <div class="card-meta">
            {formatAuthors(work)}
            {work.publication_year && <> &middot; {work.publication_year}</>}
            {work.source && <> &middot; {work.source.name}</>}
            <> &middot; cited by {formatNumber(work.cited_by_count)}</>
            <> &middot; {shortId(work.id)}</>
          </div>
        </div>
      )}
      {item.notes.map((note) => <div class="card-meta card-footnote" key={note}>{note}</div>)}
    </div>
  );
}

function References({ data }: { data: ResolveReferencesOutput }) {
  const s = data.summary;
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{s.total} reference{s.total === 1 ? "" : "s"} checked</h2>
      </header>
      <section class="metrics-row">
        <MetricBadge label="Found" value={s.matched} />
        <MetricBadge label="Likely" value={s.likely} />
        <MetricBadge label="Possible" value={s.possible} />
        <MetricBadge label="Not found" value={s.not_found} />
        {s.errors > 0 && <MetricBadge label="Not checked" value={s.errors} />}
        {s.retracted > 0 && <MetricBadge label="Retracted" value={s.retracted} />}
      </section>
      {data.results.map((r) => <ReferenceRow key={r.index} item={r} />)}
      <p class="muted table-note">
        "Not found" means nothing close enough is in OpenAlex. It does not prove a reference is invented: books and
        older works are less well covered.
      </p>
    </div>
  );
}

render(
  <AppShell<ResolveReferencesOutput> toolName="openalex_resolve_references">
    {(data) => <References data={data} />}
  </AppShell>,
  document.getElementById("app")!
);
