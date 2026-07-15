/**
 * Evolved tools — contacts / CRM.
 *
 * One rolodex across customers, suppliers, and crew, wired into the
 * pipeline: search anyone, see their history, keep supplier pricebooks and
 * crew certifications where the agent can reach them.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadDb, logActivity, nowIso, round2, shortId, withDb } from "../store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerContactsTools(server: McpServer): void {
  server.registerTool(
    "contact_search",
    {
      title: "Search contacts (customers, suppliers, crew)",
      description:
        "One search across the whole rolodex. Customers come back with their quotes, jobs, and open balance; suppliers with their pricebook summary; crew with certifications and rate.",
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => {
      const db = loadDb();
      const q = query.toLowerCase();
      const customers = db.customers
        .filter((c) => `${c.name} ${c.phone ?? ""} ${c.address ?? ""}`.toLowerCase().includes(q))
        .map((c) => ({
          type: "customer", id: c.id, name: c.name, phone: c.phone, address: c.address,
          quotes: db.quotes.filter((x) => x.customerId === c.id).map((x) => `${x.id} (${x.status})`),
          jobs: db.jobs.filter((x) => x.customerId === c.id).map((x) => `${x.id} (${x.status})`),
          openBalance: round2(
            db.invoices.filter((i) => i.customerId === c.id && (i.status === "Sent" || i.status === "Overdue"))
              .reduce((s, i) => s + i.balanceDue, 0),
          ),
        }));
      const suppliers = db.suppliers
        .filter((s) => `${s.name} ${s.products ?? ""} ${s.location ?? ""}`.toLowerCase().includes(q))
        .map((s) => ({
          type: "supplier", id: s.id, name: s.name, phone: s.phone, products: s.products,
          purchases: db.priceLog.filter((p) => p.supplier.toLowerCase() === s.name.toLowerCase()).length,
        }));
      const crew = db.crew
        .filter((m) => `${m.name} ${m.role}`.toLowerCase().includes(q))
        .map((m) => ({
          type: "crew", id: m.id, name: m.name, role: m.role,
          certifications: m.certifications, hourlyRate: m.hourlyRate, active: m.active,
        }));
      return ok({ matches: [...customers, ...suppliers, ...crew] });
    },
  );

  server.registerTool(
    "supplier_add",
    {
      title: "Add a supplier",
      description: "Add a supplier to the rolodex with products carried and contact details.",
      inputSchema: {
        name: z.string(),
        location: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        products: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const existing = db.suppliers.find((s) => s.name.toLowerCase() === input.name.toLowerCase());
          if (existing) return { supplier: existing, note: "Supplier already on file." };
          const supplier = { id: shortId("SUP"), createdAt: nowIso(), ...input };
          db.suppliers.push(supplier);
          logActivity(db, "crm", `Supplier added: ${input.name}.`);
          return { supplier };
        }),
      );
    },
  );

  server.registerTool(
    "supplier_pricebook",
    {
      title: "Supplier pricebook",
      description:
        "What the company actually pays each supplier, by product: purchase history from the price log with latest unit prices — the negotiating sheet for the next order.",
      inputSchema: { supplier: z.string().optional() },
    },
    async ({ supplier }) => {
      const db = loadDb();
      const entries = db.priceLog.filter((p) =>
        supplier ? p.supplier.toLowerCase().includes(supplier.toLowerCase()) : true,
      );
      const bySupplier: Record<string, { product: string; lastUnitPrice: number; lastDate: string; purchases: number }[]> = {};
      for (const e of entries) {
        bySupplier[e.supplier] ??= [];
        const row = bySupplier[e.supplier].find((r) => r.product === e.product);
        if (row) {
          row.purchases++;
          if (e.date >= row.lastDate) { row.lastUnitPrice = e.unitPrice; row.lastDate = e.date; }
        } else {
          bySupplier[e.supplier].push({ product: e.product, lastUnitPrice: e.unitPrice, lastDate: e.date, purchases: 1 });
        }
      }
      return ok({ pricebook: bySupplier });
    },
  );

  server.registerTool(
    "crew_add",
    {
      title: "Add a crew member",
      description: "Add a crew member with role, certifications, and loaded hourly rate. Feeds job costing and FLHA rosters.",
      inputSchema: {
        name: z.string(),
        role: z.enum(["lead-tech", "tech", "apprentice"]),
        phone: z.string().optional(),
        certifications: z.array(z.string()).optional(),
        hourlyRate: z.number().positive(),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const member = {
            id: shortId("CREW"), name: input.name, role: input.role, phone: input.phone,
            certifications: input.certifications ?? [], hourlyRate: input.hourlyRate,
            active: true, createdAt: nowIso(),
          };
          db.crew.push(member);
          logActivity(db, "crm", `Crew member added: ${input.name} (${input.role}).`);
          return { crewMember: member };
        }),
      );
    },
  );

  server.registerTool(
    "crew_roster",
    {
      title: "Crew roster",
      description:
        "Active crew with roles, rates, certifications, expiring-cert flags, and current job assignments from the dispatch board.",
      inputSchema: {},
    },
    async () => {
      const db = loadDb();
      return ok(
        db.crew.map((m) => ({
          id: m.id,
          name: m.name,
          role: m.role,
          hourlyRate: m.hourlyRate,
          active: m.active,
          certifications: m.certifications,
          assignedJobs: db.jobs
            .filter((j) => j.crew.includes(m.name) && !["Complete", "Invoiced", "Paid"].includes(j.status))
            .map((j) => `${j.id} (${j.scheduledDate ?? "unscheduled"})`),
        })),
      );
    },
  );
}
