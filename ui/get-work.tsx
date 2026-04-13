import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { OABadge } from "./shared/components/OABadge";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetWorkView() {
  return (
    <AppShell title="Work Details">
      {(data: any) => <WorkDetail data={data} />}
    </AppShell>
  );
}

function WorkDetail({ data }: { data: any }) {
  const {
    title, publication_year, type, authors, source, cited_by_count,
    open_access, abstract, topics, doi, referenced_works_count,
    related_works_count
  } = data;

  return (
    <div class="detail-container">
      {/* Title + Year */}
      <h1 class="detail-title">
        {title}
        {publication_year && (
          <span class="detail-year"> ({publication_year})</span>
        )}
      </h1>

      {type && <span class="type-badge">{type.replace(/_/g, " ")}</span>}

      {/* Authors */}
      {authors && authors.length > 0 && (
        <section class="detail-section">
          <h3>Authors</h3>
          <ul class="author-list">
            {authors.map((a: any, i: number) => (
              <li key={a.id || i} class="author-item">
                <span class="author-name">{a.name}</span>
                {a.institutions && a.institutions.length > 0 && (
                  <span class="author-affiliation">
                    {a.institutions.map((inst: any) => inst.display_name || inst.name).join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Source / Journal */}
      {source && (
        <section class="detail-section">
          <h3>Source</h3>
          <p class="source-name">{source.display_name || source}</p>
        </section>
      )}

      {/* Metrics Row */}
      <section class="metrics-row">
        <MetricBadge label="Citations" value={formatNumber(cited_by_count ?? 0)} />
        <MetricBadge label="References" value={formatNumber(referenced_works_count ?? 0)} />
        <MetricBadge label="Related Works" value={formatNumber(related_works_count ?? 0)} />
      </section>

      {/* Open Access */}
      {open_access && (
        <section class="detail-section">
          <OABadge oa={open_access} />
          {open_access.url && (
            <a href={open_access.url} target="_blank" rel="noopener" class="oa-link">
              Access PDF
            </a>
          )}
        </section>
      )}

      {/* Abstract */}
      {abstract && (
        <section class="detail-section">
          <h3>Abstract</h3>
          <p class="abstract-text">{abstract}</p>
        </section>
      )}

      {/* Topics */}
      {topics && topics.length > 0 && (
        <section class="detail-section">
          <h3>Topics</h3>
          <div class="tags-container">
            {topics.map((t: any, i: number) => (
              <span key={t.id || i} class="tag">
                {t.name}
                {t.score != null && (
                  <span class="tag-score"> {(t.score * 100).toFixed(0)}%</span>
                )}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* DOI Link */}
      {doi && (
        <section class="detail-section">
          <h3>DOI</h3>
          <a href={doi.startsWith("http") ? doi : `https://doi.org/${doi}`} target="_blank" rel="noopener" class="doi-link">
            {doi}
          </a>
        </section>
      )}
    </div>
  );
}

render(<GetWorkView />, document.getElementById("app")!);
