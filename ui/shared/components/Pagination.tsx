import { h } from "preact";

interface PaginationProps {
  pagination: {
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  };
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { total, page, perPage, hasMore } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div class="pagination">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      <span class="page-info">
        Page {page} of {totalPages}
      </span>
      <button disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
