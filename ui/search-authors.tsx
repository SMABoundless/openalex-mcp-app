import { render } from "preact";
import type { SearchAuthorsOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { AuthorCard } from "./shared/components/AuthorCard";
import { Pagination } from "./shared/components/Pagination";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SearchAuthorsView() {
  return (
    <AppShell<SearchAuthorsOutput> toolName="openalex_search_authors">
      {(data, ctx) =>
        data.authors.length === 0 ? (
          <div class="empty-state"><p>No authors found.</p></div>
        ) : (
          <div class="results-container">
            <header class="results-header">
              <h2>{formatNumber(data.pagination.total)} authors</h2>
            </header>
            <div class="card-grid">
              {data.authors.map((author) => (
                <AuthorCard key={author.id} author={author} />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPageChange={ctx.goToPage} busy={ctx.busy} />
          </div>
        )
      }
    </AppShell>
  );
}

render(<SearchAuthorsView />, document.getElementById("app")!);
