import { render } from "preact";
import type { ReferencesOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetReferencesView() {
  return (
    <AppShell<ReferencesOutput> toolName="openalex_get_references">
      {(data, ctx) => (
        <div class="results-container">
          <header class="results-header">
            <h2>References from: {data.source_work.title}</h2>
            <p class="results-subtitle">Total references: {formatNumber(data.source_work.total_references)}</p>
          </header>
          <WorkList works={data.references} pagination={data.pagination} ctx={ctx} emptyMessage="No references found." numbered />
        </div>
      )}
    </AppShell>
  );
}

render(<GetReferencesView />, document.getElementById("app")!);
