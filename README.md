# OpenAlex MCP App

An MCP server for [OpenAlex](https://openalex.org), the open catalog of scholarly works, authors, institutions, journals, publishers and funders, with interactive views for hosts that support [MCP Apps](https://modelcontextprotocol.io).

Ask your assistant to search the literature, look up a paper, follow its citations, find related work, profile an author, institution, journal, publisher, funder or subject, count works by year, author, publisher, open access status and more, get a one-call overview of a set of works, check a reference list for works that don't exist or have been retracted, read a paper's open peer reviews, export results to Zotero or a screening tool, build a thorough search from words and OpenAlex keywords, or run a query written in OpenAlex's own query language. In hosts that render MCP Apps, such as Claude Desktop and claude.ai, each answer also appears as a view with result cards, charts and paging. In hosts that don't, such as Claude Code, the same tools work as ordinary text tools.

> OpenAlex also publishes its own official connector for Claude (`https://mcp.openalex.org/mcp`, listed as **OpenAlex** in Claude's connector directory). Each person signs in to it with their own OpenAlex account and budget, and it can correct your own author profile, which this project cannot. This project's difference is the visual views and that you host it yourself.

## Tools

| Tool | What it does |
|---|---|
| `openalex_search_works` | Search works by keyword or by meaning (`mode: "semantic"`), with OpenAlex filters and sorting |
| `openalex_get_work` | One work by OpenAlex ID, DOI, PMID or PMCID: authors with affiliations, full abstract, topics |
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
| `openalex_resolve_references` | Check up to 25 references (DOIs, PMIDs, PMCIDs or citations in any style) against OpenAlex and flag retracted ones |
| `openalex_get_reviews` | Open peer reviews linked to a work, with their text where the publisher serves it (eLife, Review Commons) |
| `openalex_query` | Run a query written in OQL, OpenAlex's query language: several numbers at once, two-way breakdowns, thresholds, and lists of authors, institutions, publishers or funders |
| `openalex_find_keywords` | Find the OpenAlex keywords that fit a topic, from key phrases or a description, with each keyword's most cited works |
| `openalex_keyword_search` | Thorough search in parts: each part matches on its words or on chosen keywords. Reports what each piece contributes, returns a random sample, and can test the search against papers you already know are relevant |
| `openalex_export_works` | Export works as RIS, BibTeX or CSV, from a list of IDs or a search, with duplicates removed |
| `openalex_read_docs` | Read a page of OpenAlex's documentation (the query language, filtering, searching, grouping), whole or one section, so the model can look up syntax |

All tools are read-only.

List tools return 10 results by default (up to 100 with `limit`). Use `page` for the first 10,000 results, or `cursor` to go further on the tools that list works. Semantic search returns at most 50 results and accepts only some filters; the tool description lists them.

Tools that list works take `detail: "brief"`, which leaves out abstracts and topics and returns about half the text. Use it when titles, authors, dates and IDs are enough.

`openalex_search_works` can re-rank its results: with `rerank: true`, OpenAlex reorders the best 100 keyword matches by how well each answers the query. It is off by default because it doubles the cost of a search ($0.002 instead of $0.001).

Tools that search or count works end with the query written in OQL, OpenAlex's query language. Paste it into the OQL tab at openalex.org to rerun the search or export the full results.

`openalex_group_works` takes short names for what to count by, such as `year`, `author`, `publisher`, `keyword` or `top_10_percent`, as well as raw OpenAlex field names; the tool description lists them.

## Requirements

- Node.js 22
- An OpenAlex API key. It is free: create one at <https://openalex.org/settings/api>.

The server runs without a key, but OpenAlex then gives it a small daily budget shared with everyone on the same IP address. On a shared host that budget is usually already spent. With a key you get your own, larger daily budget. Looking up a single record by ID is free; searches and lists are metered. The topic and publisher profiles each add one small metered request (for yearly output and for the list of journals); if it fails, the profile is returned without that part.

Two tools make several requests per call:

- `openalex_analyze_works` makes 14: about $0.0014 with a filter alone, about $0.014 with a keyword query.
- `openalex_resolve_references` is free for references that carry a DOI, PMID, PMCID or OpenAlex ID. A citation without one is matched by its title and costs $0.001 to $0.003.

`openalex_get_reviews` costs $0.0002 to list a work's reviews. Review text from eLife and Review Commons is fetched from those publishers and is free. Setting `paid_text` also downloads the full text OpenAlex stores for reviews from other publishers, at $0.01 each and at most 5 per call. That stored text is unreliable: in testing it was the review itself in one download of four, and otherwise the reviewed article or an empty file. The tool discards text that is not the review, but the charge still applies.

`openalex_keyword_search` takes `seeds`: up to 25 papers already known to be relevant. It reports how many the search retrieves and, for each one it misses, which part of the search the paper fails or whether a filter excluded it, with that paper's OpenAlex keywords as candidates to add. A search that misses known papers is missing unknown ones too. The check adds 2 requests, plus 1 per part when a seed is missed.

`openalex_find_keywords` costs $0.001 per phrase and about $0.0001 per keyword returned; giving it a description adds $0.01. `openalex_keyword_search` makes up to 3 requests per part plus 3, around 1 cent for a two-part search.

`openalex_export_works` costs about $0.0001 per 100 records, or $0.001 per 100 with a keyword query.

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

## Links, full text and copying

- **Links open through the host.** Views run in a sandboxed frame, so a click on any link is handed to the host application to open. If the host refuses, the view shows the address with a copy button.
- **Full text.** Each work with a DOI has a "Full text" link to [LibKey](https://libkey.io), which sends the reader to a copy through their own library, or to an open access copy. It is a plain link: nothing is loaded or sent until someone clicks it, and no library is named in it.
- **Copy buttons** on queries, DOIs and IDs. The server declares the `clipboardWrite` permission the sandbox requires; where a host withholds it, the button reports that the copy failed.

## Exporting

`openalex_export_works` writes a file of up to 500 works as RIS (Zotero, EndNote, Mendeley, Covidence, Rayyan), BibTeX or CSV. Choose the works by a list of OpenAlex IDs, DOIs, PMIDs or PMCIDs, or by a search. A filter can name a set by its relation to a work, such as `cited_by:W2741809807` for a paper's reference list or `cites:W2741809807` for the works citing it.

- The view offers the file for download through the host, and a button to copy its text. A file under 20,000 characters is also returned as text, for clients without views.
- Repeats are removed by DOI, then OpenAlex ID, and listed. A preprint and its published version are separate OpenAlex records with different DOIs, so both are kept.
- Author names arrive from OpenAlex as one string and are turned into "Surname, Given" by rule (the last word, plus lower-case particles such as "van der"). That is wrong for some names, for example those written family name first.
- OpenAlex's machine-assigned keywords are not exported as keywords, so they are not mistaken for the authors' own.
- The counts cover identification only. Screening and inclusion numbers for a PRISMA diagram come from the screening tool.

### Choosing works in a view

Every view that lists works (search results, citing works, references, related works, an author's or institution's works, and query results) has a checkbox on each card and a bar above the list:

- Tick the works you want. Ticks are kept while you page, so works can be collected from several pages, up to 500.
- `Select page` ticks everything on the page; `Clear` unticks everything.
- `RIS`, `BibTeX` and `CSV` export the ticked works and ask the host to save the file. If the host cannot save it, the view offers the file's text to copy.
- `Copy IDs` copies the ticked works' OpenAlex IDs, one per line.

The buttons call `openalex_export_works` with the ticked IDs, so the file is the same as one asked for in conversation. In a host that does not let views call tools, the export buttons are not shown and `Copy IDs` remains.

## Other services contacted

Besides OpenAlex (`api.openalex.org`, and `content.openalex.org` for stored text), the server contacts four hosts.

`openalex_read_docs` fetches documentation pages from `help.openalex.org`. It sends no key and no parameters, keeps each page in memory for a day, and stores no copy in this repository.

The other three are contacted only from `openalex_get_reviews` with `include_text`, and are sent nothing but a review's DOI:

- `prod--epp.elifesciences.org`, for the text of eLife reviews
- `doi.org` and `eeb.embo.org`, for the text of Review Commons reviews

## Visual style

The views share a house style with [ReviewSeed](https://reviewseed.library.northwestern.edu), so that they are recognisable as part of the same family of tools.

- **The family style** is ReviewSeed's own design: warm off-white paper with white cards, near-black ink, Fraunces for titles, Inter for text, JetBrains Mono for small labels and code, nearly square corners, no shadows, small upper-case section labels, and a near-black box for queries. A dark variant follows the host.
- **One accent colour per app.** `--app-accent` and `--app-accent-soft` at the top of `ui/shared/styles/base.css` are the only values an app sets, in light and dark. This app uses ReviewSeed's blue. Buttons, links, the header marker and the main charts follow it; authors, sources, institutions, topics and funders each keep one of the family's other muted hues.
- **Accessibility.** Every text colour meets WCAG AA contrast (4.5:1) on the background it is used on, in both themes, and `test/contrast.test.ts` reads the stylesheet and fails if a pairing drops below that. No text is smaller than 11px except the 10px marker in the header. Screen readers and keyboard-only use have not been tested.
- **Fonts:** Fraunces, Inter and JetBrains Mono, each under the SIL Open Font License. Subsets are bundled into every view, because views run in a sandboxed frame that cannot load fonts from the network. The licences are in `ui/shared/fonts/`.
- **No logos:** the views carry neither OpenAlex's nor ReviewSeed's mark. Each opens with a marker naming the kind of record shown and the words "Unofficial app · data from OpenAlex". This project is not affiliated with or endorsed by OpenAlex (OurResearch).

## How results are returned

Each tool result has two parts:

- **Text** for the model: concise markdown, capped at 50,000 characters. Result lists carry a shortened abstract and the first few authors; `openalex_get_work` returns the full record.
- **Structured data** for the view: the same results as JSON, in `structuredContent`.

When the daily budget is nearly used up, the text ends with a note saying how much is left and when it resets. Errors say whether the budget is spent, the request was rate-limited, the key was rejected, or the ID was not found.

## Development

```bash
npm run dev          # rebuild server and views on change
npm run build        # type-check the views, then build server and views
npm test             # unit tests and end-to-end tests; offline, a few seconds
npm run test:live    # six tests against the real OpenAlex API; needs OPENALEX_API_KEY, costs about two cents
```

`npm test` and `npm run build` also run on GitHub for every pull request and every push to `main`, on Node 22 and 24. Dependabot proposes dependency updates weekly; a major update of the MCP SDK or ext-apps needs a check in Claude Desktop before merging, because nothing automated exercises the sandboxed frame the views run in.

Layout:

- `server/` — the MCP server. `tools/` registers the tools, `services/openalex-client.ts` talks to the API, `services/format-utils.ts`, `services/format-entities.ts`, `services/format-analysis.ts` and `services/format-query.ts` shape results, `services/references.ts` matches citations to works, `services/export.ts` writes RIS, BibTeX and CSV, `services/keywords.ts` builds keyword searches, `services/docs.ts` fetches and splits documentation pages, and `services/review-text.ts` fetches review text.
- `server/output-types.ts` — the shape of each tool's structured data. The server and the views both import it, so a renamed field fails the build.
- `ui/` — one Preact view per tool, each built into a single HTML file under `dist/ui/`. `ui/shared/styles/base.css` holds the design tokens and the app's accent colour.
- `test/` — unit tests for the pure logic (`test/*.test.ts`); end-to-end tests in `test/integration/`, where a real MCP client calls the real server and OpenAlex is replaced by canned replies; and `test/live/`, run by hand against the real API. There are no tests of the views themselves.

## License

MIT
