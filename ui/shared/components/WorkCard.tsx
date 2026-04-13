import { h } from "preact";
import { formatAuthors, formatNumber, truncateText } from "../utils/format";
import { OABadge } from "./OABadge";

interface WorkCardProps {
  work: any;
  compact?: boolean;
  onClickTitle?: (id: string) => void;
}

export function WorkCard({ work, compact, onClickTitle }: WorkCardProps) {
  const title = work.title || "Untitled";
  const authors = work.authorships || work.authors || [];
  const year = work.publication_year;
  const source =
    work.primary_location?.source?.display_name ||
    work.venue ||
    work.journal?.name ||
    "";
  const citations = work.cited_by_count ?? 0;
  const oaStatus = work.open_access?.oa_status || "closed";
  const oaUrl = work.open_access?.oa_url || work.openAccessPdf?.url;
  const abstract = work.abstract_inverted_index
    ? undefined
    : work.abstract || "";
  const topics = work.topics || [];
  const id = work.id || work.paperId || "";

  const handleClick = (e: Event) => {
    if (onClickTitle) {
      e.preventDefault();
      onClickTitle(id);
    }
  };

  return (
    <div class="card">
      <div class="card-title">
        {onClickTitle ? (
          <a href="#" onClick={handleClick}>
            {title}
          </a>
        ) : work.doi ? (
          <a href={work.doi} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
        ) : (
          title
        )}
      </div>
      <div class="card-meta">
        {formatAuthors(authors)}
        {year && <> &middot; {year}</>}
        {source && <> &middot; {source}</>}
      </div>
      <div class="metric-row">
        <span class="badge badge-metric">
          <span class="metric-label">Citations</span>
          {formatNumber(citations)}
        </span>
        <OABadge status={oaStatus} url={oaUrl} />
      </div>
      {!compact && abstract && (
        <div class="card-abstract">{truncateText(abstract, 200)}</div>
      )}
      {!compact && topics.length > 0 && (
        <div style={{ marginTop: "6px" }}>
          {topics.slice(0, 5).map((t: any) => (
            <span class="tag" key={t.id || t.display_name}>
              {t.display_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
