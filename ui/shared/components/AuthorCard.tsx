import { h } from "preact";
import { formatNumber } from "../utils/format";
import { MetricBadge } from "./MetricBadge";

interface AuthorCardProps {
  author: any;
  onClickName?: (id: string) => void;
}

export function AuthorCard({ author, onClickName }: AuthorCardProps) {
  const name = author.display_name || author.name || "Unknown";
  const institution =
    author.last_known_institution?.display_name ||
    author.affiliations?.[0]?.institution?.display_name ||
    author.affiliations?.[0] ||
    "";
  const hIndex = author.summary_stats?.h_index ?? author.hIndex ?? null;
  const works = author.works_count ?? author.paperCount ?? 0;
  const citations = author.cited_by_count ?? author.citationCount ?? 0;
  const topics = author.topics || author.x_concepts || [];
  const id = author.id || author.authorId || "";

  const handleClick = (e: Event) => {
    if (onClickName) {
      e.preventDefault();
      onClickName(id);
    }
  };

  return (
    <div class="card">
      <div class="card-title">
        {onClickName ? (
          <a href="#" onClick={handleClick}>
            {name}
          </a>
        ) : (
          name
        )}
      </div>
      {institution && <div class="card-meta">{institution}</div>}
      <div class="metric-row">
        {hIndex != null && <MetricBadge label="h-index" value={hIndex} />}
        <MetricBadge label="Works" value={works} />
        <MetricBadge label="Citations" value={citations} />
      </div>
      {topics.length > 0 && (
        <div style={{ marginTop: "6px" }}>
          {topics.slice(0, 3).map((t: any) => (
            <span class="tag" key={t.id || t.display_name}>
              {t.display_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
