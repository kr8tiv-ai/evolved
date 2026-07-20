/**
 * v3 surface tests: the workbook spine (Google Sheets / CSV), field
 * operations (photos, notes, time clock, on-site JHA), and growth
 * (reviews, reputation, Job P&L scorecard, dispatch board, branding,
 * trade-pack preview).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../server.js";
import { DATA_DIR, resetDb } from "../store.js";
import { googleCreds, workbookTabs } from "../engine/sheets.js";

async function connect() {
  const server = createServer();
  const client = new Client({ name: "test", version: "0.0.0" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  await client.connect(ct);
  return { server, client };
}

function parse(res: unknown): any {
  const content = (res as { content: { type: string; text: string }[] }).content;
  return JSON.parse(content.find((c) => c.type === "text")!.text);
}

test("workbook: tabs cover the whole OS and CSV export writes real files", async () => {
  const db = resetDb();
  const tabs = workbookTabs(db);
  assert.ok(tabs.length >= 18, `expected >=18 tabs, got ${tabs.length}`);
  for (const required of ["Quotes", "Dispatch", "Expenses", "Time Log", "Job Photos", "Reviews", "Job P&L", "Rate Table"]) {
    assert.ok(tabs.some((t) => t.title === required), `missing tab ${required}`);
  }
  const quotesTab = tabs.find((t) => t.title === "Quotes")!;
  assert.equal(quotesTab.rows.length - 1, db.quotes.length, "one row per quote plus header");

  const { client } = await connect();
  const out = parse(await client.callTool({ name: "workbook_export", arguments: {} }));
  assert.ok(out.files.length === tabs.length, "one CSV per tab");
  const quotesCsv = readFileSync(join(DATA_DIR, "workbook", "Quotes.csv"), "utf8");
  assert.match(quotesCsv.split("\n")[0], /^Quote #,Customer/);
  assert.ok(existsSync(join(DATA_DIR, "workbook", "INDEX.md")));

  const status = parse(await client.callTool({ name: "workbook_status", arguments: {} }));
  assert.equal(status.linked.provider, "csv");
});

test("workbook: without credentials, create explains and falls back; sync refreshes CSV", async () => {
  resetDb();
  assert.equal(googleCreds(), null, "test env must not carry EVOLVED_GOOGLE_SA");
  const { client } = await connect();
  const created = parse(await client.callTool({ name: "workbook_create", arguments: {} }));
  assert.equal(created.created, false);
  assert.match(created.guide, /EVOLVED_GOOGLE_SA/);
  assert.ok(created.csvFallback.files.length > 0);
  const synced = parse(await client.callTool({ name: "workbook_sync", arguments: {} }));
  assert.equal(synced.synced, true);
  assert.equal(synced.provider, "csv");
});

test("field: photo album, note routing, and the time clock feed Job P&L", async () => {
  resetDb();
  const { client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // Photos: before with no after raises the album gap.
  const photo = await call("field_photo_log", { jobId: "JOB-1043", kind: "before", caption: "Gum and grime", takenBy: "T. Field" });
  assert.equal(photo.album.before, 1);
  assert.match(photo.gap, /no after/);

  // Notes: with a job they attach; without one they land in the inbox.
  const attached = await call("field_note", { text: "Access from the alley only", by: "T. Field", jobId: "JOB-1043" });
  assert.equal(attached.routedToInbox, false);
  const loose = await call("field_note", { text: "Cafe next door wants their patio quoted", by: "T. Field", source: "voice" });
  assert.equal(loose.routedToInbox, true);
  const bogus = await call("field_note", { text: "x note", by: "T", jobId: "JOB-NOPE" });
  assert.match(bogus.error, /No job/);

  // Time clock: double punch-in refused; checkout computes hours and wage.
  const punch = await call("crew_checkin", { crewName: "T. Field", jobId: "JOB-1043" });
  assert.equal(punch.jobStatus, "In progress", "clock-in moves Confirmed → In progress");
  const dup = await call("crew_checkin", { crewName: "T. Field", jobId: "JOB-1043" });
  assert.match(dup.error, /already on the clock/);
  const out = await call("crew_checkout", { crewName: "T. Field", jobId: "JOB-1043" });
  assert.ok(out.clockedOut.hours >= 0.1);
  assert.ok(out.clockedOut.wage > 0);
  assert.ok(out.jobLaborSoFar.wages >= out.clockedOut.wage);

  // That labor shows up as Job P&L cost basis before actuals exist.
  const pnl = await call("job_pnl_report");
  const row = pnl.jobs.find((j: any) => j.jobId === "JOB-1043");
  assert.equal(row.costBasis, "time-log labor only");
  assert.ok(row.cost > 0);
});

test("field: reporting a hazard escalates it, and stop-work actually stops the job", async () => {
  resetDb();
  const { client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // A low-severity report is still recorded, but it must not cry wolf.
  const low = await call("hazard_report", {
    reportedBy: "T. Field", what: "Extension cord run across the walkway", where: "Side gate", severity: "low",
  });
  assert.equal(low.actionItem.severity, "info");
  assert.equal(low.workStopped, undefined);

  // A bad job reference never silently drops a hazard.
  const bogus = await call("hazard_report", {
    reportedBy: "T. Field", what: "Something unsafe over here", where: "Yard", severity: "high", jobId: "JOB-NOPE",
  });
  assert.match(bogus.error, /No job/);

  // Stop-work: urgent action item, owner draft, and the job comes off "In progress".
  await call("crew_checkin", { crewName: "T. Field", jobId: "JOB-1043" });
  const stop = await call("hazard_report", {
    reportedBy: "T. Field", what: "Live overhead line inside the blast radius", where: "North fence line",
    severity: "stop-work", jobId: "JOB-1043", immediateAction: "Shut down the pot and pulled everyone back",
  });
  assert.equal(stop.actionItem.severity, "urgent");
  assert.match(stop.actionItem.message, /STOP-WORK/);
  assert.match(stop.workStopped.message, /Work is STOPPED/);
  assert.equal(stop.workStopped.jobId, "JOB-1043");
  assert.match(stop.notifyOwner.subject, /\[STOP WORK\]/);
  assert.match(stop.notifyOwner.body, /WORK IS STOPPED/);
  assert.match(stop.notifyOwner.body, /Shut down the pot/);
  // Drafted, never auto-sent on a crew member's behalf.
  assert.match(stop.note, /drafted, not sent/);

  // The safety record surfaces it loudly until someone clears it.
  const log = await call("safety_log");
  assert.equal(log.stopWorkActive, true);
  assert.ok(log.unclearedHazards.some((h: any) => h.id === stop.report.id));

  // ...and it outranks the money flags on the dispatch board.
  const board = await call("dispatch_board");
  assert.match(board.flags[0], /STOP-WORK hazard uncleared/);
});

test("field: the JHA is authored on-site — field capture creates or upgrades the day's FLHA", async () => {
  resetDb();
  const { client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  const captured = await call("flha_field_capture", {
    jobId: "JOB-1043", capturedBy: "T. Field", crew: ["T. Field", "R. Nozzle"],
    siteConditions: "Storefront apron, pedestrian traffic both directions",
    hazards: [
      { hazard: "Pedestrians crossing the work zone", risk: "high", mitigations: ["Cone and tape both approaches", "Spotter during blasting"] },
    ],
  });
  assert.equal(captured.flha.source, "field");
  assert.ok(captured.flha.hazards.some((h: any) => /Pedestrians/.test(h.hazard)));

  // A second capture the same day merges rather than duplicating — and on a
  // collision the crew's on-site version WINS over the earlier entry.
  const merged = await call("flha_field_capture", {
    jobId: "JOB-1043", capturedBy: "R. Nozzle", crew: ["T. Field", "R. Nozzle"],
    siteConditions: "Wind picked up from the west",
    hazards: [
      { hazard: "Pedestrians crossing the work zone", risk: "medium", mitigations: ["Foot traffic rerouted — barrier fencing installed by the GC"] },
      { hazard: "Dust drift toward doorway", risk: "medium", mitigations: ["Reposition containment curtain"] },
    ],
  });
  const names = merged.flha.hazards.map((h: any) => h.hazard);
  assert.equal(names.filter((n: string) => /Pedestrians/.test(n)).length, 1, "no duplicate hazards");
  assert.ok(names.some((n: string) => /Dust drift/.test(n)));
  const ped = merged.flha.hazards.find((h: any) => /Pedestrians/.test(h.hazard));
  assert.equal(ped.risk, "medium", "field capture replaces the earlier entry — on-site assessment wins");
  assert.match(ped.mitigations[0], /barrier fencing/);
});

test("growth: review loop, reputation ledger, dispatch board, brand, pack preview", async () => {
  resetDb();
  const { client } = await connect();
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args }).then(parse);

  // Review asks only go out on finished work; drafts are human-sent.
  const early = await call("review_request", { jobId: "JOB-1043" });
  assert.match(early.error, /after completion/);
  const ask = await call("review_request", { jobId: "JOB-1041" });
  assert.ok(ask.alreadyReceived, "seeded five-star review already on file");

  const rep = await call("reputation_report");
  assert.equal(rep.averageRating, 5);
  assert.ok(rep.testimonialBank.length >= 1);

  const board = await call("dispatch_board");
  assert.ok(board.board["Booked"].length >= 1);
  assert.ok(board.flags.some((f: string) => /UNSCHEDULED/.test(f)), "deposit-in-unscheduled is flagged");

  const scorecard = (await call("job_pnl_report")).scorecard;
  assert.ok(scorecard.jobsTracked >= 1);
  assert.match(scorecard.quoteWinRate, /%/);

  const brand = await call("brand_configure", { company: "Test Wash Co", tagline: "CLEAN AS BUILT" });
  assert.equal(brand.company, "Test Wash Co");
  assert.equal(brand.brand.tagline, "CLEAN AS BUILT");

  // franchise_preview is read-only: rates shown, nothing mutated.
  const preview = await call("franchise_preview", { tradePack: "pressure-washing" });
  assert.equal(preview.pack.key, "pressure-washing");
  assert.ok(preview.rateCard.length === 4);
  const after = await call("pricing_rates");
  assert.ok(Array.isArray(after.rates ?? after), "rate table still readable");
  const still = await call("business_snapshot");
  assert.match(JSON.stringify(still), /Test Wash Co/, "preview did not reseed the brand we just set");

  resetDb(); // leave a clean dataset for whatever runs next
});
