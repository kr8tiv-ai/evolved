/**
 * Evolved — file-backed data spine.
 *
 * In production this maps 1:1 onto the live Google Sheets operations workbook
 * (each collection is a tab). For the public demo it persists to a local JSON
 * file seeded with a fully synthetic dataset, so the whole business brain runs
 * offline with zero credentials.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "./types.js";
import { buildSeed } from "./seed.js";

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.EVOLVED_DATA_DIR ?? join(here, "..", ".data");
const DB_PATH = join(DATA_DIR, "evolved-db.json");

let db: Database | null = null;

/** Databases persisted by older builds get the new collections on load. */
function ensureShape(d: Database): Database {
  const fresh = buildSeed();
  const arrays: (keyof Database)[] = [
    "suppliers", "crew", "inventory", "inventoryMovements", "priceLog",
    "vendors", "inbox", "todos", "payments", "esigns", "lifecycles",
    "reviews", "insights", "activity", "photos", "fieldNotes", "timeEntries",
    "hazardReports", "maintenance",
  ];
  for (const k of arrays) {
    if (!Array.isArray(d[k])) (d as unknown as Record<string, unknown>)[k] = fresh[k];
  }
  if (typeof d.insightWeights !== "object" || d.insightWeights === null) {
    d.insightWeights = {};
  }
  if (!Array.isArray(d.usedTxHashes)) d.usedTxHashes = [];
  if (!Array.isArray(d.customHazards)) d.customHazards = [];
  return d;
}

export function loadDb(): Database {
  if (db) return db;
  if (existsSync(DB_PATH)) {
    db = ensureShape(JSON.parse(readFileSync(DB_PATH, "utf8")) as Database);
  } else {
    db = buildSeed();
    persist();
  }
  return db;
}

/** Append to the activity feed (kept to the most recent 300 events). */
export function logActivity(d: Database, source: string, message: string): void {
  d.activity.push({ at: nowIso(), source, message });
  if (d.activity.length > 300) d.activity.splice(0, d.activity.length - 300);
}

export function persist(): void {
  if (!db) return;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function resetDb(): Database {
  // Replay protection and revenue counters survive demo resets: a reseed
  // must never re-arm spent transaction hashes or zero the earnings ledger.
  const carryTx = db?.usedTxHashes ?? [];
  const carryPaid = db?.meta?.paidCalls ?? 0;
  db = buildSeed();
  db.usedTxHashes = carryTx;
  db.meta.paidCalls = carryPaid;
  persist();
  return db;
}

/** Mutate-and-save helper so every tool writes through to disk. */
export function withDb<T>(fn: (d: Database) => T): T {
  const d = loadDb();
  const result = fn(d);
  persist();
  return result;
}

// ---------- on-chain replay protection (atomic reservation) ----------
// A transaction hash must settle EXACTLY ONE thing. The old check-then-write
// straddled the async RPC verify, so two concurrent callers could both pass
// the "already used?" test before either recorded the spend. `inFlightTx`
// closes that window: claiming a hash is synchronous, so on Node's single
// thread no two callers can both win the claim.
const inFlightTx = new Set<string>();

/**
 * Atomically claim a txHash for verification. Returns false if the hash is
 * already spent (persisted in usedTxHashes or on any payment) or is currently
 * being verified by another in-flight call. On true, the caller MUST later
 * call commitTxHash (on success) or releaseTxHash (on failure).
 */
export function reserveTxHash(txHash: string): boolean {
  const d = loadDb();
  const spent = d.usedTxHashes.includes(txHash) || d.payments.some((p) => p.txHash === txHash);
  if (spent || inFlightTx.has(txHash)) return false;
  inFlightTx.add(txHash);
  return true;
}

/** Persist a verified hash to the spent ledger and drop the in-flight claim. */
export function commitTxHash(txHash: string): void {
  withDb((d) => { if (!d.usedTxHashes.includes(txHash)) d.usedTxHashes.push(txHash); });
  inFlightTx.delete(txHash);
}

/** Release an in-flight claim without spending it (verification failed). */
export function releaseTxHash(txHash: string): void {
  inFlightTx.delete(txHash);
}

// ---------- small shared utilities ----------

export function nowIso(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shortId(prefix: string): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${t}${r}`.toUpperCase();
}

/** Quote numbers follow the company standard: ECO-Q-MMDDYY-NN. */
export function nextQuoteNumber(d: Database, when = new Date()): string {
  const mm = String(when.getMonth() + 1).padStart(2, "0");
  const dd = String(when.getDate()).padStart(2, "0");
  const yy = String(when.getFullYear()).slice(2);
  const key = `${mm}${dd}${yy}`;
  const n = (d.quoteCounter[key] ?? 0) + 1;
  d.quoteCounter[key] = n;
  return `ECO-Q-${key}-${String(n).padStart(2, "0")}`;
}

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(aIso: string, bIso: string): number {
  return Math.floor(
    (new Date(bIso).getTime() - new Date(aIso).getTime()) / 86_400_000,
  );
}
