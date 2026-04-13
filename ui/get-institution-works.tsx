import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { WorkCard } from "./shared/components/WorkCard";
import { Pagination } from "./shared/components/Pagination";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetInstitutionWorksView() {
  return (
    <AppShell title="Institution Works">
      {(data: any) => <InstitutionWorksDetail data={data} />}
    </AppShell>
  );
}

function InstitutionWorksDetail({ data }: { data: any }) {
  const { institution, pagination, works } = data;

  // Compute publications per year from works
  const yearCounts: Record<number, number> = {};
  (works ?? []).forEach((w: any) => {
    if (w.publication_year) {
      yearCounts[w.publication_year] = (yearCounts[w.publication_year] || 0) + 1;
    }
  });
  const chartData = Object.entries(yearCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ label: year, value: count }));

  return (
    <div class="results-container">
      {/* Header */}
      <header class="results-header">
        <h2>{institution?.name ?? "Institution"}</h2>
        <p class="results-subtitle">
          {formatNumber(institution?.total_works ?? pagination?.total ?? works?.length ?? 0)} works
        </p>
      </header>

      {/* Publications per year chart */}
      {chartData.length > 1 && (
        <section class="chart-section">
          <h3>Publications per Year</h3>
          <BarChart data={chartData} />
        </section>
      )}

      {/* Works list */}
      {(!works || works.length === 0) ? (
        <div class="empty-state">
          <p>No works found.</p>
        </div>
      ) : (
        <div class="results-list">
          {works.map((work: any, i: number) => (
            <WorkCard key={work.id || i} work={work} />
          ))}
        </div>
      )}

      {pagination && <Pagination pagination={pagination} />}
    </div>
  );
}

render(<GetInstitutionWorksView />, document.getElementById("app")!);
