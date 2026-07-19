/**
 * Evolved tools — FLHA / field safety.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { hazardsForScope, STANDARD_PPE } from "../engine/safety.js";
import { loadDb, nowIso, shortId, today, withDb } from "../store.js";
import type { Flha } from "../types.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerSafetyTools(server: McpServer): void {
  server.registerTool(
    "flha_open",
    {
      title: "Open an FLHA (field-level hazard assessment)",
      description:
        "Open the day's FLHA for a job before work starts. Drafts the hazard list automatically from the job scope using the abrasive-blasting hazard library — each hazard comes with specific mitigations, not boilerplate — plus standard PPE and a muster point. Crew adds site-specific hazards on top. No FLHA, no blasting.",
      inputSchema: {
        jobId: z.string(),
        crew: z.array(z.string()).min(1),
        siteConditions: z.string().describe("Weather, ground, traffic, occupancy — what the crew sees on arrival"),
        extraHazards: z.array(z.string()).optional().describe("Site-specific hazards the crew identified"),
        musterPoint: z.string().optional(),
        openedBy: z.string(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === input.jobId);
          if (!job) throw new Error(`Unknown job ${input.jobId}`);
          const existing = db.flhas.find((f) => f.jobId === input.jobId && f.date === today() && !f.signoff);
          if (existing) {
            return { flha: existing, note: "An open FLHA already exists for this job today." };
          }
          const flha: Flha = {
            id: shortId("FLHA"),
            jobId: input.jobId,
            date: today(),
            crew: input.crew,
            siteConditions: input.siteConditions,
            hazards: hazardsForScope(job.scope + " " + input.siteConditions, input.extraHazards ?? [], db.customHazards),
            ppeConfirmed: STANDARD_PPE,
            musterPoint: input.musterPoint ?? "Truck staging area",
            openedBy: input.openedBy,
            openedAt: nowIso(),
          };
          db.flhas.push(flha);
          return {
            flha,
            reminder: "Review each hazard and mitigation at the tailgate meeting before pressurizing. Sign off at end of day with flha_signoff.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "flha_signoff",
    {
      title: "End-of-day FLHA sign-off",
      description:
        "Close the day's FLHA: every crew member signs, incident status is recorded, and the assessment becomes part of the job's permanent safety record. Flags any crew member who has not signed.",
      inputSchema: {
        flhaId: z.string(),
        signedBy: z.array(z.string()).min(1),
        incidentFree: z.boolean(),
        notes: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const flha = db.flhas.find((f) => f.id === input.flhaId);
          if (!flha) throw new Error(`Unknown FLHA ${input.flhaId}`);
          if (flha.signoff) return { flha, note: "Already signed off." };
          const missing = flha.crew.filter((c) => !input.signedBy.includes(c));
          flha.signoff = {
            signedBy: input.signedBy,
            incidentFree: input.incidentFree,
            notes: input.notes ?? "",
            signedAt: nowIso(),
          };
          return {
            flha,
            warnings: missing.length
              ? [`Crew members on the FLHA who have NOT signed: ${missing.join(", ")} — chase signatures before filing.`]
              : [],
            incidentFollowUp: input.incidentFree
              ? undefined
              : "Incident recorded — open an incident report and notify the owner today.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "safety_log",
    {
      title: "Safety record",
      description: "The FLHA history: open assessments needing sign-off, signed records, and incident flags across all jobs.",
      inputSchema: { jobId: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ jobId }) => {
      const db = loadDb();
      const rows = db.flhas.filter((f) => (jobId ? f.jobId === jobId : true));
      return ok({
        openNeedingSignoff: rows.filter((f) => !f.signoff).map((f) => f.id),
        records: rows.map((f) => ({
          id: f.id,
          jobId: f.jobId,
          date: f.date,
          crew: f.crew,
          hazards: f.hazards.length,
          signedOff: Boolean(f.signoff),
          incidentFree: f.signoff?.incidentFree,
        })),
      });
    },
  );
}
