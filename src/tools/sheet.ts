/**
 * Evolved tools — the ops-sheet engine.
 *
 * The data spine rendered as the operations workbook it mirrors in
 * production: every collection is a tab with headers and rows, the field
 * App Inbox is the append-only capture staging area, and the filing engine
 * routes inbox rows to the right book — the exact capture → inbox → file
 * discipline the live company runs on.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addDays, loadDb, logActivity, nowIso, shortId, today, withDb } from "../store.js";
import type { Database } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

type TabDef = {
  headers: string[];
  rows: (db: Database) => (string | number | null | undefined)[][];
};

const TABS: Record<string, TabDef> = {
  Leads: {
    headers: ["ID", "Stage", "Summary", "Source", "Next action", "Next action date"],
    rows: (db) => db.leads.map((l) => [l.id, l.stage, l.summary, l.source, l.nextAction, l.nextActionDate]),
  },
  Customers: {
    headers: ["ID", "Name", "Phone", "Address", "Notes"],
    rows: (db) => db.customers.map((c) => [c.id, c.name, c.phone, c.address, c.notes]),
  },
  Quotes: {
    headers: ["Quote no.", "Customer", "Site", "Sq ft", "Subtotal", "GST", "Total", "Deposit", "Status", "Valid until"],
    rows: (db) => db.quotes.map((q) => [
      q.id, db.customers.find((c) => c.id === q.customerId)?.name, q.siteAddress,
      q.sqftTotal, q.subtotal, q.gst, q.total, q.depositRequired, q.status, q.validUntil,
    ]),
  },
  Dispatch: {
    headers: ["Job ID", "Customer", "Address", "Date", "Crew", "Status", "Deposit paid"],
    rows: (db) => db.jobs.map((j) => [
      j.id, db.customers.find((c) => c.id === j.customerId)?.name, j.siteAddress,
      j.scheduledDate, j.crew.join(", "), j.status, j.depositPaid ? "Yes" : "No",
    ]),
  },
  Expenses: {
    headers: ["Receipt", "Date", "Vendor", "Category", "Subtotal", "GST", "Total", "Job", "OCR model"],
    rows: (db) => db.receipts.map((r) => [
      r.id, r.date, r.vendor, r.category, r.amountBeforeTax, r.gst, r.total, r.jobId, r.ocr.model,
    ]),
  },
  Invoices: {
    headers: ["Invoice", "Job", "Customer", "Total", "Deposit applied", "Balance due", "Status", "Due"],
    rows: (db) => db.invoices.map((i) => [
      i.id, i.jobId, db.customers.find((c) => c.id === i.customerId)?.name,
      i.total, i.depositApplied, i.balanceDue, i.status, i.dueDate,
    ]),
  },
  Inventory: {
    headers: ["ID", "Section", "Item", "On hand", "Unit", "Par", "Reorder at", "Last unit cost", "Last supplier"],
    rows: (db) => db.inventory.map((i) => [
      i.id, i.section, i.name, i.onHand, i.unit, i.parLevel, i.reorderAt, i.lastUnitCost, i.lastSupplier,
    ]),
  },
  "Price Log": {
    headers: ["Date", "Supplier", "Product", "Unit", "Qty", "Unit price", "Total paid"],
    rows: (db) => db.priceLog.map((p) => [p.date, p.supplier, p.product, p.unitType, p.qty, p.unitPrice, p.totalPaid]),
  },
  Suppliers: {
    headers: ["ID", "Name", "Location", "Phone", "Products"],
    rows: (db) => db.suppliers.map((s) => [s.id, s.name, s.location, s.phone, s.products]),
  },
  "To-Do": {
    headers: ["ID", "Task", "Category", "Priority", "Status", "Added", "Due"],
    rows: (db) => db.todos.map((t) => [t.id, t.task, t.category, t.priority, t.status, t.added, t.due]),
  },
  "Job P&L": {
    headers: ["Job", "Revenue", "Wages", "Materials", "Fuel", "Total cost", "Profit", "Margin %", "Verdict"],
    rows: (db) => db.jobs.filter((j) => j.actuals).map((j) => [
      j.id, j.actuals!.revenue, j.actuals!.wages, j.actuals!.materials, j.actuals!.fuel,
      j.actuals!.totalCost, j.actuals!.profit, j.actuals!.marginPct, j.actuals!.verdict,
    ]),
  },
  "Action Items": {
    headers: ["ID", "Severity", "Rule", "Message", "Raised", "Resolved"],
    rows: (db) => db.actionItems.map((a) => [a.id, a.severity, a.rule, a.message, a.raisedAt, a.resolvedAt]),
  },
  "App Inbox": {
    headers: ["ID", "At", "Captured by", "Category", "Summary", "Status", "Filed to"],
    rows: (db) => db.inbox.map((r) => [r.id, r.at, r.capturedBy, r.category, r.summary, r.status, r.filedTo]),
  },
  Payments: {
    headers: ["ID", "Invoice", "Network", "Amount (asset)", "Status", "Mode", "Tx hash"],
    rows: (db) => db.payments.map((p) => [p.id, p.invoiceId, p.network, `${p.amountAsset} ${p.asset.symbol}`, p.status, p.mode, p.txHash]),
  },
  Crew: {
    headers: ["ID", "Name", "Role", "Certifications", "Hourly", "Active"],
    rows: (db) => db.crew.map((m) => [m.id, m.name, m.role, m.certifications.join(", "), m.hourlyRate, m.active ? "Yes" : "No"]),
  },
  "Time Log": {
    headers: ["ID", "Crew", "Job", "In", "Out", "Hours", "Wage"],
    rows: (db) => db.timeEntries.map((t) => [t.id, t.crewName, t.jobId, t.inAt, t.outAt ?? "on the clock", t.hours, t.wage]),
  },
  "Job Photos": {
    headers: ["ID", "Job", "Kind", "Caption", "By", "At"],
    rows: (db) => db.photos.map((p) => [p.id, p.jobId, p.kind, p.caption, p.takenBy, p.at]),
  },
  "Field Notes": {
    headers: ["ID", "Job", "Note", "By", "Source", "At"],
    rows: (db) => db.fieldNotes.map((n) => [n.id, n.jobId, n.text, n.by, n.source, n.at]),
  },
  "Safety (FLHA)": {
    headers: ["ID", "Job", "Date", "Crew", "Hazards", "Signed off"],
    rows: (db) => db.flhas.map((f) => [f.id, f.jobId, f.date, f.crew.join(", "), f.hazards.map((h) => h.hazard).join("; "), f.signoff ? "Yes" : "No"]),
  },
  "Hazard Reports": {
    headers: ["ID", "Job", "Reported by", "What", "Severity", "Status", "At"],
    rows: (db) => db.hazardReports.map((h) => [h.id, h.jobId, h.reportedBy, h.what, h.severity, h.clearedAt ? "cleared" : h.acknowledgedAt ? "acknowledged" : "open", h.at]),
  },
  Reviews: {
    headers: ["ID", "Job", "Customer", "Status", "Rating", "Comment"],
    rows: (db) => db.reviews.map((r) => [r.id, r.jobId, db.customers.find((c) => c.id === r.customerId)?.name, r.status, r.rating, r.comment]),
  },
  Vendors: {
    headers: ["Canonical", "Category", "First seen", "Total spend", "Receipts"],
    rows: (db) => db.vendors.map((v) => [v.canonical, v.category, v.firstSeen, v.totalSpend, v.receipts]),
  },
  Maintenance: {
    headers: ["Date", "Equipment", "Service", "Hours/Odometer", "Next due", "Remind from", "Notes"],
    rows: (db) => db.maintenance.map((m) => [m.date, m.equipment, m.service, m.usage, m.nextDue, m.remindFrom, m.notes]),
  },
  "Rate Table": {
    headers: ["Depth", "Label", "Base $/sqft", "Learned $/sqft", "Samples"],
    rows: (db) => db.rateTable.map((r) => [r.depth, r.label, r.baseRate, r.learnedRate, r.samples]),
  },
};

export function registerSheetTools(server: McpServer): void {
  server.registerTool(
    "sheet_tabs",
    {
      title: "List workbook tabs",
      description:
        "The data spine as an operations workbook: every tab with its row count. This is the system of record — every tool writes through it.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      return ok(Object.entries(TABS).map(([name, def]) => ({ tab: name, rows: def.rows(db).length })));
    },
  );

  server.registerTool(
    "sheet_read",
    {
      title: "Read a workbook tab",
      description: "Read any tab as headers + rows (display values), like the production router's readTab.",
      inputSchema: {
        tab: z.string(),
        maxRows: z.number().int().positive().max(500).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ tab, maxRows }) => {
      const db = loadDb();
      const def = TABS[tab] ?? TABS[Object.keys(TABS).find((k) => k.toLowerCase() === tab.toLowerCase()) ?? ""];
      if (!def) throw new Error(`Unknown tab "${tab}". Tabs: ${Object.keys(TABS).join(", ")}`);
      const rows = def.rows(db).slice(0, maxRows ?? 200);
      return ok({ tab, headers: def.headers, rows, totalRows: def.rows(db).length });
    },
  );

  server.registerTool(
    "sheet_append_todo",
    {
      title: "Append to the To-Do tab",
      description: "Append-only write to the To-Do tab (the workbook discipline: insert, never overwrite).",
      inputSchema: {
        task: z.string(),
        category: z.string().optional(),
        priority: z.enum(["low", "normal", "high"]).optional(),
        due: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const todo = {
            id: shortId("TODO"), task: input.task, category: input.category ?? "General",
            priority: input.priority ?? "normal", status: "Open" as const,
            added: today(), due: input.due,
          };
          db.todos.push(todo);
          logActivity(db, "sheet", `To-Do appended: ${input.task}`);
          return { todo };
        }),
      );
    },
  );

  server.registerTool(
    "inbox_submit",
    {
      title: "Field capture → App Inbox",
      description:
        "The crew-facing capture path: anything from the field lands as exactly one append-only inbox row (lead, receipt note, job photo note, supplier, todo, quick thought). Nothing touches the books directly — the filing engine routes it.",
      inputSchema: {
        capturedBy: z.string(),
        category: z.enum(["lead", "receipt", "todo", "supplier", "quick", "job_note"]),
        summary: z.string(),
        fields: z.record(z.string(), z.string()).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const row = {
            id: shortId("INBX"), at: nowIso(), capturedBy: input.capturedBy,
            category: input.category, summary: input.summary,
            fields: input.fields ?? {}, status: "NEW" as const,
          };
          db.inbox.push(row);
          logActivity(db, "inbox", `Captured (${input.category}): ${input.summary}`);
          return { row, note: "Run inbox_file to route NEW rows into the books." };
        }),
      );
    },
  );

  server.registerTool(
    "inbox_list",
    {
      title: "App Inbox queue",
      description: "Inbox rows by status — NEW rows await filing; NEEDS REVIEW rows want a human or smarter judgment.",
      inputSchema: { status: z.enum(["NEW", "FILED", "NEEDS REVIEW"]).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ status }) => {
      const db = loadDb();
      return ok(db.inbox.filter((r) => (status ? r.status === status : true)));
    },
  );

  server.registerTool(
    "inbox_file",
    {
      title: "Run the filing engine",
      description:
        "Deterministically route NEW inbox rows to the right book: lead → Leads (+customer), todo → To-Do, supplier → Suppliers, receipt → the OCR expense pipeline, quick → keyword-sniffed or NEEDS REVIEW. Append-only, idempotent per row, exactly like the production autopilot.",
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      const { runOcrPipeline } = await import("../engine/ocr.js");
      const { upsertVendor } = await import("./accounting.js");
      const { persist } = await import("../store.js");
      const results: { id: string; filedTo?: string; status: string }[] = [];
      const db = loadDb();
      // Snapshot the NEW rows up front so rows added mid-run are untouched.
      const queue = db.inbox.filter((r) => r.status === "NEW");
      for (const row of queue) {
        if (row.status !== "NEW") continue; // claimed by a concurrent run
        let filedTo: string | undefined;
        const f = row.fields;
        // Lead and todo keywords outrank the receipt heuristic, and a
        // receipt needs a money signal stronger than a lone "$".
        const cat = row.category === "quick"
          ? (/\bcall|quote|lead|wants|asked\b/i.test(row.summary) ? "lead"
            : /\btodo|remind|fix|order\b/i.test(row.summary) ? "todo"
            : /\breceipt\b|\$\s?\d|\btotal\b[^a-z]*\d/i.test(row.summary) ? "receipt"
            : "review")
          : row.category;

        if (cat === "lead") {
          let customer = db.customers.find((c) => f.phone && c.phone === f.phone);
          if (!customer) {
            customer = { id: shortId("CUST"), name: f.name ?? `Lead via field capture (${row.capturedBy})`, phone: f.phone, address: f.where ?? f.address, createdAt: nowIso() };
            db.customers.push(customer);
          }
          const lead = {
            id: shortId("LEAD"), customerId: customer.id, source: `Field capture (${row.capturedBy})`,
            stage: "New" as const, summary: row.summary,
            nextAction: "Call back", nextActionDate: addDays(today(), 1),
            createdAt: nowIso(), updatedAt: nowIso(),
          };
          db.leads.push(lead);
          filedTo = `Leads!${lead.id}`;
        } else if (cat === "todo") {
          const todo = { id: shortId("TODO"), task: row.summary, category: "Field", priority: "normal" as const, status: "Open" as const, added: today() };
          db.todos.push(todo);
          filedTo = `To-Do!${todo.id}`;
        } else if (cat === "supplier") {
          const supplier = { id: shortId("SUP"), name: f.name ?? row.summary, phone: f.phone, products: f.products, createdAt: nowIso() };
          db.suppliers.push(supplier);
          filedTo = `Suppliers!${supplier.id}`;
        } else if (cat === "receipt") {
          const text = f.text ?? row.summary;
          const parsed = await runOcrPipeline(text);
          if (parsed.confidence < 0.8) {
            // Low-confidence extraction never posts to the books.
            filedTo = undefined;
          } else {
            const dup = db.receipts.find(
              (r) =>
                r.vendor.toLowerCase() === parsed.vendor.toLowerCase() &&
                Math.abs(r.total - parsed.total) <= 0.5 &&
                Math.abs(new Date(r.date).getTime() - new Date(parsed.date).getTime()) <= 2 * 86_400_000,
            );
            if (dup) {
              filedTo = `Expenses!${dup.id} (duplicate — not re-posted)`;
            } else {
              const receipt = {
                id: shortId("RCPT"), vendor: parsed.vendor, date: parsed.date,
                amountBeforeTax: parsed.amountBeforeTax, gst: parsed.gst, total: parsed.total,
                category: parsed.category, paymentMethod: parsed.paymentMethod,
                jobId: f.jobId, lineItems: parsed.lineItems,
                ocr: { model: parsed.model, escalated: parsed.escalated, confidence: parsed.confidence, warnings: parsed.warnings },
                createdAt: nowIso(),
              };
              db.receipts.push(receipt);
              upsertVendor(db, receipt);
              filedTo = `Expenses!${receipt.id}`;
            }
          }
        }

        if (filedTo) {
          row.status = "FILED";
          row.filedTo = filedTo;
          results.push({ id: row.id, filedTo, status: "FILED" });
        } else {
          row.status = "NEEDS REVIEW";
          results.push({ id: row.id, status: "NEEDS REVIEW" });
        }
        logActivity(db, "filing", `Inbox ${row.id} → ${filedTo ?? "NEEDS REVIEW"}`);
        persist(); // per-row write-through so a mid-loop failure loses nothing
      }
      return ok({ processed: results, remaining: db.inbox.filter((r) => r.status === "NEW").length });
    },
  );
}
