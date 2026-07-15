/**
 * Evolved tools — insights, activity feed, backups, and franchise spin-up.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DIR, loadDb, logActivity, nowIso, persist, round2, shortId, today, withDb } from "../store.js";
import { buildSeed } from "../seed.js";
import type { Database, RateEntry } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fingerprint(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 12);
}

function generateInsights(db: Database): { text: string; category: string; suggestedAction?: string; score: number }[] {
  const out: { text: string; category: string; suggestedAction?: string; score: number }[] = [];
  const month = today().slice(0, 7);
  const dayOfMonth = Number(today().slice(8, 10));

  const mtd = db.receipts.filter((r) => r.date.startsWith(month)).reduce((s, r) => s + r.total, 0);
  const prev = new Date();
  prev.setDate(1); // pin to the 1st so month-end days can't roll over
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = prev.toISOString().slice(0, 7);
  const prevSamePoint = db.receipts
    .filter((r) => r.date.startsWith(prevMonth) && Number(r.date.slice(8, 10)) <= dayOfMonth)
    .reduce((s, r) => s + r.total, 0);
  if (mtd > 0 || prevSamePoint > 0) {
    const diffPct = prevSamePoint > 0 ? round2(((mtd - prevSamePoint) / prevSamePoint) * 100) : null;
    out.push({
      category: "spend",
      text: `Spend this month: $${round2(mtd)} vs $${round2(prevSamePoint)} at the same point last month${diffPct != null ? ` (${diffPct > 0 ? "+" : ""}${diffPct}%)` : ""}.`,
      suggestedAction: diffPct != null && diffPct > 25 ? "Review the expense ledger — spend is running hot." : undefined,
      score: diffPct != null && Math.abs(diffPct) > 25 ? 0.9 : 0.5,
    });
  }

  const topVendor = [...db.vendors].sort((a, b) => b.totalSpend - a.totalSpend)[0];
  if (topVendor) {
    out.push({ category: "vendor", text: `Top vendor: ${topVendor.canonical} at $${topVendor.totalSpend} across ${topVendor.receipts} receipts.`, score: 0.4 });
  }
  const newVendors = db.vendors.filter((v) => (Date.now() - new Date(v.firstSeen).getTime()) / 86_400_000 <= 14);
  for (const v of newVendors) {
    out.push({ category: "vendor", text: `New vendor in the last 14 days: ${v.canonical} ($${v.totalSpend}).`, suggestedAction: "Confirm it is legitimate and correctly categorized.", score: 0.6 });
  }

  const backlog = db.inbox.filter((r) => r.status === "NEW").length;
  if (backlog > 0) {
    out.push({ category: "ops", text: `${backlog} unfiled capture(s) in the App Inbox.`, suggestedAction: "Run inbox_file.", score: 0.7 });
  }

  const lowStock = db.inventory.filter((i) => i.onHand <= i.reorderAt);
  if (lowStock.length) {
    out.push({ category: "inventory", text: `${lowStock.length} item(s) at reorder point: ${lowStock.map((i) => i.name).join(", ")}.`, suggestedAction: "Run inventory_reorder_suggestions.", score: 0.8 });
  }

  const pendingPay = db.payments.filter((p) => p.status === "pending").length;
  if (pendingPay) {
    out.push({ category: "money", text: `${pendingPay} on-chain payment request(s) awaiting settlement on X Layer testnet.`, suggestedAction: "Run invoice_payment_check.", score: 0.75 });
  }
  return out;
}

export function registerOpsPlusTools(server: McpServer): void {
  server.registerTool(
    "insights_generate",
    {
      title: "Generate business insights",
      description:
        "The deterministic business brain: spend pulse vs last month, top and new vendors, inbox backlog, reorder alerts, pending on-chain settlements. Insights are fingerprint-deduplicated (refreshed, never duplicated) and ranked by learned importance weights that your feedback trains.",
      inputSchema: {},
    },
    async () => {
      return ok(
        withDb((db) => {
          const generated = generateInsights(db);
          let added = 0;
          for (const g of generated) {
            const fp = fingerprint(`${g.category}:${g.text.replace(/[\d.,$%]+/g, "#")}`);
            const existing = db.insights.find((i) => i.fingerprint === fp && i.status !== "Done");
            const weight = db.insightWeights[g.category] ?? 1;
            if (existing) {
              existing.text = g.text;
              existing.date = today();
              existing.score = round2(g.score * weight);
            } else {
              db.insights.push({
                id: shortId("INS"), date: today(), category: g.category, text: g.text,
                suggestedAction: g.suggestedAction, score: round2(g.score * weight),
                status: "New", fingerprint: fp,
              });
              added++;
            }
          }
          const open = db.insights
            .filter((i) => i.status === "New" || i.status === "Important")
            .sort((a, b) => b.score - a.score);
          logActivity(db, "insights", `Insights refreshed: ${added} new, ${open.length} open.`);
          return { newInsights: added, open };
        }),
      );
    },
  );

  server.registerTool(
    "insight_feedback",
    {
      title: "Train the insight brain",
      description:
        "Rate an insight (Important / Not important / Done). Ratings adjust per-category weights, so the brain learns what this owner actually cares about — the feedback loop from the production Insights tab.",
      inputSchema: {
        insightId: z.string(),
        rating: z.enum(["Important", "Not important", "Done"]),
      },
    },
    async ({ insightId, rating }) => {
      return ok(
        withDb((db) => {
          const insight = db.insights.find((i) => i.id === insightId);
          if (!insight) throw new Error(`Unknown insight ${insightId}`);
          insight.status = rating;
          const w = db.insightWeights[insight.category] ?? 1;
          db.insightWeights[insight.category] =
            rating === "Important" ? round2(Math.min(2, w * 1.15))
            : rating === "Not important" ? round2(Math.max(0.3, w * 0.8))
            : w;
          return { insight, categoryWeight: db.insightWeights[insight.category] };
        }),
      );
    },
  );

  server.registerTool(
    "activity_feed",
    {
      title: "Activity feed (total recall)",
      description: "The audit trail: every capture, filing, receipt, payment, and voice command in reverse-chronological order.",
      inputSchema: { limit: z.number().int().positive().max(300).optional() },
    },
    async ({ limit }) => {
      const db = loadDb();
      return ok([...db.activity].reverse().slice(0, limit ?? 50));
    },
  );

  server.registerTool(
    "backup_create",
    {
      title: "Back up the books",
      description: "Full snapshot of the data spine to a timestamped backup file — the never-pruned safety net.",
      inputSchema: {},
    },
    async () => {
      const db = loadDb();
      const dir = process.env.EVOLVED_BACKUP_DIR ?? join(DATA_DIR, "backups");
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `evolved-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeFileSync(file, JSON.stringify(db, null, 2), "utf8");
      withDb((d) => logActivity(d, "backup", `Backup written: ${file}`));
      return ok({ file, note: "Backups are never pruned automatically." });
    },
  );

  server.registerTool(
    "backup_list",
    {
      title: "List backups",
      description: "Every backup snapshot on file.",
      inputSchema: {},
    },
    async () => {
      const dir = process.env.EVOLVED_BACKUP_DIR ?? join(DATA_DIR, "backups");
      try {
        return ok({ backups: readdirSync(dir).filter((f) => f.endsWith(".json")) });
      } catch {
        return ok({ backups: [], note: "No backups yet — run backup_create." });
      }
    },
  );

  server.registerTool(
    "franchise_spinup",
    {
      title: "Business-in-a-box: spin up a new trade",
      description:
        "The productization story in one call: re-seed the entire operations brain for a NEW company — any name, any trade, your rate card — with empty books and the full machinery intact (quoting engine, receipts pipeline, FLHA library, digest, learning loop, on-chain invoicing). This is how one company's ops system becomes anyone's. DESTRUCTIVE to current demo data: requires confirm:true.",
      inputSchema: {
        companyName: z.string(),
        trade: z.string().describe("e.g. pressure washing, line painting, mobile detailing"),
        region: z.string().optional(),
        currency: z.string().optional(),
        gstRate: z.number().min(0).max(0.3).optional(),
        rates: z.array(z.object({
          depth: z.enum(["very-light", "light", "medium", "heavy"]),
          ratePerSqft: z.number().positive(),
        })).optional().describe("Custom rate card — must cover all four depths; defaults to the blasting card"),
        confirm: z.boolean().describe("Must be true — this replaces the current demo dataset"),
      },
    },
    async (input) => {
      if (!input.confirm) {
        return ok({ spunUp: false, error: "Set confirm:true — franchise_spinup replaces the current demo dataset (backup_create first if you want to keep it)." });
      }
      if (input.rates) {
        const provided = new Set(input.rates.map((r) => r.depth));
        const missing = (["very-light", "light", "medium", "heavy"] as const).filter((d) => !provided.has(d));
        if (missing.length) {
          return ok({ spunUp: false, error: `Custom rate card must cover all four depths — missing: ${missing.join(", ")}.` });
        }
      }
      const fresh = buildSeed();
      const blank: Database = {
        ...fresh,
        meta: {
          company: `${input.companyName} (demo dataset — fully synthetic)`,
          currency: input.currency ?? "CAD",
          gstRate: input.gstRate ?? 0.05,
          seededAt: nowIso(),
        },
        customers: [], leads: [], quotes: [], jobs: [], receipts: [], actionItems: [],
        flhas: [], invoices: [], pricingOutcomes: [], quoteCounter: {},
        inventoryMovements: [], priceLog: [], vendors: [], inbox: [], todos: [],
        payments: [], esigns: [], lifecycles: [], reviews: [], insights: [],
        insightWeights: {}, activity: [],
        rateTable: (input.rates
          ? input.rates.map((r): RateEntry => ({
              depth: r.depth,
              label: `${r.depth} (${input.trade})`,
              baseRate: r.ratePerSqft, learnedRate: r.ratePerSqft, samples: 0,
            }))
          : fresh.rateTable.map((r) => ({ ...r, learnedRate: r.baseRate, samples: 0 }))),
        suppliers: [], crew: [],
        inventory: fresh.inventory.map((i) => ({ ...i, onHand: 0, lastUnitCost: undefined, lastSupplier: undefined, lastPurchasedAt: undefined })),
      };
      // Swap the live database wholesale.
      const current = loadDb();
      Object.assign(current, blank);
      logActivity(current, "franchise", `Spun up: ${input.companyName} (${input.trade}${input.region ? `, ${input.region}` : ""}).`);
      persist();
      return ok({
        spunUp: true,
        company: blank.meta.company,
        trade: input.trade,
        rateCard: blank.rateTable,
        note: "Fresh books, full machinery: quoting, receipts, FLHA, digest, learning loop, and on-chain invoicing are live for the new company. demo_reset restores the Evolve demo dataset.",
      });
    },
  );
}
