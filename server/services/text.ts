// Turning markup into plain text. Pure, so it can be tested directly.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”"
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** HTML or XML to plain text: block elements become paragraph breaks, everything else is dropped. */
export function markupToText(markup: string): string {
  return decodeEntities(
    markup
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|head|tr|blockquote|section|item)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The main title recorded in a TEI document's header, or "" when it has none. */
export function teiTitle(tei: string): string {
  const match = tei.match(/<title\b[^>]*type="main"[^>]*>([\s\S]*?)<\/title>/i);
  return match ? markupToText(match[1]) : "";
}

/** The text of a TEI document's body, or "" when the body is empty or missing. */
export function teiBodyText(tei: string): string {
  const match = tei.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return match ? markupToText(match[1]) : "";
}

/** Cuts text to at most `max` characters, at a paragraph or word boundary where one is near. */
export function truncateText(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const paragraph = cut.lastIndexOf("\n\n");
  const space = cut.lastIndexOf(" ");
  const end = paragraph > max * 0.8 ? paragraph : space > max * 0.9 ? space : max;
  return { text: `${cut.slice(0, end).trimEnd()}…`, truncated: true };
}
