/**
 * Engine tests for the expansion: payments math and envelopes, voice NLU,
 * CFO model, vision header parsing, e-sign tokens, inventory helpers.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cadToOkb, paymentUri, toBaseUnits, x402Envelope, XLAYER_TESTNET,
  simulatedSettlement, DEMO_PAYTO, isAddress,
} from "../engine/payments.js";
import { parseVoiceCommand } from "../engine/nlu.js";
import { runScenario, baselineFromBooks } from "../engine/cfo.js";
import { imageDimensions } from "../engine/vision.js";
import { esignToken } from "../tools/lifecycle.js";
import { findItem } from "../tools/inventory.js";
import { buildSeed } from "../seed.js";

// ---------- payments ----------

test("payments: base-unit conversion has no float drift", () => {
  assert.equal(toBaseUnits("1", 18), "1000000000000000000");
  assert.equal(toBaseUnits("0.000100", 18), "100000000000000");
  assert.equal(toBaseUnits("2.5", 6), "2500000");
  assert.equal(toBaseUnits("0.1", 18), "100000000000000000"); // classic float trap
});

test("payments: CAD → demo OKB at the fixed synthetic rate", () => {
  assert.equal(cadToOkb(100), "1.000000");
  assert.equal(cadToOkb(1827), "18.270000");
});

test("payments: EIP-681 URI targets X Layer testnet (1952)", () => {
  const uri = paymentUri(DEMO_PAYTO, "100000000000000", XLAYER_TESTNET.chainId);
  assert.equal(uri, `ethereum:${DEMO_PAYTO}@1952?value=100000000000000`);
  assert.equal(XLAYER_TESTNET.caip2, "eip155:1952");
  assert.ok(isAddress(DEMO_PAYTO));
});

test("payments: x402 envelope is spec-shaped (accepts / exact / CAIP-2 / testnet)", () => {
  const env = x402Envelope({
    resource: "/mcp-paid", description: "test",
    amountAsset: "0.000100", baseUnits: "100000000000000", payTo: DEMO_PAYTO,
  }) as { accepts: Record<string, unknown>[] };
  assert.equal(env.accepts.length, 1);
  const a = env.accepts[0];
  assert.equal(a.scheme, "exact");
  assert.equal(a.network, "eip155:1952");
  assert.equal(a.payTo, DEMO_PAYTO);
  assert.equal((a.extra as { testnet: boolean }).testnet, true);
});

test("payments: simulated settlement is always labeled", () => {
  const s = simulatedSettlement("test");
  assert.equal(s.mode, "simulated");
  assert.match(s.detail, /Simulated/);
});

// ---------- voice NLU ----------

test("nlu: consume-inventory with word numbers and job hint", () => {
  const i = parseVoiceCommand("used four bags of crushed glass on the Kowalczyk job");
  assert.equal(i.intent, "consume-inventory");
  if (i.intent === "consume-inventory") {
    assert.equal(i.qty, 4);
    assert.match(i.item, /crushed glass/i);
    assert.match(i.jobHint ?? "", /Kowalczyk/i);
  }
});

test("nlu: flha / next stop / receipt / todo / fallback", () => {
  assert.equal(parseVoiceCommand("start the FLHA for job 1043").intent, "open-flha");
  assert.equal(parseVoiceCommand("what's next?").intent, "next-stop");
  assert.equal(parseVoiceCommand("log receipt: ESSO diesel TOTAL $92.10").intent, "log-receipt");
  const todo = parseVoiceCommand("remind me to grab couplers today");
  assert.equal(todo.intent, "add-todo");
  if (todo.intent === "add-todo") assert.equal(todo.priority, "high");
  assert.equal(parseVoiceCommand("beautiful sunset out here").intent, "quick-capture");
});

// ---------- CFO ----------

test("cfo: add-truck scenario produces 12 months, capex hole, explicit assumptions", () => {
  const db = buildSeed();
  const f = runScenario(db, { scenario: "add-truck", truckCapexCad: 85_000 });
  assert.equal(f.months.length, 12);
  assert.ok(f.months[0].cumulative < 0, "capex should start cumulative cash negative");
  assert.ok(f.assumptions.length >= 3);
  assert.ok(f.verdict.length > 10);
});

test("cfo: rate change applies elasticity; baseline is sane", () => {
  const db = buildSeed();
  const base = baselineFromBooks(db);
  assert.ok(base.monthlyRevenue > 0 && base.monthlyCosts > 0);
  const up = runScenario(db, { scenario: "rate-change", ratePct: 10 });
  const flat = runScenario(db, { scenario: "baseline" });
  assert.ok(up.months[5].revenue !== flat.months[5].revenue);
});

// ---------- vision ----------

test("vision: parses real PNG and JPEG headers", () => {
  // Minimal PNG: signature + IHDR 640x480
  const png = Buffer.alloc(33);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  assert.deepEqual(imageDimensions(png), { width: 640, height: 480 });

  // Minimal JPEG: SOI + SOF0 with 800x600
  const jpg = Buffer.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    0x02, 0x58, // height 600
    0x03, 0x20, // width 800
    0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  assert.deepEqual(imageDimensions(jpg), { width: 800, height: 600 });
});

// ---------- e-sign ----------

test("esign: tokens are deterministic per quote+nonce and tamper-evident", () => {
  const a = esignToken("ECO-Q-071526-01", "abc123");
  const b = esignToken("ECO-Q-071526-01", "abc123");
  const c = esignToken("ECO-Q-071526-02", "abc123");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 24);
});

// ---------- inventory ----------

test("inventory: fuzzy item matching", () => {
  const db = buildSeed();
  assert.equal(findItem(db.inventory, "crushed glass")?.id, "INV-001");
  assert.equal(findItem(db.inventory, "INV-003")?.name, "P100 cartridges");
  assert.equal(findItem(db.inventory, "garnet 80 mesh bags")?.id, "INV-002");
  assert.equal(findItem(db.inventory, "unobtainium"), undefined);
});
