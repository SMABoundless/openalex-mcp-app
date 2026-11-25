import { render } from "preact";
import type { CitationsOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetCitationsView() {
  return (
    <AppShell<CitationsOutput> toolName="openalex_get_citations">
      {(data, ctx) => {
        const chartData = data.cited_work.counts_by_year
          .slice()
          .sort((a, b) => a.year - b.year)
          .map((c) => ({ label: String(c.year), value: c.cited_by_count }));
        return (
          <div class="results-container">
            <header class="results-header">
              <h2>Citations for: {data.cited_work.title}</h2>
              <p class="results-subtitle">Total citations: {formatNumber(data.cited_work.total_citations)}</p>
            </header>
            {chartData.length > 0 && (
              <section class="chart-section">
                <h3>Citations by Year</h3>
                <BarChart data={chartData} />
              </section>
            )}
            <WorkList works={data.citing_works} pagination={data.pagination} ctx={ctx} emptyMessage="No citing works found." />
          </div>
        );
      }}
    </AppShell>
  );
}

render(<GetCitationsView />, document.getElementById("app")!);
