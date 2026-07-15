/**
 * Evolved — MCP server assembly.
 *
 * 83 tools across sixteen domains: quoting intelligence, money, pipeline,
 * safety, autonomous ops, inventory, contacts/CRM, the ops-sheet engine,
 * accounting depth, on-chain payments (X Layer testnet), the autonomous
 * lifecycle, the frontier set (photo-to-quote, voice, CFO, franchise),
 * the workbook spine (Google Sheets / CSV), field operations (photos,
 * notes, time clock, on-site JHA), and growth (reviews, reputation,
 * Job P&L scorecard, dispatch board, branding).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadDb } from "./store.js";
import { HAZARD_LIBRARY, STANDARD_PPE } from "./engine/safety.js";
import { TRADE_PACKS } from "./trades.js";
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
import { registerWorkbookTools } from "./tools/workbook.js";
import { registerFieldTools } from "./tools/field.js";
import { registerGrowthTools } from "./tools/growth.js";

export const SERVER_INFO = {
  name: "evolved",
  version: "2.0.0",
  title: "Evolved — business management in a box",
};

/** Kept in lockstep with registrations below; enforced by the test suite. */
export const TOOL_COUNT = 83;

export function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, {
    instructions: [
      "Evolved is a company operating system any service business can spin",
      "up in one call (franchise_spinup + trade packs) — proven on the real",
      "Alberta company it was built from. It runs the full loop: capture a lead",
      "(typed, voice, or photo), price it with a learning rate engine, e-sign",
      "the quote, book weather-gated work, open and sign off the day's FLHA,",
      "burn down inventory, ingest receipts through tiered OCR into live",
      "books, invoice, settle on-chain on OKX X Layer (TESTNET), request the",
      "review, and teach the rate engine. lifecycle_start/lifecycle_advance",
      "run the whole engagement with human gates only at money decisions.",
      "The whole OS lives on a workbook spine: workbook_create builds a real",
      "Google Sheets operations workbook (service account via",
      "EVOLVED_GOOGLE_SA), workbook_export writes the same tabs as CSV with",
      "zero credentials. Field crews log photos, notes, and time against",
      "jobs and author the day's JHA on-site (flha_field_capture).",
      "Start with business_snapshot or morning_digest to orient. All demo",
      "data is synthetic; demo_reset restores it; franchise_spinup re-seeds",
      "the whole OS for a brand-new trade (franchise_preview to window-shop).",
    ].join(" "),
  });

  registerQuotingTools(server); // 9
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
  registerWorkbookTools(server); // 5
  registerFieldTools(server); // 5
  registerGrowthTools(server); // 6

  // ---- MCP resources: the reference data an agent should be able to READ,
  // not just act on. Counted and enforced by the test suite.
  server.registerResource(
    "rate-table",
    "evolved://rate-table",
    { title: "Rate table (base + learned)", description: "Live $/sqft rate card with learning-loop state.", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(loadDb().rateTable, null, 2) }],
    }),
  );
  server.registerResource(
    "hazard-library",
    "evolved://hazard-library",
    { title: "FLHA hazard library", description: "Per-hazard mitigations (built-in plus installed trade pack), and standard PPE.", mimeType: "application/json" },
    async (uri) => ({
      contents: [{
        uri: uri.href, mimeType: "application/json",
        text: JSON.stringify({
          builtIn: HAZARD_LIBRARY.map(({ hazard, risk, mitigations }) => ({ hazard, risk, mitigations })),
          installedTradePack: loadDb().customHazards,
          standardPpe: STANDARD_PPE,
        }, null, 2),
      }],
    }),
  );
  server.registerResource(
    "trade-packs",
    "evolved://trade-packs",
    { title: "Trade packs", description: "Ready-made rate cards and hazard sets for adapting Evolved to other trades via franchise_spinup.", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(TRADE_PACKS, null, 2) }],
    }),
  );

  // ---- MCP prompts: one-line entry points for humans driving MCP clients.
  server.registerPrompt(
    "morning-briefing",
    { title: "Morning briefing", description: "Compile and narrate the owner's morning digest." },
    async () => ({
      messages: [{
        role: "user",
        content: { type: "text", text: "Run the morning_digest tool, then brief me like an operations manager: lead with the one thing not to drop, then money pulse, today's jobs, and anything the action-item scan raised. Keep it under 200 words, no fluff." },
      }],
    }),
  );
  server.registerPrompt(
    "quote-a-job",
    {
      title: "Quote a job",
      description: "Price a described job and draft the quote with a margin verdict.",
      argsSchema: { jobDescription: z.string().describe("e.g. '600 sqft exposed-aggregate driveway in Sherwood Park, tight side access'") },
    },
    async ({ jobDescription }) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: "Quote this job: " + jobDescription + ". Use quote_price first, tell me the margin verdict plainly, and if it is healthy create the quote with quote_create and render the branded document. If anything is below break-even, flag it and stop." },
      }],
    }),
  );
  server.registerPrompt(
    "run-the-lifecycle",
    {
      title: "Run the autonomous lifecycle",
      description: "Drive a full engagement from lead to on-chain payment, pausing at the human money gates.",
      argsSchema: { customer: z.string().describe("Customer name and what they want") },
    },
    async ({ customer }) => ({
      messages: [{
        role: "user",
        content: { type: "text", text: "Start an autonomous lifecycle for: " + customer + ". Use lifecycle_start, show me the quote and the profitability verdict, and STOP at the approve-quote gate for my decision. After I approve, advance through e-sign, booking, FLHA, completion, and invoicing, then stop again at the payment gate and show me the on-chain payment request." },
      }],
    }),
  );

  return server;
}
