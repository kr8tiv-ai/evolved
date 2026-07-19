/**
 * Evolved tools — leads, customers, jobs, and dispatch.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { addDays, loadDb, nowIso, round2, shortId, today, withDb } from "../store.js";
import type { Customer, JobStatus, Lead } from "../types.js";
import { COST_MODEL } from "../engine/pricing.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerPipelineTools(server: McpServer): void {
  server.registerTool(
    "lead_capture",
    {
      title: "Capture a lead",
      description:
        "Log a new lead into the sales funnel (New → Contacted → Site visit → Quoted → Won/Lost). Creates the customer record if needed. Company rule: every open lead carries a NEXT ACTION with a date — this tool enforces it.",
      inputSchema: {
        name: z.string().describe("Customer or company name"),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        source: z.string().describe("Where the lead came from (referral, website, phone, ...)"),
        summary: z.string().describe("What they want, in one line"),
        nextAction: z.string().describe("The concrete next step"),
        nextActionDate: z.string().optional().describe("YYYY-MM-DD, default tomorrow"),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          let customer = db.customers.find(
            (c) => c.name.toLowerCase() === input.name.toLowerCase(),
          );
          if (!customer) {
            customer = {
              id: shortId("CUST"),
              name: input.name,
              phone: input.phone,
              email: input.email,
              address: input.address,
              createdAt: nowIso(),
            } satisfies Customer;
            db.customers.push(customer);
          }
          const lead: Lead = {
            id: shortId("LEAD"),
            customerId: customer.id,
            source: input.source,
            stage: "New",
            summary: input.summary,
            nextAction: input.nextAction,
            nextActionDate: input.nextActionDate ?? addDays(today(), 1),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          db.leads.push(lead);
          return { lead, customer };
        }),
      );
    },
  );

  server.registerTool(
    "lead_update",
    {
      title: "Advance a lead",
      description: "Move a lead through the funnel and refresh its next action. Won/Lost closes it out.",
      inputSchema: {
        leadId: z.string(),
        stage: z.enum(["New", "Contacted", "Site visit", "Quoted", "Won", "Lost"]).optional(),
        nextAction: z.string().optional(),
        nextActionDate: z.string().optional(),
        notes: z.string().optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const lead = db.leads.find((l) => l.id === input.leadId);
          if (!lead) throw new Error(`Unknown lead ${input.leadId}`);
          if (input.stage) lead.stage = input.stage;
          if (input.nextAction) lead.nextAction = input.nextAction;
          if (input.nextActionDate) lead.nextActionDate = input.nextActionDate;
          if (input.notes) lead.notes = input.notes;
          lead.updatedAt = nowIso();
          return { lead };
        }),
      );
    },
  );

  server.registerTool(
    "pipeline_view",
    {
      title: "Sales pipeline view",
      description:
        "The whole funnel at a glance: open leads by stage with next actions, quotes out with age, and jobs by dispatch status. The first tool to reach for when asked 'where's the business at?'",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      const openLeads = db.leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
      return ok({
        leads: openLeads.map((l) => ({
          id: l.id,
          stage: l.stage,
          summary: l.summary,
          nextAction: `${l.nextAction} (${l.nextActionDate})`,
          overdue: l.nextActionDate < today(),
        })),
        quotesOut: db.quotes
          .filter((q) => q.status === "Sent")
          .map((q) => ({ id: q.id, total: q.total, validUntil: q.validUntil })),
        jobs: db.jobs.map((j) => ({
          id: j.id,
          status: j.status,
          scheduled: j.scheduledDate ?? "(unscheduled)",
          site: j.siteAddress,
          depositPaid: j.depositPaid,
        })),
      });
    },
  );

  server.registerTool(
    "job_schedule",
    {
      title: "Schedule / dispatch a job",
      description:
        "Book a job onto the dispatch board: date, crew, deposit status. Moves it along Awaiting acceptance → Booked → Confirmed → In progress. Checks the blast-day weather verdict for the chosen date.",
      inputSchema: {
        jobId: z.string(),
        scheduledDate: z.string().describe("YYYY-MM-DD"),
        crew: z.array(z.string()).optional(),
        depositPaid: z.boolean().optional(),
        status: z.enum(["Booked", "Confirmed", "In progress"]).optional(),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      const { getForecast } = await import("../engine/weather.js");
      const forecast = await getForecast(7);
      const day = forecast.days.find((d) => d.date === input.scheduledDate);
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === input.jobId);
          if (!job) throw new Error(`Unknown job ${input.jobId}`);
          job.scheduledDate = input.scheduledDate;
          if (input.crew) job.crew = input.crew;
          if (input.depositPaid != null) job.depositPaid = input.depositPaid;
          job.status = (input.status ?? "Booked") as JobStatus;
          job.updatedAt = nowIso();
          return {
            job,
            weatherCheck: day
              ? `${day.date}: ${day.verdict} (${day.tmaxC}°C, wind ${day.windKmh} km/h, precip ${day.precipPct}%)`
              : "Date beyond the 7-day forecast window — recheck closer to the day.",
          };
        }),
      );
    },
  );

  server.registerTool(
    "job_complete",
    {
      title: "Complete a job (record actuals)",
      description:
        "Close out a job with real numbers: hours, crew size, materials, fuel. Computes wages from the loaded crew rate, total cost, profit, margin, and a verdict — then feeds the per-job P&L. Follow with pricing_record_outcome to teach the quoting engine, and invoice_create to get paid.",
      inputSchema: {
        jobId: z.string(),
        hoursWorked: z.number().positive(),
        crewSize: z.number().int().positive(),
        materials: z.number().min(0),
        fuel: z.number().min(0),
        revenue: z.number().positive().describe("Job revenue before GST (usually the quote subtotal)"),
      },
      annotations: { readOnlyHint: false },
    },
    async (input) => {
      return ok(
        withDb((db) => {
          const job = db.jobs.find((j) => j.id === input.jobId);
          if (!job) throw new Error(`Unknown job ${input.jobId}`);
          const wages = round2(input.hoursWorked * input.crewSize * COST_MODEL.crewRatePerHour);
          const totalCost = round2(wages + input.materials + input.fuel);
          const profit = round2(input.revenue - totalCost);
          const marginPct = round2((profit / input.revenue) * 100);
          job.actuals = {
            hoursWorked: input.hoursWorked,
            crewSize: input.crewSize,
            wages,
            materials: input.materials,
            fuel: input.fuel,
            totalCost,
            revenue: input.revenue,
            profit,
            marginPct,
            verdict: profit < 0 ? "loss" : marginPct < 20 ? "thin" : "healthy",
            completedAt: nowIso(),
          };
          job.status = "Complete";
          job.updatedAt = nowIso();
          return {
            job,
            nextSteps: [
              "invoice_create to bill the balance",
              "pricing_record_outcome to teach the quoting engine",
              "flha_signoff if the day's FLHA is still open",
            ],
          };
        }),
      );
    },
  );

  server.registerTool(
    "customer_list",
    {
      title: "List customers",
      description: "Customer book with contact details and their quotes/jobs at a glance.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const db = loadDb();
      return ok(
        db.customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          quotes: db.quotes.filter((q) => q.customerId === c.id).map((q) => q.id),
          jobs: db.jobs.filter((j) => j.customerId === c.id).map((j) => j.id),
        })),
      );
    },
  );
}
