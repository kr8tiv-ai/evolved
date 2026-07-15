/**
 * Evolved tools — the workbook spine (Google Sheets or CSV).
 *
 * The production company lives in a Google Sheets operations workbook.
 * These tools give every Evolved deployment the same spine: create a real
 * Google Sheets workbook from the whole database (service account via
 * EVOLVED_GOOGLE_SA), keep it in sync, link an existing sheet, or export
 * the identical workbook as CSV with zero credentials.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { DATA_DIR, loadDb, logActivity, nowIso, withDb } from "../store.js";
import {
  createGoogleWorkbook, exportCsvWorkbook, googleCreds, syncGoogleWorkbook,
  workbookSummary, workbookTabs,
} from "../engine/sheets.js";

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const NO_CREDS_GUIDE =
  "No Google credentials configured. Set EVOLVED_GOOGLE_SA to a service-account JSON " +
  "(inline or a file path) with Sheets + Drive scope. workbook_create then builds the " +
  "spreadsheet and shares it (link-shared by default, or pass shareWith for a specific " +
  "account); or share your own sheet with the service account's client_email and use " +
  "workbook_link. Falling back to the CSV workbook export, which contains the identical tabs.";

export function registerWorkbookTools(server: McpServer): void {
  server.registerTool(
    "workbook_status",
    {
      title: "Workbook status",
      description:
        "The state of the operations-workbook spine: linked Google Sheet (if any), tab list, cell counts, credential mode, and last sync time.",
      inputSchema: {},
    },
    async () => {
      const db = loadDb();
      return ok({
        mode: googleCreds() ? "google-sheets (credentialed)" : "csv (zero-credential)",
        linked: db.workbook ?? null,
        tabs: workbookTabs(db).map((t) => `${t.title} (${t.rows.length - 1 < 0 ? 0 : t.rows.length - 1} rows)`),
        summary: workbookSummary(db),
      });
    },
  );

  server.registerTool(
    "workbook_export",
    {
      title: "Export the workbook (CSV, zero credentials)",
      description:
        "Render the ENTIRE operating system — quotes, dispatch, expenses, invoices, inventory, crew, time log, photos, field notes, safety, reviews, action items, rate table, Job P&L, record log — as a CSV workbook bundle. Works offline with no credentials; the same tabs a Google Sheets sync writes.",
      inputSchema: {},
    },
    async () => {
      return ok(
        withDb((db) => {
          const dir = join(DATA_DIR, "workbook");
          const result = exportCsvWorkbook(db, dir);
          // A CSV export must never clobber a live Google Sheets link.
          if (db.workbook?.provider !== "google-sheets") {
            db.workbook = {
              provider: "csv", dir: result.dir,
              tabs: result.files.map((f) => f.replace(/\.csv$/, "")),
              lastSyncAt: nowIso(),
            };
          }
          logActivity(db, "workbook", `CSV workbook exported — ${result.files.length} tabs.`);
          return { ...result, summary: workbookSummary(db) };
        }),
      );
    },
  );

  server.registerTool(
    "workbook_create",
    {
      title: "Create a live Google Sheets workbook",
      description:
        "Spin up a REAL Google Sheets operations workbook from the current database — every collection a tab, exactly like the production company's workbook. Requires EVOLVED_GOOGLE_SA (service-account JSON, inline or path). The sheet is shared automatically (link-shared writer by default; pass shareWith to grant a specific Google account instead). Without credentials it explains the setup and falls back to the CSV export.",
      inputSchema: {
        title: z.string().max(120).optional().describe("Spreadsheet title; defaults to '<Company> — Ops Workbook'"),
        shareWith: z.string().email().optional().describe("Share with this Google account (writer) instead of anyone-with-the-link"),
      },
    },
    async ({ title, shareWith }) => {
      const creds = googleCreds();
      if (!creds) {
        const fallback = withDb((db) => {
          const dir = join(DATA_DIR, "workbook");
          const result = exportCsvWorkbook(db, dir);
          logActivity(db, "workbook", "workbook_create without credentials — CSV fallback written.");
          return result;
        });
        return ok({ created: false, guide: NO_CREDS_GUIDE, csvFallback: fallback });
      }
      const db = loadDb();
      const tabs = workbookTabs(db);
      const created = await createGoogleWorkbook(creds, title ?? `${db.meta.company} — Ops Workbook`, tabs, shareWith);
      return ok(
        withDb((d) => {
          d.workbook = {
            provider: "google-sheets", spreadsheetId: created.spreadsheetId, url: created.url,
            tabs: tabs.map((t) => t.title), lastSyncAt: nowIso(),
          };
          logActivity(d, "workbook", `Google Sheets workbook created: ${created.url} (${created.sharing})`);
          return { created: true, ...created, tabs: tabs.length };
        }),
      );
    },
  );

  server.registerTool(
    "workbook_link",
    {
      title: "Link an existing Google Sheet",
      description:
        "Attach Evolved to a Google Sheets workbook you already have (by spreadsheet id). Subsequent workbook_sync calls write every tab into it. The service account in EVOLVED_GOOGLE_SA must have edit access to that sheet.",
      inputSchema: { spreadsheetId: z.string().min(20).describe("The id from the sheet URL") },
    },
    async ({ spreadsheetId }) => {
      if (!googleCreds()) return ok({ linked: false, guide: NO_CREDS_GUIDE });
      return ok(
        withDb((db) => {
          db.workbook = {
            provider: "google-sheets", spreadsheetId,
            url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
            tabs: workbookTabs(db).map((t) => t.title), lastSyncAt: nowIso(),
          };
          logActivity(db, "workbook", `Linked existing Google Sheet ${spreadsheetId}.`);
          return { linked: true, workbook: db.workbook, next: "Run workbook_sync to write all tabs." };
        }),
      );
    },
  );

  server.registerTool(
    "workbook_sync",
    {
      title: "Sync the workbook",
      description:
        "Push the entire current database into the linked workbook — updates every tab (adds missing ones) in the linked Google Sheet, or refreshes the CSV bundle when running credential-free.",
      inputSchema: {},
    },
    async () => {
      const creds = googleCreds();
      const db = loadDb();
      const link = db.workbook;
      if (creds && link?.provider === "google-sheets" && link.spreadsheetId) {
        const result = await syncGoogleWorkbook(creds, link.spreadsheetId, workbookTabs(db));
        return ok(
          withDb((d) => {
            d.workbook = { ...link, tabs: workbookTabs(d).map((t) => t.title), lastSyncAt: nowIso() };
            logActivity(d, "workbook", `Workbook synced — ${result.updatedCells} cells.`);
            return { synced: true, provider: "google-sheets", url: link.url, ...result };
          }),
        );
      }
      return ok(
        withDb((d) => {
          const dir = join(DATA_DIR, "workbook");
          const result = exportCsvWorkbook(d, dir);
          d.workbook = { provider: "csv", dir: result.dir, tabs: result.files.map((f) => f.replace(/\.csv$/, "")), lastSyncAt: nowIso() };
          logActivity(d, "workbook", `CSV workbook refreshed — ${result.files.length} tabs.`);
          return { synced: true, provider: "csv", ...result, note: creds ? "No Google Sheet linked — run workbook_create or workbook_link." : NO_CREDS_GUIDE };
        }),
      );
    },
  );
}
