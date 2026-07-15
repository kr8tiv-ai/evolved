/**
 * Evolved tools — quoting & pricing intelligence.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ACCESS_FACTORS,
  DEPTH_LABELS,
  effectiveRate,
  gstRate,
  priceQuote,
  profitabilityCheck,
  QUOTE_VALID_DAYS,
} from "../engine/pricing.js";
import { renderQuoteHtml, writeDocument } from "../engine/brand.js";
import {
  addDays,
  loadDb,
  nextQuoteNumber,
  nowIso,
  round2,
  shortId,
  today,
  withDb,
} from "../store.js";
import type { BlastDepth, Quote, SurfaceKind } from "../types.js";

const depthEnum = z.enum(["very-light", "light", "medium", "heavy"]);
const surfaceEnum = z.enum([
  "driveway", "sidewalk", "patio", "garage-pad", "exposed-aggregate",
  "trailer", "equipment", "fence", "brick", "other",
]);

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerQuotingTools(server: McpServer): void {
  server.registerTool(
    "quote_price",
    {
      title: "Price a job",
      description:
        "Price an abrasive-blasting job with the company rate engine: learned $/sqft rates by blast depth and surface, access factor, mobilization, 5% GST, 25% deposit — plus a full profitability check (media, labor, fuel, overhead, break-even rate, margin verdict). Use this before creating any quote.",
      inputSchema: {
        sqft: z.number().positive().describe("Square footage of the work area"),
        depth: depthEnum.describe("Blast depth required"),
        surface: surfaceEnum.optional().describe("Surface type (drives learned pricing)"),
        access: z.enum(["easy", "moderate", "difficult"]).optional().describe("Site access difficulty (default easy)"),
        mobilization: z.boolean().optional().describe("Include the mobilization fee (default true)"),
      },
    },
    async (input) => {
      const db = loadDb();
      const result = priceQuote(db, {
        sqft: input.sqft,
        depth: input.depth as BlastDepth,
        surface: input.surface as SurfaceKind | undefined,
        access: input.access,
        mobilization: input.mobilization,
      });
      return ok(result);
    },
  );

  server.registerTool(
    "quote_create",
    {
      title: "Create a quote",
      description:
        "Create a formal quote in the books (auto-numbered ECO-Q-MMDDYY-NN, valid 30 days) for a customer, from one or more priced lines. Runs the profitability check and stores the verdict. If a custom price is below break-even it is honoured but flagged — never silently raised.",
      inputSchema: {
        customerId: z.string().describe("Existing customer id (see pipeline tools to create one)"),
        siteAddress: z.string(),
        lines: z.array(
          z.object({
            description: z.string(),
            sqft: z.number().positive().optional(),
            depth: depthEnum.optional(),
            surface: surfaceEnum.optional(),
            access: z.enum(["easy", "moderate", "difficult"]).optional(),
            customAmount: z.number().positive().optional().describe("Override price for this line (flat-priced work)"),
          }),
        ).min(1),
        notes: z.string().optional(),
        leadId: z.string().optional(),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const customer = db.customers.find((c) => c.id === input.customerId);
          if (!customer) throw new Error(`Unknown customer ${input.customerId}`);

          let sqftTotal = 0;
          let subtotal = 0;
          let mobilizationApplied = false;
          const lines = input.lines.map((l) => {
            let amount: number;
            if (l.customAmount != null) {
              amount = l.customAmount;
            } else if (l.sqft && l.depth) {
              const priced = priceQuote(db, {
                sqft: l.sqft,
                depth: l.depth as BlastDepth,
                surface: l.surface as SurfaceKind | undefined,
                access: l.access,
                // One mobilization per site — on the first sqft-priced line,
                // wherever it sits in the list.
                mobilization: !mobilizationApplied,
              });
              mobilizationApplied = true;
              amount = priced.subtotal;
            } else {
              throw new Error(
                `Line "${l.description}": provide either customAmount or sqft+depth. Every quote must capture square footage and blast depth where applicable.`,
              );
            }
            if (l.sqft) sqftTotal += l.sqft;
            subtotal += amount;
            return {
              description: l.description,
              sqft: l.sqft,
              depth: l.depth as BlastDepth | undefined,
              surface: l.surface as SurfaceKind | undefined,
              amount: round2(amount),
            };
          });

          subtotal = round2(subtotal);
          const gst = round2(subtotal * gstRate(db));
          const total = round2(subtotal + gst);
          const primary = input.lines.find((l) => l.sqft && l.depth);
          // Check the ACTUAL quoted subtotal (custom prices included) against
          // the cost model — this is what makes "honoured but flagged" true.
          const profitability = primary
            ? profitabilityCheck(
                sqftTotal || primary.sqft!,
                primary.depth as BlastDepth,
                subtotal,
              )
            : undefined;

          const quote: Quote = {
            id: nextQuoteNumber(db),
            customerId: customer.id,
            leadId: input.leadId,
            siteAddress: input.siteAddress,
            lines,
            sqftTotal: sqftTotal || undefined,
            subtotal,
            gst,
            total,
            depositRequired: round2(total * 0.25),
            status: "Draft",
            validUntil: addDays(today(), QUOTE_VALID_DAYS),
            profitability,
            notes: input.notes,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          db.quotes.push(quote);

          if (input.leadId) {
            const lead = db.leads.find((l) => l.id === input.leadId);
            if (lead) {
              lead.stage = "Quoted";
              lead.nextAction = `Follow up on quote ${quote.id}`;
              lead.nextActionDate = addDays(today(), 3);
              lead.updatedAt = nowIso();
            }
          }
          return { quote, advisory: profitability?.advisory };
        }),
      );
    },
  );

  server.registerTool(
    "quote_render",
    {
      title: "Render branded quote document",
      description:
        "Render a quote as a polished, dark-brand HTML document (Boreal Void page, Cyber Lime underline, Aurora Neon labels, diamond bullets, payment schedule with the big green total) ready to print to PDF and send. Returns the file path and the HTML.",
      inputSchema: { quoteId: z.string() },
    },
    async ({ quoteId }) => {
      const db = loadDb();
      const q = db.quotes.find((x) => x.id === quoteId);
      if (!q) throw new Error(`Unknown quote ${quoteId}`);
      const customer = db.customers.find((c) => c.id === q.customerId)!;
      const html = renderQuoteHtml(q, customer);
      const path = writeDocument(`Evolve-Quote-${q.id}.html`, html);
      return ok({ quoteId, file: path, bytes: html.length, note: "Open in a browser and print to PDF, or attach as-is." });
    },
  );

  server.registerTool(
    "quote_update_status",
    {
      title: "Update quote status",
      description:
        "Move a quote through its lifecycle: Draft → Sent → Accepted/Declined/Expired. Accepting a quote automatically opens a job in the dispatch pipeline and marks the lead Won.",
      inputSchema: {
        quoteId: z.string(),
        status: z.enum(["Draft", "Sent", "Accepted", "Declined", "Expired"]),
      },
    },
    async ({ quoteId, status }) => {
      return ok(
        withDb((db) => {
          const q = db.quotes.find((x) => x.id === quoteId);
          if (!q) throw new Error(`Unknown quote ${quoteId}`);
          q.status = status;
          q.updatedAt = nowIso();
          let jobId: string | undefined;
          if (status === "Accepted") {
            const job = {
              id: shortId("JOB"),
              quoteId: q.id,
              customerId: q.customerId,
              siteAddress: q.siteAddress,
              scope: q.lines.map((l) => l.description).join("; "),
              status: "Awaiting acceptance" as const,
              crew: [],
              depositPaid: false,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            };
            db.jobs.push(job);
            jobId = job.id;
            if (q.leadId) {
              const lead = db.leads.find((l) => l.id === q.leadId);
              if (lead) { lead.stage = "Won"; lead.updatedAt = nowIso(); }
            }
          }
          if (status === "Declined" && q.leadId) {
            const lead = db.leads.find((l) => l.id === q.leadId);
            if (lead) { lead.stage = "Lost"; lead.updatedAt = nowIso(); }
          }
          return { quote: q, openedJobId: jobId };
        }),
      );
    },
  );

  server.registerTool(
    "quote_list",
    {
      title: "List quotes",
      description: "List quotes, optionally filtered by status. Includes totals, validity, and profitability verdicts.",
      inputSchema: {
        status: z.enum(["Draft", "Sent", "Accepted", "Declined", "Expired"]).optional(),
      },
    },
    async ({ status }) => {
      const db = loadDb();
      const quotes = db.quotes.filter((q) => (status ? q.status === status : true));
      return ok(quotes.map((q) => ({
        id: q.id, customer: db.customers.find((c) => c.id === q.customerId)?.name,
        total: q.total, status: q.status, validUntil: q.validUntil,
        verdict: q.profitability?.verdict, sqft: q.sqftTotal,
      })));
    },
  );

  server.registerTool(
    "pricing_rates",
    {
      title: "View rate table & learning loop",
      description:
        "Show the live rate table: base market rates by blast depth, the learned effective rates by surface (driven by real job outcomes at healthy margins), access factors, and the mobilization fee. This is the quoting engine's brain.",
      inputSchema: {
        surface: surfaceEnum.optional().describe("Show the learned rate for a specific surface"),
      },
    },
    async ({ surface }) => {
      const db = loadDb();
      const table = db.rateTable.map((r) => {
        const eff = effectiveRate(db, r.depth, surface as SurfaceKind | undefined);
        return {
          depth: r.depth,
          label: DEPTH_LABELS[r.depth],
          baseRate: r.baseRate,
          effectiveRate: eff.rate,
          learnedFrom: eff.source,
        };
      });
      return ok({
        currency: "CAD per sqft",
        surfaceFilter: surface ?? "(all surfaces)",
        rates: table,
        accessFactors: ACCESS_FACTORS,
        mobilizationFee: 250,
        policy: "Price at least mid-market; never below break-even without an owner flag. Exposed aggregate prices as medium blast.",
      });
    },
  );

  server.registerTool(
    "pricing_record_outcome",
    {
      title: "Teach the pricing engine",
      description:
        "Record a job outcome (won/lost, quoted rate, actual cost per sqft, margin) into the pricing learning loop. Wins at healthy margins pull future quotes for that surface+depth toward what actually works — every job makes the next quote smarter.",
      inputSchema: {
        jobId: z.string(),
        surface: surfaceEnum,
        depth: depthEnum,
        sqft: z.number().positive(),
        quotedRate: z.number().positive().describe("$/sqft quoted"),
        actualCostPerSqft: z.number().positive(),
        won: z.boolean(),
      },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const marginPct = round2(
            ((input.quotedRate - input.actualCostPerSqft) / input.quotedRate) * 100,
          );
          const outcome = {
            id: shortId("OUT"),
            jobId: input.jobId,
            surface: input.surface as SurfaceKind,
            depth: input.depth as BlastDepth,
            sqft: input.sqft,
            quotedRate: input.quotedRate,
            actualCostPerSqft: input.actualCostPerSqft,
            marginPct,
            won: input.won,
            recordedAt: nowIso(),
          };
          db.pricingOutcomes.push(outcome);
          const eff = effectiveRate(db, outcome.depth, outcome.surface);
          const entry = db.rateTable.find((r) => r.depth === outcome.depth);
          if (entry) {
            entry.learnedRate = eff.rate;
            entry.samples = eff.samples;
          }
          return {
            recorded: outcome,
            newEffectiveRate: eff.rate,
            basis: eff.source,
          };
        }),
      );
    },
  );
}
