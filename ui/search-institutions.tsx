import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { InstitutionCard } from "./shared/components/InstitutionCard";
import { Pagination } from "./shared/components/Pagination";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SearchInstitutionsView() {
  return (
    <AppShell title="Search Institutions">
      {(data: any) => <InstitutionResults data={data} />}
    </AppShell>
  );
}

function InstitutionResults({ data }: { data: any }) {
  const { pagination, institutions } = data;

  if (!institutions || institutions.length === 0) {
    return (
      <div class="empty-state">
        <p>No institutions found.</p>
      </div>
    );
  }

  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{formatNumber(pagination?.total ?? institutions.length)} institutions</h2>
      </header>

      <div class="card-grid">
        {institutions.map((inst: any, i: number) => (
          <InstitutionCard key={inst.id || i} institution={inst} />
        ))}
      </div>

      {pagination && <Pagination pagination={pagination} />}
    </div>
  );
}

render(<SearchInstitutionsView />, document.getElementById("app")!);
