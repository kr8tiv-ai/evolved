/**
 * Evolved engine — the workbook spine.
 *
 * The production system lives in a Google Sheets operations workbook; this
 * engine makes that real for anyone. With a Google service account
 * (EVOLVED_GOOGLE_SA = inline JSON or a file path), Evolved creates and syncs
 * an actual Google Sheets workbook — every collection a tab. With zero
 * credentials it exports the same workbook as a CSV bundle, so the spine
 * works offline by default and upgrades to live Sheets with one env var.
 *
 * No SDK dependency: the service-account flow is a signed RS256 JWT
 * (node:crypto) exchanged at Google's token endpoint, then plain fetch
 * against the Sheets v4 REST API.
 */

import { createSign } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Database } from "../types.js";
import { money, round2 } from "../store.js";

// ---------------------------------------------------------------------------
// Credentials

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** EVOLVED_GOOGLE_SA is inline service-account JSON or a path to the file. */
export function googleCreds(): ServiceAccount | null {
  const raw = process.env.EVOLVED_GOOGLE_SA;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8");
    const parsed = JSON.parse(text) as Partial<ServiceAccount>;
    if (parsed.client_email && parsed.private_key) {
      return { client_email: parsed.client_email, private_key: parsed.private_key };
    }
  } catch {
    /* malformed creds are treated as absent — the CSV path always works */
  }
  return null;
}

const b64url = (s: Buffer | string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Sign a service-account JWT and exchange it for an OAuth access token. */
export async function accessToken(creds: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(creds.private_key));
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${header}.${claims}.${signature}`,
  });
  if (!resp.ok) throw new Error(`Google token exchange failed: HTTP ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token exchange returned no access_token");
  return data.access_token;
}

// ---------------------------------------------------------------------------
// The workbook itself: every collection rendered as a tab of rows.

export interface WorkbookTab {
  title: string;
  rows: (string | number)[][];
}

export function workbookTabs(db: Database): WorkbookTab[] {
  const c = (id: string) => db.customers.find((x) => x.id === id)?.name ?? id;
  const tabs: WorkbookTab[] = [];

  tabs.push({
    title: "Start Here",
    rows: [
      [`${db.meta.company} — OPERATIONS WORKBOOK`],
      [db.brand?.tagline ?? "Run by Evolved — the company operating system for the agent economy"],
      ["Currency", db.meta.currency, "GST", db.meta.gstRate],
      ["Seeded", db.meta.seededAt],
      [],
      ["Every tab in this workbook is written by the Evolved MCP server.",
       "Quotes, jobs, receipts, safety records, reviews, and the learning rate table stay in sync with the agent."],
    ],
  });

  tabs.push({
    title: "Quotes",
    rows: [
      ["Quote #", "Customer", "Site", "Sq Ft", "Subtotal", "GST", "Total", "Deposit", "Status", "Valid Until", "Margin %"],
      ...db.quotes.map((q) => [
        q.id, c(q.customerId), q.siteAddress, q.sqftTotal ?? "", q.subtotal, q.gst, q.total,
        q.depositRequired, q.status, q.validUntil, q.profitability?.marginPct ?? "",
      ]),
    ],
  });

  tabs.push({
    title: "Customers",
    rows: [
      ["ID", "Name", "Phone", "Email", "Address", "Notes"],
      ...db.customers.map((x) => [x.id, x.name, x.phone ?? "", x.email ?? "", x.address ?? "", x.notes ?? ""]),
    ],
  });

  tabs.push({
    title: "Leads",
    rows: [
      ["ID", "Customer", "Source", "Stage", "Summary", "Next Action", "Next Action Date"],
      ...db.leads.map((l) => [l.id, c(l.customerId), l.source, l.stage, l.summary, l.nextAction, l.nextActionDate]),
    ],
  });

  tabs.push({
    title: "Dispatch",
    rows: [
      ["Job", "Customer", "Site", "Scope", "Status", "Scheduled", "Crew", "Deposit Paid"],
      ...db.jobs.map((j) => [
        j.id, c(j.customerId), j.siteAddress, j.scope, j.status, j.scheduledDate ?? "unscheduled",
        j.crew.join(", "), j.depositPaid ? "yes" : "no",
      ]),
    ],
  });

  tabs.push({
    title: "Expenses",
    rows: [
      ["Receipt", "Date", "Vendor", "Category", "Before Tax", "GST", "Total", "Job", "OCR Model", "Warnings"],
      ...db.receipts.map((r) => [
        r.id, r.date, r.vendor, r.category, r.amountBeforeTax, r.gst, r.total, r.jobId ?? "",
        r.ocr.model, r.ocr.warnings.join("; "),
      ]),
    ],
  });

  tabs.push({
    title: "Invoices",
    rows: [
      ["Invoice", "Job", "Customer", "Subtotal", "GST", "Total", "Deposit Applied", "Balance Due", "Status", "Due"],
      ...db.invoices.map((i) => [
        i.id, i.jobId, c(i.customerId), i.subtotal, i.gst, i.total, i.depositApplied, i.balanceDue, i.status, i.dueDate,
      ]),
    ],
  });

  tabs.push({
    title: "Inventory",
    rows: [
      ["ID", "Section", "Item", "Unit", "On Hand", "Par", "Reorder At", "Last Unit Cost", "Last Supplier"],
      ...db.inventory.map((i) => [
        i.id, i.section, i.name, i.unit, i.onHand, i.parLevel, i.reorderAt, i.lastUnitCost ?? "", i.lastSupplier ?? "",
      ]),
    ],
  });

  tabs.push({
    title: "Suppliers",
    rows: [
      ["ID", "Name", "Location", "Phone", "Products", "Notes"],
      ...db.suppliers.map((s) => [s.id, s.name, s.location ?? "", s.phone ?? "", s.products ?? "", s.notes ?? ""]),
    ],
  });

  tabs.push({
    title: "Crew",
    rows: [
      ["ID", "Name", "Role", "Certifications", "Hourly", "Active"],
      ...db.crew.map((m) => [m.id, m.name, m.role, m.certifications.join(", "), m.hourlyRate, m.active ? "yes" : "no"]),
    ],
  });

  tabs.push({
    title: "Time Log",
    rows: [
      ["ID", "Crew", "Job", "In", "Out", "Hours", "Wage"],
      ...db.timeEntries.map((t) => [t.id, t.crewName, t.jobId, t.inAt, t.outAt ?? "on the clock", t.hours ?? "", t.wage ?? ""]),
    ],
  });

  tabs.push({
    title: "Job Photos",
    rows: [
      ["ID", "Job", "Kind", "Caption", "By", "At"],
      ...db.photos.map((p) => [p.id, p.jobId, p.kind, p.caption, p.takenBy, p.at]),
    ],
  });

  tabs.push({
    title: "Field Notes",
    rows: [
      ["ID", "Job", "Note", "By", "Source", "At"],
      ...db.fieldNotes.map((n) => [n.id, n.jobId ?? "", n.text, n.by, n.source, n.at]),
    ],
  });

  tabs.push({
    title: "Safety (FLHA)",
    rows: [
      ["ID", "Job", "Date", "Crew", "Hazards", "Source", "Signed Off"],
      ...db.flhas.map((f) => [
        f.id, f.jobId, f.date, f.crew.join(", "), f.hazards.map((h) => h.hazard).join("; "),
        f.source ?? "auto-draft", f.signoff ? "yes" : "no",
      ]),
    ],
  });

  tabs.push({
    title: "Reviews",
    rows: [
      ["ID", "Job", "Customer", "Status", "Rating", "Comment"],
      ...db.reviews.map((r) => [r.id, r.jobId, c(r.customerId), r.status, r.rating ?? "", r.comment ?? ""]),
    ],
  });

  tabs.push({
    title: "Action Items",
    rows: [
      ["ID", "Rule", "Severity", "Message", "Raised", "Resolved"],
      ...db.actionItems.map((a) => [a.id, a.rule, a.severity, a.message, a.raisedAt, a.resolvedAt ?? "open"]),
    ],
  });

  tabs.push({
    title: "To-Do",
    rows: [
      ["ID", "Task", "Category", "Priority", "Status", "Due"],
      ...db.todos.map((t) => [t.id, t.task, t.category, t.priority, t.status, t.due ?? ""]),
    ],
  });

  tabs.push({
    title: "Rate Table",
    rows: [
      ["Depth", "Label", "Base $/sqft", "Learned $/sqft", "Samples"],
      ...db.rateTable.map((r) => [r.depth, r.label, r.baseRate, r.learnedRate, r.samples]),
    ],
  });

  const withActuals = db.jobs.filter((j) => j.actuals);
  const revenue = round2(withActuals.reduce((s, j) => s + (j.actuals?.revenue ?? 0), 0));
  const cost = round2(withActuals.reduce((s, j) => s + (j.actuals?.totalCost ?? 0), 0));
  tabs.push({
    title: "Job P&L",
    rows: [
      ["Job", "Customer", "Revenue", "Cost", "Profit", "Margin %", "Verdict"],
      ...withActuals.map((j) => [
        j.id, c(j.customerId), j.actuals!.revenue, j.actuals!.totalCost, j.actuals!.profit,
        j.actuals!.marginPct, j.actuals!.verdict,
      ]),
      [],
      ["SCORECARD", "", revenue, cost, round2(revenue - cost), revenue ? round2(((revenue - cost) / revenue) * 100) : 0, ""],
    ],
  });

  tabs.push({
    title: "Record Log",
    rows: [
      ["At", "Source", "Event"],
      ...db.activity.slice(-200).map((a) => [a.at, a.source, a.message]),
    ],
  });

  return tabs;
}

// ---------------------------------------------------------------------------
// Google Sheets (live) — create and sync.

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

async function sheetsFetch(token: string, url: string, body?: unknown, method = "POST"): Promise<any> {
  const resp = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Sheets API ${method} ${url.slice(0, 80)}: HTTP ${resp.status} ${await resp.text()}`);
  return resp.json();
}

async function writeTabs(token: string, spreadsheetId: string, tabs: WorkbookTab[]): Promise<number> {
  // Clear each tab first: values:batchUpdate only overwrites the cells it
  // writes, so a shrinking collection would otherwise leave stale ghost rows.
  await sheetsFetch(token, `${SHEETS}/${spreadsheetId}/values:batchClear`, {
    ranges: tabs.map((t) => `'${t.title}'`),
  });
  const result = await sheetsFetch(token, `${SHEETS}/${spreadsheetId}/values:batchUpdate`, {
    valueInputOption: "RAW",
    data: tabs.map((t) => ({ range: `'${t.title}'!A1`, values: t.rows.length ? t.rows : [[""]] })),
  });
  return result.totalUpdatedCells ?? 0;
}

/**
 * A spreadsheet created by a service account is visible only to that account
 * until it is shared — without this, the returned URL dead-ends at Google's
 * "You need access" page. drive.file scope covers files the SA created.
 */
async function shareWorkbook(token: string, spreadsheetId: string, email?: string): Promise<string> {
  const perm = email
    ? { role: "writer", type: "user", emailAddress: email }
    : { role: "writer", type: "anyone" };
  await sheetsFetch(
    token,
    `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions${email ? "" : "?sendNotificationEmail=false"}`,
    perm,
  );
  return email ? `shared with ${email} (writer)` : "anyone with the link (writer)";
}

export async function createGoogleWorkbook(
  creds: ServiceAccount,
  title: string,
  tabs: WorkbookTab[],
  shareWith?: string,
): Promise<{ spreadsheetId: string; url: string; sharing: string }> {
  const token = await accessToken(creds);
  const created = await sheetsFetch(token, SHEETS, {
    properties: { title },
    sheets: tabs.map((t) => ({ properties: { title: t.title } })),
  });
  const spreadsheetId = created.spreadsheetId as string;
  await writeTabs(token, spreadsheetId, tabs);
  let sharing: string;
  try {
    sharing = await shareWorkbook(token, spreadsheetId, shareWith);
  } catch (err) {
    sharing = `NOT shared (Drive permissions call failed: ${err instanceof Error ? err.message.slice(0, 120) : err}) — share it from the service account, or use workbook_link with a sheet you own`;
  }
  return {
    spreadsheetId,
    url: created.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    sharing,
  };
}

export async function syncGoogleWorkbook(
  creds: ServiceAccount,
  spreadsheetId: string,
  tabs: WorkbookTab[],
): Promise<{ updatedCells: number }> {
  const token = await accessToken(creds);
  const meta = await sheetsFetch(token, `${SHEETS}/${spreadsheetId}?fields=sheets.properties.title`, undefined, "GET");
  const existing = new Set<string>((meta.sheets ?? []).map((s: any) => s.properties.title));
  const missing = tabs.filter((t) => !existing.has(t.title));
  if (missing.length) {
    await sheetsFetch(token, `${SHEETS}/${spreadsheetId}:batchUpdate`, {
      requests: missing.map((t) => ({ addSheet: { properties: { title: t.title } } })),
    });
  }
  return { updatedCells: await writeTabs(token, spreadsheetId, tabs) };
}

// ---------------------------------------------------------------------------
// CSV bundle (offline) — the zero-credential spine.

function csvCell(v: string | number): string {
  let s = String(v);
  // Formula-injection guard: free text (customer names, field notes) must
  // never open in Excel/Sheets as a live formula.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCsvWorkbook(db: Database, dir: string): { dir: string; files: string[] } {
  mkdirSync(dir, { recursive: true });
  const tabs = workbookTabs(db);
  const files = tabs.map((t) => {
    const name = `${t.title.replace(/[^A-Za-z0-9&() -]/g, "").trim()}.csv`;
    writeFileSync(join(dir, name), t.rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", "utf8");
    return name;
  });
  const index = [
    `${db.meta.company} — operations workbook (CSV export)`,
    `Tabs: ${tabs.length} · Exported by Evolved`,
    "",
    ...files.map((f) => `- ${f}`),
    "",
    "Set EVOLVED_GOOGLE_SA to a Google service-account JSON (inline or path)",
    "and workbook_create will build this as a live Google Sheets workbook instead.",
  ].join("\n");
  writeFileSync(join(dir, "INDEX.md"), index, "utf8");
  return { dir, files };
}

/** One-line summary a tool can return for humans. */
export function workbookSummary(db: Database): string {
  const tabs = workbookTabs(db);
  const cells = tabs.reduce((s, t) => s + t.rows.reduce((r, row) => r + row.length, 0), 0);
  return `${tabs.length} tabs, ${cells} cells — quotes ${db.quotes.length}, jobs ${db.jobs.length}, receipts ${db.receipts.length} (${money(db.receipts.reduce((s, r) => s + r.total, 0))} tracked)`;
}
