import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorksTools } from "./tools/works.js";
import { registerAuthorsTools } from "./tools/authors.js";
import { registerInstitutionsTools } from "./tools/institutions.js";
import { registerSourcesTools } from "./tools/sources.js";
import { registerTopicsAndFundersTools } from "./tools/topics-funders.js";
import { registerPublishersTools } from "./tools/publishers.js";
import { registerGroupingTools } from "./tools/grouping.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerReferencesTools } from "./tools/references.js";
import { registerReviewsTools } from "./tools/reviews.js";
import { registerQueryTools } from "./tools/query.js";
import { registerKeywordsTools } from "./tools/keywords.js";
import { registerExportTools } from "./tools/export.js";
import { registerAllUiResources } from "./resources/ui-resources.js";

/** Builds a server with every tool and view registered. Used by both transports and by the tests. */
export function createServer(): McpServer {
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
  registerReviewsTools(server);
  registerQueryTools(server);
  registerKeywordsTools(server);
  registerExportTools(server);
  registerAllUiResources(server);
  return server;
}
