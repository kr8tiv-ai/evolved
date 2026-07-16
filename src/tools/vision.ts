/**
 * Evolved tools — photo-to-quote.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { estimateFromPhoto } from "../engine/vision.js";
import { comparableRates, priceQuote, QUOTE_VALID_DAYS } from "../engine/pricing.js";
import { addDays, loadDb, logActivity, money, nextQuoteNumber, nowIso, shortId, today, withDb } from "../store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerVisionTools(server: McpServer): void {
  server.registerTool(
    "quote_from_photo",
    {
      title: "Photo to priced quote in seconds",
      description:
        "A customer texts a photo; this turns it into a priced, branded draft quote. Vision (Claude, when a key is present) or a deterministic offline estimator (real JPEG/PNG pixel parsing + hints) estimates surface, area, condition, and blast depth; the learning rate engine prices it with a full profitability check; optionally books it straight into the ledger as a draft quote. Every photo quote carries a measure-to-confirm clause and feeds the learning loop when the job closes.",
      inputSchema: {
        imageBase64: z.string().optional().describe("The customer's photo, base64 (JPEG/PNG)"),
        mediaType: z.string().optional().describe("image/jpeg or image/png"),
        surface: z.enum(["driveway", "sidewalk", "patio", "garage-pad", "exposed-aggregate", "trailer", "equipment", "fence", "brick", "other"]).optional(),
        approxWidthFt: z.number().positive().optional(),
        approxLengthFt: z.number().positive().optional(),
        conditionNote: z.string().optional(),
        customerName: z.string().optional().describe("Provide to create the draft quote in the books"),
        siteAddress: z.string().optional(),
      },
    },
    async (input) => {
      const estimate = await estimateFromPhoto(input.imageBase64, input.mediaType, {
        surface: input.surface,
        approxWidthFt: input.approxWidthFt,
        approxLengthFt: input.approxLengthFt,
        conditionNote: input.conditionNote,
      });
      const db = loadDb();
      const priced = priceQuote(db, {
        sqft: estimate.sqft,
        depth: estimate.depth,
        surface: estimate.surface,
      });
      const comps = comparableRates(db, estimate.depth, estimate.surface);

      // A seasoned estimator doesn't hand over a single number sight-unseen —
      // it hands over a confidence-banded range, the comparables behind it,
      // and what a site measure could change.
      const quoteBand = {
        pointTotal: money(priced.total),
        confidence: estimate.confidence,
        rangeSubtotal: `${money(priced.subtotalRange[0])} – ${money(priced.subtotalRange[1])}`,
        rangeRate: `$${priced.rateRange[0].toFixed(2)} – $${priced.rateRange[1].toFixed(2)}/sqft`,
        basis: priced.rateSource,
        market: priced.market.note,
        comparables: comps.note,
        priceDrivers: estimate.priceDrivers,
        note: estimate.confidence < 0.55
          ? "Lower-confidence read — send as a ballpark range, confirm on a site measure before booking."
          : "Solid read — safe to send as a draft; the measure-to-confirm clause protects the final number.",
      };

      if (!input.customerName) {
        return ok({
          estimate,
          pricing: priced,
          quoteBand,
          note: "Estimate only — pass customerName (and siteAddress) to book a draft quote into the ledger.",
        });
      }

      return ok(
        withDb((d) => {
          let customer = d.customers.find((c) => c.name.toLowerCase() === input.customerName!.toLowerCase());
          if (!customer) {
            customer = { id: shortId("CUST"), name: input.customerName!, address: input.siteAddress, createdAt: nowIso() };
            d.customers.push(customer);
          }
          const quote = {
            id: nextQuoteNumber(d),
            customerId: customer.id,
            siteAddress: input.siteAddress ?? customer.address ?? "site TBC",
            lines: [{
              description: `${estimate.surface} — ${estimate.depth} blast, substrate profiling (photo estimate, ${estimate.condition}; measure to confirm)`,
              sqft: estimate.sqft, depth: estimate.depth, surface: estimate.surface, amount: priced.subtotal,
            }],
            sqftTotal: estimate.sqft,
            subtotal: priced.subtotal, gst: priced.gst, total: priced.total,
            depositRequired: priced.deposit,
            status: "Draft" as const,
            validUntil: addDays(today(), QUOTE_VALID_DAYS),
            profitability: priced.profitability,
            notes: `Photo-quoted (${estimate.source}, confidence ${estimate.confidence}). ${estimate.notes.join(" ")}`,
            createdAt: nowIso(), updatedAt: nowIso(),
          };
          d.quotes.push(quote);
          logActivity(d, "vision", `Photo quote ${quote.id}: ${estimate.sqft} sqft ${estimate.surface} @ ${priced.ratePerSqftEffective}/sqft.`);
          return { estimate, quote, quoteBand, advisory: priced.profitability.advisory };
        }),
      );
    },
  );
}
