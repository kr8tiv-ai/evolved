/**
 * End-to-end tool-surface test: a real MCP client over an in-memory transport
 * drives the full business loop.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, TOOL_COUNT } from "../server.js";
import { resetDb } from "../store.js";

async function connect() {
  const server = createServer();
  const client = new Client({ name: "test", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  return { server, client };
}

function parse(res: unknown): any {
  const content = (res as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content.find((c) => c.type === "text")!.text);
}

test("full loop: lead → quote → accept → schedule → flha → receipt → complete → invoice → digest", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  const tools = await client.listTools();
  assert.equal(tools.tools.length, TOOL_COUNT, `expected ${TOOL_COUNT} tools`);

  const { lead, customer } = await call("lead_capture", {
    name: "Test Client", source: "test", summary: "test job",
    nextAction: "call", phone: "780-555-0000",
  });
  assert.ok(lead.id && customer.id);

  const { quote } = await call("quote_create", {
    customerId: customer.id, leadId: lead.id, siteAddress: "1 Test St",
    lines: [{ description: "Driveway medium blast", sqft: 500, depth: "medium", surface: "driveway" }],
  });
  assert.match(quote.id, /^ECO-Q-\d{6}-\d{2}$/);
  assert.ok(quote.total > quote.subtotal);
  assert.ok(quote.profitability.verdict === "healthy");

  const accept = await call("quote_update_status", { quoteId: quote.id, status: "Accepted" });
  assert.ok(accept.openedJobId, "accepting a quote opens a job");

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const sched = await call("job_schedule", {
    jobId: accept.openedJobId, scheduledDate: tomorrow, crew: ["A"], depositPaid: true,
  });
  assert.match(sched.weatherCheck, /blast day|Marginal|No-go/);

  const { flha } = await call("flha_open", {
    jobId: accept.openedJobId, crew: ["A"], siteConditions: "dry residential driveway", openedBy: "A",
  });
  assert.ok(flha.hazards.length >= 3);

  const rcpt = await call("receipt_ingest", {
    jobId: accept.openedJobId,
    text: "PRAIRIE ABRASIVES\n2026-07-10\nSUBTOTAL 1,190.48\nGST 59.52\nTOTAL $1,250.00",
  });
  assert.equal(rcpt.posted, true);
  assert.equal(rcpt.receipt.total, 1250, "comma bug must stay dead");

  const dupe = await call("receipt_ingest", {
    text: "PRAIRIE ABRASIVES\n2026-07-10\nTOTAL $1,250.00\nGST 59.52",
  });
  assert.equal(dupe.posted, false, "duplicate guard");

  const done = await call("job_complete", {
    jobId: accept.openedJobId, hoursWorked: 8, crewSize: 2, materials: 500, fuel: 150, revenue: quote.subtotal,
  });
  assert.equal(done.job.status, "Complete");

  const { invoice } = await call("invoice_create", { jobId: accept.openedJobId });
  assert.ok(invoice.balanceDue < invoice.total, "deposit applied");

  const digest = await call("morning_digest");
  assert.ok(digest.oneThingNotToDrop.length > 0);
  assert.ok(digest.weather.lines.length === 5);

  await client.close();
  await server.close();
});

test("action items: seed data raises the five ball-drop rules", async () => {
  resetDb();
  const { server, client } = await connect();
  const scan = parse(await client.callTool({ name: "action_items_scan", arguments: {} }));
  const rules = new Set(scan.open.map((a: { rule: string }) => a.rule));
  assert.ok(rules.has("deposit-unscheduled"), "deposit in but unscheduled");
  assert.ok(rules.has("invoice-unpaid-7d"), "invoice unpaid 7+ days");
  assert.ok(rules.has("quote-unanswered-7d"), "quote unanswered 7 days");
  assert.ok(rules.has("done-not-invoiced"), "job complete but not invoiced");
  await client.close();
  await server.close();
});
