import { useState } from "preact/hooks";
import type { ExportWorksOutput, WorkOutput } from "../../../server/output-types";
import type { ShellContext } from "./AppShell";
import { CopyButton } from "./CopyButton";
import { shortId } from "../utils/format";
import { MAX_SELECTED, addSelected, allSelected, countSelected, removeSelected } from "../utils/selection";

type Format = ExportWorksOutput["format"];
const FORMATS: { format: Format; label: string; title: string }[] = [
  { format: "ris", label: "RIS", title: "RIS: for Zotero, EndNote, Mendeley, Covidence or Rayyan" },
  { format: "bibtex", label: "BibTeX", title: "BibTeX: for LaTeX" },
  { format: "csv", label: "CSV", title: "CSV: for a spreadsheet" },
];

type Outcome =
  | { kind: "saved"; label: string; file: ExportWorksOutput }
  | { kind: "unsaved"; label: string; file: ExportWorksOutput }
  | { kind: "error"; message: string };

interface SelectionBarProps {
  /** The works on the page being shown */
  works: WorkOutput[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  ctx: ShellContext;
}

/**
 * The row above a list of works: how many are ticked, buttons to tick or
 * untick the page, and buttons that export the ticked works as a file.
 * The file is made by the export tool, then handed to the host to save.
 */
export function SelectionBar({ works, selected, onChange, ctx }: SelectionBarProps) {
  const [working, setWorking] = useState<Format | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const pageIds = works.map((w) => w.id);
  const pageTicked = allSelected(selected, pageIds);
  const onPage = countSelected(selected, pageIds);
  const elsewhere = selected.size - onPage;
  const full = selected.size >= MAX_SELECTED;
  const none = selected.size === 0;
  const ids = [...selected].map(shortId);

  const exportAs = async (format: Format, label: string) => {
    if (!ctx.callTool || none || working) return;
    setWorking(format);
    setOutcome(null);
    const result = await ctx.callTool<ExportWorksOutput>("openalex_export_works", { format, ids, include_file: false });
    if (!result.data || result.data.records === 0) {
      setOutcome({ kind: "error", message: result.error ?? "The export came back empty." });
    } else {
      const file = result.data;
      const saved = await ctx.download({ filename: file.filename, mimeType: file.mime_type, text: file.content });
      setOutcome({ kind: saved ? "saved" : "unsaved", label, file });
    }
    setWorking(null);
  };

  return (
    <div class="selection-bar">
      <div class="selection-row">
        <span class="selection-count" role="status">
          {selected.size} selected
          {elsewhere > 0 && <span class="muted"> ({elsewhere} on other pages)</span>}
        </span>
        <button
          type="button"
          class="copy-button"
          onClick={() => onChange(pageTicked ? removeSelected(selected, pageIds) : addSelected(selected, pageIds))}
          disabled={!pageTicked && full}
        >
          {pageTicked ? "Unselect page" : "Select page"}
        </button>
        {!none && (
          <button type="button" class="copy-button" onClick={() => onChange(new Set())}>
            Clear
          </button>
        )}
        <span class="selection-spacer" />
        {!none && <CopyButton text={ids.join("\n")} label="IDs" />}
        {ctx.callTool &&
          FORMATS.map(({ format, label, title }) => (
            <button
              key={format}
              type="button"
              class="export-button"
              title={title}
              aria-label={`Export the selected works as ${label}`}
              disabled={none || working != null}
              onClick={() => exportAs(format, label)}
            >
              {working === format ? "Exporting…" : label}
            </button>
          ))}
      </div>

      {full && <p class="muted selection-note">{MAX_SELECTED} works is the most one export holds.</p>}
      {!ctx.callTool && !none && (
        <p class="muted selection-note">
          This host does not let the view export. Copy the IDs and ask for them to be exported.
        </p>
      )}

      {outcome?.kind === "saved" && (
        <p class="selection-note selection-done" role="status">
          Saved {outcome.file.records} record{outcome.file.records === 1 ? "" : "s"} as {outcome.label} (<code>{outcome.file.filename}</code>).
          {outcome.file.duplicates_removed > 0 && ` ${outcome.file.duplicates_removed} repeated record${outcome.file.duplicates_removed === 1 ? "" : "s"} removed.`}
          {outcome.file.not_found.length > 0 && ` Not found: ${outcome.file.not_found.join(", ")}.`}
        </p>
      )}
      {outcome?.kind === "unsaved" && (
        <div class="notice" role="status">
          The {outcome.label} file is ready ({outcome.file.records} record{outcome.file.records === 1 ? "" : "s"}) but could not be saved from here.
          Copy its text and paste it into a new file named <code>{outcome.file.filename}</code>.{" "}
          <CopyButton text={outcome.file.content} label="file text" />
        </div>
      )}
      {outcome?.kind === "error" && (
        <div class="notice" role="alert">The export failed: {outcome.message}</div>
      )}
    </div>
  );
}
