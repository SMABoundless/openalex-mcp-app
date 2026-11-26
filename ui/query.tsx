import { render } from "preact";
import type { QueryOutput, QueryColumn, QueryRow, QueryTable } from "../server/output-types";
import { AppShell, type ShellContext } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { Pagination } from "./shared/components/Pagination";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber, shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function formatMeasure(column: QueryColumn, value: number | null): string {
  if (value == null) return "n/a";
  const text = Number.isInteger(value) ? formatNumber(value) : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return column.key.startsWith("percent_") ? `${text}%` : text;
}

function TableRows({ rows, measures, depth }: { rows: QueryRow[]; measures: QueryColumn[]; depth: number }) {
  return (
    <>
      {rows.map((row) => (
        <>
          <tr key={`${depth}-${row.key}`} class={depth > 0 ? "sub-row" : undefined}>
            <td style={depth > 0 ? "padding-left: 28px" : undefined}>
              {row.name}
              {row.key.startsWith("https://openalex.org/") && <span class="muted"> {shortId(row.key)}</span>}
            </td>
            {measures.map((m) => <td class="num" key={m.key}>{formatMeasure(m, row.values[m.key])}</td>)}
          </tr>
          {row.groups && <TableRows rows={row.groups} measures={measures} depth={depth + 1} />}
        </>
      ))}
    </>
  );
}

function ResultTable({ table }: { table: QueryTable }) {
  const first = table.measures[0];
  // A chart of the first number, when the rows are a single breakdown
  const flat = table.rows.length > 1 && table.rows.every((r) => !r.groups);
  const isYears = flat && table.rows.every((r) => /^\d{4}$/.test(r.key));
  const chartData = flat && first ? table.rows.map((r) => ({ label: r.name, value: r.values[first.key] ?? 0 })) : [];

  return (
    <>
      {chartData.length > 0 && first && (
        <section class="chart-section">
          <h3>{first.label} by {table.splits[0]}</h3>
          <BarChart data={chartData} horizontal={!isYears} />
        </section>
      )}
      <table class="results-table">
        <thead>
          <tr>
            <th>{table.splits.join(" › ") || "Set"}</th>
            {table.measures.map((m) => <th class="num" key={m.key}>{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.summary && (
            <tr class="summary-row">
              <td>All works</td>
              {table.measures.map((m) => <td class="num" key={m.key}>{formatMeasure(m, table.summary![m.key])}</td>)}
            </tr>
          )}
          <TableRows rows={table.rows} measures={table.measures} depth={0} />
        </tbody>
      </table>
      {table.more_rows && <p class="muted table-note">There are more rows than shown.</p>}
    </>
  );
}

function QueryResult({ data, ctx }: { data: QueryOutput; ctx: ShellContext }) {
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>
          {formatNumber(data.total)} {data.entity}
          {data.kind === "table" && " counted"}
        </h2>
        <p class="results-subtitle query-echo">{data.oql}</p>
      </header>

      {data.kind === "table" && data.table && <ResultTable table={data.table} />}

      {data.kind === "works" && data.pagination && (
        <WorkList works={data.works} pagination={data.pagination} ctx={ctx} emptyMessage="The query matched no works." />
      )}

      {data.kind === "entities" && data.pagination && (
        data.entities.length === 0 ? (
          <div class="empty-state"><p>The query matched no {data.entity}.</p></div>
        ) : (
          <>
            <table class="results-table">
              <thead>
                <tr>
                  <th>{data.entity}</th>
                  <th class="num">Works</th>
                  <th class="num">Citations</th>
                </tr>
              </thead>
              <tbody>
                {data.entities.map((e) => (
                  <tr key={e.id}>
                    <td>{e.name} <span class="muted">{shortId(e.id)}</span></td>
                    <td class="num">{e.works_count != null ? formatNumber(e.works_count) : ""}</td>
                    <td class="num">{e.cited_by_count != null ? formatNumber(e.cited_by_count) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination pagination={data.pagination} onNavigate={ctx.navigate} busy={ctx.busy} />
          </>
        )
      )}
    </div>
  );
}

render(
  <AppShell<QueryOutput> toolName="openalex_query">{(data, ctx) => <QueryResult data={data} ctx={ctx} />}</AppShell>,
  document.getElementById("app")!
);
