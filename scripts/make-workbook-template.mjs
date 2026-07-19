#!/usr/bin/env node
/**
 * make-workbook-template.mjs — generate a starter operations workbook for YOUR
 * business. This is the deployable "backend framework" as a template: the same
 * 20-tab spine the MCP reads and writes, seeded for the trade you pick, exported
 * as a CSV bundle you can import straight into Google Sheets (or hand to
 * workbook_create for a live, MCP-synced Google Sheet).
 *
 *   npm run build
 *   node scripts/make-workbook-template.mjs <blank|blasting|pressure-washing|line-painting|mobile-detailing> ["Your Company"]
 *
 * Output: .data/workbook/*.csv  (20 tabs + INDEX.md)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";

const trade = (process.argv[2] ?? "blank").toLowerCase();
const company = process.argv[3] ?? "My Company";

const server = createServer();
const client = new Client({ name: "workbook-template", version: "1" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await server.connect(st);
await client.connect(ct);
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content?.find((c) => c.type === "text")?.text ?? "{}";
  try { return JSON.parse(t); } catch { return t; }
};

if (trade !== "blank" && trade !== "blasting") {
  const res = await call("franchise_spinup", { companyName: company, tradePack: trade, confirm: true });
  if (!res.spunUp) { console.error("Could not spin up trade:", JSON.stringify(res, null, 2)); process.exit(1); }
  console.log(`Spun up "${company}" as ${res.trade} (priced per ${res.rateCard?.[0]?.depth ? (await call("franchise_preview", { tradePack: trade })).pack?.pricedPer ?? "unit" : "unit"}).`);
} else if (trade === "blank") {
  await call("franchise_spinup", { companyName: company, trade: "general services", confirm: true });
  console.log(`Spun up a blank "${company}" workbook (add your own rate card + hazards).`);
} else {
  console.log(`Using the built-in blasting demo dataset for "${company}".`);
}

const out = await call("workbook_export");
console.log(`\nStarter workbook written: ${out.dir}`);
console.log(`Tabs (${out.files?.length}): ${(out.files ?? []).join(", ")}`);
console.log(`\nNext:`);
console.log(`  • Import the CSVs into a Google Sheet (File > Import), OR`);
console.log(`  • set EVOLVED_GOOGLE_SA and run workbook_create for a live, MCP-synced sheet.`);
console.log(`  • Point your MCP client at the server (see docs/CONNECT.md) and you're running.`);
process.exit(0);
