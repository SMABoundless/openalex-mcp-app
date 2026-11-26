import { render } from "preact";
import type { SearchWorksOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SearchWorksView() {
  return (
    <AppShell<SearchWorksOutput> toolName="openalex_search_works">
      {(data, ctx) => (
        <div class="results-container">
          <header class="results-header">
            <h2>{formatNumber(data.pagination.total)} results</h2>
          </header>
          <WorkList oql={data.oql} works={data.works} pagination={data.pagination} ctx={ctx} emptyMessage="No results found." />
        </div>
      )}
    </AppShell>
  );
}

render(<SearchWorksView />, document.getElementById("app")!);
