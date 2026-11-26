#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { registerWorksTools } from "./tools/works.js";
import { registerAuthorsTools } from "./tools/authors.js";
import { registerInstitutionsTools } from "./tools/institutions.js";
import { registerSourcesTools } from "./tools/sources.js";
import { registerTopicsAndFundersTools } from "./tools/topics-funders.js";
import { registerPublishersTools } from "./tools/publishers.js";
import { registerGroupingTools } from "./tools/grouping.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerReferencesTools } from "./tools/references.js";
import { registerAllUiResources } from "./resources/ui-resources.js";
import { MCP_AUTH_TOKEN, isAuthorized } from "./auth.js";

function createServer(): McpServer {
  const server = new McpServer({ name: "openalex-mcp-app", version: "1.0.0" });
  registerWorksTools(server);
  registerAuthorsTools(server);
  registerInstitutionsTools(server);
  registerSourcesTools(server);
  registerTopicsAndFundersTools(server);
  registerPublishersTools(server);
  registerGroupingTools(server);
  registerAnalysisTools(server);
  registerReferencesTools(server);
  registerAllUiResources(server);
  return server;
}

// ============================================
// Stdio transport (default, for Claude Desktop)
// ============================================

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenAlex MCP App running on stdio");
}

// ============================================
// HTTP transport (for Render / remote deployment)
// ============================================

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "openalex-mcp-app" });
  });

  app.post("/mcp", async (req, res) => {
    if (!isAuthorized(req.headers.authorization, req.query.key)) {
      res.status(401).set("WWW-Authenticate", "Bearer").json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized: this server requires its shared secret." },
        id: null,
      });
      return;
    }
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`OpenAlex MCP App running on http://localhost:${port}/mcp`);
  });
}

// ============================================
// Entry point
// ============================================

const transport = process.env.TRANSPORT || "stdio";

if (!process.env.OPENALEX_API_KEY?.trim()) {
  console.error(
    "Warning: OPENALEX_API_KEY is not set. OpenAlex allows only a small number of " +
    "requests per day without a key. Get a free key at https://openalex.org/settings/api"
  );
}

if (transport === "http" && !MCP_AUTH_TOKEN) {
  console.error(
    "Warning: MCP_AUTH_TOKEN is not set. Anyone who knows this server's URL can use it, " +
    "and with it your OpenAlex budget. Set MCP_AUTH_TOKEN to require a shared secret."
  );
}

if (transport === "http") {
  runHTTP().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
