/**
 * Evolved — MCP server assembly.
 *
 * 65 tools across thirteen domains: quoting intelligence, money, pipeline,
 * safety, autonomous ops, inventory, contacts/CRM, the ops-sheet engine,
 * accounting depth, on-chain payments (X Layer testnet), the autonomous
 * lifecycle, and the frontier set (photo-to-quote, voice, CFO, franchise).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerQuotingTools } from "./tools/quoting.js";
import { registerMoneyTools } from "./tools/money.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerSafetyTools } from "./tools/safety.js";
import { registerOpsTools } from "./tools/ops.js";
import { registerInventoryTools } from "./tools/inventory.js";
import { registerContactsTools } from "./tools/contacts.js";
import { registerSheetTools } from "./tools/sheet.js";
import { registerAccountingTools } from "./tools/accounting.js";
import { registerPaymentTools } from "./tools/payments.js";
import { registerLifecycleTools } from "./tools/lifecycle.js";
import { registerVisionTools } from "./tools/vision.js";
import { registerVoiceTools } from "./tools/voice.js";
import { registerCfoTools } from "./tools/cfo.js";
import { registerOpsPlusTools } from "./tools/opsplus.js";

export const SERVER_INFO = {
  name: "evolved",
  version: "2.0.0",
  title: "Evolved — business management in a box",
};

/** Kept in lockstep with registrations below; enforced by the test suite. */
export const TOOL_COUNT = 65;

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: [
      "Evolved is the operations brain of a real industrial-services company,",
      "packaged as an agentic service. It runs the full loop: capture a lead",
      "(typed, voice, or photo), price it with a learning rate engine, e-sign",
      "the quote, book weather-gated work, open and sign off the day's FLHA,",
      "burn down inventory, ingest receipts through tiered OCR into live",
      "books, invoice, settle on-chain on OKX X Layer (TESTNET), request the",
      "review, and teach the rate engine. lifecycle_start/lifecycle_advance",
      "run the whole engagement with human gates only at money decisions.",
      "Start with business_snapshot or morning_digest to orient. All demo",
      "data is synthetic; demo_reset restores it; franchise_spinup re-seeds",
      "the whole OS for a brand-new trade.",
    ].join(" "),
  });

  registerQuotingTools(server); // 7
  registerMoneyTools(server); // 5
  registerPipelineTools(server); // 6
  registerSafetyTools(server); // 3
  registerOpsTools(server); // 6
  registerInventoryTools(server); // 5
  registerContactsTools(server); // 5
  registerSheetTools(server); // 6
  registerAccountingTools(server); // 3
  registerPaymentTools(server); // 4
  registerLifecycleTools(server); // 5
  registerVisionTools(server); // 1
  registerVoiceTools(server); // 1
  registerCfoTools(server); // 2
  registerOpsPlusTools(server); // 6

  return server;
}
