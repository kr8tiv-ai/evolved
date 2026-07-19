/**
 * Evolved tools — insights, activity feed, backups, and franchise spin-up.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DIR, loadDb, logActivity, nowIso, persist, round2, shortId, today, withDb } from "../store.js";
import { buildSeed } from "../seed.js";
import { findTradePack, TRADE_PACKS } from "../trades.js";
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
      annotations: { readOnlyHint: false },
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
      annotations: { readOnlyHint: false },
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
      annotations: { readOnlyHint: true },
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
      description: "Full snapshot of the data spine to a timestamped backup file. Keeps the most recent 25 snapshots (rotation guards shared demo hosts against disk-fill).",
      inputSchema: {},
      annotations: { readOnlyHint: false },
    },
    async () => {
      const db = loadDb();
      const dir = process.env.EVOLVED_BACKUP_DIR ?? join(DATA_DIR, "backups");
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `evolved-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeFileSync(file, JSON.stringify(db, null, 2), "utf8");
      // Rotate: cap the snapshot count so an anonymous loop cannot fill the disk.
      const existing = readdirSync(dir).filter((f) => f.startsWith("evolved-backup-")).sort();
      for (const stale of existing.slice(0, Math.max(0, existing.length - 25))) {
        try { unlinkSync(join(dir, stale)); } catch { /* best effort */ }
      }
      withDb((d) => logActivity(d, "backup", `Backup written: ${file}`));
      return ok({ file, retained: Math.min(existing.length, 25), note: "Most recent 25 snapshots are retained." });
    },
  );

  server.registerTool(
    "backup_list",
    {
      title: "List backups",
      description: "Every backup snapshot on file.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
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
        "The productization story in one call: re-seed the entire operations brain for a NEW company — any name, any trade, your rate card — with empty books and the full machinery intact (quoting engine, receipts pipeline, FLHA library with trade-specific hazards, digest, learning loop, on-chain invoicing). Pass tradePack for a ready-made pack (" +
        TRADE_PACKS.map((p) => p.key).join(", ") +
        "), supply your own rates, or pass a full customPack (labels + hazards) INLINE to adapt to a brand-new trade in one call — no repo fork. This is how one company's ops system becomes anyone's. DESTRUCTIVE to current demo data: requires confirm:true.",
      inputSchema: {
        companyName: z.string(),
        tradePack: z.string().optional().describe("Ready-made pack: " + TRADE_PACKS.map((p) => p.key).join(" | ")),
        trade: z.string().optional().describe("Freeform trade name (defaults from tradePack)"),
        region: z.string().optional(),
        currency: z.string().optional(),
        gstRate: z.number().min(0).max(0.3).optional().describe("Sales-tax rate as a decimal (0.05 = 5% GST, 0.20 = 20% VAT, 0 = none)"),
        taxLabel: z.string().max(24).optional().describe("Sales-tax label on quotes/invoices — 'GST' (default), 'VAT', 'Sales Tax', 'HST'…"),
        unit: z.string().max(24).optional().describe("What the rate card prices PER — 'sqft' (default), 'hour', 'unit', 'vehicle', 'linear ft'… so the quote speaks your trade, not blasting"),
        industryNotes: z.array(z.string().min(1)).optional().describe("Trade-specific policy lines appended to every quote (cure times, permits, warranties). Defaults to none — no blasting boilerplate carries over"),
        rates: z.array(z.object({
          depth: z.enum(["very-light", "light", "medium", "heavy"]),
          ratePerSqft: z.number().positive(),
        })).optional().describe("Custom rate card — must cover all four depths; defaults to the blasting card"),
        customPack: z.object({
          rateCard: z.array(z.object({
            depth: z.enum(["very-light", "light", "medium", "heavy"]),
            label: z.string().min(1),
            ratePerSqft: z.number().positive(),
          })).describe("Four tiers, one per depth, with YOUR trade's own labels"),
          hazards: z.array(z.object({
            hazard: z.string().min(1),
            risk: z.enum(["low", "medium", "high"]),
            mitigations: z.array(z.string().min(1)),
          })).optional().describe("Your trade's hazards — merged into every FLHA the system drafts"),
        }).optional().describe("Bring your own trade pack INLINE (labels + hazards) — adapt to a brand-new trade in one call, no repo fork"),
        confirm: z.boolean().describe("Must be true — this replaces the current demo dataset"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (input) => {
      if (!input.confirm) {
        return ok({ spunUp: false, error: "Set confirm:true — franchise_spinup replaces the current demo dataset (backup_create first if you want to keep it)." });
      }
      const named = input.tradePack ? findTradePack(input.tradePack) : undefined;
      if (input.tradePack && !named) {
        return ok({ spunUp: false, error: `Unknown trade pack "${input.tradePack}". Available: ${TRADE_PACKS.map((p) => p.key).join(", ")}.` });
      }
      // A named pack OR an inline customPack both resolve to the same shape.
      const pack = named ?? (input.customPack
        ? { key: "custom", trade: input.trade ?? "custom", description: "inline pack", rateCard: input.customPack.rateCard, hazards: input.customPack.hazards ?? [] }
        : undefined);
      const trade = input.trade ?? pack?.trade;
      if (!trade) {
        return ok({ spunUp: false, error: "Provide trade, tradePack, or customPack." });
      }
      // Any rate card supplied (inline pack or explicit rates) must cover all four depths.
      const ALL_DEPTHS = ["very-light", "light", "medium", "heavy"] as const;
      for (const [card, label] of [[input.rates, "rates"], [input.customPack?.rateCard, "customPack.rateCard"]] as const) {
        if (card) {
          const missing = ALL_DEPTHS.filter((d) => !new Set(card.map((r) => r.depth)).has(d));
          if (missing.length) {
            return ok({ spunUp: false, error: `${label} must cover all four depths — missing: ${missing.join(", ")}.` });
          }
        }
      }
      const rates = input.rates ?? pack?.rateCard.map((r) => ({ depth: r.depth, ratePerSqft: r.ratePerSqft }));
      const rateLabels = new Map(pack?.rateCard.map((r) => [r.depth, r.label]) ?? []);
      const fresh = buildSeed();
      const blank: Database = {
        ...fresh,
        meta: {
          company: `${input.companyName} (demo dataset — fully synthetic)`,
          currency: input.currency ?? "CAD",
          gstRate: input.gstRate ?? 0.05,
          taxLabel: input.taxLabel ?? "Tax",
          seededAt: nowIso(),
          // Adapted trades start with NO blasting policy boilerplate; they bring
          // their own trade notes (permits, cure times, warranties) if any.
          industryNotes: input.industryNotes ?? [],
          ...((input.unit ?? pack?.unit) ? { pricingUnit: input.unit ?? pack?.unit } : {}),
        },
        customers: [], leads: [], quotes: [], jobs: [], receipts: [], actionItems: [],
        flhas: [], invoices: [], pricingOutcomes: [], quoteCounter: {},
        inventoryMovements: [], priceLog: [], vendors: [], inbox: [], todos: [],
        payments: [], esigns: [], lifecycles: [], reviews: [], insights: [],
        insightWeights: {}, activity: [],
        rateTable: (rates
          ? rates.map((r): RateEntry => ({
              depth: r.depth,
              label: rateLabels.get(r.depth) ?? `${r.depth} (${trade})`,
              baseRate: r.ratePerSqft, learnedRate: r.ratePerSqft, samples: 0,
            }))
          : fresh.rateTable.map((r) => ({ ...r, learnedRate: r.baseRate, samples: 0 }))),
        suppliers: [], crew: [],
        inventory: fresh.inventory.map((i) => ({ ...i, onHand: 0, lastUnitCost: undefined, lastSupplier: undefined, lastPurchasedAt: undefined })),
        customHazards: pack?.hazards ?? [],
      };
      // Swap the live database wholesale — but the replay ledger and revenue
      // counters survive every reseed, franchise included.
      const current = loadDb();
      blank.usedTxHashes = current.usedTxHashes;
      blank.meta.paidCalls = current.meta.paidCalls ?? 0;
      Object.assign(current, blank);
      logActivity(current, "franchise", `Spun up: ${input.companyName} (${trade}${input.region ? `, ${input.region}` : ""})${pack ? ` from the ${pack.key} trade pack` : ""}.`);
      persist();
      return ok({
        spunUp: true,
        company: blank.meta.company,
        trade,
        tradePack: pack?.key,
        rateCard: blank.rateTable,
        tradeHazardsInstalled: (pack?.hazards ?? []).length,
        note: "Fresh books, full machinery: quoting, receipts, FLHA (with trade-specific hazards), digest, learning loop, and on-chain invoicing are live for the new company. demo_reset restores the Evolve demo dataset.",
      });
    },
  );
}
