import { render } from "preact";
import type { WorkOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { OABadge } from "./shared/components/OABadge";
import { doiUrl } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function WorkDetail({ work }: { work: WorkOutput }) {
  return (
    <div class="detail-container">
      <h1 class="detail-title">
        {work.title}
        {work.publication_year && <span class="detail-year"> ({work.publication_year})</span>}
      </h1>

      <div class="detail-subtitle-row">
        {work.type && <span class="type-badge">{work.type.replace(/[-_]/g, " ")}</span>}
        {work.source && <span class="source-name">{work.source.name}</span>}
      </div>

      <section class="metrics-row">
        <MetricBadge label="Citations" value={work.cited_by_count} />
        <MetricBadge label="References" value={work.referenced_works_count} />
        <OABadge status={work.open_access.status} url={work.open_access.url} />
      </section>

      {work.authors.length > 0 && (
        <section class="detail-section">
          <h3>Authors</h3>
          <ul class="author-list">
            {work.authors.map((a, i) => (
              <li key={a.id || i} class="author-item">
                <span class="author-name">{a.name}</span>
                {a.institutions && a.institutions.length > 0 && (
                  <span class="author-affiliation">{a.institutions.map((inst) => inst.name).join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.abstract && (
        <section class="detail-section">
          <h3>Abstract</h3>
          <p class="abstract-text">{work.abstract}</p>
        </section>
      )}

      {work.topics.length > 0 && (
        <section class="detail-section">
          <h3>Topics</h3>
          <div class="tags-container">
            {work.topics.map((t) => (
              <span key={t.id} class="tag">{t.name}</span>
            ))}
          </div>
        </section>
      )}

      {work.doi && (
        <section class="detail-section">
          <h3>DOI</h3>
          <a href={doiUrl(work.doi)} target="_blank" rel="noopener noreferrer" class="external-link">
            {work.doi}
          </a>
        </section>
      )}
    </div>
  );
}

render(
  <AppShell<WorkOutput> toolName="openalex_get_work">{(data) => <WorkDetail work={data} />}</AppShell>,
  document.getElementById("app")!
);
