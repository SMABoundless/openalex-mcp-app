import type { PaginationInfo } from "../../../server/output-types";

interface PaginationProps {
  pagination: PaginationInfo;
  /** Re-runs the query with changed arguments. When omitted (host cannot run tools from the app), only the position is shown. */
  onNavigate?: (changes: Record<string, unknown>) => void;
  busy?: boolean;
}

export function Pagination({ pagination, onNavigate, busy }: PaginationProps) {
  const { total, page, perPage, hasMore } = pagination;

  // Cursor paging has no page numbers and only moves forward
  if (pagination.cursorMode) {
    if (!pagination.nextCursor) return null;
    const next = pagination.nextCursor;
    return (
      <div class="pagination">
        <span class="page-info">{busy ? "Loading…" : "More results available"}</span>
        {onNavigate && (
          <button disabled={busy} onClick={() => onNavigate({ cursor: next })}>
            Next
          </button>
        )}
      </div>
    );
  }

  // OpenAlex paging only reaches the first 10,000 results
  const totalPages = Math.max(1, Math.ceil(Math.min(total, 10000) / perPage));
  if (totalPages <= 1) return null;

  return (
    <div class="pagination">
      {onNavigate && (
        <button disabled={busy || page <= 1} onClick={() => onNavigate({ page: page - 1 })}>
          Prev
        </button>
      )}
      <span class="page-info">
        {busy ? "Loading…" : `Page ${page.toLocaleString("en-US")} of ${totalPages.toLocaleString("en-US")}`}
      </span>
      {onNavigate && (
        <button disabled={busy || !hasMore} onClick={() => onNavigate({ page: page + 1 })}>
          Next
        </button>
      )}
    </div>
  );
}
