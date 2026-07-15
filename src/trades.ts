/**
 * Evolved — trade packs: the adaptable-toolkit story made real.
 *
 * A trade pack is everything franchise_spinup needs to re-seed the OS for a
 * different service business: a rate card, the trade's own depth labels,
 * and trade-specific hazards that merge into the FLHA library. Fork the
 * repo, add a pack (or pass your own inline), and the whole machine —
 * quoting, receipts, safety, digest, learning loop, on-chain invoicing —
 * is yours.
 */

import type { BlastDepth, HazardEntry } from "./types.js";

export interface TradePack {
  key: string;
  trade: string;
  description: string;
  rateCard: { depth: BlastDepth; label: string; ratePerSqft: number }[];
  hazards: HazardEntry[];
}

export const TRADE_PACKS: TradePack[] = [
  {
    key: "pressure-washing",
    trade: "pressure washing",
    description: "Residential and commercial pressure washing — driveways, siding, decks, storefronts.",
    rateCard: [
      { depth: "very-light", label: "Rinse (dust, pollen, light grime)", ratePerSqft: 0.3 },
      { depth: "light", label: "Standard wash (dirt, algae film)", ratePerSqft: 0.5 },
      { depth: "medium", label: "Deep wash (gum, grease, stains)", ratePerSqft: 0.85 },
      { depth: "heavy", label: "Strip wash (paint prep, heavy buildup)", ratePerSqft: 1.5 },
    ],
    hazards: [
      { hazard: "High-pressure water injection", risk: "high", mitigations: ["Never point the wand at any person", "Zero-degree tips prohibited on the crew", "Wand lanyard and trigger lock during moves"] },
      { hazard: "Slips on wet surfaces", risk: "high", mitigations: ["Cone and tape the runoff path", "Slip-resistant CSA boots", "Squeegee walkways before demobilizing"] },
      { hazard: "Ladder and elevated work", risk: "medium", mitigations: ["Three points of contact; no wand work above the second rung without tie-off", "Spotter for gutter runs"] },
    ],
  },
  {
    key: "line-painting",
    trade: "parking lot line painting",
    description: "Parking lot striping, stencils, and pavement marking.",
    rateCard: [
      { depth: "very-light", label: "Re-stripe over existing lines", ratePerSqft: 0.22 },
      { depth: "light", label: "New lines on sealed asphalt", ratePerSqft: 0.35 },
      { depth: "medium", label: "Layout + new lines (unmarked lot)", ratePerSqft: 0.55 },
      { depth: "heavy", label: "Stencils, curbs, custom markings", ratePerSqft: 1.1 },
    ],
    hazards: [
      { hazard: "Live vehicle traffic in work zone", risk: "high", mitigations: ["Cone taper and signage before any paint goes down", "High-visibility apparel, spotter on open lots", "Work sections closed to traffic only"] },
      { hazard: "Paint fumes and overspray", risk: "medium", mitigations: ["Respirators when spraying in still air", "Overspray shields near parked vehicles"] },
      { hazard: "Heat stress on open asphalt", risk: "medium", mitigations: ["Hydration breaks every hour above 28°C", "Rotate layout and spray duties"] },
    ],
  },
  {
    key: "mobile-detailing",
    trade: "mobile auto detailing",
    description: "On-site vehicle detailing — fleets, dealerships, driveway service.",
    rateCard: [
      { depth: "very-light", label: "Express exterior (per 100 sqft of vehicle)", ratePerSqft: 8 },
      { depth: "light", label: "Full exterior + interior vacuum", ratePerSqft: 14 },
      { depth: "medium", label: "Full detail (shampoo, clay, sealant)", ratePerSqft: 24 },
      { depth: "heavy", label: "Restoration (paint correction, extraction)", ratePerSqft: 45 },
    ],
    hazards: [
      { hazard: "Chemical exposure (degreasers, acids)", risk: "medium", mitigations: ["Nitrile gloves and eye protection for chemical application", "SDS sheets in the truck; no mixing products"] },
      { hazard: "Working around customer property", risk: "medium", mitigations: ["Walk-around with photos before starting", "Containment mats for runoff where required"] },
    ],
  },
];

export function findTradePack(key: string): TradePack | undefined {
  const k = key.toLowerCase().trim();
  return TRADE_PACKS.find((p) => p.key === k || p.trade.includes(k));
}
