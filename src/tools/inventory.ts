/**
 * Evolved tools — inventory control.
 *
 * Media, consumables, PPE, and equipment: live stock levels, par/reorder
 * thresholds, receiving tied to receipts and the price log, per-job
 * burn-down, and auto-reorder suggestions priced from what the company
 * actually paid last time.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadDb, logActivity, nowIso, round2, shortId, today, withDb } from "../store.js";
import type { InventoryItem } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function findItem(items: InventoryItem[], query: string): InventoryItem | undefined {
  const q = query.toLowerCase().trim();
  return (
    items.find((i) => i.id.toLowerCase() === q) ??
    items.find((i) => i.name.toLowerCase() === q) ??
    items.find((i) => i.name.toLowerCase().includes(q)) ??
    items.find((i) => q.includes(i.name.toLowerCase().split(" ")[0]))
  );
}

export function registerInventoryTools(server: McpServer): void {
  server.registerTool(
    "inventory_status",
    {
      title: "Inventory status",
      description:
        "Stock levels across all three sections (Materials & Media, Consumables & PPE, Equipment & General) with par levels, reorder thresholds, low-stock flags, and last-paid pricing. The count that used to live on a clipboard.",
      inputSchema: {
        section: z.enum(["Materials & Media", "Consumables & PPE", "Equipment & General"]).optional(),
        lowStockOnly: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ section, lowStockOnly }) => {
      const db = loadDb();
      const rows = db.inventory
        .filter((i) => (section ? i.section === section : true))
        .filter((i) => (lowStockOnly ? i.onHand <= i.reorderAt : true))
        .map((i) => ({
          id: i.id,
          section: i.section,
          name: i.name,
          onHand: `${i.onHand} × ${i.unit}`,
          parLevel: i.parLevel,
          reorderAt: i.reorderAt,
          status: i.onHand <= i.reorderAt ? "REORDER" : i.onHand < i.parLevel ? "below par" : "ok",
          lastUnitCost: i.lastUnitCost,
          lastSupplier: i.lastSupplier,
        }));
      return ok({
        items: rows,
        lowStockCount: db.inventory.filter((i) => i.onHand <= i.reorderAt).length,
      });
    },
  );

  server.registerTool(
    "inventory_receive",
    {
      title: "Receive inventory",
      description:
        "Book received stock: bumps on-hand, records the movement, updates last-paid cost/supplier, and appends to the price log (so the price-watch and reorder engines learn real COD pricing). Link the receipt id when it came through the receipt pipeline.",
      inputSchema: {
        item: z.string().describe("Item id or name (fuzzy match ok)"),
        qty: z.number().positive(),
        unitCost: z.number().positive().optional(),
        supplier: z.string().optional(),
        receiptId: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const item = findItem(db.inventory, input.item);
          if (!item) throw new Error(`Unknown inventory item "${input.item}". Use inventory_status to list items.`);
          item.onHand = round2(item.onHand + input.qty);
          if (input.unitCost) item.lastUnitCost = input.unitCost;
          if (input.supplier) item.lastSupplier = input.supplier;
          item.lastPurchasedAt = today();
          db.inventoryMovements.push({
            id: shortId("MOV"), itemId: item.id, delta: input.qty, reason: "received",
            receiptId: input.receiptId, unitCost: input.unitCost, at: nowIso(),
          });
          if (input.unitCost) {
            db.priceLog.push({
              id: shortId("PL"), date: today(), supplier: input.supplier ?? item.lastSupplier ?? "unknown",
              product: item.name, itemId: item.id, unitType: item.unit, qty: input.qty,
              unitPrice: input.unitCost, totalPaid: round2(input.qty * input.unitCost),
              receiptId: input.receiptId,
            });
          }
          logActivity(db, "inventory", `Received ${input.qty} × ${item.unit} of ${item.name}.`);
          return { item, note: input.unitCost ? "Price log updated — price watch is tracking this." : "No unit cost supplied — price log unchanged." };
        }),
      );
    },
  );

  server.registerTool(
    "inventory_consume",
    {
      title: "Consume inventory (job burn-down)",
      description:
        "Log media/consumable usage against a job. Decrements stock, records the burn-down movement (fuel for per-job P&L and reorder forecasting), and warns the moment an item crosses its reorder threshold.",
      inputSchema: {
        item: z.string().describe("Item id or name (fuzzy match ok)"),
        qty: z.number().positive(),
        jobId: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const item = findItem(db.inventory, input.item);
          if (!item) throw new Error(`Unknown inventory item "${input.item}".`);
          if (input.qty > item.onHand) {
            return {
              consumed: false,
              warning: `Only ${item.onHand} × ${item.unit} of ${item.name} on hand — cannot consume ${input.qty}. Correct the count with inventory_receive or reduce the quantity.`,
            };
          }
          item.onHand = round2(item.onHand - input.qty);
          db.inventoryMovements.push({
            id: shortId("MOV"), itemId: item.id, delta: -input.qty, reason: "consumed",
            jobId: input.jobId, at: nowIso(),
          });
          logActivity(db, "inventory", `Consumed ${input.qty} × ${item.unit} of ${item.name}${input.jobId ? ` on ${input.jobId}` : ""}.`);
          const warnings: string[] = [];
          if (item.onHand <= item.reorderAt) {
            warnings.push(`${item.name} is at ${item.onHand} (reorder point ${item.reorderAt}) — run inventory_reorder_suggestions.`);
          }
          return { consumed: true, item, warnings };
        }),
      );
    },
  );

  server.registerTool(
    "inventory_reorder_suggestions",
    {
      title: "Auto-reorder suggestions",
      description:
        "Everything at or below its reorder point, with suggested order quantity (back to par), preferred supplier, last-paid unit price, estimated cost, and recent burn rate so nothing runs out mid-job.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const now = Date.now();
      const suggestions = db.inventory
        .filter((i) => i.onHand <= i.reorderAt)
        .map((i) => {
          const supplier = db.suppliers.find((s) => s.id === i.preferredSupplierId);
          const burn30 = db.inventoryMovements
            .filter((m) => m.itemId === i.id && m.reason === "consumed" && now - new Date(m.at).getTime() < 30 * 86_400_000)
            .reduce((s, m) => s + Math.abs(m.delta), 0);
          const orderQty = Math.max(i.parLevel - i.onHand, 1);
          return {
            item: i.name,
            onHand: i.onHand,
            parLevel: i.parLevel,
            orderQty,
            supplier: supplier?.name ?? i.lastSupplier ?? "no preferred supplier",
            supplierPhone: supplier?.phone,
            lastUnitPrice: i.lastUnitCost,
            estimatedCost: i.lastUnitCost ? round2(orderQty * i.lastUnitCost) : null,
            burnLast30Days: burn30,
            daysOfStockLeft: burn30 > 0 ? Math.round((i.onHand / burn30) * 30) : null,
          };
        });
      return ok({
        suggestions,
        totalEstimatedCost: round2(suggestions.reduce((s, x) => s + (x.estimatedCost ?? 0), 0)),
        note: suggestions.length ? "Prices are the company's actual last-paid COD prices from the price log." : "Nothing at reorder point — stock is healthy.",
      });
    },
  );

  server.registerTool(
    "price_watch",
    {
      title: "Price watch",
      description:
        "Supplier price history per product from real purchases: last price vs previous, percent change, and spike flags (≥10% increase). Catches supplier creep before it eats the margin.",
      inputSchema: { product: z.string().optional().describe("Filter to one product (fuzzy)") },
      annotations: { readOnlyHint: true },
    },
    async ({ product }) => {
      const db = loadDb();
      const byProduct = new Map<string, typeof db.priceLog>();
      for (const e of db.priceLog) {
        const key = e.product.toLowerCase();
        if (product && !key.includes(product.toLowerCase())) continue;
        if (!byProduct.has(key)) byProduct.set(key, []);
        byProduct.get(key)!.push(e);
      }
      const watch = [...byProduct.entries()].map(([, entries]) => {
        const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];
        const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
        const changePct = prev ? round2(((latest.unitPrice - prev.unitPrice) / prev.unitPrice) * 100) : null;
        return {
          product: latest.product,
          lastPaid: latest.unitPrice,
          lastSupplier: latest.supplier,
          lastDate: latest.date,
          previousPaid: prev?.unitPrice ?? null,
          changePct,
          spike: changePct != null && changePct >= 10 ? `PRICE SPIKE +${changePct}% — shop it around or negotiate` : null,
          purchases: sorted.length,
        };
      });
      return ok({ watch, spikes: watch.filter((w) => w.spike).length });
    },
  );
}
