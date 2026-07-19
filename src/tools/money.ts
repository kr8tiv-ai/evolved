/**
 * Evolved tools — receipts, invoicing, and reporting.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runOcrPipeline } from "../engine/ocr.js";
import { renderInvoiceHtml, writeDocument } from "../engine/brand.js";
import { gstRate } from "../engine/pricing.js";
import { upsertVendor } from "./accounting.js";
import {
  addDays, loadDb, logActivity, money, nowIso, round2, shortId, today, withDb,
} from "../store.js";
import type { Invoice, Receipt } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerMoneyTools(server: McpServer): void {
  server.registerTool(
    "receipt_ingest",
    {
      title: "Ingest a receipt (OCR pipeline)",
      description:
        "Run a receipt through the tiered extraction pipeline: fast model first, automatic escalation to a stronger model when confidence is low or the math does not reconcile. The result is categorized (media, fuel, equipment, safety gear, ...), optionally matched to a job for per-job P&L, duplicate-guarded, and posted straight to the expense ledger. Paper to books in one call.",
      inputSchema: {
        text: z.string().describe("Raw receipt text (from a photo OCR or typed)"),
        jobId: z.string().optional().describe("Job to attribute this cost to"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ text, jobId }) => {
      const result = await runOcrPipeline(text);
      return ok(
        withDb((db) => {
          // Duplicate guard: same vendor, total within $0.50, date within 2 days.
          const dup = db.receipts.find(
            (r) =>
              r.vendor.toLowerCase() === result.vendor.toLowerCase() &&
              Math.abs(r.total - result.total) <= 0.5 &&
              Math.abs(new Date(r.date).getTime() - new Date(result.date).getTime()) <= 2 * 86_400_000,
          );
          if (dup) {
            return {
              posted: false,
              duplicateOf: dup.id,
              message: `Looks like a duplicate of ${dup.id} (${dup.vendor}, ${money(dup.total)} on ${dup.date}). Not posted.`,
              extraction: result,
            };
          }
          const receipt: Receipt = {
            id: shortId("RCPT"),
            vendor: result.vendor,
            date: result.date,
            amountBeforeTax: result.amountBeforeTax,
            gst: result.gst,
            total: result.total,
            category: result.category,
            paymentMethod: result.paymentMethod,
            jobId,
            lineItems: result.lineItems,
            ocr: {
              model: result.model,
              escalated: result.escalated,
              confidence: result.confidence,
              warnings: result.warnings,
            },
            createdAt: nowIso(),
          };
          db.receipts.push(receipt);
          const canonicalVendor = upsertVendor(db, receipt);

          // Price-spike detection: compare line items to the price log.
          const spikes: string[] = [];
          for (const li of receipt.lineItems) {
            // Match on the full product name to avoid first-word collisions.
            const prior = db.priceLog
              .filter((p) => li.description.toLowerCase().includes(p.product.toLowerCase()))
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            const qtyMatch = li.description.match(/\bx\s?(\d+)\b|\b(\d+)\s*(?:bags?|pairs?|units?)\b/i);
            const qty = qtyMatch ? Number(qtyMatch[1] ?? qtyMatch[2]) : null;
            if (prior && qty && qty > 0 && prior.unitPrice > 0) {
              const unit = round2(li.amount / qty);
              const changePct = round2(((unit - prior.unitPrice) / prior.unitPrice) * 100);
              if (changePct >= 10) {
                spikes.push(`${li.description}: $${unit}/unit vs $${prior.unitPrice} last time (+${changePct}%) — price spike.`);
              }
            }
          }
          logActivity(db, "receipts", `Receipt posted: ${canonicalVendor} ${money(receipt.total)} (${receipt.category}).`);

          return {
            posted: true,
            receipt,
            vendorCanonical: canonicalVendor,
            priceSpikes: spikes,
            note: jobId
              ? `Attributed to ${jobId} — will appear in that job's P&L.`
              : "No job attribution — categorized as overhead.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "expense_report",
    {
      title: "Expense report",
      description:
        "Expense breakdown by category and vendor for a month (YYYY-MM, default current). Shows OCR provenance and reclaimable GST — the bookkeeping view an accountant actually wants.",
      inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ month }) => {
      const db = loadDb();
      const m = month ?? today().slice(0, 7);
      const rows = db.receipts.filter((r) => r.date.startsWith(m));
      const byCategory: Record<string, number> = {};
      const byVendor: Record<string, number> = {};
      let gst = 0;
      for (const r of rows) {
        byCategory[r.category] = round2((byCategory[r.category] ?? 0) + r.total);
        byVendor[r.vendor] = round2((byVendor[r.vendor] ?? 0) + r.total);
        gst += r.gst;
      }
      return ok({
        month: m,
        receipts: rows.length,
        totalSpend: round2(rows.reduce((s, r) => s + r.total, 0)),
        reclaimableGst: round2(gst),
        byCategory,
        byVendor,
        flagged: rows
          .filter((r) => r.ocr.warnings.length > 0)
          .map((r) => ({ id: r.id, vendor: r.vendor, warnings: r.ocr.warnings })),
      });
    },
  );

  server.registerTool(
    "invoice_create",
    {
      title: "Create invoice",
      description:
        "Invoice a completed job: pulls the quote lines, applies the deposit already collected, computes 5% GST and the balance due (net 14). Marks the job Invoiced.",
      inputSchema: {
        jobId: z.string(),
        extraLines: z.array(z.object({ description: z.string(), amount: z.number() })).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ jobId, extraLines }) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === jobId);
          if (!job) throw new Error(`Unknown job ${jobId}`);
          const quote = db.quotes.find((q) => q.id === job.quoteId);
          const lines = [
            ...(quote?.lines ?? [{ description: job.scope, amount: job.actuals?.revenue ?? 0 }]),
            ...(extraLines ?? []),
          ];
          const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
          const gst = round2(subtotal * gstRate(db));
          const total = round2(subtotal + gst);
          const depositApplied = job.depositPaid && quote ? quote.depositRequired : 0;
          const invoice: Invoice = {
            id: shortId("ECO-INV"),
            jobId,
            customerId: job.customerId,
            lines,
            subtotal,
            gst,
            total,
            depositApplied,
            balanceDue: round2(total - depositApplied),
            status: "Draft",
            dueDate: addDays(today(), 14),
            createdAt: nowIso(),
          };
          db.invoices.push(invoice);
          job.status = "Invoiced";
          job.updatedAt = nowIso();
          return { invoice };
        }),
      );
    },
  );

  server.registerTool(
    "invoice_render",
    {
      title: "Render branded invoice document",
      description: "Render an invoice in the company's dark brand as a self-contained HTML document ready to print to PDF.",
      inputSchema: { invoiceId: z.string() },
      annotations: { readOnlyHint: true },
    },
    async ({ invoiceId }) => {
      const db = loadDb();
      const inv = db.invoices.find((i) => i.id === invoiceId);
      if (!inv) throw new Error(`Unknown invoice ${invoiceId}`);
      const customer = db.customers.find((c) => c.id === inv.customerId)!;
      const html = renderInvoiceHtml(inv, customer);
      const path = writeDocument(`Evolve-Invoice-${inv.id}.html`, html);
      return ok({ invoiceId, file: path, bytes: html.length });
    },
  );

  server.registerTool(
    "pnl_report",
    {
      title: "P&L report",
      description:
        "Profit & loss for a month or the whole book: revenue from paid invoices, expenses from the receipt ledger, per-job margins from recorded actuals, and the business scorecard (win rate, average $/sqft, overall margin).",
      inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM; omit for all-time") },
      annotations: { readOnlyHint: true },
    },
    async ({ month }) => {
      const db = loadDb();
      const inMonth = (iso: string) => (month ? iso.startsWith(month) : true);

      const revenue = round2(
        db.invoices.filter((i) => i.status === "Paid" && inMonth(i.createdAt)).reduce((s, i) => s + i.total, 0),
      );
      const expenses = round2(
        db.receipts.filter((r) => inMonth(r.date)).reduce((s, r) => s + r.total, 0),
      );

      const jobsWithActuals = db.jobs.filter((j) => j.actuals && inMonth(j.actuals.completedAt));
      const jobPnl = jobsWithActuals.map((j) => ({
        jobId: j.id,
        revenue: j.actuals!.revenue,
        cost: j.actuals!.totalCost,
        profit: j.actuals!.profit,
        marginPct: j.actuals!.marginPct,
        verdict: j.actuals!.verdict,
      }));

      const outcomes = db.pricingOutcomes;
      const winRate = outcomes.length
        ? round2((outcomes.filter((o) => o.won).length / outcomes.length) * 100)
        : null;
      const avgRate = outcomes.length
        ? round2(outcomes.reduce((s, o) => s + o.quotedRate, 0) / outcomes.length)
        : null;

      return ok({
        period: month ?? "all-time",
        revenue,
        expenses,
        netProfit: round2(revenue - expenses),
        outstandingReceivables: round2(
          db.invoices.filter((i) => i.status === "Sent" || i.status === "Overdue").reduce((s, i) => s + i.balanceDue, 0),
        ),
        jobPnl,
        scorecard: {
          jobsTracked: jobPnl.length,
          winRatePct: winRate,
          avgQuotedRatePerSqft: avgRate,
          avgJobMarginPct: jobPnl.length
            ? round2(jobPnl.reduce((s, j) => s + j.marginPct, 0) / jobPnl.length)
            : null,
        },
      });
    },
  );
}
