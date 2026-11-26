import type { ComponentChildren } from "preact";
import type { PaginationInfo } from "../../../server/output-types";
import type { ShellContext } from "./AppShell";
import { Pagination } from "./Pagination";
import { formatNumber } from "../utils/format";

interface ResultsPageProps {
  pagination: PaginationInfo;
  ctx: ShellContext;
  /** Plural noun for the heading, e.g. "sources". */
  noun: string;
  isEmpty: boolean;
  children: ComponentChildren;
}

/** Heading, card grid and pager shared by the simple search views. */
export function ResultsPage({ pagination, ctx, noun, isEmpty, children }: ResultsPageProps) {
  if (isEmpty) {
    return (
      <div class="empty-state">
        <p>No {noun} found.</p>
      </div>
    );
  }
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{formatNumber(pagination.total)} {noun}</h2>
      </header>
      <div class="card-grid">{children}</div>
      <Pagination pagination={pagination} onNavigate={ctx.navigate} busy={ctx.busy} />
    </div>
  );
}
