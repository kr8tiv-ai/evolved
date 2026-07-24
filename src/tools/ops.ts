/**
 * Evolved tools — the autonomous operations layer.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildMorningDigest } from "../engine/digest.js";
import { scanForActionItems } from "../engine/actions.js";
import { getForecast } from "../engine/weather.js";
import { loadDb, nowIso, resetDb, withDb } from "../store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerOpsTools(server: McpServer): void {
  server.registerTool(
    "morning_digest",
    {
      title: "Morning digest",
      description:
        "The 6:30 AM owner briefing, on demand — a proactive 'here's your day / here's what needs you' rundown: the one thing not to drop, today's jobs with crews, the upcoming few days' schedule, money pulse (month revenue, expenses, receivables), deposits gating work (money in but unscheduled, or accepted work awaiting a deposit), quotes out with age, leads needing a touch, top open to-dos, low-inventory reorder alerts, the auto-raised action-item 'ball-drops', five-day blast-day weather verdicts, and system health. One call, whole business.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const digest = await withDb((db) => buildMorningDigest(db));
      return ok(digest);
    },
  );

  server.registerTool(
    "action_items_scan",
    {
      title: "Scan for dropped balls",
      description:
        "Run the ball-drop catcher across the books. Auto-raises items for: deposit in but unscheduled, invoice unpaid 7+ days, quote unanswered 7 days, quote expiring within 7 days, job complete but not invoiced, and open leads with stale next actions. Deduplicates against items already open.",
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      return ok(
        withDb((db) => {
          const { raised, existing } = scanForActionItems(db);
          return {
            newlyRaised: raised,
            alreadyOpen: existing,
            open: db.actionItems.filter((a) => !a.resolvedAt).map((a) => ({
              id: a.id, severity: a.severity, rule: a.rule, message: a.message,
            })),
          };
        }),
      );
    },
  );

  server.registerTool(
    "action_item_resolve",
    {
      title: "Resolve an action item",
      description: "Mark an action item handled. It leaves the digest and the open list.",
      inputSchema: { actionItemId: z.string(), resolution: z.string().optional() },
      annotations: { readOnlyHint: false },
    },
    async ({ actionItemId, resolution }) => {
      return ok(
        withDb((db) => {
          const item = db.actionItems.find((a) => a.id === actionItemId);
          if (!item) throw new Error(`Unknown action item ${actionItemId}`);
          item.resolvedAt = nowIso();
          if (resolution) item.message += ` [resolved: ${resolution}]`;
          return { resolved: item };
        }),
      );
    },
  );

  server.registerTool(
    "weather_check",
    {
      title: "Blast-day weather check",
      description:
        "Five-day forecast with blast-day verdicts (Good blast day / Marginal / No-go) using the company's gating thresholds: no blasting at precip ≥50%, wind >40 km/h, or highs below 3°C.",
      inputSchema: { days: z.number().int().min(1).max(14).optional() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ days }) => {
      return ok(await getForecast(days ?? 5));
    },
  );

  server.registerTool(
    "demo_reset",
    {
      title: "Reset demo dataset",
      description:
        "Restore the synthetic demo dataset to its seeded state (all names, numbers, and dollar figures are invented). Useful between demo runs.",
      inputSchema: {},
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async () => {
      const db = resetDb();
      return ok({
        reset: true,
        seededAt: db.meta.seededAt,
        counts: {
          customers: db.customers.length,
          leads: db.leads.length,
          quotes: db.quotes.length,
          jobs: db.jobs.length,
          receipts: db.receipts.length,
        },
      });
    },
  );

  server.registerTool(
    "business_snapshot",
    {
      title: "Business snapshot",
      description:
        "Everything on one screen: funnel counts, money position, open safety items, and open action items. The health check an investor or owner asks for first.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const open = (s: string[]) => db.leads.filter((l) => s.includes(l.stage)).length;
      return ok({
        company: db.meta.company,
        funnel: {
          newLeads: open(["New", "Contacted"]),
          inMotion: open(["Site visit", "Quoted"]),
          quotesOut: db.quotes.filter((q) => q.status === "Sent").length,
          jobsBooked: db.jobs.filter((j) => ["Booked", "Confirmed", "In progress"].includes(j.status)).length,
        },
        money: {
          receivables: db.invoices
            .filter((i) => i.status === "Sent" || i.status === "Overdue")
            .reduce((s, i) => s + i.balanceDue, 0),
          receiptsOnFile: db.receipts.length,
        },
        safety: {
          flhasOnFile: db.flhas.length,
          awaitingSignoff: db.flhas.filter((f) => !f.signoff).length,
        },
        attention: db.actionItems.filter((a) => !a.resolvedAt).length,
      });
    },
  );
}
