// End-to-end tests: a real MCP client calls the real server, and OpenAlex is
// replaced by canned replies. They check what a host would see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { startHarness, textOf, get, post, work, list, type Route } from "../helpers/harness.js";
import { clearDocsCache } from "../../server/services/docs.js";

async function withServer(routes: Route[], run: (h: Awaited<ReturnType<typeof startHarness>>) => Promise<void>): Promise<void> {
  const harness = await startHarness(routes);
  try {
    await run(harness);
    assert.deepEqual(harness.unmatched.map(c => `${c.method} ${c.url.pathname}${c.url.search}`), [], "requests with no canned reply");
  } finally {
    await harness.close();
  }
}

test("the server lists every tool, each read-only and each with a view that is registered", async () => {
  await withServer([], async ({ client }) => {
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    const views = new Set(resources.map(r => r.uri));
    assert.equal(tools.length, 28);
    assert.equal(new Set(tools.map(t => t.name)).size, 28, "tool names are unique");
    for (const tool of tools) {
      assert.match(tool.name, /^openalex_[a-z_]+$/);
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} is marked read-only`);
      assert.ok((tool.description ?? "").length > 80, `${tool.name} has a description`);
      const view = (tool._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
      assert.ok(view && views.has(view), `${tool.name} points at a registered view (${view})`);
    }
    assert.equal(views.size, 28, "one view per tool");
  });
});

test("search_works sends the query, asks only for the fields it uses, and returns text plus structured data", async () => {
  const routes: Route[] = [{
    name: "works search",
    match: get("/works", { search: "kelp forests" }),
    reply: list([work(1), work(2)], { count: 52, x_query: { oql: "get works about kelp forests" } }),
  }];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({ name: "openalex_search_works", arguments: { query: "kelp forests", filter: "publication_year:2024", limit: 2 } });
    assert.ok(!result.isError);
    const sent = calls[0].url.searchParams;
    assert.equal(sent.get("filter"), "publication_year:2024");
    assert.equal(sent.get("per_page"), "2");
    assert.equal(sent.get("sort"), "relevance_score:desc");
    assert.match(sent.get("select") ?? "", /abstract_inverted_index/);
    assert.equal(sent.get("rerank"), null, "re-ranking is off unless asked for");

    const text = textOf(result);
    assert.match(text, /52 works in total; page 1, 2 shown/);
    assert.match(text, /1\. \*\*Example work 1\*\*/);
    assert.match(text, /More results available: use page=2/);
    assert.match(text, /Query in OQL .*get works about kelp forests/);

    const data = result.structuredContent as { works: { id: string; abstract: string | null }[]; pagination: { total: number }; oql: string; reranked: boolean };
    assert.equal(data.works.length, 2);
    assert.equal(data.works[0].abstract, "An abstract about1");
    assert.equal(data.pagination.total, 52);
    assert.equal(data.reranked, false);
  });
});

test("search_works with detail brief and rerank changes the request and drops abstracts", async () => {
  const routes: Route[] = [{
    name: "works search",
    match: get("/works", { search: "kelp" }),
    reply: list([work(1)], { reranked: true }),
  }];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({ name: "openalex_search_works", arguments: { query: "kelp", detail: "brief", rerank: true } });
    const sent = calls[0].url.searchParams;
    assert.equal(sent.get("rerank"), "true");
    assert.doesNotMatch(sent.get("select") ?? "", /abstract_inverted_index|topics/);
    const data = result.structuredContent as { works: { abstract: string | null; topics: unknown[] }[]; reranked: boolean };
    assert.equal(data.works[0].abstract, null);
    assert.deepEqual(data.works[0].topics, []);
    assert.equal(data.reranked, true);
    assert.match(textOf(result), /Re-ranked by OpenAlex/);
  });
});

test("get_work accepts a PMCID and a DOI, and offers a LibKey link", async () => {
  const routes: Route[] = [
    { name: "by pmcid", match: get("/works/pmcid:PMC5815332"), reply: work(7) },
    { name: "by doi", match: get("/works/https://doi.org/10.7717/peerj.4375"), reply: work(8) },
  ];
  await withServer(routes, async ({ client }) => {
    const byPmcid = await client.callTool({ name: "openalex_get_work", arguments: { id: "PMC5815332" } });
    assert.match(textOf(byPmcid), /^## Example work 7/);
    assert.match(textOf(byPmcid), /\(LibKey\):\*\* https:\/\/libkey\.io\/10\.1234\/example\.7/);
    const byDoi = await client.callTool({ name: "openalex_get_work", arguments: { id: "10.7717/peerj.4375" } });
    assert.match(textOf(byDoi), /^## Example work 8/);
  });
});

test("errors from OpenAlex become clear tool errors: not found, and a spent budget", async () => {
  const routes: Route[] = [
    { name: "missing work", match: get("/works/https://openalex.org/W404"), reply: { error: "Not Found" }, status: 404 },
    {
      name: "budget spent",
      match: get("/works", { search: "anything" }),
      reply: { error: "Rate limit exceeded" },
      status: 429,
      headers: { "x-ratelimit-remaining-usd": "0", "x-ratelimit-limit-usd": "1", "x-ratelimit-reset": "3600" },
    },
  ];
  await withServer(routes, async ({ client, calls }) => {
    const missing = await client.callTool({ name: "openalex_get_work", arguments: { id: "W404" } });
    assert.equal(missing.isError, true);
    assert.match(textOf(missing), /Not found in OpenAlex/);

    const spent = await client.callTool({ name: "openalex_search_works", arguments: { query: "anything" } });
    assert.equal(spent.isError, true);
    assert.match(textOf(spent), /daily budget used up/);
    assert.equal(calls.filter(c => c.url.searchParams.get("search") === "anything").length, 1, "a spent budget is not retried");
  });
});

test("an input the schema rejects never reaches OpenAlex", async () => {
  await withServer([], async ({ client, calls }) => {
    const result = await client.callTool({ name: "openalex_search_works", arguments: { query: "kelp", limit: 5000 } }).catch(error => ({ isError: true, content: [{ type: "text", text: String(error) }] }));
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  });
});

test("group_works turns a short name into the OpenAlex field and labels the result", async () => {
  const routes: Route[] = [{
    name: "group by publisher",
    match: get("/works", { group_by: "primary_location.source.publisher_lineage" }),
    reply: {
      meta: { count: 200, groups_count: 2 },
      group_by: [
        { key: "https://openalex.org/P1", key_display_name: "Example Press", count: 150 },
        { key: "https://openalex.org/P2", key_display_name: "Other House", count: 50 },
      ],
    },
  }];
  await withServer(routes, async ({ client }) => {
    const result = await client.callTool({ name: "openalex_group_works", arguments: { group_by: "publisher", filter: "publication_year:2024" } });
    const text = textOf(result);
    assert.match(text, /^## Works by publisher/);
    assert.match(text, /- Example Press \[P1\]: 150 \(75\.0%\)/);
    const data = result.structuredContent as { group_by: string; label: string; total_works: number };
    assert.equal(data.group_by, "primary_location.source.publisher_lineage");
    assert.equal(data.label, "publisher");
    assert.equal(data.total_works, 200);
  });
});

test("analyze_works assembles its parts and names the ones that failed", async () => {
  const groups = (rows: [string, string, number][]) => ({
    meta: { count: 100, groups_count: rows.length, x_query: { oqo: { get_rows: "works", filter_rows: [{ column_id: "publication_year", value: 2024 }] } } },
    group_by: rows.map(([key, key_display_name, count]) => ({ key, key_display_name, count })),
  });
  const routes: Route[] = [
    { name: "funders fail", match: get("/works", { group_by: "funders.id" }), reply: { error: "boom" }, status: 500 },
    { name: "by year", match: get("/works", { group_by: "publication_year" }), reply: groups([["2024", "2024", 100]]) },
    { name: "oa status", match: get("/works", { group_by: "open_access.oa_status" }), reply: groups([["closed", "closed", 25], ["gold", "gold", 75]]) },
    { name: "countries count", match: get("/works", { group_by: "countries_distinct_count" }), reply: groups([["1", "1", 60], ["2", "2", 20]]) },
    { name: "top 10%", match: get("/works", { group_by: "citation_normalized_percentile.is_in_top_10_percent" }), reply: groups([["true", "true", 10], ["false", "false", 40]]) },
    { name: "other groups", match: get("/works", { group_by: /./ }), reply: groups([["https://openalex.org/X1", "Something", 30]]) },
    { name: "most cited", match: get("/works", { sort: "cited_by_count:desc" }), reply: list([work(9)], { x_query: { oql: "get works from 2024, most cited first" } }) },
    {
      name: "citation totals",
      match: post("/", (_oql, body) => Boolean((body.oqo as { calculate?: unknown[] } | undefined)?.calculate)),
      reply: { summary: { all: { count: 100, sum_cited_by_count: 480, mean_cited_by_count: 4.8, median_cited_by_count: 1.1, mean_fwci: 1.66 } } },
    },
  ];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({ name: "openalex_analyze_works", arguments: { filter: "publication_year:2024" } });
    assert.ok(!result.isError);
    const data = result.structuredContent as {
      total_works: number; open_access_share: number; international_share: number; top_10_percent_share: number;
      citations: { total: number; mean: number }; unavailable: string[]; most_cited: unknown[];
    };
    assert.equal(data.total_works, 100);
    assert.equal(data.open_access_share, 0.75);
    assert.equal(data.international_share, 0.25);
    assert.equal(data.top_10_percent_share, 0.2);
    assert.equal(data.citations.total, 480);
    assert.deepEqual(data.unavailable, ["funders"]);
    assert.equal(data.most_cited.length, 1);
    assert.match(textOf(result), /Could not be fetched and left out: funders\./);
    const post = calls.find(c => c.method === "POST");
    assert.deepEqual((post?.body?.oqo as { filter_rows: unknown[] }).filter_rows, [{ column_id: "publication_year", value: 2024 }], "the citation request reuses the set OpenAlex echoed back");
  });
});

test("resolve_references finds a work by DOI, flags a retraction, and reports a DOI that is not in OpenAlex", async () => {
  const routes: Route[] = [
    { name: "retracted", match: get("/works/https://doi.org/10.1234/retracted"), reply: work(3, { is_retracted: true, display_name: "A retracted study" }) },
    { name: "unknown", match: get("/works/https://doi.org/10.9999/nothing"), reply: { error: "Not Found" }, status: 404 },
  ];
  await withServer(routes, async ({ client }) => {
    const result = await client.callTool({ name: "openalex_resolve_references", arguments: { references: ["10.1234/retracted", "10.9999/nothing"] } });
    const data = result.structuredContent as { results: { status: string; is_retracted: boolean; notes: string[] }[]; summary: Record<string, number> };
    assert.deepEqual(data.results.map(r => r.status), ["matched", "not_found"]);
    assert.equal(data.results[0].is_retracted, true);
    assert.match(data.results[1].notes[0], /not in OpenAlex/);
    assert.equal(data.summary.retracted, 1);
    assert.match(textOf(result), /\*\*Found\*\* · RETRACTED/);
  });
});

test("query checks the OQL first, passes on OpenAlex's fix hint, and does not run a refused query", async () => {
  const routes: Route[] = [{
    name: "check refuses",
    match: post("/query"),
    reply: { validation: { valid: false, errors: [{ type: "parse_error", message: "unknown entity type \"nonsense\"  Fix: write `get works ...`" }] } },
    status: 400,
  }];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({ name: "openalex_query", arguments: { oql: "get nonsense blah" } });
    assert.equal(result.isError, true);
    assert.match(textOf(result), /OpenAlex could not read this OQL\. unknown entity type "nonsense" Fix: write/);
    assert.equal(calls.length, 1, "only the free check was made");
  });
});

test("query returns a table with its columns and whole-set row", async () => {
  const routes: Route[] = [
    { name: "check", match: post("/query"), reply: { oql_oneline: "get the count of works by year", oqo: { get_rows: "works", calculate: [{ measure: "count" }], group_by: [{ column_id: "publication_year" }] } } },
    {
      name: "run",
      match: post("/"),
      reply: {
        meta: { count: 30, measures: [{ key: "count", oql: "count" }], splits: [{ oql: "year" }], cost_usd: 0.0001, x_query: { oql: "get the count of works by year" } },
        summary: { all: { count: 30 } },
        group_by: [{ key: "2023", key_display_name: "2023", count: 10 }, { key: "2024", key_display_name: "2024", count: 20 }],
        results: [],
      },
    },
  ];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({ name: "openalex_query", arguments: { oql: "get the count of works by year" } });
    const data = result.structuredContent as { kind: string; table: { rows: { name: string; values: Record<string, number> }[]; summary: Record<string, number> } };
    assert.equal(data.kind, "table");
    assert.deepEqual(data.table.rows.map(r => [r.name, r.values.count]), [["2023", 10], ["2024", 20]]);
    assert.equal(data.table.summary.count, 30);
    assert.equal(calls[1].body?.select, undefined, "a table is not asked for work fields");
    assert.match(textOf(result), /- 2024: count 20/);
  });
});

test("export_works by identifiers writes a file, removes repeats and names what was not found", async () => {
  const routes: Route[] = [
    { name: "by openalex id", match: get("/works", { filter: "openalex_id:W1" }), reply: list([work(1)]) },
    { name: "by doi", match: get("/works", { filter: /^doi:/ }), reply: list([work(1)]) },
  ];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({
      name: "openalex_export_works",
      arguments: { ids: ["W1", "10.1234/example.1", "10.9999/missing", "not an id"], format: "ris" },
    });
    const data = result.structuredContent as { records: number; duplicates_removed: number; not_found: string[]; content: string; filename: string };
    assert.equal(data.records, 1);
    assert.equal(data.duplicates_removed, 1);
    assert.deepEqual(data.not_found.sort(), ["10.9999/missing", "not an id"]);
    assert.match(data.filename, /^openalex-export-\d{4}-\d{2}-\d{2}\.ris$/);
    assert.ok(data.content.startsWith("TY  - JOUR\r\nTI  - Example work 1\r\nAU  - Example1, Ada\r\n"));
    assert.ok(data.content.endsWith("ER  - \r\n"));
    assert.equal(calls.find(c => /^doi:/.test(c.url.searchParams.get("filter") ?? ""))?.url.searchParams.get("filter"), "doi:10.1234/example.1|10.9999/missing");
    assert.match(textOf(result), /```\nTY  - JOUR/, "a small file is also given as text");
  });
});

test("keyword_search runs each count once, and traces a missed seed to the part it fails", async () => {
  const count = (n: number, oql = "") => ({ meta: { count: n, x_query: { oql } }, results: [] });
  const routes: Route[] = [
    { name: "keyword ids", match: get("/keywords", { filter: "id:snowballing" }), reply: list([{ id: "https://openalex.org/keywords/snowballing", display_name: "snowballing" }]) },
    { name: "seed records", match: get("/works", { filter: "openalex_id:W1|W2" }), reply: list([work(1, { keywords: [{ id: "https://openalex.org/keywords/open-access", display_name: "open access" }] }), work(2)]) },
    // The whole search retrieves seed W2 only
    { name: "combined, seeds", match: post("/", oql => /"systematic review"/.test(oql) && /snowballing/.test(oql) && /openalex id is \(W1 or W2\)/.test(oql)), reply: { results: [{ id: "https://openalex.org/W2" }] } },
    // The missed seed W1 matches the "setting" part but not "method"
    { name: "setting part, missed seed", match: post("/", oql => /"systematic review"/.test(oql) && /openalex id is \(W1\)/.test(oql)), reply: { results: [{ id: "https://openalex.org/W1" }] } },
    { name: "method part, missed seed", match: post("/", oql => /snowballing/.test(oql) && /openalex id is \(W1\)/.test(oql)), reply: { results: [] } },
    { name: "counts", match: post("/", (oql, body) => body.per_page === 1), reply: (call: { body?: Record<string, unknown> }) => count(/"systematic review"/.test(String(call.body?.oql)) && /snowballing/.test(String(call.body?.oql)) ? 40 : 500, "get works where ...") },
  ];
  await withServer(routes, async ({ client, calls }) => {
    const result = await client.callTool({
      name: "openalex_keyword_search",
      arguments: {
        parts: [
          { label: "method", text: "\"citation chaining\"", keyword_ids: ["keywords/snowballing"] },
          { label: "setting", text: "\"systematic review\"" },
        ],
        sample_size: 0,
        seeds: ["W1", "W2"],
      },
    });
    assert.ok(!result.isError, textOf(result));
    const data = result.structuredContent as {
      total: number; text_only: number | null;
      parts: { label: string; keywords: { id: string; name: string }[] }[];
      seeds: { total: number; found: number; results: { id: string; found: boolean; missing_parts: string[]; keywords: { id: string }[] }[] };
    };
    assert.equal(data.total, 40);
    assert.deepEqual(data.parts[0].keywords, [{ id: "snowballing", name: "snowballing" }]);
    assert.equal(data.seeds.found, 1);
    const missed = data.seeds.results.find(r => !r.found)!;
    assert.equal(missed.id, "W1");
    assert.deepEqual(missed.missing_parts, ["method"]);
    assert.deepEqual(missed.keywords.map(k => k.id), ["open-access"]);
    assert.match(textOf(result), /Seed check: 1 of 2 known papers retrieved/);

    const countQueries = calls.filter(c => c.method === "POST" && c.body?.per_page === 1).map(c => String(c.body?.oql));
    assert.equal(new Set(countQueries).size, countQueries.length, "no count query is sent twice");
  });
});

test("a view resource is served with the clipboard permission its copy buttons need", async () => {
  await withServer([], async ({ client }) => {
    // The view files are build output; skip quietly when the views have not been built
    const read = await client.readResource({ uri: "ui://openalex/search-works.html" }).catch(() => null);
    if (!read) return;
    const item = read.contents[0] as { text?: string; _meta?: { ui?: { permissions?: Record<string, unknown> } } };
    assert.ok((item.text ?? "").includes("<div id=\"app\">"));
    assert.deepEqual(item._meta?.ui?.permissions, { clipboardWrite: {} });
  });
});

test("read_docs fetches a page from the help site once, returns a section, and lists headings when none matches", async () => {
  clearDocsCache();
  const page = "<!-- editors\' note -->\n# Search\n\nIntro.\n\n## Wildcards\n\nA star.\n\n```\n# a comment\n```\n\n## Proximity\n\nNear.\n";
  const routes: Route[] = [{
    name: "help page",
    match: call => call.url.hostname === "help.openalex.org" && call.url.pathname === "/api/searching.md",
    reply: page,
  }];
  await withServer(routes, async ({ client, calls }) => {
    const whole = await client.callTool({ name: "openalex_read_docs", arguments: { topic: "searching" } });
    const text = textOf(whole);
    assert.match(text, /Source: https:\/\/help\.openalex\.org\/api\/searching\//);
    assert.match(text, /## Wildcards/);
    assert.doesNotMatch(text, /editors/);
    const data = whole.structuredContent as { mode: string; headings: { text: string }[] };
    assert.equal(data.mode, "page");
    assert.deepEqual(data.headings.map(h => h.text), ["Search", "Wildcards", "Proximity"]);

    const part = await client.callTool({ name: "openalex_read_docs", arguments: { topic: "searching", section: "wildcard" } });
    assert.match(textOf(part), /## Wildcards\n\nA star\./);
    assert.doesNotMatch(textOf(part), /Proximity/);

    const none = await client.callTool({ name: "openalex_read_docs", arguments: { topic: "searching", section: "zebra" } });
    assert.equal(none.isError, true);
    assert.match(textOf(none), /No heading on this page contains "zebra"[\s\S]*- Wildcards/);

    assert.equal(calls.length, 1, "the page is fetched once and then served from memory");
    assert.equal(calls[0].url.search, "", "no key or other parameter is sent to the documentation site");
  });
});
