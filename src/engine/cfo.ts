/**
 * Evolved — the agentic CFO.
 *
 * Deterministic 12-month scenario simulator grounded in the company's real
 * cost model and current books: add a truck, change rates, or shock demand,
 * and see monthly cash, cumulative position, utilization, and the
 * break-even month. Assumptions are explicit in the output — a CFO that
 * shows its work.
 */

import type { Database } from "../types.js";
import { round2 } from "../store.js";
import { COST_MODEL } from "./pricing.js";

export interface ScenarioInput {
  scenario: "baseline" | "add-truck" | "rate-change" | "demand-shock";
  truckCapexCad?: number; // add-truck
  truckMonthlyFixedCad?: number; // insurance, financing, maintenance
  extraCrew?: number; // hires that come with the truck
  ratePct?: number; // rate-change: +10 → +10% on all quoted rates
  demandPct?: number; // demand-shock: -20 → 20% fewer jobs
}

export interface MonthRow {
  month: number;
  revenue: number;
  costs: number;
  net: number;
  cumulative: number;
  utilizationPct: number;
}

export interface CfoForecast {
  scenario: string;
  assumptions: string[];
  months: MonthRow[];
  breakEvenMonth: number | null;
  endingCash: number;
  verdict: string;
}

/** Baseline monthly figures derived from the books (with floors so a thin demo ledger still simulates sensibly). */
export function baselineFromBooks(db: Database): {
  monthlyRevenue: number;
  monthlyCosts: number;
  jobsPerMonth: number;
} {
  const paid = db.invoices.filter((i) => i.status === "Paid");
  const jobsWithActuals = db.jobs.filter((j) => j.actuals);
  const avgJobRevenue =
    jobsWithActuals.length > 0
      ? jobsWithActuals.reduce((s, j) => s + j.actuals!.revenue, 0) / jobsWithActuals.length
      : 4200;
  const jobsPerMonth = Math.max(4, paid.length + jobsWithActuals.length);
  const monthlyRevenue = round2(jobsPerMonth * avgJobRevenue);
  // Cost model: direct costs ≈ 55% of revenue at observed margins + fixed overhead.
  const monthlyCosts = round2(monthlyRevenue * 0.55 + 3800);
  return { monthlyRevenue, monthlyCosts, jobsPerMonth };
}

export function runScenario(db: Database, input: ScenarioInput): CfoForecast {
  const base = baselineFromBooks(db);
  const assumptions: string[] = [
    `Baseline from books: ~${base.jobsPerMonth} jobs/month, $${base.monthlyRevenue.toFixed(0)}/month revenue, $${base.monthlyCosts.toFixed(0)}/month costs (direct ≈55% of revenue + $3,800 fixed).`,
    `Crew loaded rate $${COST_MODEL.crewRatePerHour}/hr, crew of ${COST_MODEL.crewSize}.`,
    "Seasonality: winter months (Nov–Mar) run at 55% capacity due to blast-day weather gating.",
  ];

  let capex = 0;
  let extraFixed = 0;
  let capacityFactor = 1;
  let rateFactor = 1;
  let demandFactor = 1;

  switch (input.scenario) {
    case "add-truck": {
      capex = input.truckCapexCad ?? 85_000;
      extraFixed = (input.truckMonthlyFixedCad ?? 2_400) + (input.extraCrew ?? 2) * COST_MODEL.crewRatePerHour * 160 * 0.35;
      capacityFactor = 2;
      assumptions.push(
        `Add-a-truck: $${capex.toLocaleString()} capex month 1, $${round2(extraFixed).toLocaleString()}/month added fixed cost, capacity ×2, second-truck utilization ramps 25% → 85% over 8 months.`,
      );
      break;
    }
    case "rate-change": {
      rateFactor = 1 + (input.ratePct ?? 10) / 100;
      demandFactor = 1 - Math.max(0, (input.ratePct ?? 10)) / 100 * 0.35;
      assumptions.push(
        `Rate change ${input.ratePct ?? 10 > 0 ? "+" : ""}${input.ratePct ?? 10}%: price elasticity assumed −0.35 (a 10% raise loses ~3.5% of jobs).`,
      );
      break;
    }
    case "demand-shock": {
      demandFactor = 1 + (input.demandPct ?? -20) / 100;
      assumptions.push(`Demand shock: ${input.demandPct ?? -20}% job volume.`);
      break;
    }
    default:
      assumptions.push("Baseline: no changes — the control curve.");
  }

  const months: MonthRow[] = [];
  let cumulative = -capex;
  let breakEvenMonth: number | null = capex === 0 ? 0 : null;
  const startMonth = new Date().getMonth(); // 0-based

  for (let m = 1; m <= 12; m++) {
    const cal = (startMonth + m - 1) % 12; // 0 = Jan
    const winter = cal >= 10 || cal <= 2; // Nov–Mar
    const seasonal = winter ? 0.55 : 1;

    let rampUtil = 1;
    if (input.scenario === "add-truck") {
      const ramp = Math.min(0.85, 0.25 + (m - 1) * 0.075);
      rampUtil = (1 + ramp) / 2; // fleet-average utilization of doubled capacity
    }

    const utilization = seasonal * rampUtil;
    const revenue = round2(
      base.monthlyRevenue * capacityFactor * utilization * rateFactor * demandFactor,
    );
    const costs = round2(
      base.monthlyCosts * (0.45 + 0.55 * (revenue / Math.max(1, base.monthlyRevenue))) + extraFixed,
    );
    const net = round2(revenue - costs);
    cumulative = round2(cumulative + net);
    if (breakEvenMonth === null && cumulative >= 0) breakEvenMonth = m;
    months.push({
      month: m,
      revenue,
      costs,
      net,
      cumulative,
      utilizationPct: round2(utilization * 100),
    });
  }

  const endingCash = cumulative;
  const verdict =
    input.scenario === "add-truck"
      ? breakEvenMonth
        ? `Truck pays itself back in month ${breakEvenMonth} — ${breakEvenMonth <= 9 ? "workable if winter cash reserves cover the trough" : "long payback; consider used equipment or waiting for spring"}.`
        : "Truck does not break even within 12 months at current volumes — do not buy yet."
      : endingCash >= 0
        ? `Scenario ends the year ${endingCash >= 0 ? "+" : ""}$${endingCash.toLocaleString()} cumulative.`
        : `Scenario ends the year $${endingCash.toLocaleString()} under water — needs mitigation.`;

  return { scenario: input.scenario, assumptions, months, breakEvenMonth, endingCash, verdict };
}
