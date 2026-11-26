# OpenAlex MCP App

An MCP server for [OpenAlex](https://openalex.org), the open catalog of scholarly works, authors and institutions, with interactive views for hosts that support [MCP Apps](https://modelcontextprotocol.io).

Ask your assistant to search the literature, look up a paper, follow its citations, or profile an author or institution. In hosts that render MCP Apps, such as Claude Desktop and claude.ai, each answer also appears as a view with result cards, charts and paging. In hosts that don't, such as Claude Code, the same tools work as ordinary text tools.

> OpenAlex also publishes its own official connector for Claude (`https://mcp.openalex.org/mcp`, listed as **OpenAlex** in Claude's connector directory). It covers more of the API than this project. This project's difference is the visual views and that you host it yourself.

## Tools

| Tool | What it does |
|---|---|
| `openalex_search_works` | Search works by keyword or by meaning (`mode: "semantic"`), with OpenAlex filters and sorting |
| `openalex_get_work` | One work by OpenAlex ID, DOI or PMID: authors with affiliations, full abstract, topics |
| `openalex_get_citations` | Works that cite a given work, with citations per year |
| `openalex_get_references` | Works a given work cites, in the order of its reference list |
| `openalex_search_authors` | Search author profiles |
| `openalex_get_author` | One author by OpenAlex ID or ORCID: metrics, affiliation history, topics |
| `openalex_get_author_works` | An author's works, with filters and sorting |
| `openalex_search_institutions` | Search institutions |
| `openalex_get_institution` | One institution by OpenAlex ID or ROR: metrics, topics, related institutions |
| `openalex_get_institution_works` | An institution's works, with filters and sorting |

All tools are read-only.

List tools return 10 results by default (up to 100 with `limit`). Use `page` for the first 10,000 results, or `cursor` to go further on the tools that list works. Semantic search returns at most 50 results and accepts only some filters; the tool description lists them.

## Requirements

- Node.js 22
- An OpenAlex API key. It is free: create one at <https://openalex.org/settings/api>.

The server runs without a key, but OpenAlex then gives it a small daily budget shared with everyone on the same IP address. On a shared host that budget is usually already spent. With a key you get your own, larger daily budget. Looking up a single record by ID is free; searches and lists are metered.

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

The HTTP endpoint has no authentication. Anyone who knows the URL can run searches against your OpenAlex budget, so keep the URL private or put the service behind your own access control.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `OPENALEX_API_KEY` | Your OpenAlex API key | none (shared budget) |
| `TRANSPORT` | `stdio` or `http` | `stdio` |
| `PORT` | Port for the HTTP transport | `3000` |

## How results are returned

Each tool result has two parts:

- **Text** for the model: concise markdown, capped at 50,000 characters. Result lists carry a shortened abstract and the first few authors; `openalex_get_work` returns the full record.
- **Structured data** for the view: the same results as JSON, in `structuredContent`.

When the daily budget is nearly used up, the text ends with a note saying how much is left and when it resets. Errors say whether the budget is spent, the request was rate-limited, the key was rejected, or the ID was not found.

## Development

```bash
npm run dev          # rebuild server and views on change
npm run build        # type-check the views, then build server and views
npm test             # run the formatter tests
```

Layout:

- `server/` — the MCP server. `tools/` registers the tools, `services/openalex-client.ts` talks to the API, `services/format-utils.ts` shapes results.
- `server/output-types.ts` — the shape of each tool's structured data. The server and the views both import it, so a renamed field fails the build.
- `ui/` — one Preact view per tool, each built into a single HTML file under `dist/ui/`.
- `test/` — tests for ID handling, pagination and formatting. They do not call the API.

## License

MIT
