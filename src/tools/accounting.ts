/**
 * Evolved tools — accounting depth.
 *
 * Vendor canonicalization and roll-up, the periodic receipt discrepancy
 * report, and receivables chasing — the bookkeeping layer that keeps the
 * books accountant-ready instead of shoebox-shaped.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { daysBetween, loadDb, money, round2, today, withDb, nowIso, logActivity } from "../store.js";
import type { Database, Receipt } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Canonicalize a vendor name and roll the receipt into its record. */
export function upsertVendor(db: Database, receipt: Receipt): string {
  const raw = receipt.vendor.trim();
  // Punctuation becomes a space so "Petro-Canada" and "Petro Canada" collide.
  const norm = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  let vendor = db.vendors.find(
    (v) => v.canonical.toLowerCase() === raw.toLowerCase() || v.aliases.some((a) => a === norm),
  );
  if (!vendor) {
    vendor = { canonical: raw, aliases: [norm], category: receipt.category, firstSeen: receipt.date, totalSpend: 0, receipts: 0 };
    db.vendors.push(vendor);
  } else if (!vendor.aliases.includes(norm)) {
    vendor.aliases.push(norm);
  }
  vendor.totalSpend = round2(vendor.totalSpend + receipt.total);
  vendor.receipts += 1;
  return vendor.canonical;
}

export function registerAccountingTools(server: McpServer): void {
  server.registerTool(
    "vendor_rollup",
    {
      title: "Vendor roll-up",
      description:
        "Canonicalized vendor spend: total spend, receipt count, category, first seen — with new-vendor flags. Misspellings and variants roll up to one vendor record.",
      inputSchema: {},
    },
    async () => {
      const db = loadDb();
      const t = today();
      return ok(
        db.vendors
          .sort((a, b) => b.totalSpend - a.totalSpend)
          .map((v) => ({
            vendor: v.canonical,
            category: v.category,
            totalSpend: v.totalSpend,
            receipts: v.receipts,
            firstSeen: v.firstSeen,
            newVendor: daysBetween(v.firstSeen, t) <= 14 ? "NEW in the last 14 days" : undefined,
          })),
      );
    },
  );

  server.registerTool(
    "receipt_report",
    {
      title: "Receipt discrepancy report",
      description:
        "The 3-day style audit: receipts with OCR warnings, arithmetic that does not reconcile (subtotal + GST ≠ total), future/stale dates, and missing job attribution on job-sized spends. Clean receipts are counted, dirty ones are itemized.",
      inputSchema: { days: z.number().int().positive().max(90).optional() },
    },
    async ({ days }) => {
      const db = loadDb();
      const cutoff = Date.now() - (days ?? 3) * 86_400_000;
      const recent = db.receipts.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
      const issues = recent.flatMap((r) => {
        const found: string[] = [];
        if (Math.abs(r.amountBeforeTax + r.gst - r.total) > 0.02) found.push("subtotal + GST ≠ total");
        if (r.date > today()) found.push("future-dated");
        if (r.ocr.warnings.length) found.push(...r.ocr.warnings);
        if (!r.jobId && r.total >= 500) found.push("no job attribution on a $500+ spend");
        return found.length ? [{ id: r.id, vendor: r.vendor, total: r.total, issues: found }] : [];
      });
      return ok({
        window: `${days ?? 3} days`,
        receiptsReviewed: recent.length,
        clean: recent.length - issues.length,
        flagged: issues,
      });
    },
  );

  server.registerTool(
    "invoice_remind",
    {
      title: "Chase receivables",
      description:
        "Draft polite-but-firm reminder messages for every unpaid invoice, escalating tone with age (gentle < 7 days, direct 7–20, final notice 21+). Brand voice: no exclamation points, abrasive blasting not sandblasting.",
      inputSchema: { invoiceId: z.string().optional().describe("One invoice, or omit for all outstanding") },
    },
    async ({ invoiceId }) => {
      return ok(
        withDb((db) => {
          const targets = db.invoices.filter(
            (i) => (i.status === "Sent" || i.status === "Overdue") && (invoiceId ? i.id === invoiceId : true),
          );
          const t = today();
          const reminders = targets.map((i) => {
            const customer = db.customers.find((c) => c.id === i.customerId);
            const age = daysBetween(i.createdAt.slice(0, 10), t);
            if (age >= 21 && i.status !== "Overdue") i.status = "Overdue";
            const tone = age < 7 ? "gentle" : age < 21 ? "direct" : "final-notice";
            const message =
              tone === "gentle"
                ? `Hi ${customer?.name ?? "there"}, a friendly note that invoice ${i.id} (${money(i.balanceDue)} balance) is on file from our recent abrasive blasting work. E-transfer or on-chain payment details are on the invoice. Thank you.`
                : tone === "direct"
                  ? `Hi ${customer?.name ?? "there"}, invoice ${i.id} for ${money(i.balanceDue)} is now ${age} days outstanding. Please arrange payment this week, or let us know if anything on the invoice needs clarifying.`
                  : `Hi ${customer?.name ?? "there"}, this is a final notice for invoice ${i.id} (${money(i.balanceDue)}, ${age} days outstanding). Please settle within 5 business days to avoid collection steps. We would rather resolve this together.`;
            logActivity(db, "receivables", `Reminder drafted (${tone}) for ${i.id}.`);
            return { invoiceId: i.id, customer: customer?.name, ageDays: age, tone, message, draftedAt: nowIso() };
          });
          return { reminders, note: "Drafts only — send through your own channel. Money actions stay human." };
        }),
      );
    },
  );
}
