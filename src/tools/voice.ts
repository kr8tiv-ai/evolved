/**
 * Evolved tools — hands-free crew commands.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseVoiceCommand } from "../engine/nlu.js";
import { hazardsForScope, STANDARD_PPE } from "../engine/safety.js";
import { runOcrPipeline } from "../engine/ocr.js";
import { findItem } from "./inventory.js";
import { loadDb, logActivity, nowIso, round2, shortId, today, withDb } from "../store.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function matchJob(db: ReturnType<typeof loadDb>, hint?: string) {
  const active = db.jobs.filter((j) => !["Complete", "Invoiced", "Paid"].includes(j.status));
  if (!hint) return active[0];
  const h = hint.toLowerCase();
  // A hint that matches nothing returns undefined — never silently
  // attribute work to an arbitrary job.
  return (
    active.find((j) => j.id.toLowerCase() === h) ??
    active.find((j) => {
      const c = db.customers.find((x) => x.id === j.customerId);
      return `${c?.name ?? ""} ${j.siteAddress} ${j.scope}`.toLowerCase().includes(h);
    })
  );
}

export function registerVoiceTools(server: McpServer): void {
  server.registerTool(
    "voice_command",
    {
      title: "Crew voice command (hands-free)",
      description:
        "Field crew talk, the books listen. Deterministic intent parsing handles: media/consumable usage ('used four bags of crushed glass on the Kowalczyk job'), FLHA start ('open the FLHA for job 1043'), navigation ('next stop?'), receipt logging ('log receipt: PETRO-CANADA … TOTAL $150'), todos ('remind me to grab couplers'), job status — and anything unrecognized is captured to the App Inbox so no thought is ever lost. Returns the action taken plus a short spoken-style reply.",
      inputSchema: {
        utterance: z.string().min(2),
        speaker: z.string().optional().describe("Crew member name (default: crew)"),
      },
    },
    async ({ utterance, speaker }) => {
      const who = speaker ?? "crew";
      const intent = parseVoiceCommand(utterance);
      const db = loadDb();

      switch (intent.intent) {
        case "consume-inventory": {
          const result = withDb((d) => {
            const item = findItem(d.inventory, intent.item);
            if (!item) return { error: `No inventory item matching "${intent.item}".` };
            const job = matchJob(d, intent.jobHint);
            if (intent.jobHint && !job) {
              return { error: `No active job matching "${intent.jobHint}" — say the job id or customer name, or leave the job off to log as overhead.` };
            }
            if (intent.qty > item.onHand) {
              return { error: `Only ${item.onHand} ${item.unit} of ${item.name} on hand.` };
            }
            item.onHand = round2(item.onHand - intent.qty);
            d.inventoryMovements.push({
              id: shortId("MOV"), itemId: item.id, delta: -intent.qty,
              reason: "consumed", jobId: job?.id, at: nowIso(),
            });
            logActivity(d, "voice", `${who}: consumed ${intent.qty} ${item.name}${job ? ` on ${job.id}` : ""}.`);
            return {
              item: item.name, consumed: intent.qty, remaining: item.onHand, job: job?.id,
              low: item.onHand <= item.reorderAt,
            };
          });
          if ("error" in result) return ok({ intent, reply: result.error });
          return ok({
            intent, action: result,
            reply: `Logged ${intent.qty} ${result.item} against ${result.job ?? "overhead"}. ${result.low ? `Heads up — you're down to ${result.remaining}, reorder point hit.` : `${result.remaining} left.`}`,
          });
        }

        case "open-flha": {
          const result = withDb((d) => {
            const job = matchJob(d, intent.jobHint);
            if (!job) return { error: "No active job to open an FLHA for." };
            const existing = d.flhas.find((f) => f.jobId === job.id && f.date === today() && !f.signoff);
            if (existing) return { flhaId: existing.id, jobId: job.id, existing: true, hazards: existing.hazards.length };
            const flha = {
              id: shortId("FLHA"), jobId: job.id, date: today(),
              crew: job.crew.length ? job.crew : [who],
              siteConditions: "Opened by voice — crew confirms conditions on site.",
              hazards: hazardsForScope(job.scope, [], d.customHazards), ppeConfirmed: STANDARD_PPE,
              musterPoint: "Truck staging area", openedBy: who, openedAt: nowIso(),
            };
            d.flhas.push(flha);
            logActivity(d, "voice", `${who} opened FLHA ${flha.id} for ${job.id}.`);
            return { flhaId: flha.id, jobId: job.id, existing: false, hazards: flha.hazards.length };
          });
          if ("error" in result) return ok({ intent, reply: result.error });
          return ok({
            intent, action: result,
            reply: result.existing
              ? `FLHA already open for ${result.jobId} — review it at the tailgate.`
              : `FLHA opened for ${result.jobId}: ${result.hazards} hazards drafted with mitigations. Talk them through before pressurizing.`,
          });
        }

        case "next-stop": {
          const t = today();
          const upcoming = db.jobs
            .filter((j) => j.scheduledDate && j.scheduledDate >= t && !["Complete", "Invoiced", "Paid"].includes(j.status))
            .sort((a, b) => (a.scheduledDate! < b.scheduledDate! ? -1 : 1))[0];
          if (!upcoming) return ok({ intent, reply: "Nothing on the board — check the pipeline for quotes to chase." });
          const customer = db.customers.find((c) => c.id === upcoming.customerId);
          return ok({
            intent,
            action: { jobId: upcoming.id, date: upcoming.scheduledDate, address: upcoming.siteAddress },
            reply: `Next stop: ${customer?.name ?? "customer"} at ${upcoming.siteAddress}, ${upcoming.scheduledDate === t ? "today" : upcoming.scheduledDate}. Scope: ${upcoming.scope}.`,
          });
        }

        case "log-receipt": {
          const parsed = await runOcrPipeline(intent.text);
          const result = withDb((d) => {
            // Same duplicate guard as receipt_ingest.
            const dup = d.receipts.find(
              (r) =>
                r.vendor.toLowerCase() === parsed.vendor.toLowerCase() &&
                Math.abs(r.total - parsed.total) <= 0.5 &&
                Math.abs(new Date(r.date).getTime() - new Date(parsed.date).getTime()) <= 2 * 86_400_000,
            );
            if (dup) return { duplicateOf: dup.id, vendor: dup.vendor, total: dup.total };
            const receipt = {
              id: shortId("RCPT"), vendor: parsed.vendor, date: parsed.date,
              amountBeforeTax: parsed.amountBeforeTax, gst: parsed.gst, total: parsed.total,
              category: parsed.category, paymentMethod: parsed.paymentMethod,
              // No job hint in the utterance → overhead; never guess a job.
              jobId: undefined, lineItems: parsed.lineItems,
              ocr: { model: parsed.model, escalated: parsed.escalated, confidence: parsed.confidence, warnings: parsed.warnings },
              createdAt: nowIso(),
            };
            d.receipts.push(receipt);
            logActivity(d, "voice", `${who} logged receipt: ${parsed.vendor} $${parsed.total}.`);
            return receipt;
          });
          if ("duplicateOf" in result) {
            return ok({ intent, action: result, reply: `That looks like a duplicate of ${result.duplicateOf} (${result.vendor}, $${result.total}) — not posted twice.` });
          }
          return ok({ intent, action: result, reply: `Receipt in the books: ${result.vendor}, $${result.total}, filed under ${result.category} as overhead — say the job name if it belongs to one.` });
        }

        case "add-todo": {
          const todo = withDb((d) => {
            const t = { id: shortId("TODO"), task: intent.task, category: "Field", priority: intent.priority, status: "Open" as const, added: today() };
            d.todos.push(t);
            logActivity(d, "voice", `${who} added todo: ${intent.task}.`);
            return t;
          });
          return ok({ intent, action: todo, reply: `On the list${intent.priority === "high" ? ", marked high priority" : ""}: ${intent.task}.` });
        }

        case "job-status": {
          const job = matchJob(db, intent.jobHint);
          if (!job) return ok({ intent, reply: "No active job matching that." });
          return ok({
            intent,
            action: { jobId: job.id, status: job.status, scheduled: job.scheduledDate },
            reply: `${job.id} is ${job.status}${job.scheduledDate ? `, scheduled ${job.scheduledDate}` : ", not yet scheduled"}. Deposit ${job.depositPaid ? "in" : "not in"}.`,
          });
        }

        case "quick-capture":
        default: {
          const row = withDb((d) => {
            const r = {
              id: shortId("INBX"), at: nowIso(), capturedBy: who, category: "quick",
              summary: intent.intent === "quick-capture" ? intent.note : utterance,
              fields: {}, status: "NEW" as const,
            };
            d.inbox.push(r);
            logActivity(d, "voice", `${who} quick-captured a note.`);
            return r;
          });
          return ok({ intent, action: row, reply: "Didn't match a command, so I captured it to the inbox — the filing engine will route it." });
        }
      }
    },
  );
}
