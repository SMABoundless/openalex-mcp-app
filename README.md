# OpenAlex MCP App

An MCP server for [OpenAlex](https://openalex.org), the open catalog of scholarly works, authors, institutions, journals, publishers and funders, with interactive views for hosts that support [MCP Apps](https://modelcontextprotocol.io).

Ask your assistant to search the literature, look up a paper, follow its citations, find related work, profile an author, institution, journal, publisher, funder or subject, count works by year, author, publisher, open access status and more, get a one-call overview of a set of works, check a reference list for works that don't exist or have been retracted, read a paper's open peer reviews, or run a query written in OpenAlex's own query language. In hosts that render MCP Apps, such as Claude Desktop and claude.ai, each answer also appears as a view with result cards, charts and paging. In hosts that don't, such as Claude Code, the same tools work as ordinary text tools.

> OpenAlex also publishes its own official connector for Claude (`https://mcp.openalex.org/mcp`, listed as **OpenAlex** in Claude's connector directory). Each person signs in to it with their own OpenAlex account and budget, and it can correct your own author profile, which this project cannot. This project's difference is the visual views and that you host it yourself.

## Tools

| Tool | What it does |
|---|---|
| `openalex_search_works` | Search works by keyword or by meaning (`mode: "semantic"`), with OpenAlex filters and sorting |
| `openalex_get_work` | One work by OpenAlex ID, DOI or PMID: authors with affiliations, full abstract, topics |
| `openalex_get_citations` | Works that cite a given work, with citations per year |
| `openalex_get_references` | Works a given work cites, in the order of its reference list |
| `openalex_get_related_works` | Works OpenAlex judges to be on a similar subject to a given work |
| `openalex_search_authors` | Search author profiles |
| `openalex_get_author` | One author by OpenAlex ID or ORCID: metrics, affiliation history, topics |
| `openalex_get_author_works` | An author's works, with filters and sorting |
| `openalex_search_institutions` | Search institutions |
| `openalex_get_institution` | One institution by OpenAlex ID or ROR: metrics, topics, related institutions |
| `openalex_get_institution_works` | An institution's works, with filters and sorting |
| `openalex_search_sources` | Search journals, repositories and conferences; compare open access status and article processing charges |
| `openalex_get_source` | One source by OpenAlex ID or ISSN: publisher, access, metrics, topics, yearly output |
| `openalex_search_publishers` | Search publishers, to get an ID for filtering works or journals by publisher |
| `openalex_get_publisher` | One publisher by OpenAlex ID or ROR: parent publisher, metrics, yearly output, largest journals |
| `openalex_search_topics` | Search OpenAlex's subject topics, to get an ID for filtering works by subject |
| `openalex_get_topic` | One topic by OpenAlex ID: place in the subject hierarchy, keywords, yearly output, neighbouring topics |
| `openalex_search_funders` | Search research funders, to get an ID for filtering works by funder |
| `openalex_get_funder` | One funder by OpenAlex ID or ROR: metrics, awards, funded works per year |
| `openalex_group_works` | Count works by year, type, open access status, author, institution, country, journal, publisher, funder, subject, keyword, language and more |
| `openalex_analyze_works` | One-call overview of a set of works: total, mean and median citations, field-weighted impact, output per year, open access share, leading fields, authors, institutions, countries, journals and funders, international co-authorship, most cited works |
| `openalex_resolve_references` | Check up to 25 references (DOIs, PMIDs or citations in any style) against OpenAlex and flag retracted ones |
| `openalex_get_reviews` | Open peer reviews linked to a work, with their text where the publisher serves it (eLife, Review Commons) |
| `openalex_query` | Run a query written in OQL, OpenAlex's query language: several numbers at once, two-way breakdowns, thresholds, and lists of authors, institutions, publishers or funders |

All tools are read-only.

List tools return 10 results by default (up to 100 with `limit`). Use `page` for the first 10,000 results, or `cursor` to go further on the tools that list works. Semantic search returns at most 50 results and accepts only some filters; the tool description lists them.

Tools that search or count works end with the query written in OQL, OpenAlex's query language. Paste it into the OQL tab at openalex.org to rerun the search or export the full results.

`openalex_group_works` takes short names for what to count by, such as `year`, `author`, `publisher`, `keyword` or `top_10_percent`, as well as raw OpenAlex field names; the tool description lists them.

## Requirements

- Node.js 22
- An OpenAlex API key. It is free: create one at <https://openalex.org/settings/api>.

The server runs without a key, but OpenAlex then gives it a small daily budget shared with everyone on the same IP address. On a shared host that budget is usually already spent. With a key you get your own, larger daily budget. Looking up a single record by ID is free; searches and lists are metered. The topic and publisher profiles each add one small metered request (for yearly output and for the list of journals); if it fails, the profile is returned without that part.

Two tools make several requests per call:

- `openalex_analyze_works` makes 14: about $0.0014 with a filter alone, about $0.014 with a keyword query.
- `openalex_resolve_references` is free for references that carry a DOI, PMID or OpenAlex ID. A citation without one is matched by its title and costs $0.001 to $0.003.

`openalex_get_reviews` costs $0.0002 to list a work's reviews. Review text from eLife and Review Commons is fetched from those publishers and is free. Setting `paid_text` also downloads the full text OpenAlex stores for reviews from other publishers, at $0.01 each and at most 5 per call. That stored text is unreliable: in testing it was the review itself in one download of four, and otherwise the reviewed article or an empty file. The tool discards text that is not the review, but the charge still applies.

`openalex_query` costs the same as the equivalent search. A query OpenAlex refuses is free, and the error says how to fix it. OQL is under active development at OpenAlex, so its syntax can change.

## Install

```bash
git clone https://github.com/SMABoundless/openalex-mcp-app.git
cd openalex-mcp-app
npm install
npm run build
```

## Use with Claude Desktop

Add this to `claude_desktop_config.json` (on macOS: `~/Library/Application Support/Claude/`), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "openalex": {
      "command": "node",
      "args": ["/absolute/path/to/openalex-mcp-app/dist/server/index.js"],
      "env": {
        "OPENALEX_API_KEY": "your-key"
      }
    }
  }
}
```

## Use with Claude Code

```bash
claude mcp add openalex --env OPENALEX_API_KEY=your-key -- node /absolute/path/to/openalex-mcp-app/dist/server/index.js
```

## Run as a remote server

```bash
TRANSPORT=http PORT=3000 OPENALEX_API_KEY=your-key npm start
```

The MCP endpoint is `POST /mcp`, and `GET /health` reports status. `render.yaml` and the `Dockerfile` deploy it to [Render](https://render.com); set `OPENALEX_API_KEY` in the service's environment settings, not in `render.yaml`.

### Protecting a remote server

Without a secret, anyone who knows the URL can run searches against your OpenAlex budget. Set `MCP_AUTH_TOKEN` to a long random value to require it on every request to `/mcp`:

```bash
openssl rand -hex 32    # generates a suitable secret
```

Clients then present the secret in one of two ways:

- **Header**, for clients that can send one: `Authorization: Bearer <secret>`. In Claude Code:

  ```bash
  claude mcp add --transport http openalex https://your-server.example/mcp --header "Authorization: Bearer <secret>"
  ```

- **URL**, for clients that only accept an address and cannot send a header: `https://your-server.example/mcp?key=<secret>`. Treat that whole address as the secret: anyone you share it with can use the server.

Requests without the right secret get a 401. `/health` stays open so the host can check the service is up. On Render, set `MCP_AUTH_TOKEN` in the service's environment settings.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `OPENALEX_API_KEY` | Your OpenAlex API key | none (shared budget) |
| `MCP_AUTH_TOKEN` | Shared secret required on `/mcp` when using the HTTP transport | none (open) |
| `TRANSPORT` | `stdio` or `http` | `stdio` |
| `PORT` | Port for the HTTP transport | `3000` |

## Other services contacted

Besides OpenAlex (`api.openalex.org`, and `content.openalex.org` for stored text), the server contacts three hosts, only from `openalex_get_reviews` with `include_text`, and sends them nothing but a review's DOI:

- `prod--epp.elifesciences.org`, for the text of eLife reviews
- `doi.org` and `eeb.embo.org`, for the text of Review Commons reviews

## How results are returned

Each tool result has two parts:

- **Text** for the model: concise markdown, capped at 50,000 characters. Result lists carry a shortened abstract and the first few authors; `openalex_get_work` returns the full record.
- **Structured data** for the view: the same results as JSON, in `structuredContent`.

When the daily budget is nearly used up, the text ends with a note saying how much is left and when it resets. Errors say whether the budget is spent, the request was rate-limited, the key was rejected, or the ID was not found.

## Development

```bash
npm run dev          # rebuild server and views on change
npm run build        # type-check the views, then build server and views
npm test             # run the tests
```

Layout:

- `server/` — the MCP server. `tools/` registers the tools, `services/openalex-client.ts` talks to the API, `services/format-utils.ts`, `services/format-entities.ts`, `services/format-analysis.ts` and `services/format-query.ts` shape results, `services/references.ts` matches citations to works, and `services/review-text.ts` fetches review text.
- `server/output-types.ts` — the shape of each tool's structured data. The server and the views both import it, so a renamed field fails the build.
- `ui/` — one Preact view per tool, each built into a single HTML file under `dist/ui/`.
- `test/` — tests for ID handling, pagination, formatting, the set summary, citation matching, review text and query results. They do not call the API.

## License

MIT
