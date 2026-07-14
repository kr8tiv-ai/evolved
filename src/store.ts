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
const DATA_DIR = process.env.EVOLVED_DATA_DIR ?? join(here, "..", ".data");
const DB_PATH = join(DATA_DIR, "evolved-db.json");

let db: Database | null = null;

export function loadDb(): Database {
  if (db) return db;
  if (existsSync(DB_PATH)) {
    db = JSON.parse(readFileSync(DB_PATH, "utf8")) as Database;
  } else {
    db = buildSeed();
    persist();
  }
  return db;
}

export function persist(): void {
  if (!db) return;
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export function resetDb(): Database {
  db = buildSeed();
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
