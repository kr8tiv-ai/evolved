/**
 * Evolved tools — the agentic CFO.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { baselineFromBooks, runScenario } from "../engine/cfo.js";
import { getForecast } from "../engine/weather.js";
import { addDays, daysBetween, loadDb, nowIso, round2, today } from "../store.js";
import type { PriceLogEntry } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerCfoTools(server: McpServer): void {
  server.registerTool(
    "cfo_forecast",
    {
      title: "CFO scenario simulator",
      description:
        "Answer the questions owners lose sleep over, with numbers: add a second truck (capex, added fixed cost, utilization ramp, break-even month), change rates (with price elasticity), or shock demand. 12-month monthly cash table grounded in the company's actual books and cost model, seasonality from the blast-day weather gates, and every assumption stated in the output.",
      inputSchema: {
        scenario: z.enum(["baseline", "add-truck", "rate-change", "demand-shock"]),
        truckCapexCad: z.number().positive().optional(),
        truckMonthlyFixedCad: z.number().positive().optional(),
        extraCrew: z.number().int().min(0).optional(),
        ratePct: z.number().optional().describe("rate-change: percent, e.g. 10 or -5"),
        demandPct: z.number().optional().describe("demand-shock: percent, e.g. -20"),
      },
      annotations: { readOnlyHint: true },
    },
    async (input) => {
      const db = loadDb();
      return ok(runScenario(db, input));
    },
  );

  server.registerTool(
    "cfo_health",
    {
      title: "Financial health check",
      description:
        "The CFO one-pager: receivables aging, customer concentration risk, monthly run-rate from the books, weather-capacity outlook (share of blastable days ahead), review reputation, and the three numbers to fix first.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const t = today();
      const base = baselineFromBooks(db);

      const outstanding = db.invoices.filter((i) => i.status === "Sent" || i.status === "Overdue");
      const aging = { current: 0, days7to20: 0, days21plus: 0 };
      for (const i of outstanding) {
        const age = daysBetween(i.createdAt.slice(0, 10), t);
        if (age < 7) aging.current = round2(aging.current + i.balanceDue);
        else if (age < 21) aging.days7to20 = round2(aging.days7to20 + i.balanceDue);
        else aging.days21plus = round2(aging.days21plus + i.balanceDue);
      }

      const revenueByCustomer = new Map<string, number>();
      for (const i of db.invoices.filter((x) => x.status === "Paid")) {
        revenueByCustomer.set(i.customerId, (revenueByCustomer.get(i.customerId) ?? 0) + i.total);
      }
      const totalRev = [...revenueByCustomer.values()].reduce((s, v) => s + v, 0);
      const top = [...revenueByCustomer.entries()].sort((a, b) => b[1] - a[1])[0];
      const concentrationPct = top && totalRev > 0 ? round2((top[1] / totalRev) * 100) : 0;

      const forecast = await getForecast(5);
      const blastable = forecast.days.filter((d) => d.verdict !== "No-go").length;

      const rated = db.reviews.filter((r) => r.rating);
      const avgRating = rated.length ? round2(rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) : null;

      const priorities: string[] = [];
      if (aging.days21plus > 0) priorities.push(`Collect $${aging.days21plus} that is 21+ days old — cash first.`);
      if (concentrationPct > 50) priorities.push(`Customer concentration at ${concentrationPct}% — one phone call could halve revenue; widen the funnel.`);
      const lowStock = db.inventory.filter((i) => i.onHand <= i.reorderAt).length;
      if (lowStock) priorities.push(`${lowStock} inventory item(s) at reorder point — do not lose a blast day to a missing bag of media.`);
      if (!priorities.length) priorities.push("Books are healthy — push sales while the weather holds.");

      return ok({
        runRate: base,
        receivablesAging: aging,
        customerConcentration: top
          ? { topCustomer: db.customers.find((c) => c.id === top[0])?.name, sharePct: concentrationPct }
          : null,
        weatherCapacity: { next5Days: `${blastable}/5 blastable`, source: forecast.source },
        reputation: { averageRating: avgRating, reviews: rated.length },
        fixFirst: priorities,
      });
    },
  );

  server.registerTool(
    "business_intelligence",
    {
      title: "Business intelligence — proactive insights",
      description:
        "Turns the books into decisions, not records. Computes: inventory low-stock + drawdown rate (how many days until each item hits its reorder point at current burn); spend by category with month-over-month trend and the biggest cost driver; RISING supplier prices from the materials price tracker (which materials are creeping up, and where a bulk buy locks the lower rate before the next big job); and job-margin anomalies below the healthy floor. Returns a ranked list of concrete recommendations up top. Read-only, computed live from the synthetic dataset.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const t = today();

      // ---- Inventory: low stock + drawdown rate (last 30 days of consumption) ----
      const lowStock = db.inventory
        .filter((i) => i.onHand <= i.reorderAt)
        .map((i) => ({
          item: i.name, onHand: i.onHand, unit: i.unit, reorderAt: i.reorderAt, par: i.parLevel,
          pctOfPar: i.parLevel ? Math.round((i.onHand / i.parLevel) * 100) : 0,
          reorderFrom: i.lastSupplier ?? "preferred supplier",
          lastUnitCost: i.lastUnitCost ?? null,
          action: "At or below reorder point — reorder now.",
        }));
      const cutoff = addDays(t, -30);
      const drawdown = db.inventory
        .map((i) => {
          const used = db.inventoryMovements
            .filter((m) => m.itemId === i.id && m.reason === "consumed" && m.at.slice(0, 10) >= cutoff)
            .reduce((s, m) => s + Math.abs(m.delta), 0);
          if (!used) return null;
          const perDay = round2(used / 30);
          const daysToReorder = perDay > 0 ? Math.max(0, Math.round((i.onHand - i.reorderAt) / perDay)) : null;
          return {
            item: i.name, onHand: i.onHand, unit: i.unit, usedLast30d: used, perDay,
            daysToReorderPoint: daysToReorder,
            note: daysToReorder != null && daysToReorder <= 14
              ? `Burning ~${perDay}/day — hits reorder in ~${daysToReorder} days.`
              : `~${daysToReorder ?? "?"} days of runway to reorder point.`,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)
        .sort((a, b) => (a.daysToReorderPoint ?? 9999) - (b.daysToReorderPoint ?? 9999));

      // ---- Spend: by category + month-over-month + top driver ----
      const byCat = new Map<string, number>();
      let total = 0;
      for (const r of db.receipts) { byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.total); total += r.total; }
      total = round2(total);
      const byCategory = [...byCat.entries()]
        .map(([category, amt]) => ({ category, total: round2(amt), pct: total ? round2((amt / total) * 100) : 0 }))
        .sort((a, b) => b.total - a.total);
      const byMonth = new Map<string, number>();
      for (const r of db.receipts) byMonth.set(r.date.slice(0, 7), (byMonth.get(r.date.slice(0, 7)) ?? 0) + r.total);
      const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
      const monthOverMonth = months.map(([month, amt], idx) => {
        const prev = idx > 0 ? months[idx - 1][1] : null;
        return { month, total: round2(amt), changePct: prev ? round2(((amt - prev) / prev) * 100) : null };
      });
      const latestMoM = monthOverMonth[monthOverMonth.length - 1];

      // ---- Rising prices + buying opportunities (materials price tracker) ----
      const byProduct = new Map<string, PriceLogEntry[]>();
      for (const e of db.priceLog) {
        const k = e.product.toLowerCase();
        if (!byProduct.has(k)) byProduct.set(k, []);
        byProduct.get(k)!.push(e);
      }
      const rising = [...byProduct.values()]
        .map((entries) => {
          const s = [...entries].sort((a, b) => a.date.localeCompare(b.date));
          const last = s[s.length - 1], prev = s.length > 1 ? s[s.length - 2] : null;
          if (!prev) return null;
          const changePct = round2(((last.unitPrice - prev.unitPrice) / prev.unitPrice) * 100);
          if (changePct < 3) return null;
          return {
            product: last.product, from: prev.unitPrice, to: last.unitPrice, unit: last.unitType,
            changePct, supplier: last.supplier,
            note: `Up ${changePct}% ($${prev.unitPrice} → $${last.unitPrice}/${last.unitType}) since ${prev.date}.`,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => b.changePct - a.changePct);
      const first = (name: string) => name.toLowerCase().split(/[\s\d]/)[0];
      const opportunities = rising.map((r) => {
        const item = db.inventory.find((i) => first(i.name) === first(r.product));
        const pct = item && item.parLevel ? Math.round((item.onHand / item.parLevel) * 100) : null;
        return `${r.product}: unit cost rising (+${r.changePct}%)${pct != null ? `, and you're at ${pct}% of par` : ""} — a bulk buy now locks the lower rate before the next big job and beats a rush-order premium.`;
      });

      // ---- Margins: anomalies below the healthy floor ----
      const jobs = db.jobs.filter((j) => j.actuals).map((j) => ({
        jobId: j.id, revenue: j.actuals!.revenue, cost: j.actuals!.totalCost,
        marginPct: j.actuals!.marginPct, verdict: j.actuals!.verdict,
      }));
      const avgMargin = jobs.length ? round2(jobs.reduce((s, m) => s + m.marginPct, 0) / jobs.length) : null;
      const anomalies = jobs.filter((m) => m.marginPct < 20).map((m) => `${m.jobId}: ${m.marginPct}% margin (${m.verdict}) — below the 20% healthy floor.`);

      // ---- Ranked, concrete recommendations ----
      const headline: string[] = [];
      if (rising.length) headline.push(`Lock in ${rising[0].product}: supplier price up ${rising[0].changePct}% — buy bulk before the next big job.`);
      if (lowStock.length) headline.push(`Reorder ${lowStock.map((l) => l.item).join(", ")} — at or below reorder point.`);
      if (latestMoM?.changePct != null && latestMoM.changePct > 25) {
        headline.push(`Spend up ${latestMoM.changePct}% MoM in ${latestMoM.month}, driven by ${byCategory[0].category} (${byCategory[0].pct}% of spend) — confirm it's a one-off job cost, not creep.`);
      }
      const drawSoon = drawdown.filter((d) => d.daysToReorderPoint != null && d.daysToReorderPoint <= 21);
      if (drawSoon.length) headline.push(`${drawSoon[0].item} burns ~${drawSoon[0].perDay}/day — hits reorder in ~${drawSoon[0].daysToReorderPoint} days.`);
      headline.push(...anomalies);
      if (!headline.length) headline.push("No red flags — inventory, spend, and margins are all in range.");

      return ok({
        generatedAt: nowIso(),
        headline,
        inventory: { lowStock, drawdown },
        spend: { total, byCategory, monthOverMonth, topDriver: byCategory[0] ?? null },
        prices: { rising, opportunities },
        margins: { jobs, average: avgMargin, anomalies },
      });
    },
  );
}
