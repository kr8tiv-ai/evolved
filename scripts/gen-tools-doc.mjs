import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/server.js";
import { writeFileSync } from "node:fs";

const server = createServer();
const client = new Client({ name: "docgen", version: "0" });
const [ct, st] = InMemoryTransport.createLinkedPair();
await server.connect(st);
await client.connect(ct);
const { tools } = await client.listTools();

const DOMAINS = [
  ["Quoting intelligence", ["quote_price","quote_create","quote_render","quote_update_status","quote_list","pricing_rates","pricing_record_outcome"]],
  ["Money", ["receipt_ingest","expense_report","invoice_create","invoice_render","pnl_report"]],
  ["Pipeline", ["lead_capture","lead_update","pipeline_view","job_schedule","job_complete","customer_list"]],
  ["Safety", ["flha_open","flha_signoff","safety_log"]],
  ["Autonomous ops", ["morning_digest","action_items_scan","action_item_resolve","weather_check","business_snapshot","demo_reset"]],
];

function paramTable(schema) {
  const props = schema?.properties ?? {};
  const req = new Set(schema?.required ?? []);
  const keys = Object.keys(props);
  if (!keys.length) return "_No parameters._\n";
  let md = "| Parameter | Type | Required | Description |\n|---|---|---|---|\n";
  for (const k of keys) {
    const p = props[k];
    let type = p.type ?? (p.enum ? "enum" : p.anyOf ? "union" : "object");
    if (p.enum) type = p.enum.map((e) => `\`${e}\``).join(" · ");
    if (type === "array" && p.items) {
      type = p.items.type === "object" ? "array of objects" : `array of ${p.items.type ?? "items"}`;
    }
    md += `| \`${k}\` | ${type} | ${req.has(k) ? "yes" : "no"} | ${(p.description ?? "").replace(/\|/g, "\\|")} |\n`;
  }
  return md;
}

let out = `# Tool catalog\n\nGenerated from the live server — ${tools.length} tools. Every tool returns JSON.\n`;
for (const [domain, names] of DOMAINS) {
  out += `\n## ${domain}\n`;
  for (const name of names) {
    const t = tools.find((x) => x.name === name);
    if (!t) { console.error("MISSING", name); continue; }
    out += `\n### \`${t.name}\`\n\n${t.description}\n\n${paramTable(t.inputSchema)}`;
  }
}
const covered = DOMAINS.flatMap(([, n]) => n);
for (const t of tools) if (!covered.includes(t.name)) console.error("UNLISTED", t.name);

writeFileSync(new URL("../docs/TOOLS.md", import.meta.url), out, "utf8");
console.log(`Wrote TOOLS.md with ${tools.length} tools.`);
await client.close();
await server.close();
