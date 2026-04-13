import { h } from "preact";
import { formatNumber } from "../utils/format";

interface MetricBadgeProps {
  label: string;
  value: string | number;
  icon?: string;
}

export function MetricBadge({ label, value, icon }: MetricBadgeProps) {
  const display = typeof value === "number" ? formatNumber(value) : value;
  return (
    <span class="badge badge-metric">
      {icon && <span>{icon}</span>}
      <span class="metric-label">{label}</span>
      {display}
    </span>
  );
}
