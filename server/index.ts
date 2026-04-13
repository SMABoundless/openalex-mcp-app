#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { registerWorksTools } from "./tools/works.js";
import { registerAuthorsTools } from "./tools/authors.js";
import { registerInstitutionsTools } from "./tools/institutions.js";
import { registerAllUiResources } from "./resources/ui-resources.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "openalex-mcp-app" });
});

app.post("/mcp", async (req, res) => {
  const server = new McpServer({ name: "openalex-mcp-app", version: "1.0.0" });
  registerWorksTools(server);
  registerAuthorsTools(server);
  registerInstitutionsTools(server);
  registerAllUiResources(server);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || "3000");
app.listen(port, () => {
  console.error(`OpenAlex MCP App running on http://localhost:${port}/mcp`);
});
