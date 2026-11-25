import { render } from "preact";
import type { AuthorWorksOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber, worksPerYear } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetAuthorWorksView() {
  return (
    <AppShell<AuthorWorksOutput> toolName="openalex_get_author_works">
      {(data, ctx) => {
        const chartData = worksPerYear(data.works);
        return (
          <div class="results-container">
            <header class="results-header">
              <h2>{data.author.name}</h2>
              <p class="results-subtitle">
                {formatNumber(data.pagination.total)} matching works
                {data.pagination.total !== data.author.total_works && <> of {formatNumber(data.author.total_works)} in total</>}
              </p>
            </header>
            {chartData.length > 1 && (
              <section class="chart-section">
                <h3>Works on This Page by Year</h3>
                <BarChart data={chartData} />
              </section>
            )}
            <WorkList works={data.works} pagination={data.pagination} ctx={ctx} emptyMessage="No works found." />
          </div>
        );
      }}
    </AppShell>
  );
}

render(<GetAuthorWorksView />, document.getElementById("app")!);
