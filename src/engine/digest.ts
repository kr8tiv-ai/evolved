/**
 * Evolved — the morning digest.
 *
 * One email's worth of everything the owner needs at 6:30 AM: today's jobs,
 * the one thing not to drop, money pulse, quotes out, leads needing a touch,
 * blast-day weather verdicts, and system health. Composed from the books —
 * no hand-curation.
 */

import type { Database } from "../types.js";
import { daysBetween, money, round2, today } from "../store.js";
import { scanForActionItems } from "./actions.js";
import { getForecast } from "./weather.js";

export interface MorningDigest {
  date: string;
  oneThingNotToDrop: string;
  todaysJobs: string[];
  moneyPulse: {
    monthRevenue: number;
    monthExpenses: number;
    monthProfit: number;
    outstandingInvoices: number;
    outstandingTotal: number;
  };
  quotesOut: string[];
  leadsPulse: string[];
  topTodos: string[];
  /** Deposits gating work: money in but unscheduled, and accepted work awaiting a deposit. */
  depositsAwaiting: string[];
  /** Jobs scheduled in the next few days (beyond today). */
  upcomingSchedule: string[];
  /** Inventory at or below its reorder point — reorder before the next job. */
  lowInventory: string[];
  actionItems: string[];
  weather: { source: string; lines: string[] };
  systemHealth: string;
}

export async function buildMorningDigest(db: Database): Promise<MorningDigest> {
  const t = today();
  const month = t.slice(0, 7);

  // Auto-raise before composing, so the digest reflects a fresh scan.
  scanForActionItems(db);

  const todaysJobs = db.jobs
    .filter((j) => j.scheduledDate === t && j.status !== "Complete" && j.status !== "Paid")
    .map((j) => {
      const c = db.customers.find((x) => x.id === j.customerId);
      return `${j.id} — ${c?.name ?? "?"} at ${j.siteAddress} (${j.scope}) — crew: ${j.crew.join(", ") || "unassigned"}`;
    });

  const monthReceipts = db.receipts.filter((r) => r.date.startsWith(month));
  const monthExpenses = round2(monthReceipts.reduce((s, r) => s + r.total, 0));
  const paidInvoices = db.invoices.filter(
    (i) => i.status === "Paid" && i.createdAt.startsWith(month),
  );
  const monthRevenue = round2(paidInvoices.reduce((s, i) => s + i.total, 0));
  const outstanding = db.invoices.filter((i) => i.status === "Sent" || i.status === "Overdue");

  const quotesOut = db.quotes
    .filter((q) => q.status === "Sent")
    .map((q) => {
      const c = db.customers.find((x) => x.id === q.customerId);
      const age = daysBetween(q.updatedAt.slice(0, 10), t);
      return `${q.id} — ${c?.name ?? "?"} — ${money(q.total)} — out ${age} day${age === 1 ? "" : "s"}`;
    });

  const leadsPulse = db.leads
    .filter((l) => l.stage !== "Won" && l.stage !== "Lost")
    .map((l) => `${l.stage}: ${l.summary} → next: ${l.nextAction} (${l.nextActionDate})`);

  const openActions = db.actionItems
    .filter((a) => !a.resolvedAt)
    .sort((a, b) => (a.severity === "urgent" ? -1 : b.severity === "urgent" ? 1 : 0));

  // Top open to-dos: due/high first, capped — the real digest surfaces these
  // alongside dispatch, leads, and quotes.
  const prio = (p: string) => (p === "high" ? 0 : p === "normal" ? 1 : 2);
  const topTodos = db.todos
    .filter((td) => td.status !== "Done")
    .sort((a, b) => prio(a.priority) - prio(b.priority) || (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 5)
    .map((td) => `${td.task}${td.due ? ` (due ${td.due})` : ""}${td.priority === "high" ? " — HIGH" : ""}`);

  // Deposits gating work: money in but the job isn't booked, and accepted work
  // still waiting on the deposit that funds mobilization.
  const depositsAwaiting: string[] = [];
  for (const j of db.jobs) {
    if (j.depositPaid && !j.scheduledDate && !["Complete", "Invoiced", "Paid"].includes(j.status)) {
      const c = db.customers.find((x) => x.id === j.customerId);
      depositsAwaiting.push(`${j.id} — ${c?.name ?? "?"}: deposit IN but not scheduled — book it`);
    }
  }
  for (const q of db.quotes.filter((x) => x.status === "Accepted")) {
    const hasJob = db.jobs.some((j) => j.quoteId === q.id && j.depositPaid);
    if (!hasJob) {
      const c = db.customers.find((x) => x.id === q.customerId);
      depositsAwaiting.push(`${q.id} — ${c?.name ?? "?"}: accepted, awaiting ${money(q.depositRequired)} deposit to mobilize`);
    }
  }

  // Next few days of scheduled work (beyond today).
  const upcomingSchedule = db.jobs
    .filter((j) => j.scheduledDate && j.scheduledDate > t && daysBetween(t, j.scheduledDate) <= 4 && !["Complete", "Paid"].includes(j.status))
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))
    .map((j) => {
      const c = db.customers.find((x) => x.id === j.customerId);
      return `${j.scheduledDate}: ${j.id} — ${c?.name ?? "?"} (${j.scope}) — crew: ${j.crew.join(", ") || "UNASSIGNED"}`;
    });

  // Inventory at or below its reorder point.
  const lowInventory = db.inventory
    .filter((i) => i.onHand <= i.reorderAt)
    .map((i) => {
      const pct = i.parLevel > 0 ? Math.round((i.onHand / i.parLevel) * 100) : 0;
      return `${i.name}: ${i.onHand} ${i.unit} on hand (${pct}% of par, reorder at ${i.reorderAt}) — reorder from ${i.lastSupplier ?? "a supplier"}`;
    });

  const forecast = await getForecast(5);
  const weatherLines = forecast.days.map(
    (d) => `${d.date}: ${d.verdict} — ${d.tmaxC}°C, wind ${d.windKmh} km/h, precip ${d.precipPct}%`,
  );

  const urgent = openActions.find((a) => a.severity === "urgent");
  const oneThing =
    urgent?.message ??
    (todaysJobs[0]
      ? `Deliver today's job: ${todaysJobs[0]}`
      : quotesOut[0]
        ? `Chase the oldest quote out: ${quotesOut[0]}`
        : "Books are clean. Go find the next lead.");

  return {
    date: t,
    oneThingNotToDrop: oneThing,
    todaysJobs,
    moneyPulse: {
      monthRevenue,
      monthExpenses,
      monthProfit: round2(monthRevenue - monthExpenses),
      outstandingInvoices: outstanding.length,
      outstandingTotal: round2(outstanding.reduce((s, i) => s + i.balanceDue, 0)),
    },
    quotesOut,
    leadsPulse,
    topTodos,
    depositsAwaiting,
    upcomingSchedule,
    lowInventory,
    actionItems: openActions.map((a) => `[${a.severity.toUpperCase()}] ${a.message}`),
    weather: { source: forecast.source, lines: weatherLines },
    systemHealth: `${db.customers.length} customers, ${db.quotes.length} quotes, ${db.jobs.length} jobs, ${db.receipts.length} receipts on file. Data spine healthy.`,
  };
}
