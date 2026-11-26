interface QueryNoteProps {
  oql?: string | null;
}

/** The query behind a result, in OpenAlex's query language, for rerunning or exporting on openalex.org. */
export function QueryNote({ oql }: QueryNoteProps) {
  if (!oql) return null;
  return (
    <details class="query-note">
      <summary>Query in OQL</summary>
      <code>{oql}</code>
      <p class="muted">Paste this into the OQL tab at openalex.org to rerun or export the full results.</p>
    </details>
  );
}
