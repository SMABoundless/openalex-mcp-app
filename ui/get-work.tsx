import { render } from "preact";
import type { WorkOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { OABadge } from "./shared/components/OABadge";
import { CopyButton } from "./shared/components/CopyButton";
import { doiUrl, libkeyUrl, shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function WorkDetail({ work }: { work: WorkOutput }) {
  const fullText = libkeyUrl(work.doi);
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

      <section class="detail-section">
        <h3>Identifiers and Links</h3>
        <ul class="plain-list">
          {work.doi && (
            <li class="id-row">
              <a href={doiUrl(work.doi)} target="_blank" rel="noopener noreferrer" class="external-link">{work.doi}</a>
              <CopyButton text={work.doi} label="DOI" />
            </li>
          )}
          {fullText && (
            <li class="id-row">
              <a href={fullText} target="_blank" rel="noopener noreferrer" class="external-link">Full text through your library (LibKey)</a>
            </li>
          )}
          <li class="id-row">
            <span>OpenAlex ID <code>{shortId(work.id)}</code></span>
            <CopyButton text={shortId(work.id)} label="ID" />
          </li>
        </ul>
      </section>
    </div>
  );
}

render(
  <AppShell<WorkOutput> toolName="openalex_get_work">{(data) => <WorkDetail work={data} />}</AppShell>,
  document.getElementById("app")!
);
