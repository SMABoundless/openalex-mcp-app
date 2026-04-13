import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { WorkCard } from "./shared/components/WorkCard";
import { Pagination } from "./shared/components/Pagination";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetReferencesView() {
  return (
    <AppShell title="References">
      {(data: any) => <ReferencesDetail data={data} />}
    </AppShell>
  );
}

function ReferencesDetail({ data }: { data: any }) {
  const { source_work, pagination, references } = data;

  return (
    <div class="results-container">
      {/* Header */}
      <header class="results-header">
        <h2>References from: {source_work?.title ?? "Unknown Work"}</h2>
        <p class="results-subtitle">
          Total references: {formatNumber(source_work?.total_references ?? references?.length ?? 0)}
        </p>
      </header>

      {/* Numbered reference list */}
      {(!references || references.length === 0) ? (
        <div class="empty-state">
          <p>No references found.</p>
        </div>
      ) : (
        <ol class="results-list numbered-list">
          {references.map((work: any, i: number) => (
            <li key={work.id || i} class="numbered-item">
              <WorkCard work={work} />
            </li>
          ))}
        </ol>
      )}

      {pagination && <Pagination pagination={pagination} />}
    </div>
  );
}

render(<GetReferencesView />, document.getElementById("app")!);
