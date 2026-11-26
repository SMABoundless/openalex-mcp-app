/** The kinds of record OpenAlex colour-codes. Each view shows one. */
export type Category = "works" | "authors" | "institutions" | "sources" | "topics" | "funders";

const CATEGORY_OF_TOOL: Record<string, { category: Category; label: string }> = {
  openalex_search_authors: { category: "authors", label: "Authors" },
  openalex_get_author: { category: "authors", label: "Author" },
  openalex_search_institutions: { category: "institutions", label: "Institutions" },
  openalex_get_institution: { category: "institutions", label: "Institution" },
  openalex_search_sources: { category: "sources", label: "Sources" },
  openalex_get_source: { category: "sources", label: "Source" },
  openalex_search_publishers: { category: "sources", label: "Publishers" },
  openalex_get_publisher: { category: "sources", label: "Publisher" },
  openalex_search_topics: { category: "topics", label: "Topics" },
  openalex_get_topic: { category: "topics", label: "Topic" },
  openalex_find_keywords: { category: "topics", label: "Keywords" },
  openalex_search_funders: { category: "funders", label: "Funders" },
  openalex_get_funder: { category: "funders", label: "Funder" },
  openalex_get_work: { category: "works", label: "Work" },
};

/** The record kind a tool's view shows; anything not listed shows works. */
export function categoryOf(toolName: string): { category: Category; label: string } {
  return CATEGORY_OF_TOOL[toolName] ?? { category: "works", label: "Works" };
}

/**
 * The strip at the top of every view: the kind of record shown, and where the
 * data comes from. It deliberately carries no logo or symbol, and no OpenAlex
 * wordmark, so the app is not mistaken for theirs.
 */
export function BrandBar({ toolName }: { toolName: string }) {
  const { label } = categoryOf(toolName);
  return (
    <header class="brand-bar">
      <span class="brand-cat">{label}</span>
      <span class="brand-note">
        Unofficial app · data from{" "}
        <a href="https://openalex.org" target="_blank" rel="noopener noreferrer">OpenAlex</a>
      </span>
    </header>
  );
}
