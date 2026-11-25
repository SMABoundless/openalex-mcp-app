import { formatNumber } from "../utils/format";

interface MetricBadgeProps {
  label: string;
  value: string | number;
}

export function MetricBadge({ label, value }: MetricBadgeProps) {
  const display = typeof value === "number" ? formatNumber(value) : value;
  return (
    <span class="badge badge-metric">
      <span class="metric-label">{label}</span>
      {display}
    </span>
  );
}
