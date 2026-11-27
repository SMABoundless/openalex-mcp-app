import { render } from "preact";
import type { ReadDocsOutput } from "../server/output-types";
import { AppShell, type ShellContext } from "./shared/components/AppShell";
import { Markdown } from "./shared/components/Markdown";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

const SITE = "https://help.openalex.org";

function Docs({ data, ctx }: { data: ReadDocsOutput; ctx: ShellContext }) {
  const top = Math.min(...data.headings.map((h) => h.level), 6);
  const go = ctx.navigate;
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{data.title}</h2>
        <p class="results-subtitle">
          <a href={data.url} target="_blank" rel="noopener noreferrer">{data.url}</a>
          {data.section && <> · sections matching "{data.section}"</>}
          {" · "}fetched {data.fetched_at.slice(0, 10)}
        </p>
      </header>

      {data.mode === "overview" && (
        <p class="muted table-note">This page is long, so only its opening is shown. Choose a section below.</p>
      )}
      {data.mode === "sections" && data.truncated && (
        <p class="muted table-note">This section was cut to fit. Choose a narrower one, or read the whole page at the address above.</p>
      )}

      <Markdown text={data.content} linkBase={SITE} />

      {data.headings.length > 1 && (
        <details class="query-note" open={data.mode === "overview"}>
          <summary>Sections of this page</summary>
          <ul class="doc-outline">
            {data.headings.map((h, i) => (
              <li key={i} style={`padding-left: ${(h.level - top) * 16}px`}>
                {go ? (
                  <button type="button" class="link-button" disabled={ctx.busy} onClick={() => go({ section: h.text })}>{h.text}</button>
                ) : (
                  h.text
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

render(
  <AppShell<ReadDocsOutput> toolName="openalex_read_docs">{(data, ctx) => <Docs data={data} ctx={ctx} />}</AppShell>,
  document.getElementById("app")!
);
