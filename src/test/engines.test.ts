/**
 * Engine tests — pricing math, the comma-bug regression, action rules.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { priceQuote, profitabilityCheck, normalizeDepth } from "../engine/pricing.js";
import { parseAmount, categorize, runOcrPipeline } from "../engine/ocr.js";
import { verdictFor } from "../engine/weather.js";
import { hazardsForScope } from "../engine/safety.js";
import { buildSeed } from "../seed.js";

test("pricing: subtotal = sqft × rate × access + mobilization; GST 5%; deposit 25% of total", () => {
  const db = buildSeed();
  db.pricingOutcomes = []; // isolate from the learning loop
  const r = priceQuote(db, { sqft: 100, depth: "very-light", access: "easy" });
  // 100 × 2.50 × 1.0 + 250 = 500
  assert.equal(r.subtotal, 500);
  assert.equal(r.gst, 25);
  assert.equal(r.total, 525);
  assert.equal(r.deposit, 131.25); // 25% of the GST-inclusive total
});

test("pricing: exposed aggregate normalizes to medium blast", () => {
  assert.equal(normalizeDepth("light", "exposed-aggregate"), "medium");
  assert.equal(normalizeDepth("heavy", "exposed-aggregate"), "heavy");
});

test("pricing: learning loop pulls driveway medium toward ~$9/sqft, never below base", () => {
  const db = buildSeed();
  const r = priceQuote(db, { sqft: 500, depth: "medium", surface: "driveway" });
  assert.ok(r.rate >= 6.9, `rate ${r.rate} must be >= base 6.90`);
  assert.ok(r.rate > 8 && r.rate < 9.5, `learned driveway rate ${r.rate} should be near $9`);
  assert.match(r.rateSource, /learned from/);
});

test("pricing: below-break-even work is flagged, not silently raised", () => {
  const check = profitabilityCheck(1000, "heavy", 1500); // absurdly cheap heavy job
  assert.equal(check.verdict, "below-break-even");
  assert.ok(check.breakEvenRate > 1.5);
});

test("ocr: comma thousands-separator regression (the production P0 bug)", () => {
  // The old parser read "$1,250.00" as 1.25 and undercounted expenses ~1000x.
  assert.equal(parseAmount("$1,250.00"), 1250);
  assert.equal(parseAmount("12,345.67"), 12345.67);
  assert.equal(parseAmount("1.234,56"), 1234.56); // EU-style too
  assert.equal(parseAmount("250.00"), 250);
  // Lone decimal comma must not be 100x-inflated ("234,56" is 234.56, not 23456).
  assert.equal(parseAmount("234,56"), 234.56);
  assert.equal(parseAmount("3,50"), 3.5);
  assert.equal(parseAmount("12,345"), 12345); // classic thousands, no decimals
});

test("ocr: full receipt reconciles subtotal + GST = total", async () => {
  const r = await runOcrPipeline(
    "PRAIRIE ABRASIVES SUPPLY\n2026-07-02\nCrushed glass 40/70 x30  1,050.00\nSUBTOTAL 1,190.48\nGST 59.52\nTOTAL $1,250.00\nVISA",
  );
  assert.equal(r.total, 1250);
  assert.equal(r.gst, 59.52);
  assert.equal(r.amountBeforeTax, 1190.48);
  assert.equal(r.category, "Abrasive media");
  assert.equal(r.escalated, false);
});

test("ocr: unreconcilable receipt escalates and is flagged for review", async () => {
  const r = await runOcrPipeline("SOME STORE\nwidget 10.00\nTOTAL 99.99\nGST 1.00\nSUBTOTAL 50.00");
  assert.equal(r.escalated, true);
  assert.ok(r.warnings.some((w) => /mismatch|review/i.test(w)));
});

test("ocr: categorization hints", () => {
  assert.equal(categorize("Petro-Canada", "diesel"), "Fuel");
  assert.equal(categorize("Princess Auto", "blast hose"), "Equipment");
  assert.equal(categorize("Unknown Corp", "misc"), "Other");
});

test("weather: blast-day gating thresholds", () => {
  assert.equal(verdictFor(20, 10, 5), "Good blast day");
  assert.equal(verdictFor(20, 30, 5), "Marginal"); // wind > 28
  assert.equal(verdictFor(20, 10, 55), "No-go"); // precip >= 50
  assert.equal(verdictFor(2, 10, 5), "No-go"); // too cold
});

test("safety: hazard library selects blasting hazards with mitigations", () => {
  const hazards = hazardsForScope("driveway medium blast, paint removal", ["dog on site"]);
  assert.ok(hazards.some((h) => /particulate/i.test(h.hazard)));
  assert.ok(hazards.some((h) => /high-pressure/i.test(h.hazard)));
  assert.ok(hazards.some((h) => /dog on site/i.test(h.hazard)));
  for (const h of hazards) assert.ok(h.mitigations.length > 0);
});
