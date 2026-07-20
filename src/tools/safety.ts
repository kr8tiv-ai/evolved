/**
 * Evolved tools — FLHA / field safety.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { hazardsForScope, STANDARD_PPE } from "../engine/safety.js";
import { loadDb, logActivity, nowIso, shortId, today, withDb } from "../store.js";
import type { ActionItem, Flha, HazardReport } from "../types.js";

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
    "hazard_report",
    {
      title: "Report a hazard (field escalation)",
      description:
        "The one-screen escalation from the deployed field app: a crew member found something unsafe and needs it off their hands NOW. Records the hazard, raises an action item at the matching urgency, and returns a ready-to-send owner notification. A 'stop-work' report is not a severity label — it puts the job into a stopped state and says so in the response, because the crew has already downed tools. Nothing here waits for the next FLHA.",
      inputSchema: {
        reportedBy: z.string().max(60),
        what: z.string().min(5).max(400).describe("What the hazard is, in the reporter's own words"),
        where: z.string().max(200).describe("Where on site — the crew has to be able to find it again"),
        severity: z.enum(["low", "medium", "high", "stop-work"]),
        jobId: z.string().optional().describe("Attach to a job when the hazard is on one of ours"),
        immediateAction: z.string().max(300).optional().describe("What the reporter already did (tagged out, coned off, evacuated)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ reportedBy, what, where, severity, jobId, immediateAction }) => {
      return ok(
        withDb((db) => {
          if (jobId && !db.jobs.find((j) => j.id === jobId)) {
            return { error: `No job ${jobId}. Re-send without jobId to report a hazard that is not on one of our jobs — a hazard is never dropped for a bad reference.` };
          }

          const report: HazardReport = {
            id: shortId("HZ"), jobId, reportedBy, what, where, severity,
            immediateAction, at: nowIso(),
          };

          // Severity drives urgency, and only the top two stop anything. A "low"
          // report is still recorded and still raises an item — it just doesn't
          // cry wolf, so the urgent queue stays worth reading.
          const urgent = severity === "high" || severity === "stop-work";
          const item: ActionItem = {
            id: shortId("ACT"),
            rule: "hazard-reported",
            severity: urgent ? "urgent" : severity === "medium" ? "warn" : "info",
            message: `${severity === "stop-work" ? "STOP-WORK" : severity.toUpperCase()} hazard reported by ${reportedBy} at ${where}${jobId ? ` (${jobId})` : ""}: ${what}`,
            relatedId: report.id,
            raisedAt: nowIso(),
          };
          db.actionItems.push(item);
          report.actionItemId = item.id;
          db.hazardReports.push(report);

          // Stop-work means the tools are already down. We deliberately do NOT
          // invent a new job status for it: the pipeline statuses are a money/
          // delivery ladder that dispatch, the board and the sheet tabs all agree
          // on, and a safety hold is orthogonal to where a job sits on it. The
          // hold lives on the hazard record and is surfaced as a flag on the
          // dispatch board and in safety_log until someone clears it in person.
          const workStopped = severity === "stop-work"
            ? {
                jobId,
                message: `Work is STOPPED${jobId ? ` on ${jobId}` : ""} until this hazard is cleared. Flagged on the dispatch board and in safety_log; clearing is a deliberate act, not a timeout.`,
              }
            : undefined;

          logActivity(db, "safety", `${severity} hazard reported by ${reportedBy} at ${where}.`);

          const subject = `${severity === "stop-work" ? "[STOP WORK] " : urgent ? "[URGENT] " : ""}Hazard reported — ${where}`;
          const notify = {
            subject,
            body: [
              `${reportedBy} reported a ${severity} hazard.`,
              ``,
              `What:  ${what}`,
              `Where: ${where}`,
              jobId ? `Job:   ${jobId}` : `Job:   not attached to one of our jobs`,
              immediateAction ? `Already done: ${immediateAction}` : `Already done: nothing recorded — confirm the area is safe.`,
              ``,
              severity === "stop-work"
                ? `WORK IS STOPPED. Do not restart until someone has cleared this in person.`
                : urgent
                  ? `Treat as urgent — confirm control measures before the next shift.`
                  : `Logged for review at the next tailgate meeting.`,
              ``,
              `Reported ${report.at} · ${report.id}`,
            ].join("\n"),
          };

          return {
            report,
            actionItem: item,
            workStopped,
            notifyOwner: notify,
            note: "Owner notification is drafted, not sent — Evolved never sends on a crew member's behalf without the operator seeing it. Clear the hazard on the record once it is physically resolved.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "safety_log",
    {
      title: "Safety record",
      description: "The safety record: FLHAs (open assessments needing sign-off, signed records, incident flags) plus hazards escalated from the field and whether they have been cleared.",
      inputSchema: { jobId: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ jobId }) => {
      const db = loadDb();
      const rows = db.flhas.filter((f) => (jobId ? f.jobId === jobId : true));
      const hazards = db.hazardReports.filter((h) => (jobId ? h.jobId === jobId : true));
      const uncleared = hazards.filter((h) => !h.clearedAt);
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
        // An uncleared stop-work is the loudest thing in this system.
        stopWorkActive: uncleared.some((h) => h.severity === "stop-work"),
        unclearedHazards: uncleared.map((h) => ({
          id: h.id, jobId: h.jobId, severity: h.severity, what: h.what,
          where: h.where, reportedBy: h.reportedBy, at: h.at,
          acknowledged: Boolean(h.acknowledgedBy),
        })),
        hazardsReported: hazards.length,
      });
    },
  );
}
