import type { AuthorOutput } from "../../../server/output-types";
import { MetricBadge } from "./MetricBadge";

export function AuthorCard({ author }: { author: AuthorOutput }) {
  const institution = author.last_known_institutions[0]?.name ?? author.affiliations[0]?.institution.name ?? "";

  return (
    <div class="card">
      <div class="card-title">{author.display_name}</div>
      {institution && <div class="card-meta">{institution}</div>}
      <div class="metric-row">
        {author.h_index != null && <MetricBadge label="h-index" value={author.h_index} />}
        <MetricBadge label="Works" value={author.works_count} />
        <MetricBadge label="Citations" value={author.cited_by_count} />
      </div>
      {author.top_topics.length > 0 && (
        <div class="tags-container">
          {author.top_topics.slice(0, 3).map((t) => (
            <span class="tag" key={t.id}>{t.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
