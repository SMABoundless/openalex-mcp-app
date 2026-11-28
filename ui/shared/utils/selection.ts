// Ticking works in a list so they can be exported together.
//
// A selection is a set of OpenAlex work IDs. It is kept while paging, so
// works can be collected from several pages before exporting. Every function
// returns a new set and leaves the one it was given alone.

/** Most works one export holds; the same as the export tool's limit. */
export const MAX_SELECTED = 500;

/** Ticks a work, or unticks it if it was ticked. A full selection takes no more. */
export function toggleSelected(selected: ReadonlySet<string>, id: string, max: number = MAX_SELECTED): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else if (next.size < max) next.add(id);
  return next;
}

/** Ticks every work given, in order, stopping when the selection is full. */
export function addSelected(selected: ReadonlySet<string>, ids: string[], max: number = MAX_SELECTED): Set<string> {
  const next = new Set(selected);
  for (const id of ids) {
    if (next.size >= max) break;
    next.add(id);
  }
  return next;
}

/** Unticks every work given. */
export function removeSelected(selected: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.delete(id);
  return next;
}

/** True when the list is not empty and every work in it is ticked. */
export function allSelected(selected: ReadonlySet<string>, ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => selected.has(id));
}

/** How many of the works given are ticked. */
export function countSelected(selected: ReadonlySet<string>, ids: string[]): number {
  return ids.filter((id) => selected.has(id)).length;
}
