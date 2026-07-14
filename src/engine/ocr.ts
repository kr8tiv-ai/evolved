/**
 * Evolved — receipt understanding pipeline.
 *
 * Tiered extraction, exactly like the production system:
 *   1. Claude Haiku reads the receipt (fast, cheap).
 *   2. If confidence is low or the math doesn't reconcile, escalate to Sonnet.
 *   3. Structured result is categorized, matched to a job, and posted to the
 *      expense ledger — books stay live, not a shoebox problem.
 *
 * With ANTHROPIC_API_KEY set the pipeline calls the live API. Without it,
 * a deterministic offline parser handles text receipts so the public demo
 * runs with zero credentials.
 *
 * Note: the original production parser had a comma bug — "1,234.56" was read
 * as 1.23 and silently undercounted expenses. parseAmount() below is the fix,
 * and it is regression-tested.
 */

import type { ExpenseCategory } from "../types.js";
import { round2 } from "../store.js";

export interface OcrResult {
  vendor: string;
  date: string;
  amountBeforeTax: number;
  gst: number;
  total: number;
  category: ExpenseCategory;
  paymentMethod?: string;
  lineItems: { description: string; amount: number }[];
  model: "haiku" | "sonnet" | "manual";
  escalated: boolean;
  confidence: number;
  warnings: string[];
}

/** Currency parser that survives thousands separators and stray symbols. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.,-]/g, "");
  // "1,234.56" -> strip commas; "1.234,56" (EU style) -> normalize.
  let normalized = cleaned;
  if (/,\d{2}$/.test(cleaned) && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? round2(n) : 0;
}

const CATEGORY_HINTS: [RegExp, ExpenseCategory][] = [
  [/garnet|abrasive|media|crushed glass|soda|corn cob/i, "Abrasive media"],
  [/petro|esso|shell|husky|fas gas|co-op fuel|diesel|gasoline|fuel/i, "Fuel"],
  [/princess auto|acklands|grainger|toolup|compressor|nozzle|hose/i, "Equipment"],
  [/rental|united rentals|sunbelt|herc/i, "Equipment rental"],
  [/kal tire|fountain tire|lube|oil change|napa|parts|mechanic/i, "Vehicle & maintenance"],
  [/mark'?s|ppe|respirator|3m|glove|safety/i, "Safety gear"],
  [/insurance|intact|wawanesa/i, "Insurance"],
  [/facebook|meta ads|google ads|sign|vistaprint|印/i, "Marketing"],
  [/staples|microsoft|google workspace|adobe|hosting/i, "Office & software"],
  [/tim hortons|a&w|mcdonald|subway|denny|hotel|motel/i, "Meals & travel"],
];

export function categorize(vendor: string, text: string): ExpenseCategory {
  const hay = `${vendor} ${text}`;
  for (const [rx, cat] of CATEGORY_HINTS) if (rx.test(hay)) return cat;
  return "Other";
}

/**
 * Offline extraction pass — plays the role of Haiku in the demo. Parses
 * common receipt text shapes; confidence drops when fields are missing or
 * the arithmetic doesn't reconcile, which triggers the escalation pass.
 */
function extractOffline(text: string): Omit<OcrResult, "model" | "escalated"> {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const vendor = lines[0]?.replace(/[^\w\s&'.-]/g, "").trim() || "Unknown vendor";

  const dateMatch = text.match(
    /(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})|((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4})/i,
  );
  let date = new Date().toISOString().slice(0, 10);
  if (dateMatch) {
    const parsed = new Date(dateMatch[0]);
    if (!Number.isNaN(parsed.getTime()))
      date = parsed.toISOString().slice(0, 10);
  } else {
    warnings.push("No date found — defaulted to today.");
  }

  const grab = (rx: RegExp): number | null => {
    const m = text.match(rx);
    return m ? parseAmount(m[1]) : null;
  };
  let total = grab(/(?<!sub[- ]?)total[^0-9$-]*\$?\s*([0-9.,]+)/i);
  let gst = grab(/(?:gst|hst|tax)[^0-9$-]*\$?\s*([0-9.,]+)/i);
  let sub = grab(/(?:sub-?total)[^0-9$-]*\$?\s*([0-9.,]+)/i);

  const lineItems: { description: string; amount: number }[] = [];
  for (const l of lines.slice(1)) {
    if (/total|gst|hst|tax|visa|debit|master|cash|change|approved/i.test(l)) continue;
    const m = l.match(/^(.{3,40}?)\s+\$?([0-9][0-9.,]*)$/);
    if (m) lineItems.push({ description: m[1].trim(), amount: parseAmount(m[2]) });
  }

  // Reconcile what we have.
  if (total == null && sub != null && gst != null) total = round2(sub + gst);
  if (sub == null && total != null && gst != null) sub = round2(total - gst);
  if (gst == null && total != null && sub != null) gst = round2(total - sub);
  if (total != null && sub == null && gst == null) {
    sub = round2(total / 1.05);
    gst = round2(total - sub);
    warnings.push("Subtotal/GST inferred from total at 5%.");
  }

  let confidence = 0.95;
  if (total == null) {
    confidence = 0.2;
    warnings.push("No total found.");
    total = lineItems.reduce((s, li) => s + li.amount, 0);
    sub = round2(total / 1.05);
    gst = round2(total - sub);
  }
  if (sub != null && gst != null && total != null) {
    if (Math.abs(sub + gst - total) > 0.02) {
      confidence = Math.min(confidence, 0.55);
      warnings.push(
        `Arithmetic mismatch: subtotal ${sub} + GST ${gst} != total ${total}.`,
      );
    }
  }
  if (!dateMatch) confidence = Math.min(confidence, 0.75);

  const payment = text.match(/\b(visa|mastercard|debit|interac|cash|amex|e-?transfer)\b/i)?.[1];

  return {
    vendor,
    date,
    amountBeforeTax: sub ?? 0,
    gst: gst ?? 0,
    total: total ?? 0,
    category: categorize(vendor, text),
    paymentMethod: payment ? payment.toLowerCase() : undefined,
    lineItems,
    confidence,
    warnings,
  };
}

const ESCALATION_THRESHOLD = 0.8;

/** Live-API pass. Only used when ANTHROPIC_API_KEY is present. */
async function extractWithClaude(
  text: string,
  model: string,
): Promise<Omit<OcrResult, "model" | "escalated"> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Extract this receipt into strict JSON with keys: vendor, date (YYYY-MM-DD), amountBeforeTax, gst, total, paymentMethod, lineItems (array of {description, amount}), confidence (0-1). Amounts are plain numbers — beware thousands separators. Receipt:\n\n${text}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      content: { type: string; text?: string }[];
    };
    const raw = body.content.find((c) => c.type === "text")?.text ?? "";
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return {
      vendor: String(json.vendor ?? "Unknown vendor"),
      date: String(json.date ?? new Date().toISOString().slice(0, 10)),
      amountBeforeTax: round2(Number(json.amountBeforeTax) || 0),
      gst: round2(Number(json.gst) || 0),
      total: round2(Number(json.total) || 0),
      category: categorize(String(json.vendor ?? ""), text),
      paymentMethod: json.paymentMethod ? String(json.paymentMethod) : undefined,
      lineItems: Array.isArray(json.lineItems)
        ? json.lineItems.map((li: { description?: unknown; amount?: unknown }) => ({
            description: String(li.description ?? ""),
            amount: round2(Number(li.amount) || 0),
          }))
        : [],
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.9)),
      warnings: [],
    };
  } catch {
    return null;
  }
}

export async function runOcrPipeline(text: string): Promise<OcrResult> {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);

  // Pass 1 — Haiku (or offline stand-in).
  let first = live ? await extractWithClaude(text, "claude-haiku-4-5-20251001") : null;
  let model: OcrResult["model"] = first ? "haiku" : "manual";
  if (!first) first = extractOffline(text);

  if (first.confidence >= ESCALATION_THRESHOLD) {
    return { ...first, model: live ? "haiku" : "manual", escalated: false };
  }

  // Pass 2 — escalate to Sonnet (or a stricter offline reconcile).
  if (live) {
    const second = await extractWithClaude(text, "claude-sonnet-5");
    if (second && second.confidence > first.confidence) {
      return {
        ...second,
        model: "sonnet",
        escalated: true,
        warnings: [
          ...second.warnings,
          `Escalated from Haiku (confidence ${first.confidence.toFixed(2)}).`,
        ],
      };
    }
  }
  return {
    ...first,
    model,
    escalated: true,
    warnings: [
      ...first.warnings,
      "Low confidence — flagged for human review in the morning digest.",
    ],
  };
}
