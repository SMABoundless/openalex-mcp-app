import { h } from "preact";

interface OABadgeProps {
  status: string;
  url?: string;
}

const statusClass: Record<string, string> = {
  gold: "badge-gold",
  green: "badge-green",
  bronze: "badge-bronze",
  hybrid: "badge-hybrid",
  closed: "badge-closed",
};

export function OABadge({ status, url }: OABadgeProps) {
  const normalized = (status || "closed").toLowerCase();
  const cls = `badge ${statusClass[normalized] || "badge-closed"}`;
  const label = normalized === "closed" ? "Closed" : `OA: ${normalized}`;

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" class={cls}>
        {label}
      </a>
    );
  }
  return <span class={cls}>{label}</span>;
}
