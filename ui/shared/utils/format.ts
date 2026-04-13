export function formatNumber(n: number): string {
  if (n == null) return "0";
  return n.toLocaleString("en-US");
}

export function truncateText(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "...";
}

export function formatAuthors(authors: any[], max: number = 3): string {
  if (!authors || authors.length === 0) return "Unknown";
  const names = authors
    .slice(0, max)
    .map((a) => a.author?.display_name || a.display_name || a.name || "Unknown");
  if (authors.length > max) {
    return names.join(", ") + `, et al.`;
  }
  return names.join(", ");
}
