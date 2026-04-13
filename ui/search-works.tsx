import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { WorkCard } from "./shared/components/WorkCard";
import { Pagination } from "./shared/components/Pagination";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SearchWorksView() {
  return (
    <AppShell title="Search Works">
      {(data: any) => <SearchResults data={data} />}
    </AppShell>
  );
}

function SearchResults({ data }: { data: any }) {
  const { pagination, works } = data;

  if (!works || works.length === 0) {
    return (
      <div class="empty-state">
        <p>No results found.</p>
      </div>
    );
  }

  return (
    <div class="results-container">
      <header class="results-header">
        <h2>
          {formatNumber(pagination?.total ?? works.length)} results
        </h2>
      </header>

      <div class="results-list">
        {works.map((work: any, i: number) => (
          <WorkCard key={work.id || i} work={work} />
        ))}
      </div>

      {pagination && <Pagination pagination={pagination} />}
    </div>
  );
}

render(<SearchWorksView />, document.getElementById("app")!);
