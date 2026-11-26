import { render } from "preact";
import { useState } from "preact/hooks";
import type { ExportWorksOutput } from "../server/output-types";
import { AppShell, type ShellContext } from "./shared/components/AppShell";
import { MetricBadge } from "./shared/components/MetricBadge";
import { CopyButton } from "./shared/components/CopyButton";
import { QueryNote } from "./shared/components/QueryNote";
import { formatNumber } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

const LABEL: Record<ExportWorksOutput["format"], string> = { ris: "RIS", bibtex: "BibTeX", csv: "CSV" };
const OPENS_IN: Record<ExportWorksOutput["format"], string> = {
  ris: "Zotero, EndNote, Mendeley, Covidence or Rayyan",
  bibtex: "LaTeX and BibTeX-based tools",
  csv: "a spreadsheet",
};

/** Lines of the file shown before "Show all" */
const PREVIEW_LINES = 40;

function ExportView({ data, ctx }: { data: ExportWorksOutput; ctx: ShellContext }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [showAll, setShowAll] = useState(false);

  if (data.records === 0) {
    return (
      <div class="empty-state">
        <p>Nothing to export: no works were found.</p>
        {data.not_found.length > 0 && <p class="muted">Not found: {data.not_found.join(", ")}</p>}
      </div>
    );
  }

  const save = async () => {
    setState("saving");
    const ok = await ctx.download({ filename: data.filename, mimeType: data.mime_type, text: data.content });
    setState(ok ? "saved" : "failed");
  };

  const lines = data.content.split(/\r?\n/);
  const preview = showAll ? data.content : lines.slice(0, PREVIEW_LINES).join("\n");

  return (
    <div class="results-container">
      <header class="results-header">
        <h2>{LABEL[data.format]} export: {formatNumber(data.records)} record{data.records === 1 ? "" : "s"}</h2>
        <p class="results-subtitle">
          <code>{data.filename}</code> · for {OPENS_IN[data.format]} · exported {data.exported_at.slice(0, 10)}
          {data.abstracts ? " · with abstracts" : " · without abstracts"}
        </p>
      </header>

      <section class="metrics-row">
        <MetricBadge label="In the file" value={data.records} />
        {data.matched != null && <MetricBadge label="Matched the search" value={data.matched} />}
        <MetricBadge label="Duplicates removed" value={data.duplicates_removed} />
        {data.not_found.length > 0 && <MetricBadge label="Not found" value={data.not_found.length} />}
      </section>

      <div class="button-row">
        <button type="button" class="primary-button" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Download file"}
        </button>
        <CopyButton text={data.content} label="file text" />
      </div>
      {state === "failed" && (
        <div class="notice" role="status">
          The file could not be saved from here. Use "Copy file text" and paste it into a new file named <code>{data.filename}</code>.
        </div>
      )}

      {data.truncated && data.matched != null && (
        <p class="muted table-note">
          The search matched {formatNumber(data.matched)} works. The file holds the first {formatNumber(data.records + data.duplicates_removed)} in the chosen order.
        </p>
      )}
      {data.duplicates_removed > 0 && (
        <p class="muted table-note">
          Repeats of works already in the file were removed, matched by DOI then OpenAlex ID: {[...new Set(data.removed_ids)].join(", ")}
        </p>
      )}
      {data.not_found.length > 0 && (
        <p class="muted table-note">Not found in OpenAlex, so not in the file: {data.not_found.join(", ")}</p>
      )}

      <section class="detail-section">
        <h3>File preview</h3>
        <pre class="file-preview">{preview}</pre>
        {!showAll && lines.length > PREVIEW_LINES && (
          <button type="button" class="copy-button" onClick={() => setShowAll(true)}>
            Show all {formatNumber(lines.length)} lines
          </button>
        )}
      </section>

      <p class="muted table-note">
        Author names are turned into "Surname, Given" by rule, which is wrong for some names. A preprint and its
        published version are separate records and both are kept. These numbers cover identification only; screening
        and inclusion counts come from your screening tool.
      </p>
      <QueryNote oql={data.oql} />
    </div>
  );
}

render(
  <AppShell<ExportWorksOutput> toolName="openalex_export_works">{(data, ctx) => <ExportView data={data} ctx={ctx} />}</AppShell>,
  document.getElementById("app")!
);
