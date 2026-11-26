// Reading and presenting the result of a query written in OQL.
// Pure (no network), so it can be tested directly.
import type { QueryColumn, QueryEntity, QueryRow, QueryTable } from "../output-types.js";
import { num } from "./format-utils.js";
import { shortId } from "./openalex-client.js";

/** The parts of a query response this module reads. */
export interface QueryResponse {
  meta?: {
    count?: number;
    more_groups?: boolean;
    measures?: { key?: string; oql?: string }[];
    splits?: { oql?: string }[];
    cost_usd?: number;
    x_query?: { oql?: string | null } | null;
    [key: string]: unknown;
  };
  results?: Record<string, unknown>[];
  group_by?: Record<string, unknown>[];
  summary?: { all?: Record<string, unknown> } | null;
}

/** The validation messages in a refused query's response body, each with its suggested fix. */
export function validationMessages(body: string): string[] {
  try {
    const errors = (JSON.parse(body) as { validation?: { errors?: { message?: unknown }[] } }).validation?.errors ?? [];
    return errors.map(e => (typeof e.message === "string" ? e.message.replace(/\s+/g, " ").trim() : "")).filter(Boolean);
  } catch {
    return [];
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toRow(raw: Record<string, unknown>, measures: QueryColumn[]): QueryRow {
  const key = String(raw.key ?? "");
  const row: QueryRow = {
    key,
    name: String(raw.key_display_name ?? raw.key ?? ""),
    values: Object.fromEntries(measures.map(m => [m.key, numberOrNull(raw[m.key])]))
  };
  if (Array.isArray(raw.groups)) {
    row.groups = (raw.groups as Record<string, unknown>[]).map(g => toRow(g, measures));
  }
  return row;
}

/** True when the response holds numbers (a table) and not a list of records. */
export function isTableResponse(response: QueryResponse): boolean {
  return (response.meta?.measures?.length ?? 0) > 0;
}

export function parseTable(response: QueryResponse): QueryTable {
  const measures: QueryColumn[] = (response.meta?.measures ?? [])
    .filter(m => typeof m.key === "string" && m.key !== "")
    .map(m => ({ key: m.key!, label: m.oql || m.key! }));
  const all = response.summary?.all;
  return {
    splits: (response.meta?.splits ?? []).map(s => s.oql ?? "").filter(Boolean),
    measures,
    rows: (response.group_by ?? []).map(g => toRow(g, measures)),
    summary: all ? Object.fromEntries(measures.map(m => [m.key, numberOrNull(all[m.key])])) : null,
    more_rows: Boolean(response.meta?.more_groups)
  };
}

/**
 * Keeps at most `limit` rows at each level. OpenAlex does not apply the
 * requested page size to a table split two ways, which can return hundreds of rows.
 */
export function limitRows(table: QueryTable, limit: number): QueryTable {
  let cut = table.rows.length > limit;
  const rows = table.rows.slice(0, limit).map(row => {
    if (!row.groups || row.groups.length <= limit) return row;
    cut = true;
    return { ...row, groups: row.groups.slice(0, limit) };
  });
  return { ...table, rows, more_rows: table.more_rows || cut };
}

export function parseEntities(results: Record<string, unknown>[]): QueryEntity[] {
  return results.map(r => ({
    id: String(r.id ?? ""),
    name: String(r.display_name ?? r.id ?? ""),
    works_count: numberOrNull(r.works_count),
    cited_by_count: numberOrNull(r.cited_by_count)
  }));
}

/** A number as the table shows it: whole numbers with separators, others to two places, percents marked. */
export function formatMeasure(column: QueryColumn, value: number | null): string {
  if (value == null) return "n/a";
  const percent = column.key.startsWith("percent_");
  const text = Number.isInteger(value) ? num(value) : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return percent ? `${text}%` : text;
}

function rowLine(row: QueryRow, measures: QueryColumn[], indent: string): string {
  // Show the ID when the row is an OpenAlex entity, so it can be used in a further query
  const id = row.key.startsWith("https://openalex.org/") ? ` [${shortId(row.key)}]` : "";
  const values = measures.map(m => `${m.label} ${formatMeasure(m, row.values[m.key])}`).join(" · ");
  return `${indent}- ${row.name}${id}: ${values}`;
}

/** Inner rows shown per outer row when a table has two splits */
const INNER_ROWS_IN_TEXT = 10;

export function tableMarkdown(table: QueryTable): string {
  const lines: string[] = [];
  if (table.summary) {
    lines.push(`**All works:** ${table.measures.map(m => `${m.label} ${formatMeasure(m, table.summary![m.key])}`).join(" · ")}`);
  }
  if (table.rows.length > 0) {
    lines.push("", `By ${table.splits.join(", then ") || "group"}:`);
    for (const row of table.rows) {
      lines.push(rowLine(row, table.measures, ""));
      const inner = row.groups ?? [];
      for (const sub of inner.slice(0, INNER_ROWS_IN_TEXT)) lines.push(rowLine(sub, table.measures, "  "));
      if (inner.length > INNER_ROWS_IN_TEXT) lines.push(`  - and ${inner.length - INNER_ROWS_IN_TEXT} more`);
    }
  }
  if (table.more_rows) lines.push("", "There are more rows than shown; raise limit to see more.");
  return lines.join("\n").trim();
}

export function entityLine(e: QueryEntity, index: number): string {
  const facts = [
    e.works_count != null ? `${num(e.works_count)} works` : null,
    e.cited_by_count != null ? `${num(e.cited_by_count)} citations` : null,
    shortId(e.id)
  ].filter(Boolean);
  return `${index}. **${e.name}**\n   ${facts.join(" · ")}`;
}
