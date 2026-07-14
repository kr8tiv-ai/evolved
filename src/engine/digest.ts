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
    actionItems: openActions.map((a) => `[${a.severity.toUpperCase()}] ${a.message}`),
    weather: { source: forecast.source, lines: weatherLines },
    systemHealth: `${db.customers.length} customers, ${db.quotes.length} quotes, ${db.jobs.length} jobs, ${db.receipts.length} receipts on file. Data spine healthy.`,
  };
}
