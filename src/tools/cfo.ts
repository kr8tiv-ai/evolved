/**
 * Evolved tools — the agentic CFO.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { baselineFromBooks, runScenario } from "../engine/cfo.js";
import { getForecast } from "../engine/weather.js";
import { daysBetween, loadDb, round2, today } from "../store.js";

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
}
