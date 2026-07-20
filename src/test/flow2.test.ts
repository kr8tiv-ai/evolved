/**
 * Expansion end-to-end tests: the full autonomous lifecycle over a real MCP
 * client, every new tool domain, the x402 paid endpoint over real HTTP, and
 * a live (skip-if-offline) X Layer testnet probe.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, TOOL_COUNT } from "../server.js";
import { handleRequest } from "../app.js";
import { chainStatus, XLAYER_TESTNET } from "../engine/payments.js";
import { commitTxHash, loadDb, releaseTxHash, reserveTxHash, resetDb } from "../store.js";

async function connect() {
  const server = createServer();
  const client = new Client({ name: "test2", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  return { server, client };
}

function parse(res: unknown): any {
  const content = (res as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content.find((c) => c.type === "text")!.text);
}

test("autonomous lifecycle: lead → e-sign → weather booking → FLHA → invoice → on-chain settle → review → learning, with human money gates", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  const started = await call("lifecycle_start", {
    customerName: "Aurora Ridge Dental",
    phone: "780-555-0199",
    siteAddress: "12 Aurora Ridge Blvd, Edmonton",
    summary: "Front entrance concrete refresh",
    surface: "sidewalk", sqft: 520, depth: "light", access: "moderate",
  });
  const lcId = started.lifecycle.id;
  assert.equal(started.lifecycle.stage, "quoted");
  assert.equal(started.lifecycle.gates[0].gate, "approve-quote");
  // Depth: the money gate is margin-aware — its reason states the verdict/margin.
  assert.match(started.lifecycle.gates[0].reason, /money gate/i);
  assert.match(started.lifecycle.gates[0].reason, /margin|break-even/i);

  // Advancing WITHOUT approval must hold at the money gate.
  const held = await call("lifecycle_advance", { lifecycleId: lcId });
  assert.equal(held.stage, "quoted");
  assert.equal(held.openGates.length, 1, "money gate must hold");

  // Approve + sign in one advance: should run all the way to awaiting-payment.
  const advanced = await call("lifecycle_advance", {
    lifecycleId: lcId, approveQuote: true, esignSigner: "Dr. A. Ridge",
  });
  assert.equal(advanced.stage, "awaiting-payment");
  assert.ok(advanced.refs.job && advanced.refs.flha && advanced.refs.invoice && advanced.refs.payment);
  const steps = advanced.log.map((l: { step: string }) => l.step);
  for (const expected of ["esign-sent", "esigned", "scheduled", "flha", "complete", "invoiced"]) {
    assert.ok(steps.includes(expected), `missing step ${expected}`);
  }

  // Payment is the second money gate — settle (simulated demo mode).
  const settled = await call("lifecycle_advance", { lifecycleId: lcId, simulatePayment: true });
  assert.equal(settled.stage, "closed");
  assert.ok(settled.log.some((l: { step: string }) => l.step === "paid"));
  assert.ok(settled.log.some((l: { step: string }) => l.step === "learned"));

  // Verify artifacts landed in the books.
  const db = loadDb();
  const payment = db.payments.find((p) => p.id === settled.refs.payment)!;
  assert.equal(payment.status, "paid");
  assert.equal(payment.chainId, 1952);
  const invoice = db.invoices.find((i) => i.id === settled.refs.invoice)!;
  assert.equal(invoice.status, "Paid");
  const flha = db.flhas.find((f) => f.id === settled.refs.flha)!;
  assert.ok(flha.signoff?.incidentFree);
  const review = db.reviews.find((r) => r.id === settled.refs.review)!;
  assert.equal(review.status, "requested");

  // Record the review through the tool.
  const rec = await call("review_record", { reviewId: review.id, rating: 5, comment: "Concrete looks new." });
  assert.equal(rec.review.status, "received");

  await client.close();
  await server.close();
});

test("new domains: inventory, voice, inbox filing, photo quote, sheet, cfo, insights, accounting", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // Inventory: receive, consume, reorder suggestions, price watch.
  const received = await call("inventory_receive", { item: "garnet", qty: 10, unitCost: 38.5, supplier: "Prairie Abrasives Supply" });
  assert.equal(received.item.onHand, 16);
  const consumed = await call("inventory_consume", { item: "garnet", qty: 12, jobId: "JOB-1043" });
  assert.equal(consumed.consumed, true);
  assert.equal(consumed.item.onHand, 4);
  assert.ok(consumed.warnings.length >= 1, "reorder warning expected");
  const overdraw = await call("inventory_consume", { item: "garnet", qty: 999 });
  assert.equal(overdraw.consumed, false);
  const reorder = await call("inventory_reorder_suggestions", {});
  assert.ok(reorder.suggestions.some((s: { item: string }) => /garnet/i.test(s.item)));
  const watch = await call("price_watch", { product: "garnet" });
  assert.ok(watch.watch[0].purchases >= 2);
  assert.ok(watch.watch[0].changePct !== null);

  // Voice: hands-free consume + next stop + unknown → inbox.
  const v1 = await call("voice_command", { utterance: "used two bags of crushed glass on the Jasper Ave job", speaker: "R. Nozzle" });
  assert.equal(v1.intent.intent, "consume-inventory");
  assert.match(v1.reply, /Logged 2/);
  const v2 = await call("voice_command", { utterance: "where's our next stop?" });
  assert.equal(v2.intent.intent, "next-stop");
  const v3 = await call("voice_command", { utterance: "the neighbor's dog kept getting close to the hose line" });
  assert.equal(v3.intent.intent, "quick-capture");

  // Inbox: seed row + voice capture get filed.
  const before = await call("inbox_list", { status: "NEW" });
  assert.ok(before.length >= 2);
  const filed = await call("inbox_file", {});
  assert.equal(filed.remaining, 0);
  assert.ok(filed.processed.some((p: { filedTo?: string }) => p.filedTo?.startsWith("Leads!")), "seed lead capture should file to Leads");

  // Photo-to-quote: offline heuristic with dimensions → draft quote in books.
  const photo = await call("quote_from_photo", {
    surface: "driveway", approxWidthFt: 20, approxLengthFt: 30,
    customerName: "Photo Lead", siteAddress: "99 Test Cres",
  });
  assert.equal(photo.estimate.sqft, 600);
  assert.match(photo.quote.id, /^ECO-Q-/);
  assert.match(photo.quote.notes, /measure(-| )to(-| )confirm/i);
  // Depth: a photo quote is a confidence-banded range with comparables + drivers.
  assert.ok(photo.quoteBand, "photo quote carries a confidence band");
  assert.match(photo.quoteBand.rangeRate, /\$[\d.]+ . \$[\d.]+\/sqft/);
  assert.ok(Array.isArray(photo.quoteBand.priceDrivers) && photo.quoteBand.priceDrivers.length >= 2);
  assert.equal(typeof photo.quoteBand.comparables, "string");
  // Edge: an absurd area is clamped, not passed through.
  const huge = await call("quote_from_photo", { surface: "driveway", approxWidthFt: 900, approxLengthFt: 900 });
  assert.ok(huge.estimate.sqft <= 20000, "absurd area is capped");

  // Sheet engine: tabs + read + append.
  const tabs = await call("sheet_tabs", {});
  assert.ok(tabs.length >= 14);
  const quotesTab = await call("sheet_read", { tab: "Quotes" });
  assert.ok(quotesTab.rows.length >= 5);
  assert.equal(quotesTab.headers[0], "Quote no.");
  await call("sheet_append_todo", { task: "Test task from sheet", priority: "low" });
  const todoTab = await call("sheet_read", { tab: "To-Do" });
  assert.ok(todoTab.rows.some((r: unknown[]) => r[1] === "Test task from sheet"));

  // Accounting: vendor rollup + receipt report + reminders.
  await call("receipt_ingest", { text: "PRAIRIE ABRASIVES SUPPLY\n2026-07-12\nGarnet 80 mesh x4 160.00\nSUBTOTAL 152.38\nGST 7.62\nTOTAL $160.00" });
  const vendors = await call("vendor_rollup", {});
  const prairie = vendors.find((v: { vendor: string }) => /prairie/i.test(v.vendor));
  assert.ok(prairie.receipts >= 2, "receipt should roll into the canonical vendor");
  const report = await call("receipt_report", { days: 30 });
  assert.ok(report.receiptsReviewed >= 5);
  const reminders = await call("invoice_remind", {});
  assert.ok(reminders.reminders.length >= 1);
  assert.ok(["direct", "final-notice"].includes(reminders.reminders[0].tone));

  // CFO.
  const forecast = await call("cfo_forecast", { scenario: "add-truck" });
  assert.equal(forecast.months.length, 12);
  const health = await call("cfo_health", {});
  assert.ok(health.fixFirst.length >= 1);
  assert.ok(health.receivablesAging);

  // Insights + feedback loop.
  const insights = await call("insights_generate", {});
  assert.ok(insights.open.length >= 2);
  const target = insights.open[0];
  const fb = await call("insight_feedback", { insightId: target.id, rating: "Important" });
  assert.ok(fb.categoryWeight > 1);

  // Contacts.
  const search = await call("contact_search", { query: "prairie" });
  assert.ok(search.matches.some((m: { type: string }) => m.type === "supplier"));
  const roster = await call("crew_roster", {});
  assert.equal(roster.length, 2);

  // Activity feed captured the session.
  const feed = await call("activity_feed", { limit: 100 });
  assert.ok(feed.length >= 5);

  await client.close();
  await server.close();
});

test("payments tools: request → check (simulated) marks invoice and job paid; x402_info envelope", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  const req = await call("invoice_payment_request", { invoiceId: "ECO-INV-9002" });
  assert.equal(req.payment.chainId, 1952);
  assert.match(req.payment.uri, /^ethereum:0x[0-9a-fA-F]{40}@1952\?value=\d+$/);
  assert.equal(req.payment.amountCad, 1827);
  assert.equal(req.payment.amountAsset, "18.270000");
  // Depth: deposit already applied → default split is the balance; why-on-chain is trade-specific.
  assert.equal(req.split.kind, "balance");
  assert.ok(req.whyOnChain.reasons.some((r: string) => /chargeback/i.test(r)));
  // Programmable deposit split: exactly 25% of the GST-inclusive total.
  const dep = await call("invoice_payment_request", { invoiceId: "ECO-INV-9002", split: "deposit" });
  assert.equal(dep.split.kind, "deposit");
  assert.equal(dep.payment.amountCad, 609); // 25% of 2436
  assert.match(dep.whyOnChain.headline, /deposit/i);

  const unpaid = await call("invoice_payment_check", { paymentId: req.payment.id });
  assert.equal(unpaid.verified, false);

  const paid = await call("invoice_payment_check", { paymentId: req.payment.id, simulate: true });
  assert.equal(paid.verification.verified, true);
  assert.equal(paid.verification.mode, "simulated");
  assert.equal(paid.payment.status, "paid");
  const db = loadDb();
  assert.equal(db.invoices.find((i) => i.id === "ECO-INV-9002")!.status, "Paid");

  const info = await call("x402_info", {});
  assert.equal(info.envelope.accepts[0].scheme, "exact");
  assert.equal(info.envelope.accepts[0].network, "eip155:1952");

  await client.close();
  await server.close();
});

test("x402 over real HTTP: 402 challenge, then simulated proof unlocks the MCP surface", async () => {
  resetDb();
  const httpServer = createHttpServer((req, res) => void handleRequest(req, res));
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const base = `http://localhost:${port}`;
  const initBody = JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "x402-probe", version: "0" } },
  });

  try {
    // Health advertises both endpoints.
    const health = (await (await fetch(`${base}/health`)).json()) as { endpoints: Record<string, string>; tools: number };
    assert.ok(health.endpoints["/mcp-paid"]);
    assert.equal(health.tools, TOOL_COUNT);

    // No payment → 402 with spec-shaped envelope + base64 header.
    const challenge = await fetch(`${base}/mcp-paid`, {
      method: "POST", body: initBody,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    });
    assert.equal(challenge.status, 402);
    const envelope = (await challenge.json()) as { accepts: { scheme: string; network: string }[] };
    assert.equal(envelope.accepts[0].scheme, "exact");
    assert.equal(envelope.accepts[0].network, "eip155:1952");
    const prHeader = challenge.headers.get("payment-required");
    assert.ok(prHeader);
    const decoded = JSON.parse(Buffer.from(prHeader!, "base64").toString("utf8"));
    assert.equal(decoded.accepts[0].scheme, "exact");

    // Garbage proof → 400.
    const bad = await fetch(`${base}/mcp-paid`, {
      method: "POST", body: initBody,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-payment": "not-json-not-base64" },
    });
    assert.equal(bad.status, 400);

    // Simulated proof (demo mode) → real MCP response + settlement header.
    const paidRes = await fetch(`${base}/mcp-paid`, {
      method: "POST", body: initBody,
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "x-payment": JSON.stringify({ simulated: true }),
      },
    });
    assert.equal(paidRes.status, 200);
    const settle = JSON.parse(Buffer.from(paidRes.headers.get("x-payment-response")!, "base64").toString("utf8"));
    assert.equal(settle.settled, true);
    assert.equal(settle.mode, "simulated");
    const text = await paidRes.text();
    assert.match(text, /serverInfo/);
    assert.match(text, /evolved/);

    // The free endpoint stays free.
    const free = await fetch(`${base}/mcp`, {
      method: "POST", body: initBody,
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    });
    assert.equal(free.status, 200);
  } finally {
    httpServer.close();
  }
});

test("shared-demo guard: destructive tools are fenced off raw /mcp, safe tools pass through", async () => {
  resetDb();
  const httpServer = createHttpServer((req, res) => void handleRequest(req, res));
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const port = (httpServer.address() as AddressInfo).port;
  const base = `http://localhost:${port}`;
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  try {
    // A raw tools/call to a state-wiping tool is declined (not executed).
    const before = loadDb().meta.seededAt;
    const blocked = await fetch(`${base}/mcp`, {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "demo_reset", arguments: {} } }),
    });
    assert.equal(blocked.status, 200);
    const bj = await blocked.json() as { result: { content: { text: string }[] } };
    assert.match(bj.result.content[0].text, /disabledOnSharedDemo/);
    assert.match(bj.result.content[0].text, /demo_reset/);
    assert.equal(loadDb().meta.seededAt, before, "demo_reset must not have run");

    // A normal message still passes through to the MCP transport.
    const init = await fetch(`${base}/mcp`, {
      method: "POST", headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 8, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "guard-probe", version: "0" } } }),
    });
    assert.equal(init.status, 200);
    assert.match(await init.text(), /serverInfo/);
  } finally {
    httpServer.close();
  }
});

test("X Layer testnet RPC: live read-only probe (skips cleanly offline)", async (t) => {
  const status = await chainStatus();
  if (!status.reachable) {
    t.skip(`RPC unreachable from this environment: ${status.error}`);
    return;
  }
  assert.equal(status.chainId, XLAYER_TESTNET.chainId, "must be X Layer testnet 1952");
  assert.ok(status.blockNumber! > 0);
});

test("review fixes: replay protection, declined e-sign is final, custom price break-even flag, voice job-hint strictness", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // Replay protection: a tx hash that settled one payment cannot settle another.
  const fakeTx = "0x" + "ab".repeat(32);
  const req1 = await call("invoice_payment_request", { invoiceId: "ECO-INV-9002" });
  const db = loadDb();
  const p1 = db.payments.find((p) => p.id === req1.payment.id)!;
  p1.status = "paid";
  p1.txHash = fakeTx; // simulate a prior live settlement
  const req2 = await call("invoice_payment_request", { invoiceId: "ECO-INV-9001" });
  const replay = await call("invoice_payment_check", { paymentId: req2.payment.id, txHash: fakeTx });
  assert.equal(replay.verified, false);
  assert.match(replay.detail, /replay/i);

  // Declined e-sign is final: lifecycle closes as lost, never flips to signed.
  const started = await call("lifecycle_start", {
    customerName: "Decline Test Co", siteAddress: "1 No St",
    summary: "test", surface: "driveway", sqft: 400, depth: "medium",
  });
  const adv1 = await call("lifecycle_advance", { lifecycleId: started.lifecycle.id, approveQuote: true });
  assert.equal(adv1.stage, "awaiting-esign");
  const d2 = loadDb();
  const esign = d2.esigns.find((e) => e.id === adv1.refs.esign)!;
  const declined = await call("quote_esign_sign", {
    esignId: esign.id, token: esign.token, signerName: "N. Ope", decision: "decline",
  });
  assert.equal(declined.quoteStatus, "Declined");
  const adv2 = await call("lifecycle_advance", { lifecycleId: started.lifecycle.id, esignSigner: "Should Not Work" });
  assert.equal(adv2.stage, "closed-lost");
  const d3 = loadDb();
  assert.equal(d3.esigns.find((e) => e.id === esign.id)!.status, "declined", "decline must never be overwritten");
  assert.equal(d3.quotes.find((q) => q.id === started.quote.id)!.status, "Declined");

  // Custom (relationship) price below break-even is flagged, not silently raised.
  const cheap = await call("quote_create", {
    customerId: "CUST-001", siteAddress: "1 Cheap St",
    lines: [{ description: "Relationship price — heavy blast", sqft: 1000, depth: "heavy", customAmount: 1500 }],
  });
  assert.equal(cheap.quote.profitability.verdict, "below-break-even");
  assert.match(cheap.advisory, /break-even/i);

  // Voice: a job hint that matches nothing must not attribute to an arbitrary job.
  const v = await call("voice_command", { utterance: "used one bag of crushed glass on the Nonexistent Corp job" });
  assert.match(v.reply, /No active job matching/i);
  const d4 = loadDb();
  assert.ok(!d4.inventoryMovements.some((m) => m.at > started.lifecycle.createdAt && m.reason === "consumed" && m.itemId === "INV-001" && m.jobId), "no movement should be attributed to a guessed job");

  await client.close();
  await server.close();
});

test("every tool carries MCP annotations; read/write/destructive hints are correct", async () => {
  const { server, client } = await connect();
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, TOOL_COUNT, `all ${TOOL_COUNT} tools listed`);
  // Every tool must declare readOnlyHint so clients know what's safe to call.
  for (const t of tools) {
    assert.ok(t.annotations, `${t.name} is missing annotations`);
    assert.equal(typeof t.annotations.readOnlyHint, "boolean", `${t.name} needs readOnlyHint`);
  }
  const ann = (name: string) => tools.find((t) => t.name === name)?.annotations ?? {};
  // Destructive re-seeds must be flagged; pure reports must be read-only.
  assert.equal(ann("franchise_spinup").destructiveHint, true);
  assert.equal(ann("demo_reset").destructiveHint, true);
  assert.equal(ann("business_snapshot").readOnlyHint, true);
  assert.equal(ann("xlayer_status").readOnlyHint, true);
  assert.equal(ann("xlayer_status").openWorldHint, true);
  assert.equal(ann("quote_create").readOnlyHint, false);
  assert.equal(ann("invoice_payment_check").readOnlyHint, false);
  await client.close();
  await server.close();
});

test("franchise: an inline customPack adapts to a brand-new trade in one call (no fork)", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  const res = await call("franchise_spinup", {
    companyName: "Aurora Window Cleaning",
    trade: "window cleaning",
    customPack: {
      rateCard: [
        { depth: "very-light", label: "Ground-floor rinse", ratePerSqft: 0.4 },
        { depth: "light", label: "Standard interior + exterior", ratePerSqft: 0.7 },
        { depth: "medium", label: "Hard-water stain removal", ratePerSqft: 1.1 },
        { depth: "heavy", label: "Post-construction scrape", ratePerSqft: 2.2 },
      ],
      hazards: [
        { hazard: "Ladder and elevated work", risk: "high", mitigations: ["Tie off above 3m", "Spotter on the ladder"] },
      ],
    },
    confirm: true,
  });
  assert.equal(res.spunUp, true);
  assert.equal(res.trade, "window cleaning");
  assert.equal(res.tradeHazardsInstalled, 1);
  assert.ok(res.rateCard.some((r: { label: string }) => /hard-water/i.test(r.label)), "inline labels installed");

  // The inline hazard now shows up when the system drafts a JHA.
  const hazLib = await client.readResource({ uri: "evolved://hazard-library" }).then((r: any) => JSON.parse(r.contents[0].text));
  assert.ok(hazLib.installedTradePack.some((h: { hazard: string }) => /ladder/i.test(h.hazard)));

  // A rate card that misses a depth is rejected, not silently defaulted.
  const bad = await call("franchise_spinup", {
    companyName: "Broken Co",
    customPack: { rateCard: [{ depth: "light", label: "only one", ratePerSqft: 1 }] },
    confirm: true,
  });
  assert.equal(bad.spunUp, false);
  assert.match(bad.error, /all four depths/i);

  await call("demo_reset");
  await client.close();
  await server.close();
});

test("genericization: adapted trade gets its own tax label, no blasting boilerplate, and flat pricing", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // A US mobile service: 8% Sales Tax, priced per hour, its own policy note.
  await call("franchise_spinup", {
    companyName: "Cascade Mobile Services", tradePack: "pressure-washing",
    unit: "hour", currency: "USD", gstRate: 0.08, taxLabel: "Sales Tax",
    industryNotes: ["A 24-hour cancellation notice is required."], confirm: true,
  });
  const q = await call("quote_price", { quantity: 5, depth: "medium" });
  const notes = q.policyNotes.join(" | ");
  assert.match(notes, /8% Sales Tax/, "uses the configured tax label + rate");
  assert.match(notes, /24-hour cancellation/, "uses the trade's own policy note");
  assert.doesNotMatch(notes, /concrete|abrasive|blast/i, "no blasting boilerplate leaks into an adapted trade");
  assert.equal(q.unit, "hour");

  // Flat pricing kind: a fixed fee, no quantity × rate.
  const flat = await call("quote_price", { flatPrice: 300 });
  assert.equal(flat.subtotal, 300);
  assert.match(flat.rateSource, /flat/i);
  assert.equal(flat.gst, 24); // 8% of 300

  // demo_reset restores the blasting profile (GST + concrete note).
  await call("demo_reset");
  const back = await call("quote_price", { sqft: 500, depth: "medium" });
  const backNotes = back.policyNotes.join(" | ");
  assert.match(backNotes, /GST/);
  assert.match(backNotes, /concrete/i);

  await client.close();
  await server.close();
});

test("pricing unit: an adapted trade quotes in its OWN unit, not sqft (de-blasted)", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // Baseline blasting still prices per sqft with identical math (quantity omitted).
  const blast = await call("quote_price", { sqft: 500, depth: "medium" });
  assert.equal(blast.unit, "sqft");
  assert.equal(blast.quantity, 500);

  // Spin up a detailing shop — its rate card is priced per VEHICLE.
  await call("franchise_spinup", { companyName: "Aurora Detailing", tradePack: "mobile-detailing", confirm: true });
  const q = await call("quote_price", { quantity: 3, depth: "light" });
  assert.equal(q.unit, "vehicle", "quote speaks the trade's unit");
  assert.equal(q.quantity, 3);
  // 3 vehicles x $120 (light tier) x easy access + $250 mobilization = $610.
  assert.equal(q.subtotal, 610);

  await call("demo_reset");
  const back = await call("quote_price", { sqft: 500, depth: "medium" });
  assert.equal(back.unit, "sqft", "demo_reset restores the blasting unit");

  await client.close();
  await server.close();
});

test("replay race: concurrent settlement of one txHash — exactly one wins (atomic reservation)", async () => {
  resetDb();
  const hash = "0x" + "cd".repeat(32);

  // Two callers reach the reservation at the same time, then each awaits the
  // (async) on-chain verify before recording the spend — the exact window the
  // old check-then-write left open. The synchronous claim must let only one in.
  const attempt = async (): Promise<"settled" | "rejected"> => {
    if (!reserveTxHash(hash)) return "rejected";
    await Promise.resolve(); // stand-in for the async RPC verify
    commitTxHash(hash);
    return "settled";
  };
  const outcomes = await Promise.all([attempt(), attempt(), attempt()]);
  assert.equal(outcomes.filter((o) => o === "settled").length, 1, "exactly one concurrent caller may spend a hash");
  assert.equal(outcomes.filter((o) => o === "rejected").length, 2);

  // Committed hash is now in the persistent ledger and blocks any later claim.
  assert.ok(loadDb().usedTxHashes.includes(hash));
  assert.equal(reserveTxHash(hash), false, "a spent hash can never be reclaimed");

  // A failed verification releases its claim so an honest retry can proceed.
  const other = "0x" + "ef".repeat(32);
  assert.equal(reserveTxHash(other), true);
  releaseTxHash(other); // verification failed
  assert.equal(reserveTxHash(other), true, "a released (failed) hash is reclaimable");
  releaseTxHash(other);
});

test("adaptable toolkit: MCP resources + prompts registered; trade pack installs rates AND hazards", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // The server speaks the whole MCP spec: resources and prompts, not just tools.
  const resources = await client.listResources();
  const uris = resources.resources.map((r) => r.uri);
  for (const u of ["evolved://rate-table", "evolved://hazard-library", "evolved://trade-packs", "evolved://field-app"]) {
    assert.ok(uris.includes(u), `missing resource ${u}`);
  }
  // The field-app resource is the completeness proof: a real deployed front-end.
  const fieldRes = await client.readResource({ uri: "evolved://field-app" });
  const fieldApp = JSON.parse((fieldRes.contents[0] as { text: string }).text);
  assert.match(fieldApp.repo, /evolve-field-app/);
  assert.ok(fieldApp.capturePaths.some((p: { evolved: string }) => p.evolved.includes("hazard_report")));
  const packRes = await client.readResource({ uri: "evolved://trade-packs" });
  const packs = JSON.parse((packRes.contents[0] as { text: string }).text);
  assert.ok(packs.some((p: { key: string }) => p.key === "pressure-washing"));

  const prompts = await client.listPrompts();
  const names = prompts.prompts.map((p) => p.name);
  for (const n of ["morning-briefing", "quote-a-job", "run-the-lifecycle"]) {
    assert.ok(names.includes(n), `missing prompt ${n}`);
  }
  const prompt = await client.getPrompt({ name: "quote-a-job", arguments: { jobDescription: "test driveway" } });
  assert.match(JSON.stringify(prompt.messages), /quote_price/);

  // Trade pack spin-up: rates land in the engine, hazards land in the FLHA.
  const spun = await call("franchise_spinup", {
    companyName: "Glacier Pressure Washing", tradePack: "pressure-washing", confirm: true,
  });
  assert.equal(spun.spunUp, true);
  assert.equal(spun.tradePack, "pressure-washing");
  assert.ok(spun.tradeHazardsInstalled >= 3);
  const priced = await call("quote_price", { sqft: 1000, depth: "medium" });
  assert.equal(priced.rate, 0.85, "pack rate card must drive the engine");

  const lc = await call("lifecycle_start", {
    customerName: "Wash Client", siteAddress: "1 Suds St", summary: "storefront wash",
    surface: "sidewalk", sqft: 400, depth: "light",
  });
  await call("lifecycle_advance", { lifecycleId: lc.lifecycle.id, approveQuote: true, esignSigner: "W. Client" });
  const db = loadDb();
  const flha = db.flhas[db.flhas.length - 1];
  assert.ok(
    flha.hazards.some((h) => /high-pressure water injection/i.test(h.hazard)),
    "trade-pack hazards must lead the drafted FLHA",
  );

  await call("demo_reset", {});
  await client.close();
  await server.close();
});

test("franchise spin-up re-seeds the OS for a new trade, demo_reset restores Evolve", async () => {
  resetDb();
  const { server, client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  const refused = await call("franchise_spinup", { companyName: "Nope", trade: "nope", confirm: false });
  assert.equal(refused.spunUp, false);

  const spun = await call("franchise_spinup", {
    companyName: "Glacier Pressure Washing",
    trade: "pressure washing",
    region: "Calgary",
    rates: [
      { depth: "very-light", ratePerSqft: 0.35 },
      { depth: "light", ratePerSqft: 0.55 },
      { depth: "medium", ratePerSqft: 0.9 },
      { depth: "heavy", ratePerSqft: 1.6 },
    ],
    confirm: true,
  });
  assert.equal(spun.spunUp, true);
  assert.match(spun.company, /Glacier Pressure Washing/);
  assert.equal(spun.rateCard.find((r: { depth: string }) => r.depth === "medium").baseRate, 0.9);

  // The machinery works with the new rate card on empty books.
  const priced = await call("quote_price", { sqft: 1000, depth: "medium" });
  assert.equal(priced.rate, 0.9);
  const snapshot = await call("business_snapshot", {});
  assert.match(snapshot.company, /Glacier/);

  // Restore the Evolve demo dataset.
  const restored = await call("demo_reset", {});
  assert.ok(restored.reset);
  const snap2 = await call("business_snapshot", {});
  assert.match(snap2.company, /Evolve Eco Blasting/);

  await client.close();
  await server.close();
});
