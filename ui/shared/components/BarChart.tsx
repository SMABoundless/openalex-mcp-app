import { h } from "preact";

interface BarChartProps {
  data: { year: number; count: number }[];
  label?: string;
  height?: number;
}

export function BarChart({ data, label, height = 180 }: BarChartProps) {
  if (!data || data.length === 0) return null;

  const sorted = [...data].sort((a, b) => a.year - b.year);
  const maxCount = Math.max(...sorted.map((d) => d.count), 1);
  const barWidth = 32;
  const gap = 6;
  const topPad = 24;
  const bottomPad = 28;
  const chartWidth = sorted.length * (barWidth + gap) - gap;
  const chartHeight = height - topPad - bottomPad;

  return (
    <div class="chart-container">
      {label && <div class="chart-label">{label}</div>}
      <svg
        width={chartWidth + 16}
        height={height}
        viewBox={`0 0 ${chartWidth + 16} ${height}`}
        style={{ display: "block", maxWidth: "100%", overflow: "visible" }}
      >
        {sorted.map((d, i) => {
          const barH = (d.count / maxCount) * chartHeight;
          const x = 8 + i * (barWidth + gap);
          const y = topPad + chartHeight - barH;
          return (
            <g key={d.year}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={3}
                fill="var(--oa-accent)"
                opacity={0.85}
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                text-anchor="middle"
                font-size="10"
                fill="var(--oa-text-secondary)"
              >
                {d.count > 0 ? d.count.toLocaleString() : ""}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 6}
                text-anchor="middle"
                font-size="10"
                fill="var(--oa-text-secondary)"
              >
                {d.year}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
