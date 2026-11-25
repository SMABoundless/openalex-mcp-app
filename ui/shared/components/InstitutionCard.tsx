import type { InstitutionOutput } from "../../../server/output-types";
import { MetricBadge } from "./MetricBadge";

export function InstitutionCard({ institution }: { institution: InstitutionOutput }) {
  const location = [institution.geo?.city, institution.geo?.country ?? institution.country_code]
    .filter(Boolean)
    .join(", ");

  return (
    <div class="card">
      <div class="card-title">{institution.display_name}</div>
      <div class="card-meta">
        {institution.type && <span class="badge">{institution.type}</span>}
        {location && <> &middot; {location}</>}
      </div>
      <div class="metric-row">
        <MetricBadge label="Works" value={institution.works_count} />
        <MetricBadge label="Citations" value={institution.cited_by_count} />
      </div>
    </div>
  );
}
