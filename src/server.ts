/**
 * Evolved — MCP server assembly.
 *
 * 27 tools across five domains: quoting intelligence, money (receipts,
 * invoicing, P&L), pipeline (leads, jobs, dispatch), safety (FLHA), and the
 * autonomous ops layer (digest, ball-drop catcher, weather gating).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerQuotingTools } from "./tools/quoting.js";
import { registerMoneyTools } from "./tools/money.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerSafetyTools } from "./tools/safety.js";
import { registerOpsTools } from "./tools/ops.js";

export const SERVER_INFO = {
  name: "evolved",
  version: "1.0.0",
  title: "Evolved — business management in a box",
};

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: [
      "Evolved is the operations brain of a real industrial-services company,",
      "packaged as an agentic service. It runs the full loop: capture a lead,",
      "price the work with a learning rate engine, issue a branded quote, book",
      "the job (weather-gated), open and sign off the day's FLHA, ingest",
      "receipts through tiered OCR into live books, invoice, and report P&L.",
      "Start with business_snapshot or morning_digest to orient. The demo",
      "dataset is fully synthetic; demo_reset restores it.",
    ].join(" "),
  });

  registerQuotingTools(server);
  registerMoneyTools(server);
  registerPipelineTools(server);
  registerSafetyTools(server);
  registerOpsTools(server);

  return server;
}
