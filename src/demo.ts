/**
 * Evolved — scripted end-to-end demo.
 *
 * Runs a REAL MCP client against the REAL server over an in-memory transport
 * and walks the full business loop: lead → price → quote → branded document →
 * accept → schedule (weather-gated) → FLHA → receipt OCR → complete → invoice
 * → morning digest. This is the 90-second story.
 *
 *   npm run build && npm run demo
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./server.js";
import { resetDb } from "./store.js";

const LIME = "\x1b[92m";
const DIM = "\x1b[90m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function h(step: string, title: string) {
  console.log(`\n${LIME}${BOLD}◆ ${step}${RESET} ${BOLD}${title}${RESET}`);
}

function show(result: unknown, keys?: string[]) {
  const content = (result as { content: { type: string; text: string }[] }).content;
  const text = content?.find((c) => c.type === "text")?.text ?? "";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    console.log(DIM + text + RESET);
    return;
  }
  if (keys && typeof data === "object" && data !== null) {
    const slim: Record<string, unknown> = {};
    for (const k of keys) slim[k] = (data as Record<string, unknown>)[k];
    data = slim;
  }
  console.log(DIM + JSON.stringify(data, null, 2) + RESET);
}

resetDb();
const server = createServer();
const client = new Client({ name: "evolved-demo", version: "1.0.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
await client.connect(clientTransport);

const call = (name: string, args: Record<string, unknown> = {}) =>
  client.callTool({ name, arguments: args });

console.log(`${BOLD}${LIME}
  ███████╗██╗   ██╗ ██████╗ ██╗    ██╗   ██╗███████╗██████╗
  ██╔════╝██║   ██║██╔═══██╗██║    ██║   ██║██╔════╝██╔══██╗
  █████╗  ██║   ██║██║   ██║██║    ██║   ██║█████╗  ██║  ██║
  ██╔══╝  ╚██╗ ██╔╝██║   ██║██║    ╚██╗ ██╔╝██╔══╝  ██║  ██║
  ███████╗ ╚████╔╝ ╚██████╔╝███████╗╚████╔╝ ███████╗██████╔╝
  ╚══════╝  ╚═══╝   ╚═════╝ ╚══════╝ ╚═══╝  ╚══════╝╚═════╝${RESET}
  ${DIM}business management in a box — full loop, synthetic data${RESET}`);

h("1/10", "A lead comes in — capture it (next action enforced)");
const leadRes = await call("lead_capture", {
  name: "Hawthorne Dental Clinic",
  phone: "780-555-0199",
  address: "9922 82 Ave, Edmonton",
  source: "Website form",
  summary: "Front entrance concrete — gum, grime, and sealer removal, wants it fresh for reopening",
  nextAction: "Site measure",
});
show(leadRes);
const leadData = JSON.parse(
  (leadRes as { content: { type: string; text: string }[] }).content[0].text,
) as { lead: { id: string }; customer: { id: string } };

h("2/10", "Price it — learned rates + profitability check in one shot");
show(await call("quote_price", { sqft: 520, depth: "light", surface: "sidewalk", access: "moderate" }));

h("3/10", "Create the quote — auto-numbered, 30-day validity, margin verdict stored");
const quoteRes = await call("quote_create", {
  customerId: leadData.customer.id,
  leadId: leadData.lead.id,
  siteAddress: "9922 82 Ave, Edmonton",
  lines: [
    {
      description: "Entrance concrete — light blast, substrate profiling",
      sqft: 520,
      depth: "light",
      surface: "sidewalk",
      access: "moderate",
    },
  ],
  notes: "Reopening date is firm — client wants completion this week.",
});
show(quoteRes);
const quote = (
  JSON.parse((quoteRes as { content: { type: string; text: string }[] }).content[0].text) as {
    quote: { id: string };
  }
).quote;

h("4/10", "Render the branded quote document (dark brand, big green total)");
show(await call("quote_render", { quoteId: quote.id }));

h("5/10", "Client says yes — accepting opens a job automatically");
const acceptRes = await call("quote_update_status", { quoteId: quote.id, status: "Accepted" });
show(acceptRes);
const jobId = (
  JSON.parse((acceptRes as { content: { type: string; text: string }[] }).content[0].text) as {
    openedJobId: string;
  }
).openedJobId;

h("6/10", "Schedule it — dispatch board + blast-day weather verdict");
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
show(await call("job_schedule", { jobId, scheduledDate: tomorrow, crew: ["T. Field", "R. Nozzle"], depositPaid: true, status: "Confirmed" }));

h("7/10", "Morning of: open the FLHA — hazards drafted from the scope, real mitigations");
const flhaRes = await call("flha_open", {
  jobId,
  crew: ["T. Field", "R. Nozzle"],
  siteConditions: "Dry, 18°C. Public sidewalk adjacent — pedestrian traffic.",
  extraHazards: ["Pedestrians cutting through work zone"],
  openedBy: "T. Field",
});
show(flhaRes);
const flhaId = (
  JSON.parse((flhaRes as { content: { type: string; text: string }[] }).content[0].text) as {
    flha: { id: string };
  }
).flha.id;

h("8/10", "Fuel receipt from the road — tiered OCR straight into the books (job-matched)");
show(await call("receipt_ingest", {
  jobId,
  text: "PETRO-CANADA\n2026-07-14 08:12\nDIESEL 92.4L\nSUBTOTAL 142.86\nGST 7.14\nTOTAL $150.00\nVISA ************1234",
}));

h("9/10", "Job done — actuals recorded, FLHA signed off, invoice out, engine taught");
show(await call("job_complete", { jobId, hoursWorked: 6, crewSize: 2, materials: 180, fuel: 150, revenue: 2570 }));
show(await call("flha_signoff", { flhaId, signedBy: ["T. Field", "R. Nozzle"], incidentFree: true }));
show(await call("invoice_create", { jobId }));
show(await call("pricing_record_outcome", {
  jobId, surface: "sidewalk", depth: "light", sqft: 520,
  quotedRate: 4.46, actualCostPerSqft: 1.68, won: true,
}));

h("10/10", "Tomorrow, 6:30 AM — the digest catches everything, drops nothing");
show(await call("morning_digest"));

console.log(`\n${LIME}${BOLD}◆ Full loop complete.${RESET} Lead → quote → job → safety → books → digest, one agent, one data spine.\n`);
await client.close();
await server.close();
