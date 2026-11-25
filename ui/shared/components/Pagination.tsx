import type { PaginationInfo } from "../../../server/output-types";

interface PaginationProps {
  pagination: PaginationInfo;
  /** When omitted (host cannot run tools from the app), only the page position is shown. */
  onPageChange?: (page: number) => void;
  busy?: boolean;
}

export function Pagination({ pagination, onPageChange, busy }: PaginationProps) {
  const { total, page, perPage, hasMore } = pagination;
  // OpenAlex paging only reaches the first 10,000 results
  const totalPages = Math.max(1, Math.ceil(Math.min(total, 10000) / perPage));
  if (totalPages <= 1) return null;

  return (
    <div class="pagination">
      {onPageChange && (
        <button disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
      )}
      <span class="page-info">
        {busy ? "Loading…" : `Page ${page.toLocaleString("en-US")} of ${totalPages.toLocaleString("en-US")}`}
      </span>
      {onPageChange && (
        <button disabled={busy || !hasMore} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      )}
    </div>
  );
}
