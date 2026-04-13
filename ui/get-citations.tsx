import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { WorkCard } from "./shared/components/WorkCard";
import { Pagination } from "./shared/components/Pagination";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetCitationsView() {
  return (
    <AppShell title="Citations">
      {(data: any) => <CitationsDetail data={data} />}
    </AppShell>
  );
}

function CitationsDetail({ data }: { data: any }) {
  const { cited_work, pagination, citing_works } = data;

  const chartData = cited_work?.counts_by_year
    ?.slice()
    .sort((a: any, b: any) => a.year - b.year)
    .map((c: any) => ({ label: String(c.year), value: c.cited_by_count }))
    ?? [];

  return (
    <div class="results-container">
      {/* Header */}
      <header class="results-header">
        <h2>Citations for: {cited_work?.title ?? "Unknown Work"}</h2>
        <p class="results-subtitle">
          Total citations: {formatNumber(cited_work?.total_citations ?? citing_works?.length ?? 0)}
        </p>
      </header>

      {/* Citations by year chart */}
      {chartData.length > 0 && (
        <section class="chart-section">
          <h3>Citations by Year</h3>
          <BarChart data={chartData} />
        </section>
      )}

      {/* Citing works list */}
      {(!citing_works || citing_works.length === 0) ? (
        <div class="empty-state">
          <p>No citing works found.</p>
        </div>
      ) : (
        <div class="results-list">
          {citing_works.map((work: any, i: number) => (
            <WorkCard key={work.id || i} work={work} />
          ))}
        </div>
      )}

      {pagination && <Pagination pagination={pagination} />}
    </div>
  );
}

render(<GetCitationsView />, document.getElementById("app")!);
