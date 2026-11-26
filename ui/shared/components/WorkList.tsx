import type { PaginationInfo, WorkOutput } from "../../../server/output-types";
import type { ShellContext } from "./AppShell";
import { WorkCard } from "./WorkCard";
import { Pagination } from "./Pagination";

interface WorkListProps {
  works: WorkOutput[];
  pagination: PaginationInfo;
  ctx: ShellContext;
  emptyMessage: string;
  numbered?: boolean;
}

/** A page of work cards followed by the pager. Shared by every view that lists works. */
export function WorkList({ works, pagination, ctx, emptyMessage, numbered }: WorkListProps) {
  if (works.length === 0) {
    return (
      <div class="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }
  const start = pagination.cursorMode ? 1 : (pagination.page - 1) * pagination.perPage + 1;
  return (
    <>
      {numbered ? (
        <ol class="results-list numbered-list" start={start}>
          {works.map((work) => (
            <li key={work.id} class="numbered-item">
              <WorkCard work={work} />
            </li>
          ))}
        </ol>
      ) : (
        <div class="results-list">
          {works.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      )}
      <Pagination pagination={pagination} onNavigate={ctx.navigate} busy={ctx.busy} />
    </>
  );
}
