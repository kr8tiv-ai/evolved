/**
 * Evolved tools — field operations (the field app made portable).
 *
 * What the crew actually does on-site: log before/after photos, capture
 * notes by voice or text, punch in and out against jobs (feeding real labor
 * cost into Job P&L), and author the day's JHA/FLHA ON-SITE — hazard
 * assessments are generated in the field by the people standing in front of
 * the hazards; auto-drafts are only a starting point.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadDb, logActivity, nowIso, round2, shortId, today, withDb } from "../store.js";
import { STANDARD_PPE } from "../engine/safety.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerFieldTools(server: McpServer): void {
  server.registerTool(
    "field_photo_log",
    {
      title: "Log a job photo",
      description:
        "File a before/after/progress photo against a job — the same discipline as the production company's job-photo folders. Returns the job's album state so gaps (a 'before' with no 'after') are visible immediately.",
      inputSchema: {
        jobId: z.string(),
        kind: z.enum(["before", "after", "progress"]),
        caption: z.string().max(200),
        takenBy: z.string().max(60),
      },
    },
    async ({ jobId, kind, caption, takenBy }) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === jobId);
          if (!job) return { error: `No job ${jobId}. Photos must attach to a real job — check dispatch_board.` };
          const photo = { id: shortId("PHOTO"), jobId, kind, caption, takenBy, at: nowIso() };
          db.photos.push(photo);
          logActivity(db, "field", `${kind} photo logged on ${jobId} by ${takenBy}.`);
          const album = db.photos.filter((p) => p.jobId === jobId);
          const counts = { before: 0, after: 0, progress: 0 } as Record<string, number>;
          for (const p of album) counts[p.kind] += 1;
          return {
            logged: photo,
            album: counts,
            gap: counts.before > 0 && counts.after === 0 ? "Before shots with no after — close the album when the job wraps." : undefined,
          };
        }),
      );
    },
  );

  server.registerTool(
    "field_note",
    {
      title: "Capture a field note",
      description:
        "A crew note from the field, by voice or text — a lead a neighbor mentioned, site access details, anything. Attaches to a job when given; otherwise it lands in the App Inbox for the filing engine so nothing is lost.",
      inputSchema: {
        text: z.string().min(3).max(500),
        by: z.string().max(60),
        jobId: z.string().optional(),
        source: z.enum(["voice", "text"]).optional(),
      },
    },
    async ({ text, by, jobId, source }) => {
      return ok(
        withDb((db) => {
          if (jobId && !db.jobs.find((j) => j.id === jobId)) {
            return { error: `No job ${jobId} — captured nothing. Re-send without jobId to file it to the inbox instead.` };
          }
          const note = { id: shortId("FN"), jobId, text, by, source: source ?? "text", at: nowIso() };
          db.fieldNotes.push(note);
          if (!jobId) {
            db.inbox.push({
              id: shortId("INBX"), at: nowIso(), capturedBy: by, category: "field-note",
              summary: text.slice(0, 120), fields: {}, status: "NEW",
            });
          }
          logActivity(db, "field", `Field note by ${by}${jobId ? ` on ${jobId}` : " → inbox"}.`);
          return { captured: note, routedToInbox: !jobId };
        }),
      );
    },
  );

  server.registerTool(
    "crew_checkin",
    {
      title: "Crew clock-in",
      description:
        "Punch a crew member in against a job. One open entry per person per job — double punch-ins are refused, not silently duplicated.",
      inputSchema: { crewName: z.string().max(60), jobId: z.string() },
    },
    async ({ crewName, jobId }) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === jobId);
          if (!job) return { error: `No job ${jobId}.` };
          const open = db.timeEntries.find((t) => t.crewName === crewName && t.jobId === jobId && !t.outAt);
          if (open) return { error: `${crewName} is already on the clock for ${jobId} (since ${open.inAt}).` };
          const entry = { id: shortId("TIME"), crewName, jobId, inAt: nowIso() };
          db.timeEntries.push(entry);
          if (job.status === "Confirmed") { job.status = "In progress"; job.updatedAt = nowIso(); }
          logActivity(db, "field", `${crewName} clocked in on ${jobId}.`);
          return { clockedIn: entry, jobStatus: job.status };
        }),
      );
    },
  );

  server.registerTool(
    "crew_checkout",
    {
      title: "Crew clock-out",
      description:
        "Punch out: closes the open time entry, computes hours and wage from the crew member's rate (Time Log tab), and that labor flows into Job P&L as actual cost — quoted vs actual with no manual math.",
      inputSchema: { crewName: z.string().max(60), jobId: z.string(), note: z.string().max(200).optional() },
    },
    async ({ crewName, jobId, note }) => {
      return ok(
        withDb((db) => {
          const entry = db.timeEntries.find((t) => t.crewName === crewName && t.jobId === jobId && !t.outAt);
          if (!entry) return { error: `${crewName} has no open entry on ${jobId} — nothing to close.` };
          entry.outAt = nowIso();
          const hours = Math.max(0.1, round2((new Date(entry.outAt).getTime() - new Date(entry.inAt).getTime()) / 3_600_000));
          const rate = db.crew.find((m) => m.name === crewName)?.hourlyRate ?? 45;
          entry.hours = hours;
          entry.wage = round2(hours * rate);
          if (note) entry.note = note;
          logActivity(db, "field", `${crewName} clocked out on ${jobId}: ${hours}h / $${entry.wage}.`);
          const jobHours = db.timeEntries.filter((t) => t.jobId === jobId && t.hours);
          return {
            clockedOut: entry,
            jobLaborSoFar: {
              entries: jobHours.length,
              hours: round2(jobHours.reduce((s, t) => s + (t.hours ?? 0), 0)),
              wages: round2(jobHours.reduce((s, t) => s + (t.wage ?? 0), 0)),
            },
          };
        }),
      );
    },
  );

  server.registerTool(
    "flha_field_capture",
    {
      title: "On-site JHA capture (crew-authored)",
      description:
        "The crew authors the day's hazard assessment ON-SITE — real hazards from the people standing in front of them, not a desk draft. Creates the job's FLHA for today (or upgrades an auto-draft): field-authored hazards are merged in and the record is marked source=field. Auto-drafts (flha_open) are starting points; this is the source of truth.",
      inputSchema: {
        jobId: z.string(),
        capturedBy: z.string().max(60),
        crew: z.array(z.string()).min(1),
        siteConditions: z.string().max(300),
        hazards: z.array(z.object({
          hazard: z.string().max(120),
          risk: z.enum(["low", "medium", "high"]),
          mitigations: z.array(z.string().max(160)).min(1),
        })).min(1),
        musterPoint: z.string().max(120).optional(),
      },
    },
    async ({ jobId, capturedBy, crew, siteConditions, hazards, musterPoint }) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === jobId);
          if (!job) return { error: `No job ${jobId}.` };
          const t = today();
          let flha = db.flhas.find((f) => f.jobId === jobId && f.date === t && !f.signoff);
          if (flha) {
            // Field capture upgrades the auto-draft: crew hazards merge in and win.
            const known = new Set(flha.hazards.map((h) => h.hazard.toLowerCase()));
            for (const h of hazards) if (!known.has(h.hazard.toLowerCase())) flha.hazards.push(h);
            flha.crew = crew;
            flha.siteConditions = siteConditions;
            if (musterPoint) flha.musterPoint = musterPoint;
            flha.source = "field";
          } else {
            flha = {
              id: shortId("FLHA"), jobId, date: t, crew, siteConditions,
              hazards, ppeConfirmed: STANDARD_PPE, musterPoint: musterPoint ?? "Front of the work truck",
              openedBy: capturedBy, openedAt: nowIso(), source: "field",
            };
            db.flhas.push(flha);
          }
          logActivity(db, "safety", `On-site JHA captured for ${jobId} by ${capturedBy} (${hazards.length} crew-identified hazards).`);
          return {
            flha,
            note: "Crew-authored, on-site. Sign off at end of day with flha_signoff — the permanent safety record.",
          };
        }),
      );
    },
  );
}
