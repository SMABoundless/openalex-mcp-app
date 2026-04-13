#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { registerWorksTools } from "./tools/works.js";
import { registerAuthorsTools } from "./tools/authors.js";
import { registerInstitutionsTools } from "./tools/institutions.js";
import { registerAllUiResources } from "./resources/ui-resources.js";

function createServer(): McpServer {
  const server = new McpServer({ name: "openalex-mcp-app", version: "1.0.0" });
  registerWorksTools(server);
  registerAuthorsTools(server);
  registerInstitutionsTools(server);
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
