import { render } from "preact";
import type { InstitutionWorksOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { WorkList } from "./shared/components/WorkList";
import { BarChart } from "./shared/components/BarChart";
import { formatNumber, worksPerYear } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function GetInstitutionWorksView() {
  return (
    <AppShell<InstitutionWorksOutput> toolName="openalex_get_institution_works">
      {(data, ctx) => {
        const chartData = worksPerYear(data.works);
        return (
          <div class="results-container">
            <header class="results-header">
              <h2>{data.institution.name}</h2>
              <p class="results-subtitle">
                {formatNumber(data.pagination.total)} matching works
                {data.pagination.total !== data.institution.total_works && <> of {formatNumber(data.institution.total_works)} in total</>}
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

render(<GetInstitutionWorksView />, document.getElementById("app")!);
