// Live tests: the real server against the real OpenAlex API.
//
// The offline suite proves the server handles the replies it expects. Only
// these can show that OpenAlex still sends those replies: a renamed field, a
// changed query-language rule or a moved endpoint passes every offline test.
//
// Run with `npm run test:live` before a release. They need OPENALEX_API_KEY
// and spend about two cents of its daily budget, so they are not part of
// `npm test` or the automated checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../server/create-server.js";
import { textOf } from "../helpers/harness.js";

const HAS_KEY = Boolean(process.env.OPENALEX_API_KEY?.trim());
const skip = HAS_KEY ? false : "OPENALEX_API_KEY is not set";

// A well-known paper with stable identifiers: Piwowar et al., "The state of OA" (PeerJ, 2018)
const WORK = { id: "W2741809807", doi: "10.7717/peerj.4375", pmcid: "PMC5815332", title: /^The state of OA/ };

async function call(name: string, args: Record<string, unknown>) {
  const server = createServer();
  const client = new Client({ name: "live-test", version: "1.0.0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  try {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, `${name} failed: ${textOf(result)}`);
    return result.structuredContent as Record<string, any>;
  } finally {
    await client.close();
    await server.close();
  }
}

test("a work is found by OpenAlex ID, DOI and PMCID", { skip }, async () => {
  for (const id of [WORK.id, WORK.doi, WORK.pmcid]) {
    const work = await call("openalex_get_work", { id });
    assert.match(work.title, WORK.title, `looked up by ${id}`);
    assert.ok(work.authors.length > 0 && work.abstract, "authors and abstract are present");
  }
});

test("a keyword search returns works, a total and its query in OQL", { skip }, async () => {
  const data = await call("openalex_search_works", { query: "open access citation advantage", limit: 3 });
  assert.equal(data.works.length, 3);
  assert.ok(data.pagination.total > 100);
  assert.match(data.oql, /^get works/);
  assert.ok(data.works[0].title && data.works[0].id.startsWith("https://openalex.org/W"));
});

test("counting by a short name returns named groups whose shares are sensible", { skip }, async () => {
  const data = await call("openalex_group_works", { group_by: "oa_status", filter: `cites:${WORK.id}` });
  assert.ok(data.total_works > 100);
  assert.ok(data.groups.some((g: { key: string }) => g.key === "closed" || g.key === "gold"));
  const sum = data.groups.reduce((n: number, g: { share: number }) => n + g.share, 0);
  assert.ok(sum > 0.99 && sum < 1.01, `open access shares add up to 1 (got ${sum})`);
});

test("the query language runs a table and is refused with a hint when malformed", { skip }, async () => {
  const table = await call("openalex_query", { oql: `get the count and mean citations of works citing (${WORK.id}) by year`, limit: 5 });
  assert.equal(table.kind, "table");
  assert.ok(table.table.rows.length > 0 && table.table.measures.length === 2);
  assert.ok(typeof table.table.summary.count === "number");

  const server = createServer();
  const client = new Client({ name: "live-test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(b), client.connect(a)]);
  const refused = await client.callTool({ name: "openalex_query", arguments: { oql: "get nonsense blah" } });
  await client.close();
  await server.close();
  assert.equal(refused.isError, true);
  assert.match(textOf(refused), /could not read this OQL/);
});

test("the summary of a set includes citation totals and reports nothing missing", { skip }, async () => {
  const data = await call("openalex_analyze_works", { filter: `cites:${WORK.id},publication_year:2022`, top: 3 });
  assert.ok(data.total_works > 10);
  assert.deepEqual(data.unavailable, []);
  assert.ok(data.citations && data.citations.total > 0);
  assert.ok(data.open_access_share > 0 && data.open_access_share <= 1);
});

test("a keyword search with a seed retrieves it, and an export of it is well formed", { skip }, async () => {
  const search = await call("openalex_keyword_search", {
    parts: [{ label: "topic", text: "\"open access\"", keyword_ids: ["open-access"] }],
    sample_size: 0,
    seeds: [WORK.doi],
  });
  assert.equal(search.seeds.found, 1, "the seed paper is retrieved");
  assert.ok(search.total > 1000);

  const file = await call("openalex_export_works", { ids: [WORK.id], format: "ris" });
  assert.equal(file.records, 1);
  assert.ok(file.content.startsWith("TY  - JOUR\r\n"));
  assert.match(file.content, /\r\nAU  - Piwowar, Heather\r\n/);
  assert.match(file.content, /\r\nDO  - 10\.7717\/peerj\.4375\r\n/);
});
