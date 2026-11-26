import { render } from "preact";
import type { GroupWorksOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { BarChart } from "./shared/components/BarChart";
import { QueryNote } from "./shared/components/QueryNote";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function percent(share: number): string {
  const pct = share * 100;
  return pct > 0 && pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`;
}

function GroupedCounts({ data }: { data: GroupWorksOutput }) {
  const scope = [data.query ? `matching "${data.query}"` : null, data.filter ? `filter: ${data.filter}` : null]
    .filter(Boolean)
    .join(" · ");

  if (data.groups.length === 0) {
    return (
      <div class="empty-state">
        <p>No works found to group.</p>
      </div>
    );
  }

  // Years arrive in date order and suit a column chart; anything else has
  // labels of unpredictable length, so it gets horizontal bars.
  const isYears = data.groups.every((g) => /^\d{4}$/.test(g.key));
  const chartData = data.groups.map((g) => ({ label: g.name, value: g.count }));

  return (
    <div class="results-container">
      <header class="results-header">
        <h2>Works by {data.label}</h2>
        <p class="results-subtitle">
          {formatNumber(data.total_works)} works{scope && <> · {scope}</>}
        </p>
      </header>

      <BarChart data={chartData} horizontal={!isYears} />

      <table class="results-table">
        <thead>
          <tr>
            <th>{data.label}</th>
            <th class="num">Works</th>
            <th class="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map((g) => (
            <tr key={g.key}>
              <td>{g.name}</td>
              <td class="num">{formatNumber(g.count)}</td>
              <td class="num">{percent(g.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.works_without_value != null && data.works_without_value > 0 && (
        <p class="muted table-note">
          {formatNumber(data.works_without_value)} of the {formatNumber(data.total_works)} works have no value for this
          field, so they are in neither group.
        </p>
      )}

      {data.more_groups && <p class="muted table-note">Only the {data.groups.length} largest groups are shown.</p>}
      <QueryNote oql={data.oql} />
    </div>
  );
}

render(
  <AppShell<GroupWorksOutput> toolName="openalex_group_works">{(data) => <GroupedCounts data={data} />}</AppShell>,
  document.getElementById("app")!
);
