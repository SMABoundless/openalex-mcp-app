import { render } from "preact";
import type { SearchInstitutionsOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { InstitutionCard } from "./shared/components/InstitutionCard";
import { Pagination } from "./shared/components/Pagination";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SearchInstitutionsView() {
  return (
    <AppShell<SearchInstitutionsOutput> toolName="openalex_search_institutions">
      {(data, ctx) =>
        data.institutions.length === 0 ? (
          <div class="empty-state"><p>No institutions found.</p></div>
        ) : (
          <div class="results-container">
            <header class="results-header">
              <h2>{formatNumber(data.pagination.total)} institutions</h2>
            </header>
            <div class="card-grid">
              {data.institutions.map((inst) => (
                <InstitutionCard key={inst.id} institution={inst} />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPageChange={ctx.goToPage} busy={ctx.busy} />
          </div>
        )
      }
    </AppShell>
  );
}

render(<SearchInstitutionsView />, document.getElementById("app")!);
