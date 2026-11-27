import type { ComponentChildren } from "preact";

/**
 * A small Markdown renderer for documentation pages: headings, paragraphs,
 * lists, tables, fenced code, and inline code, bold and links. It builds
 * elements, never HTML strings, so page text cannot inject markup.
 * Anything it does not recognise is shown as plain text.
 */

interface MarkdownProps {
  text: string;
  /** Site that relative links such as "/access/oql/" belong to */
  linkBase: string;
}

function inline(text: string, linkBase: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    if (match[1] != null) out.push(<code>{match[1]}</code>);
    else if (match[2] != null) out.push(<strong>{match[2]}</strong>);
    else {
      const target = match[4];
      const href = /^https?:\/\//i.test(target) ? target : target.startsWith("/") ? `${linkBase}${target}` : null;
      // In-page anchors and anything else unusual stay as text
      out.push(href ? <a href={href} target="_blank" rel="noopener noreferrer">{match[3]}</a> : match[3]);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string): string[] => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text, linkBase }: MarkdownProps) {
  const lines = text.split("\n");
  const blocks: ComponentChildren[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1][0].repeat(3))) body.push(lines[i++]);
      i++;
      blocks.push(<pre class="doc-code">{body.join("\n")}</pre>);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], linkBase);
      blocks.push(level <= 1 ? <h2 class="doc-h1">{content}</h2> : level === 2 ? <h3 class="doc-h2">{content}</h3> : <h4 class="doc-h3">{content}</h4>);
      i++;
      continue;
    }

    if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      blocks.push(
        <div class="doc-table-wrap">
          <table class="results-table">
            <thead><tr>{head.map((c) => <th>{inline(c, linkBase)}</th>)}</tr></thead>
            <tbody>{rows.map((r) => <tr>{r.map((c) => <td>{inline(c, linkBase)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length > 0))) {
        const item = lines[i].match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/);
        if (item) items.push(item[1]);
        else items[items.length - 1] += ` ${lines[i].trim()}`;
        i++;
      }
      const list = items.map((item) => <li>{inline(item, linkBase)}</li>);
      blocks.push(ordered ? <ol class="doc-list">{list}</ol> : <ul class="doc-list">{list}</ul>);
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|\s{0,3}(`{3,}|~{3,})|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) {
      paragraph.push(lines[i++].replace(/^>\s?/, ""));
    }
    if (paragraph.length === 0) paragraph.push(lines[i++]);
    blocks.push(<p class="doc-p">{inline(paragraph.join(" "), linkBase)}</p>);
  }
  return <div class="doc">{blocks}</div>;
}
