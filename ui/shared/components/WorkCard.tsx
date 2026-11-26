import type { WorkOutput } from "../../../server/output-types";
import { formatAuthors, formatNumber, doiUrl, libkeyUrl } from "../utils/format";
import { OABadge } from "./OABadge";

interface WorkCardProps {
  work: WorkOutput;
  compact?: boolean;
}

export function WorkCard({ work, compact }: WorkCardProps) {
  const fullText = libkeyUrl(work.doi);
  return (
    <div class="card">
      <div class="card-title">
        {work.doi ? (
          <a href={doiUrl(work.doi)} target="_blank" rel="noopener noreferrer">
            {work.title}
          </a>
        ) : (
          work.title
        )}
      </div>
      <div class="card-meta">
        {formatAuthors(work)}
        {work.publication_year && <> &middot; {work.publication_year}</>}
        {work.source && <> &middot; {work.source.name}</>}
      </div>
      <div class="metric-row">
        <span class="badge badge-metric">
          <span class="metric-label">Citations</span>
          {formatNumber(work.cited_by_count)}
        </span>
        <OABadge status={work.open_access.status} url={work.open_access.url} />
        {fullText && (
          <a class="text-link" href={fullText} target="_blank" rel="noopener noreferrer" title="Full text through your library, via LibKey">
            Full text
          </a>
        )}
      </div>
      {!compact && work.abstract && <div class="card-abstract">{work.abstract}</div>}
      {!compact && work.topics.length > 0 && (
        <div class="tags-container">
          {work.topics.map((t) => (
            <span class="tag" key={t.id}>{t.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
