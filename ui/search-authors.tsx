import { h, render } from "preact";
import { AppShell } from "./shared/components/AppShell";
import { AuthorCard } from "./shared/components/AuthorCard";
import { Pagination } from "./shared/components/Pagination";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

function SearchAuthorsView() {
  return (
    <AppShell title="Search Authors">
      {(data: any) => <AuthorResults data={data} />}
    </AppShell>
  );
}

function AuthorResults({ data }: { data: any }) {
  const { pagination, authors } = data;

  if (!authors || authors.length === 0) {
    return (
      <div class="empty-state">
        <p>No authors found.</p>
      </div>
    );
  }

  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{formatNumber(pagination?.total ?? authors.length)} authors</h2>
      </header>

      <div class="card-grid">
        {authors.map((author: any, i: number) => (
          <AuthorCard key={author.id || i} author={author} />
        ))}
      </div>

      {pagination && <Pagination pagination={pagination} />}
    </div>
  );
}

render(<SearchAuthorsView />, document.getElementById("app")!);
