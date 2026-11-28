import { useState } from "preact/hooks";
import type { PaginationInfo, WorkOutput } from "../../../server/output-types";
import type { ShellContext } from "./AppShell";
import { WorkCard } from "./WorkCard";
import { Pagination } from "./Pagination";
import { QueryNote } from "./QueryNote";
import { SelectionBar } from "./SelectionBar";
import { MAX_SELECTED, toggleSelected } from "../utils/selection";

interface WorkListProps {
  works: WorkOutput[];
  pagination: PaginationInfo;
  ctx: ShellContext;
  emptyMessage: string;
  numbered?: boolean;
  /** The query behind the list, shown under the pager when given */
  oql?: string | null;
}

/**
 * A page of work cards followed by the pager. Shared by every view that lists works.
 * Each card has a checkbox; ticked works stay ticked while paging and can be
 * exported together from the bar above the list.
 */
export function WorkList({ works, pagination, ctx, emptyMessage, numbered, oql }: WorkListProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set<string>());
  if (works.length === 0) {
    return (
      <div class="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }
  const full = selected.size >= MAX_SELECTED;
  const card = (work: WorkOutput) => (
    <WorkCard
      work={work}
      selected={selected.has(work.id)}
      onToggle={() => setSelected((s) => toggleSelected(s, work.id))}
      selectionFull={full}
    />
  );
  const start = pagination.cursorMode ? 1 : (pagination.page - 1) * pagination.perPage + 1;
  return (
    <>
      <SelectionBar works={works} selected={selected} onChange={setSelected} ctx={ctx} />
      {numbered ? (
        <ol class="results-list numbered-list" start={start}>
          {works.map((work) => (
            <li key={work.id} class="numbered-item">
              {card(work)}
            </li>
          ))}
        </ol>
      ) : (
        <div class="results-list">
          {works.map((work) => (
            <div key={work.id}>{card(work)}</div>
          ))}
        </div>
      )}
      <Pagination pagination={pagination} onNavigate={ctx.navigate} busy={ctx.busy} />
      <QueryNote oql={oql} />
    </>
  );
}
