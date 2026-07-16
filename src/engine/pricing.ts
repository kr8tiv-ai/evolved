/**
 * Evolved — quoting & profitability engine.
 *
 * Rate table, access factors, and cost model come from a real Alberta
 * abrasive-blasting operation's Quote Engine. The learning loop nudges the
 * effective rate per surface+depth toward what actually wins work at healthy
 * margins, so every completed job makes the next quote smarter.
 */

import type {
  BlastDepth,
  Database,
  ProfitabilityCheck,
  SurfaceKind,
} from "../types.js";
import { round2 } from "../store.js";

export const GST_RATE = 0.05;
export const DEPOSIT_RATE = 0.25;
export const QUOTE_VALID_DAYS = 30;

/** Company tax rate — franchise_spinup can override it in db.meta. */
export function gstRate(db: Database): number {
  const r = db.meta?.gstRate;
  return typeof r === "number" && r >= 0 && r <= 0.3 ? r : GST_RATE;
}

/** Market-floor base rates; the last line of defense if a rate card is incomplete. */
const FALLBACK_BASE_RATES: Record<BlastDepth, number> = {
  "very-light": 2.5,
  light: 3.75,
  medium: 6.9,
  heavy: 14.5,
};

/** Access factors: how hard it is to get equipment onto the work. */
export const ACCESS_FACTORS: Record<string, number> = {
  easy: 1.0, // open driveway, hose run < 50 ft
  moderate: 1.15, // backyard, gates, moderate hose run
  difficult: 1.3, // tight access, long hose run, staging required
};

/** Flat mobilization fee applied per site visit (Quote Engine B19). */
export const MOBILIZATION_FEE = 250;

/** Cost model (CAD) used for the profitability check. */
export const COST_MODEL = {
  mediaPerSqft: {
    "very-light": 0.35,
    light: 0.55,
    medium: 1.1,
    heavy: 2.6,
  } as Record<BlastDepth, number>,
  sqftPerCrewHour: {
    "very-light": 220,
    light: 160,
    medium: 90,
    heavy: 40,
  } as Record<BlastDepth, number>,
  crewRatePerHour: 45, // loaded wage per crew member
  crewSize: 2,
  fuelPerHour: 18, // compressor + truck
  overheadPct: 0.12, // insurance, maintenance, admin as % of revenue
};

export const DEPTH_LABELS: Record<BlastDepth, string> = {
  "very-light": "Very light (surface film, paint haze)",
  light: "Light (sealer, light coatings, substrate profiling)",
  medium: "Medium (epoxy, exposed-aggregate finish, rust)",
  heavy: "Heavy (thick coatings, membrane, heavy corrosion)",
};

/** Company policy: exposed-aggregate work always prices as a medium blast. */
export function normalizeDepth(
  depth: BlastDepth,
  surface?: SurfaceKind,
): BlastDepth {
  if (surface === "exposed-aggregate" && depth !== "heavy") return "medium";
  return depth;
}

export interface MarketBand {
  low: number;
  typ: number;
  high: number;
}

export interface MarketPosition {
  position: "below-market" | "within-market" | "above-market";
  percentile: number;
  note: string;
  band: MarketBand;
}

/**
 * Market band for a depth, derived from THIS trade's own rate card so it
 * generalizes to any service business a trade pack defines: the base rate is
 * the market floor, ~1.3x is typical, ~1.85x is the busy-season / premium end.
 * A company can pin its own bands via db.meta.marketRates[depth].
 */
export function marketBand(db: Database, depth: BlastDepth): MarketBand {
  const override = (db.meta as unknown as {
    marketRates?: Record<string, MarketBand>;
  }).marketRates?.[depth];
  if (override && typeof override.typ === "number") return override;
  const entry = db.rateTable.find((r) => r.depth === depth);
  const base = entry?.baseRate ?? FALLBACK_BASE_RATES[depth];
  return { low: round2(base), typ: round2(base * 1.3), high: round2(base * 1.85) };
}

/** Reference a $/sqft rate against the market band: below / within / above, with guidance. */
export function marketBenchmark(rate: number, band: MarketBand): MarketPosition {
  const position: MarketPosition["position"] =
    rate < band.low ? "below-market" : rate > band.high ? "above-market" : "within-market";
  const span = band.high - band.low;
  const percentile =
    span > 0 ? Math.max(0, Math.min(100, Math.round(((rate - band.low) / span) * 100))) : 0;
  const note =
    position === "below-market"
      ? "Under the going rate; likely leaving money on the table."
      : position === "above-market"
        ? "Above the going rate; expect a lower win-rate unless the scope justifies it."
        : percentile < 40
          ? "Competitive."
          : percentile > 70
            ? "Premium end of the market."
            : "Right in the market.";
  return { position, percentile, note, band };
}

/**
 * Learning loop: blend the base rate with the outcome history for this
 * surface+depth. Only wins at >= 20% margin teach the engine; the blend
 * weight grows with sample count (capped at 80% learned).
 */
export interface EffectiveRate {
  rate: number;
  source: string;
  samples: number;
  /** 0..0.98 — rises with winning data, falls with volatility. */
  confidence: number;
  /** Suggested quote range; tightens as confidence grows. */
  range: [number, number];
  /** Where this rate sits against the market band. */
  market: MarketPosition;
}

export function effectiveRate(
  db: Database,
  depth: BlastDepth,
  surface?: SurfaceKind,
): EffectiveRate {
  const entry = db.rateTable.find((r) => r.depth === depth);
  // Never fall back to $0/sqft: an incomplete rate card uses the market floor.
  const base = entry?.baseRate ?? FALLBACK_BASE_RATES[depth];
  const relevant = db.pricingOutcomes.filter(
    (o) =>
      o.depth === depth &&
      (surface ? o.surface === surface : true) &&
      o.won &&
      o.marginPct >= 20,
  );
  const finish = (
    rate: number,
    source: string,
    samples: number,
    confidence: number,
  ): EffectiveRate => {
    const band = marketBand(db, depth);
    // Range tightens as confidence grows: sparse data quotes wide, proven data quotes tight.
    const halfWidth = round2(rate * Math.max(0.03, 0.18 * (1 - confidence)));
    return {
      rate,
      source,
      samples,
      confidence: round2(confidence),
      range: [round2(rate - halfWidth), round2(rate + halfWidth)],
      market: marketBenchmark(rate, band),
    };
  };
  if (relevant.length === 0) {
    return finish(base, "base rate (no outcome history yet)", 0, 0);
  }
  const rates = relevant.map((o) => o.quotedRate);
  const avgWinning = rates.reduce((s, v) => s + v, 0) / rates.length;
  const weight = Math.min(0.8, relevant.length * 0.2);
  const blended = round2(base * (1 - weight) + avgWinning * weight);
  // Never learn our way below the market floor.
  const rate = Math.max(blended, base);
  // Confidence: more winning jobs and a tighter spread => more confident.
  const n = relevant.length;
  const variance =
    n > 1 ? rates.reduce((s, v) => s + (v - avgWinning) ** 2, 0) / (n - 1) : 0;
  const cv = avgWinning > 0 ? Math.sqrt(variance) / avgWinning : 0;
  const confidence = Math.min(0.98, (n / (n + 4)) * (1 - Math.min(cv, 0.6)));
  return finish(
    rate,
    `learned from ${n} winning job${n === 1 ? "" : "s"} at healthy margin`,
    n,
    confidence,
  );
}

export interface PriceQuoteInput {
  sqft: number;
  depth: BlastDepth;
  surface?: SurfaceKind;
  access?: keyof typeof ACCESS_FACTORS;
  mobilization?: boolean;
}

/** Comparable closed/quoted work for the same surface+depth — grounds an estimate in real history. */
export interface Comparables {
  wonJobs: number;
  quotesOut: number;
  ratePerSqft: MarketBand | null; // low / typ(median) / high across comparable $/sqft
  note: string;
}

export function comparableRates(
  db: Database,
  depth: BlastDepth,
  surface?: SurfaceKind,
): Comparables {
  const won = db.pricingOutcomes.filter(
    (o) => o.depth === depth && (surface ? o.surface === surface : true) && o.won,
  );
  const quotes = db.quotes.filter((q) => {
    const l = q.lines.find((x) => x.depth === depth && (surface ? x.surface === surface : true) && x.sqft);
    return !!l && (q.status === "Sent" || q.status === "Accepted");
  });
  const rates: number[] = [
    ...won.map((o) => o.quotedRate),
    ...quotes.flatMap((q) => {
      const l = q.lines.find((x) => x.depth === depth && x.sqft);
      return l?.sqft ? [round2(q.subtotal / l.sqft)] : [];
    }),
  ].filter((r) => r > 0).sort((a, b) => a - b);
  const band: MarketBand | null = rates.length
    ? { low: rates[0], typ: rates[Math.floor(rates.length / 2)], high: rates[rates.length - 1] }
    : null;
  const note = rates.length
    ? `${rates.length} comparable ${surface ?? ""} ${depth}-blast job${rates.length === 1 ? "" : "s"} in the books priced $${band!.low.toFixed(2)}–$${band!.high.toFixed(2)}/sqft (median $${band!.typ.toFixed(2)}).`
    : "No comparable jobs in the books yet — priced off the market-floor rate card.";
  return { wonJobs: won.length, quotesOut: quotes.length, ratePerSqft: band, note };
}

export interface PriceQuoteResult {
  depth: BlastDepth;
  surface?: SurfaceKind;
  rate: number;
  rateSource: string;
  /** Confidence (0..0.98) and suggested $/sqft range from the learning loop. */
  confidence: number;
  rateRange: [number, number];
  market: MarketPosition;
  accessFactor: number;
  mobilization: number;
  subtotal: number;
  /** Subtotal low/high from the rate range — what to quote as a not-to-exceed band. */
  subtotalRange: [number, number];
  gst: number;
  total: number;
  deposit: number;
  ratePerSqftEffective: number;
  profitability: ProfitabilityCheck;
  policyNotes: string[];
}

export function priceQuote(db: Database, input: PriceQuoteInput): PriceQuoteResult {
  const depth = normalizeDepth(input.depth, input.surface);
  const access = input.access ?? "easy";
  const accessFactor = ACCESS_FACTORS[access] ?? 1.0;
  const mobilization = input.mobilization === false ? 0 : MOBILIZATION_FEE;

  const eff = effectiveRate(db, depth, input.surface);
  const { rate, source } = eff;
  const subtotal = round2(input.sqft * rate * accessFactor + mobilization);
  const gst = round2(subtotal * gstRate(db));
  const total = round2(subtotal + gst);
  // Company standard: deposit is 25% of the GST-inclusive total.
  const deposit = round2(total * DEPOSIT_RATE);

  const subLo = round2(input.sqft * eff.range[0] * accessFactor + mobilization);
  const subHi = round2(input.sqft * eff.range[1] * accessFactor + mobilization);

  const profitability = profitabilityCheck(input.sqft, depth, subtotal);

  const policyNotes: string[] = [];
  if (depth !== input.depth) {
    policyNotes.push(
      "Exposed-aggregate finishes are priced as a medium blast per company policy.",
    );
  }
  policyNotes.push(
    "Fresh concrete must cure 28 days before abrasive blasting.",
    "Quote is valid 30 days; 25% deposit books the job, balance on completion, 5% GST on final invoice.",
  );
  if (profitability.verdict === "below-break-even") {
    policyNotes.push(
      `WARNING: this price is below the break-even rate of $${profitability.breakEvenRate.toFixed(2)}/sqft — flag to the owner, never silently raise.`,
    );
  }

  return {
    depth,
    surface: input.surface,
    rate,
    rateSource: source,
    confidence: eff.confidence,
    rateRange: eff.range,
    market: eff.market,
    accessFactor,
    mobilization,
    subtotal,
    subtotalRange: [subLo, subHi],
    gst,
    total,
    deposit,
    ratePerSqftEffective: input.sqft > 0 ? round2(subtotal / input.sqft) : 0,
    profitability,
    policyNotes,
  };
}

export function profitabilityCheck(
  sqft: number,
  depth: BlastDepth,
  revenue: number,
): ProfitabilityCheck {
  const c = COST_MODEL;
  const media = round2(sqft * c.mediaPerSqft[depth]);
  const crewHours = sqft / c.sqftPerCrewHour[depth];
  const labor = round2(crewHours * c.crewSize * c.crewRatePerHour);
  const fuel = round2(crewHours * c.fuelPerHour);
  const overhead = round2(revenue * c.overheadPct);
  const total = round2(media + labor + fuel + overhead);
  const profit = round2(revenue - total);
  const marginPct = revenue > 0 ? round2((profit / revenue) * 100) : 0;

  // Break-even $/sqft: costs excluding revenue-proportional overhead,
  // grossed up so overhead is covered at that rate.
  const directPerSqft = sqft > 0 ? (media + labor + fuel) / sqft : 0;
  const breakEvenRate = round2(directPerSqft / (1 - c.overheadPct));

  const verdict: ProfitabilityCheck["verdict"] =
    profit < 0 ? "below-break-even" : marginPct < 20 ? "thin" : "healthy";

  const advisory =
    verdict === "healthy"
      ? `Healthy job: ${marginPct.toFixed(1)}% margin, $${profit.toFixed(2)} projected profit.`
      : verdict === "thin"
        ? `Thin margin (${marginPct.toFixed(1)}%). Fine for a relationship price — flag it, don't silently raise.`
        : `Below break-even ($${breakEvenRate.toFixed(2)}/sqft). Do not send without owner approval.`;

  return {
    estimatedCosts: { media, labor, fuel, overhead, total },
    profit,
    marginPct,
    breakEvenRate,
    verdict,
    advisory,
  };
}
