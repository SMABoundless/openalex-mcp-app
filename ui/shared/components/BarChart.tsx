export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  /** Bars are drawn in the order given. */
  data: BarDatum[];
  /** Horizontal bars suit long labels such as topic names. */
  horizontal?: boolean;
  height?: number;
}

export function BarChart({ data, horizontal, height = 180 }: BarChartProps) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);

  if (horizontal) {
    return (
      <div class="chart-container hbar-chart">
        {data.map((d) => (
          <div class="hbar-row" key={d.label}>
            <span class="hbar-label" title={d.label}>{d.label}</span>
            <span class="hbar-track">
              <span class="hbar-fill" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span class="hbar-value">{d.value.toLocaleString("en-US")}</span>
          </div>
        ))}
      </div>
    );
  }

  const barWidth = 32;
  const gap = 6;
  const topPad = 24;
  const bottomPad = 28;
  const chartWidth = data.length * (barWidth + gap) - gap;
  const chartHeight = height - topPad - bottomPad;

  return (
    <div class="chart-container chart-scroll">
      <svg width={chartWidth + 16} height={height} viewBox={`0 0 ${chartWidth + 16} ${height}`} style={{ display: "block" }}>
        {data.map((d, i) => {
          const barH = (d.value / max) * chartHeight;
          const x = 8 + i * (barWidth + gap);
          const y = topPad + chartHeight - barH;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={3} fill="var(--oa-cat-mid)" />
              <text x={x + barWidth / 2} y={y - 4} text-anchor="middle" font-size="10" fill="var(--oa-text-secondary)">
                {d.value > 0 ? compact(d.value) : ""}
              </text>
              <text x={x + barWidth / 2} y={height - 6} text-anchor="middle" font-size="10" fill="var(--oa-text-secondary)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Keep value labels narrow enough to fit above a bar. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("en-US");
}
