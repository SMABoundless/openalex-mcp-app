import { h } from "preact";
import { MetricBadge } from "./MetricBadge";

interface InstitutionCardProps {
  institution: any;
  onClickName?: (id: string) => void;
}

export function InstitutionCard({
  institution,
  onClickName,
}: InstitutionCardProps) {
  const name = institution.display_name || "Unknown";
  const type = institution.type || "";
  const country = institution.geo?.country || institution.country_code || "";
  const city = institution.geo?.city || "";
  const location = [city, country].filter(Boolean).join(", ");
  const works = institution.works_count ?? 0;
  const citations = institution.cited_by_count ?? 0;
  const id = institution.id || "";

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
      <div class="card-meta">
        {type && <span class="badge">{type}</span>}
        {location && <> &middot; {location}</>}
      </div>
      <div class="metric-row">
        <MetricBadge label="Works" value={works} />
        <MetricBadge label="Citations" value={citations} />
      </div>
    </div>
  );
}
