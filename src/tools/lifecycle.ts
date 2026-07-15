/**
 * Evolved tools — the autonomous business lifecycle.
 *
 * One agent runs the whole engagement: lead → priced quote → e-sign
 * acceptance → weather-gated scheduling → FLHA → work → invoice → on-chain
 * payment → review request → pricing learning loop. Humans stay in the loop
 * at exactly two places, both about money: approving the quote that goes
 * out, and confirming payment settlement. Everything else advances itself.
 */

import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gstRate, priceQuote, QUOTE_VALID_DAYS } from "../engine/pricing.js";
import { getForecast } from "../engine/weather.js";
import { hazardsForScope, STANDARD_PPE } from "../engine/safety.js";
import { buildPaymentAmounts, DEMO_PAYTO, paymentUri, paymentsMode, XLAYER_TESTNET } from "../engine/payments.js";
import { addDays, loadDb, logActivity, nowIso, nextQuoteNumber, round2, shortId, today, withDb } from "../store.js";
import type { BlastDepth, Database, Lifecycle, SurfaceKind } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// No committed default secret: without EVOLVED_ESIGN_SECRET each process
// generates its own. Verification compares the STORED token string, so
// existing e-sign records remain valid across restarts either way.
const ESIGN_SECRET =
  process.env.EVOLVED_ESIGN_SECRET ?? randomBytes(24).toString("hex");

export function esignToken(quoteId: string, nonce: string): string {
  return createHmac("sha256", ESIGN_SECRET).update(`${quoteId}:${nonce}`).digest("hex").slice(0, 24);
}

function log(lc: Lifecycle, step: string, detail: string): void {
  lc.log.push({ at: nowIso(), step, detail });
  lc.updatedAt = nowIso();
}

/** Advance a lifecycle as far as gates and state allow. Pure state machine. */
async function advance(
  db: Database,
  lc: Lifecycle,
  opts: {
    approveQuote?: boolean;
    esignSigner?: string;
    simulatePayment?: boolean;
    txHash?: string;
    receiptText?: string;
  },
): Promise<void> {
  // Gate clearing.
  for (const gate of lc.gates.filter((g) => !g.clearedAt)) {
    if (gate.gate === "approve-quote" && opts.approveQuote) {
      gate.clearedAt = nowIso();
      log(lc, "gate", "Owner approved the quote — money gate cleared.");
    }
  }

  let progressed = true;
  while (progressed) {
    progressed = false;

    // Stage: quoted → needs approval gate → send + esign link
    if (lc.stage === "quoted") {
      const gate = lc.gates.find((g) => g.gate === "approve-quote");
      if (!gate?.clearedAt) return; // waiting on the human money gate
      const quote = db.quotes.find((q) => q.id === lc.quoteId)!;
      quote.status = "Sent";
      quote.updatedAt = nowIso();
      const nonce = randomBytes(6).toString("hex");
      const esign = {
        id: shortId("ESIGN"), quoteId: quote.id, token: esignToken(quote.id, nonce),
        status: "sent" as const, sentAt: nowIso(),
      };
      db.esigns.push(esign);
      lc.esignId = esign.id;
      lc.stage = "awaiting-esign";
      log(lc, "esign-sent", `Quote ${quote.id} sent with e-sign token ${esign.token}.`);
      progressed = true;
      continue;
    }

    // Stage: awaiting-esign → consume a signature, never overwrite a decline.
    if (lc.stage === "awaiting-esign") {
      const esign = db.esigns.find((e) => e.id === lc.esignId)!;
      const quote = db.quotes.find((q) => q.id === lc.quoteId)!;

      if (esign.status === "declined") {
        // A decline on record is final — never flipped by a later advance.
        quote.status = "Declined";
        quote.updatedAt = nowIso();
        const lostLead = db.leads.find((l) => l.id === lc.leadId);
        if (lostLead) { lostLead.stage = "Lost"; lostLead.updatedAt = nowIso(); }
        lc.stage = "closed-lost";
        log(lc, "declined", `${esign.signerName ?? "Client"} declined ${quote.id} — lifecycle closed as lost.`);
        return;
      }

      if (esign.status === "signed") {
        log(lc, "esign-consumed", `Using ${esign.signerName}'s existing signature on ${quote.id}.`);
      } else if (opts.esignSigner) {
        esign.status = "signed";
        esign.signerName = opts.esignSigner;
        esign.signedAt = nowIso();
      } else {
        return; // still waiting on the client
      }

      quote.status = "Accepted";
      quote.updatedAt = nowIso();
      // Guard against duplicate jobs for the same quote (e.g. e-signed
      // through quote_esign_sign and then advanced here).
      let job = db.jobs.find((j) => j.quoteId === quote.id);
      if (!job) {
        job = {
          id: shortId("JOB"), quoteId: quote.id, customerId: quote.customerId,
          siteAddress: quote.siteAddress, scope: quote.lines.map((l) => l.description).join("; "),
          status: "Booked" as const, crew: db.crew.filter((c) => c.active).map((c) => c.name).slice(0, 2),
          depositPaid: true, createdAt: nowIso(), updatedAt: nowIso(),
        };
        db.jobs.push(job);
      }
      lc.jobId = job.id;
      const lead = db.leads.find((l) => l.id === lc.leadId);
      if (lead) { lead.stage = "Won"; lead.updatedAt = nowIso(); }
      lc.stage = "scheduling";
      log(lc, "esigned", `${esign.signerName} accepted ${quote.id} — job ${job.id} opened, deposit recorded.`);
      progressed = true;
      continue;
    }

    // Stage: scheduling → pick the first Good blast day in the forecast.
    if (lc.stage === "scheduling") {
      const forecast = await getForecast(7);
      const good = forecast.days.find((d) => d.verdict === "Good blast day" && d.date > today())
        ?? forecast.days.find((d) => d.verdict === "Marginal" && d.date > today());
      const job = db.jobs.find((j) => j.id === lc.jobId)!;
      job.scheduledDate = good?.date ?? addDays(today(), 2);
      job.status = "Confirmed";
      job.updatedAt = nowIso();
      lc.stage = "pre-job-safety";
      log(lc, "scheduled", good
        ? `Booked ${good.date} — ${good.verdict} (${good.tmaxC}°C, wind ${good.windKmh} km/h, precip ${good.precipPct}%).`
        : "No clean weather window in 7 days — booked +2 days, recheck before mobilizing.");
      progressed = true;
      continue;
    }

    // Stage: pre-job-safety → open FLHA from scope.
    if (lc.stage === "pre-job-safety") {
      const job = db.jobs.find((j) => j.id === lc.jobId)!;
      const flha = {
        id: shortId("FLHA"), jobId: job.id, date: job.scheduledDate ?? today(),
        crew: job.crew, siteConditions: "Auto-drafted at booking — crew confirms on arrival.",
        hazards: hazardsForScope(job.scope, [], db.customHazards), ppeConfirmed: STANDARD_PPE,
        musterPoint: "Truck staging area", openedBy: "Evolved (agent)", openedAt: nowIso(),
      };
      db.flhas.push(flha);
      lc.flhaId = flha.id;
      lc.stage = "work";
      log(lc, "flha", `FLHA ${flha.id} drafted: ${flha.hazards.length} hazards with mitigations. Crew signs off end of day.`);
      progressed = true;
      continue;
    }

    // Stage: work → complete with modeled actuals (+ optional receipt).
    if (lc.stage === "work") {
      const job = db.jobs.find((j) => j.id === lc.jobId)!;
      const quote = db.quotes.find((q) => q.id === lc.quoteId)!;
      const line = quote.lines.find((l) => l.sqft && l.depth);
      const sqft = line?.sqft ?? 300;
      const hours = round2(Math.max(3, sqft / 90));
      const wages = round2(hours * 2 * 45);
      const materials = round2(sqft * 1.05);
      const fuel = round2(hours * 18);
      const revenue = quote.subtotal;
      const totalCost = round2(wages + materials + fuel);
      const profit = round2(revenue - totalCost);
      job.actuals = {
        hoursWorked: hours, crewSize: 2, wages, materials, fuel, totalCost,
        revenue, profit, marginPct: round2((profit / revenue) * 100),
        verdict: profit < 0 ? "loss" : profit / revenue < 0.2 ? "thin" : "healthy",
        completedAt: nowIso(),
      };
      job.status = "Complete";
      job.updatedAt = nowIso();
      const flha = db.flhas.find((f) => f.id === lc.flhaId);
      if (flha && !flha.signoff) {
        flha.signoff = { signedBy: flha.crew, incidentFree: true, notes: "Auto-recorded at completion (demo).", signedAt: nowIso() };
      }
      // Media burn-down against inventory.
      const media = db.inventory.find((i) => i.name.toLowerCase().includes("crushed glass"));
      if (media) {
        const bags = Math.min(media.onHand, Math.max(1, Math.round(sqft / 60)));
        media.onHand = round2(media.onHand - bags);
        db.inventoryMovements.push({ id: shortId("MOV"), itemId: media.id, delta: -bags, reason: "consumed", jobId: job.id, at: nowIso() });
        log(lc, "burn-down", `${bags} bags of ${media.name} consumed against ${job.id}.`);
      }
      lc.stage = "invoicing";
      log(lc, "complete", `Job done: ${hours} crew-pair hours, ${job.actuals.marginPct}% margin (${job.actuals.verdict}). FLHA signed off incident-free.`);
      progressed = true;
      continue;
    }

    // Stage: invoicing → invoice + on-chain payment request.
    if (lc.stage === "invoicing") {
      const job = db.jobs.find((j) => j.id === lc.jobId)!;
      const quote = db.quotes.find((q) => q.id === lc.quoteId)!;
      const subtotal = quote.subtotal;
      const gst = round2(subtotal * gstRate(db));
      const total = round2(subtotal + gst);
      const invoice = {
        id: shortId("ECO-INV"), jobId: job.id, customerId: job.customerId,
        lines: quote.lines, subtotal, gst, total,
        depositApplied: quote.depositRequired, balanceDue: round2(total - quote.depositRequired),
        status: "Sent" as const, dueDate: addDays(today(), 14), createdAt: nowIso(),
      };
      db.invoices.push(invoice);
      lc.invoiceId = invoice.id;
      job.status = "Invoiced";
      const { amountAsset, baseUnits } = buildPaymentAmounts(invoice.balanceDue);
      const payment = {
        id: shortId("PAY"), invoiceId: invoice.id, network: XLAYER_TESTNET.caip2,
        chainId: XLAYER_TESTNET.chainId, payTo: DEMO_PAYTO,
        asset: { symbol: "OKB", address: null, decimals: 18 },
        amountCad: invoice.balanceDue, amountAsset, amountBaseUnits: baseUnits,
        uri: paymentUri(DEMO_PAYTO, baseUnits, XLAYER_TESTNET.chainId),
        status: "pending" as const, mode: paymentsMode(),
        createdAt: nowIso(), expiresAt: addDays(today(), 7),
      };
      db.payments.push(payment);
      lc.paymentId = payment.id;
      lc.gates.push({ gate: "confirm-payment", reason: "Money gate: settlement must be confirmed (txHash in live mode, simulated in demo).", raisedAt: nowIso() });
      lc.stage = "awaiting-payment";
      log(lc, "invoiced", `Invoice ${invoice.id}: balance ${invoice.balanceDue} CAD = ${amountAsset} test OKB on X Layer testnet. Payment URI issued.`);
      progressed = true;
      continue;
    }

    // Stage: awaiting-payment → settle via simulate/txHash.
    if (lc.stage === "awaiting-payment") {
      if (!opts.simulatePayment && !opts.txHash) return;
      const payment = db.payments.find((p) => p.id === lc.paymentId)!;
      if (opts.txHash) {
        // Replay protection: one on-chain transaction settles exactly one thing.
        const alreadyUsed =
          db.usedTxHashes.includes(opts.txHash) ||
          db.payments.some((p) => p.txHash === opts.txHash && p.id !== payment.id);
        if (alreadyUsed) {
          log(lc, "payment-rejected", `Transaction ${opts.txHash} was already used to settle another payment — replay rejected.`);
          return;
        }
        const { verifyOnChain } = await import("../engine/payments.js");
        const v = await verifyOnChain(opts.txHash, payment.payTo, payment.amountBaseUnits);
        if (!v.verified) { log(lc, "payment-failed", v.detail); return; }
        payment.txHash = opts.txHash;
        db.usedTxHashes.push(opts.txHash);
      } else if (paymentsMode() === "live") {
        log(lc, "payment-blocked", "Live mode requires a real X Layer testnet txHash.");
        return;
      } else {
        payment.txHash = "simulated";
      }
      payment.status = "paid";
      payment.paidAt = nowIso();
      const gate = lc.gates.find((g) => g.gate === "confirm-payment" && !g.clearedAt);
      if (gate) gate.clearedAt = nowIso();
      const invoice = db.invoices.find((i) => i.id === lc.invoiceId)!;
      invoice.status = "Paid";
      const job = db.jobs.find((j) => j.id === lc.jobId)!;
      job.status = "Paid";
      lc.stage = "aftercare";
      log(lc, "paid", `Payment settled (${payment.txHash === "simulated" ? "simulated demo settlement" : payment.txHash}).`);
      progressed = true;
      continue;
    }

    // Stage: aftercare → review request + teach the pricing engine.
    if (lc.stage === "aftercare") {
      const job = db.jobs.find((j) => j.id === lc.jobId)!;
      const quote = db.quotes.find((q) => q.id === lc.quoteId)!;
      const review = {
        id: shortId("REV"), jobId: job.id, customerId: job.customerId,
        status: "requested" as const, requestedAt: nowIso(),
      };
      db.reviews.push(review);
      lc.reviewId = review.id;
      const line = quote.lines.find((l) => l.sqft && l.depth);
      if (line?.sqft && line.depth && job.actuals) {
        db.pricingOutcomes.push({
          id: shortId("OUT"), jobId: job.id,
          surface: (line.surface ?? "other") as SurfaceKind, depth: line.depth as BlastDepth,
          sqft: line.sqft, quotedRate: round2(quote.subtotal / line.sqft),
          actualCostPerSqft: round2(job.actuals.totalCost / line.sqft),
          marginPct: job.actuals.marginPct, won: true, recordedAt: nowIso(),
        });
        log(lc, "learned", "Outcome recorded — the rate engine just got smarter for this surface and depth.");
      }
      lc.stage = "closed";
      log(lc, "closed", "Review requested. Lifecycle complete: lead to paid, one agent, two human money gates.");
      progressed = true;
      continue;
    }
  }
}

export function registerLifecycleTools(server: McpServer): void {
  server.registerTool(
    "lifecycle_start",
    {
      title: "Start an autonomous engagement",
      description:
        "Kick off the full lead-to-paid lifecycle from one description: creates the lead and customer, prices the work with the learning engine, drafts the quote, and pauses at the human money gate (approve-quote). From there lifecycle_advance runs everything: e-sign, weather-gated booking, FLHA, completion with actuals and inventory burn-down, invoicing, on-chain payment on X Layer testnet, review request, and the pricing learning loop.",
      inputSchema: {
        customerName: z.string(),
        phone: z.string().optional(),
        siteAddress: z.string(),
        summary: z.string().describe("What the customer wants, one line"),
        surface: z.enum(["driveway", "sidewalk", "patio", "garage-pad", "exposed-aggregate", "trailer", "equipment", "fence", "brick", "other"]),
        sqft: z.number().positive(),
        depth: z.enum(["very-light", "light", "medium", "heavy"]),
        access: z.enum(["easy", "moderate", "difficult"]).optional(),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          let customer = db.customers.find((c) => c.name.toLowerCase() === input.customerName.toLowerCase());
          if (!customer) {
            customer = { id: shortId("CUST"), name: input.customerName, phone: input.phone, address: input.siteAddress, createdAt: nowIso() };
            db.customers.push(customer);
          }
          const lead = {
            id: shortId("LEAD"), customerId: customer.id, source: "Lifecycle intake",
            stage: "Quoted" as const, summary: input.summary,
            nextAction: "Await quote approval", nextActionDate: addDays(today(), 1),
            createdAt: nowIso(), updatedAt: nowIso(),
          };
          db.leads.push(lead);
          const priced = priceQuote(db, {
            sqft: input.sqft, depth: input.depth as BlastDepth,
            surface: input.surface as SurfaceKind, access: input.access,
          });
          const quote = {
            id: nextQuoteNumber(db), customerId: customer.id, leadId: lead.id,
            siteAddress: input.siteAddress,
            lines: [{ description: `${input.summary} — ${input.depth} blast, substrate profiling`, sqft: input.sqft, depth: input.depth as BlastDepth, surface: input.surface as SurfaceKind, amount: priced.subtotal }],
            sqftTotal: input.sqft, subtotal: priced.subtotal, gst: priced.gst,
            total: priced.total, depositRequired: priced.deposit,
            status: "Draft" as const, validUntil: addDays(today(), QUOTE_VALID_DAYS),
            profitability: priced.profitability, createdAt: nowIso(), updatedAt: nowIso(),
          };
          db.quotes.push(quote);
          const lc: Lifecycle = {
            id: shortId("LC"), stage: "quoted",
            leadId: lead.id, customerId: customer.id, quoteId: quote.id,
            gates: [{ gate: "approve-quote", reason: `Money gate: quote ${quote.id} (${quote.total} CAD, ${priced.profitability.verdict}) needs owner approval before it goes out.`, raisedAt: nowIso() }],
            log: [], createdAt: nowIso(), updatedAt: nowIso(),
          };
          log(lc, "start", `Lifecycle opened for ${customer.name}: ${input.sqft} sqft ${input.surface}, ${input.depth} blast → ${quote.id} at ${quote.total} CAD (${priced.rateSource}).`);
          db.lifecycles.push(lc);
          logActivity(db, "lifecycle", `Lifecycle ${lc.id} started for ${customer.name}.`);
          return {
            lifecycle: lc, quote,
            nextStep: "Human money gate: call lifecycle_advance with approveQuote:true to release the quote.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "lifecycle_advance",
    {
      title: "Advance the lifecycle",
      description:
        "Push a lifecycle forward through every stage it can reach. Provide approveQuote:true to clear the quote money gate, esignSigner to record client acceptance, and simulatePayment:true or txHash to settle the on-chain invoice. Everything between gates advances automatically and is logged step by step.",
      inputSchema: {
        lifecycleId: z.string(),
        approveQuote: z.boolean().optional(),
        esignSigner: z.string().optional(),
        simulatePayment: z.boolean().optional(),
        txHash: z.string().optional(),
      },
    },
    async (input) => {
      const db = loadDb();
      const lc = db.lifecycles.find((l) => l.id === input.lifecycleId);
      if (!lc) throw new Error(`Unknown lifecycle ${input.lifecycleId}`);
      await advance(db, lc, input);
      const { persist } = await import("../store.js");
      persist();
      const openGates = lc.gates.filter((g) => !g.clearedAt);
      return ok({
        stage: lc.stage,
        openGates,
        log: lc.log,
        refs: { quote: lc.quoteId, esign: lc.esignId, job: lc.jobId, flha: lc.flhaId, invoice: lc.invoiceId, payment: lc.paymentId, review: lc.reviewId },
        waitingOn: lc.stage === "closed" ? null
          : openGates.length ? openGates.map((g) => g.reason)
          : lc.stage === "awaiting-esign" ? ["Client e-signature (esignSigner)"]
          : lc.stage === "awaiting-payment" ? ["Payment settlement (txHash or simulatePayment)"]
          : ["Nothing — call lifecycle_advance again"],
      });
    },
  );

  server.registerTool(
    "lifecycle_status",
    {
      title: "Lifecycle status",
      description: "Every lifecycle with stage, open gates, and full step log — the audit trail of an autonomous engagement.",
      inputSchema: { lifecycleId: z.string().optional() },
    },
    async ({ lifecycleId }) => {
      const db = loadDb();
      const rows = db.lifecycles.filter((l) => (lifecycleId ? l.id === lifecycleId : true));
      return ok(rows.map((l) => ({
        id: l.id, stage: l.stage,
        openGates: l.gates.filter((g) => !g.clearedAt).map((g) => g.reason),
        steps: l.log.length, lastStep: l.log[l.log.length - 1],
      })));
    },
  );

  server.registerTool(
    "quote_esign_sign",
    {
      title: "E-sign a quote",
      description:
        "Record a client's e-signature on a sent quote using its HMAC acceptance token. Signature is verified against the token, timestamped, and becomes part of the permanent record. Accepting opens the job (or, when the quote belongs to a lifecycle, the lifecycle consumes the signature on its next advance).",
      inputSchema: {
        esignId: z.string(),
        token: z.string(),
        signerName: z.string(),
        decision: z.enum(["accept", "decline"]),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const esign = db.esigns.find((e) => e.id === input.esignId);
          if (!esign) throw new Error(`Unknown e-sign record ${input.esignId}`);
          if (esign.token !== input.token) {
            return { signed: false, error: "Token mismatch — signature rejected." };
          }
          if (esign.status !== "sent") return { signed: false, error: `Already ${esign.status}.` };
          esign.status = input.decision === "accept" ? "signed" : "declined";
          esign.signerName = input.signerName;
          esign.signedAt = nowIso();
          const quote = db.quotes.find((q) => q.id === esign.quoteId)!;
          quote.status = input.decision === "accept" ? "Accepted" : "Declined";
          quote.updatedAt = nowIso();
          logActivity(db, "esign", `${input.signerName} ${esign.status} quote ${quote.id}.`);

          const lifecycle = db.lifecycles.find((l) => l.esignId === esign.id);
          let openedJobId: string | undefined;
          if (input.decision === "accept" && !lifecycle) {
            // Standalone e-sign: open the job here (once per quote).
            const existing = db.jobs.find((j) => j.quoteId === quote.id);
            if (!existing) {
              const job = {
                id: shortId("JOB"), quoteId: quote.id, customerId: quote.customerId,
                siteAddress: quote.siteAddress,
                scope: quote.lines.map((l) => l.description).join("; "),
                status: "Awaiting acceptance" as const, crew: [],
                depositPaid: false, createdAt: nowIso(), updatedAt: nowIso(),
              };
              db.jobs.push(job);
              openedJobId = job.id;
            } else {
              openedJobId = existing.id;
            }
          }
          return {
            signed: true, esign, quoteStatus: quote.status, openedJobId,
            note: lifecycle
              ? `Quote belongs to lifecycle ${lifecycle.id} — call lifecycle_advance to consume the ${esign.status === "signed" ? "signature" : "decline"}.`
              : undefined,
          };
        }),
      );
    },
  );

  server.registerTool(
    "review_record",
    {
      title: "Record a customer review",
      description: "Log the customer's post-job review (1–5 rating and comment) against the review request — closes the loop on the engagement and builds the reputation ledger.",
      inputSchema: {
        reviewId: z.string(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const review = db.reviews.find((r) => r.id === input.reviewId);
          if (!review) throw new Error(`Unknown review request ${input.reviewId}`);
          review.status = "received";
          review.rating = input.rating;
          review.comment = input.comment;
          review.receivedAt = nowIso();
          const all = db.reviews.filter((r) => r.rating);
          const avg = round2(all.reduce((s, r) => s + (r.rating ?? 0), 0) / all.length);
          logActivity(db, "reviews", `Review received: ${input.rating}/5.`);
          return { review, averageRating: avg, reviewsOnFile: all.length };
        }),
      );
    },
  );
}
