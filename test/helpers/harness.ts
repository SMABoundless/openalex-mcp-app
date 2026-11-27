// A real MCP client connected to the real server in memory, with the network replaced.
//
// Every request the server makes goes through `globalThis.fetch`, so swapping
// that for a table of canned replies exercises the whole path a host uses:
// tool lookup, input validation, the handler, formatting and the result shape.
// Nothing here touches the network.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../server/create-server.js";

export interface Call {
  method: string;
  url: URL;
  /** Parsed JSON body of a POST; undefined otherwise */
  body?: Record<string, unknown>;
}

export interface Route {
  /** Describes the route in failure messages */
  name: string;
  match: (call: Call) => boolean;
  /** The JSON to reply with, or a function of the request */
  reply: unknown | ((call: Call) => unknown);
  status?: number;
  headers?: Record<string, string>;
}

export interface Harness {
  client: Client;
  /** Every request the server made, in order */
  calls: Call[];
  /** Requests no route matched. A test should end with none. */
  unmatched: Call[];
  close: () => Promise<void>;
}

/** Starts a server and client, with `fetch` answering from `routes` (first match wins). */
export async function startHarness(routes: Route[]): Promise<Harness> {
  const calls: Call[] = [];
  const unmatched: Call[] = [];
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : input.url);
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    const call: Call = { method: init?.method ?? "GET", url, body };
    calls.push(call);
    const route = routes.find(r => r.match(call));
    if (!route) {
      unmatched.push(call);
      return new Response(JSON.stringify({ error: "no canned reply for this request" }), { status: 599 });
    }
    const payload = typeof route.reply === "function" ? (route.reply as (c: Call) => unknown)(call) : route.reply;
    return new Response(typeof payload === "string" ? payload : JSON.stringify(payload), {
      status: route.status ?? 200,
      headers: { "content-type": "application/json", ...route.headers },
    });
  }) as typeof fetch;

  const server = createServer();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  return {
    client,
    calls,
    unmatched,
    close: async () => {
      await client.close();
      await server.close();
      globalThis.fetch = realFetch;
    },
  };
}

/** The text of a tool result. */
export function textOf(result: { content?: unknown }): string {
  const content = (result.content ?? []) as { type: string; text?: string }[];
  return content.filter(c => c.type === "text").map(c => c.text ?? "").join("\n");
}

/** Matches a GET to an OpenAlex path, optionally with given query parameters. */
export function get(path: string, params: Record<string, string | RegExp> = {}): Route["match"] {
  return call =>
    call.method === "GET" &&
    call.url.hostname === "api.openalex.org" &&
    call.url.pathname === path &&
    Object.entries(params).every(([key, want]) => {
      const have = call.url.searchParams.get(key);
      return have != null && (typeof want === "string" ? have === want : want.test(have));
    });
}

/** Matches a POST to the OpenAlex root ("/") or "/query" whose `oql` passes `test`. */
export function post(path: "/" | "/query", test: (oql: string, body: Record<string, unknown>) => boolean = () => true): Route["match"] {
  return call =>
    call.method === "POST" &&
    call.url.hostname === "api.openalex.org" &&
    call.url.pathname === path &&
    test(String(call.body?.oql ?? ""), call.body ?? {});
}

/** A minimal OpenAlex work record. */
export function work(n: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `https://openalex.org/W${n}`,
    doi: `https://doi.org/10.1234/example.${n}`,
    display_name: `Example work ${n}`,
    publication_year: 2020 + (n % 5),
    publication_date: `${2020 + (n % 5)}-01-15`,
    type: "article",
    authorships: [{ author_position: "first", author: { id: `https://openalex.org/A${n}`, display_name: `Ada Example${n}` }, institutions: [] }],
    primary_location: { source: { id: "https://openalex.org/S1", display_name: "Journal of Examples", type: "journal", is_oa: false } },
    cited_by_count: n * 10,
    open_access: { is_oa: true, oa_status: "gold", oa_url: `https://example.org/${n}.pdf` },
    abstract_inverted_index: { An: [0], abstract: [1], [`about${n}`]: [2] },
    topics: [{ id: "https://openalex.org/T1", display_name: "Example Studies", score: 0.9 }],
    referenced_works_count: 3,
    ids: { openalex: `https://openalex.org/W${n}`, pmid: `https://pubmed.ncbi.nlm.nih.gov/${1000000 + n}` },
    biblio: { volume: "1", issue: "2", first_page: "10", last_page: "20" },
    ...overrides,
  };
}

/** A list response holding `results`. */
export function list(results: unknown[], meta: Record<string, unknown> = {}): Record<string, unknown> {
  return { meta: { count: results.length, page: 1, per_page: 10, db_response_time_ms: 1, ...meta }, results, group_by: [] };
}
