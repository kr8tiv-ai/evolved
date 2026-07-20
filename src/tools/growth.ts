/**
 * Evolved tools — growth, reputation, and the scorecard.
 *
 * The parts of the production workbook that turn done work into the next
 * job: review requests and the testimonial bank, the Job P&L scorecard
 * (quoted vs actual, win rate, avg $/sqft), the live dispatch board, brand
 * configuration for adapted businesses, and a safe read-only preview of any
 * trade pack.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadDb, logActivity, money, nowIso, round2, shortId, withDb } from "../store.js";
import { TRADE_PACKS, findTradePack } from "../trades.js";
import type { JobStatus } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerGrowthTools(server: McpServer): void {
  server.registerTool(
    "review_request",
    {
      title: "Request a review",
      description:
        "Draft the post-job review ask for a completed job — brand voice (no exclamation points), personal, with the one-line prompt that actually gets responses. Logs the request so reputation_report can track response rate. Draft only; a human sends it.",
      inputSchema: { jobId: z.string() },
      annotations: { readOnlyHint: false },
    },
    async ({ jobId }) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === jobId);
          if (!job) return { error: `No job ${jobId}.` };
          if (!["Complete", "Invoiced", "Paid"].includes(job.status)) {
            return { error: `Job ${jobId} is ${job.status} — review asks go out after completion.` };
          }
          const customer = db.customers.find((c) => c.id === job.customerId);
          let review = db.reviews.find((r) => r.jobId === jobId);
          if (review?.status === "received") return { alreadyReceived: review };
          if (!review) {
            review = { id: shortId("REV"), jobId, customerId: job.customerId, status: "requested", requestedAt: nowIso() };
            db.reviews.push(review);
          }
          logActivity(db, "growth", `Review requested for ${jobId}.`);
          return {
            review,
            draft:
              `Hi ${customer?.name ?? "there"}, thank you for having us out for the ${job.scope.toLowerCase()}. ` +
              `If you were happy with the work, a short review helps a small crew more than you would guess — ` +
              `it takes about a minute. And if anything fell short, reply here and we will make it right first.`,
            note: "Draft only — send through your own channel. record the reply with review_record.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "reputation_report",
    {
      title: "Reputation report",
      description:
        "The reputation ledger: average rating, five-star share, response rate on requests, review velocity, and the testimonial bank (best quotes, ready for the website). Reviews are earned data — this is the growth loop's dashboard.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const received = db.reviews.filter((r) => r.status === "received" && r.rating);
      const avg = received.length ? round2(received.reduce((s, r) => s + (r.rating ?? 0), 0) / received.length) : null;
      const last30 = received.filter((r) => r.receivedAt && Date.now() - new Date(r.receivedAt).getTime() < 30 * 86_400_000);
      return ok({
        requests: db.reviews.length,
        received: received.length,
        responseRate: db.reviews.length ? `${Math.round((received.length / db.reviews.length) * 100)}%` : "no requests yet",
        averageRating: avg,
        fiveStarShare: received.length ? `${Math.round((received.filter((r) => r.rating === 5).length / received.length) * 100)}%` : null,
        last30Days: last30.length,
        testimonialBank: received
          .filter((r) => (r.rating ?? 0) >= 4 && r.comment)
          .map((r) => ({ jobId: r.jobId, rating: r.rating, quote: r.comment })),
        openAsks: db.reviews.filter((r) => r.status === "requested").map((r) => r.jobId),
      });
    },
  );

  server.registerTool(
    "job_pnl_report",
    {
      title: "Job P&L + scorecard",
      description:
        "The Job P&L tab: every job's quoted-vs-actual — revenue, cost (time-log labor counted when actuals are missing), profit, margin, verdict — plus the business scorecard: jobs, total revenue, total cost, overall margin, quote win rate, and average $/sqft.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const rows = db.jobs.map((j) => {
        const quote = j.quoteId ? db.quotes.find((q) => q.id === j.quoteId) : undefined;
        const labor = db.timeEntries.filter((t) => t.jobId === j.id && t.wage);
        const laborCost = round2(labor.reduce((s, t) => s + (t.wage ?? 0), 0));
        const cost = j.actuals?.totalCost ?? (laborCost || undefined);
        const revenue = j.actuals?.revenue ?? quote?.subtotal;
        const profit = revenue !== undefined && cost !== undefined ? round2(revenue - cost) : undefined;
        return {
          jobId: j.id,
          status: j.status,
          quoted: quote?.subtotal,
          revenue,
          cost,
          costBasis: j.actuals ? "actuals" : laborCost ? "time-log labor only" : "none yet",
          profit,
          marginPct: profit !== undefined && revenue ? round2((profit / revenue) * 100) : undefined,
          verdict: j.actuals?.verdict,
        };
      });
      const done = rows.filter((r) => r.revenue !== undefined && r.cost !== undefined);
      const revenue = round2(done.reduce((s, r) => s + (r.revenue ?? 0), 0));
      const cost = round2(done.reduce((s, r) => s + (r.cost ?? 0), 0));
      const sentQuotes = db.quotes.filter((q) => q.status !== "Draft");
      const won = sentQuotes.filter((q) => q.status === "Accepted");
      // $/sqft only over sqft-priced wins — flat-priced work (trailers,
      // benches) would otherwise inflate the average.
      const sqftPriced = won.filter((q) => q.sqftTotal);
      const sqftWon = sqftPriced.reduce((s, q) => s + (q.sqftTotal ?? 0), 0);
      return ok({
        jobs: rows,
        scorecard: {
          jobsTracked: done.length,
          revenue: money(revenue),
          cost: money(cost),
          profit: money(round2(revenue - cost)),
          overallMarginPct: revenue ? round2(((revenue - cost) / revenue) * 100) : 0,
          quoteWinRate: sentQuotes.length ? `${Math.round((won.length / sentQuotes.length) * 100)}% (${won.length}/${sentQuotes.length})` : "no quotes sent",
          avgDollarPerSqft: sqftWon ? money(round2(sqftPriced.reduce((s, q) => s + q.subtotal, 0) / sqftWon)) : "n/a (flat-priced work)",
        },
      });
    },
  );

  server.registerTool(
    "dispatch_board",
    {
      title: "Dispatch board",
      description:
        "The live dispatch board, bucketed by the real pipeline statuses (Awaiting acceptance → Booked → Confirmed → In progress → Complete → Invoiced → Paid), with today's work, unscheduled-but-paid flags, and crew assignments.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const statuses: JobStatus[] = ["Awaiting acceptance", "Booked", "Confirmed", "In progress", "Complete", "Invoiced", "Paid"];
      const board = Object.fromEntries(statuses.map((s) => [
        s,
        db.jobs.filter((j) => j.status === s).map((j) => ({
          jobId: j.id,
          customer: db.customers.find((c) => c.id === j.customerId)?.name ?? j.customerId,
          site: j.siteAddress,
          scheduled: j.scheduledDate ?? "unscheduled",
          crew: j.crew,
          depositPaid: j.depositPaid,
        })),
      ]));
      const todayStr = new Date().toISOString().slice(0, 10);
      return ok({
        board,
        today: db.jobs.filter((j) => j.scheduledDate === todayStr).map((j) => j.id),
        flags: [
          // Safety holds sit ABOVE money flags: an uncleared stop-work is the one
          // thing on this board that means "nobody is working right now".
          ...db.hazardReports
            .filter((h) => h.severity === "stop-work" && !h.clearedAt)
            .map((h) => `${h.jobId ?? "NO JOB"}: STOP-WORK hazard uncleared (${h.id}) — ${h.what}`),
          ...db.jobs
            .filter((j) => j.depositPaid && !j.scheduledDate && !["Complete", "Invoiced", "Paid"].includes(j.status))
            .map((j) => `${j.id}: deposit in but UNSCHEDULED — book it`),
        ],
      });
    },
  );

  server.registerTool(
    "brand_configure",
    {
      title: "Configure the brand",
      description:
        "Make an adapted business feel like ITS OWN business: set the company name, tagline, and motto that flow into rendered quotes, invoices, review asks, and the workbook's Start Here tab. Pairs with franchise_spinup — spin up the trade, then brand it.",
      inputSchema: {
        company: z.string().min(2).max(80).optional(),
        tagline: z.string().max(120).optional(),
        motto: z.string().max(120).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ company, tagline, motto }) => {
      if (!company && !tagline && !motto) return ok({ error: "Nothing to set — pass company, tagline, or motto." });
      return ok(
        withDb((db) => {
          if (company) db.meta.company = company;
          db.brand = { ...db.brand, ...(tagline ? { tagline } : {}), ...(motto ? { motto } : {}) };
          logActivity(db, "brand", `Brand updated: ${[company, tagline, motto].filter(Boolean).join(" · ")}`);
          return { company: db.meta.company, brand: db.brand, flowsInto: ["quote_render", "invoice_render", "review_request", "workbook Start Here tab"] };
        }),
      );
    },
  );

  server.registerTool(
    "franchise_preview",
    {
      title: "Preview a trade pack (read-only)",
      description:
        "See exactly what franchise_spinup would install for a trade — rate card, depth labels, trade-specific hazards — WITHOUT touching the current business. Safe on shared demos; the adaptable toolkit's showroom.",
      inputSchema: { tradePack: z.string().describe(`One of: ${TRADE_PACKS.map((p) => p.key).join(", ")} — or any trade name to fuzzy-match`) },
      annotations: { readOnlyHint: true },
    },
    async ({ tradePack }) => {
      const pack = findTradePack(tradePack);
      if (!pack) {
        return ok({
          error: `No pack matching "${tradePack}".`,
          available: TRADE_PACKS.map((p) => ({ key: p.key, trade: p.trade, description: p.description })),
          note: "Adding your own trade is one entry in src/trades.ts — rate card + hazards, ~30 lines.",
        });
      }
      return ok({
        pack: { key: pack.key, trade: pack.trade, description: pack.description, pricedPer: pack.unit ?? "sqft" },
        rateCard: pack.rateCard,
        tradeHazards: pack.hazards,
        wouldChange: [
          "meta.company renamed (your choice), books re-seeded empty",
          "rate table replaced with this card — the learning loop then tunes it from YOUR job outcomes",
          "these hazards merge into every FLHA the system drafts",
          "quoting, receipts, dispatch, digest, invoicing, on-chain settlement: unchanged machinery, your trade",
        ],
        applyWith: `franchise_spinup { tradePack: "${pack.key}", companyName: "...", confirm: true }`,
      });
    },
  );
}
