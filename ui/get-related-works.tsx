import { render } from "preact";
import type { RelatedWorksOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetRelatedWorksView() {
  return (
    <AppShell<RelatedWorksOutput> toolName="openalex_get_related_works">
      {(data, ctx) => (
        <div class="results-container">
          <header class="results-header">
            <h2>Related to: {data.source_work.title}</h2>
            <p class="results-subtitle">Related works listed by OpenAlex: {formatNumber(data.source_work.total_related)}</p>
          </header>
          <WorkList works={data.related_works} pagination={data.pagination} ctx={ctx} emptyMessage="OpenAlex lists no related works." />
        </div>
      )}
    </AppShell>
  );
}

render(<GetRelatedWorksView />, document.getElementById("app")!);
