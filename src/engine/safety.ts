/**
 * Evolved — FLHA (Field-Level Hazard Assessment) engine.
 *
 * Alberta field-services safety practice: before work starts, the crew opens
 * an FLHA naming the day's hazards with specific mitigations; at end of day
 * every crew member signs off. The hazard library below carries per-hazard
 * mitigations curated for abrasive-blasting work, so the agent can draft a
 * competent FLHA from just a scope description.
 */

import type { HazardEntry } from "../types.js";

interface HazardTemplate extends HazardEntry {
  triggers: RegExp;
}

export const HAZARD_LIBRARY: HazardTemplate[] = [
  {
    hazard: "Airborne particulate / dust exposure",
    risk: "high",
    triggers: /blast|profil|strip|concrete|paint|coating|rust/i,
    mitigations: [
      "Dustless (vapor) blasting system in use — water-encapsulated media",
      "Half-mask respirators with P100 cartridges for nozzle operator and pot tender",
      "Establish 25 ft exclusion zone with cones and signage",
      "Silica-free media only (crushed glass or garnet)",
    ],
  },
  {
    hazard: "High-pressure air and media lines",
    risk: "high",
    triggers: /blast|compressor|hose|pressure/i,
    mitigations: [
      "Whip checks installed at every coupling",
      "Inspect hoses and couplings before pressurizing",
      "Deadman switch tested before first blast",
      "Never point the nozzle at any person — 100% of the time",
    ],
  },
  {
    hazard: "Noise exposure (compressor and nozzle)",
    risk: "medium",
    triggers: /blast|compressor/i,
    mitigations: [
      "Dual hearing protection (plugs + muffs) inside the work zone",
      "Compressor positioned away from occupied buildings where possible",
    ],
  },
  {
    hazard: "Slips, trips, and wet surfaces",
    risk: "medium",
    triggers: /vapor|water|wet|winter|ice|driveway|sidewalk|patio/i,
    mitigations: [
      "Route hoses along edges, tape or mat crossings on walkways",
      "Squeegee standing water from finished areas before demobilizing",
      "CSA-approved boots with slip-resistant soles",
    ],
  },
  {
    hazard: "Lead or hazardous coatings (pre-1990 structures)",
    risk: "high",
    triggers: /paint|coating|older|heritage|pre-?19|lead/i,
    mitigations: [
      "Presume lead on pre-1990 painted surfaces until test-verified",
      "Contain and collect spent media and paint chips for disposal",
      "Upgrade to supplied-air respirators if lead is confirmed",
    ],
  },
  {
    hazard: "Public and client proximity",
    risk: "medium",
    triggers: /residential|driveway|sidewalk|storefront|public|school/i,
    mitigations: [
      "Barricade tape around the full work zone before starting",
      "Brief the client on exclusion zone; no pets or children outside",
      "Spotter assigned when blasting within 15 ft of a walkway",
    ],
  },
  {
    hazard: "Manual handling of media bags and equipment",
    risk: "medium",
    triggers: /.*/,
    mitigations: [
      "Two-person lift for media bags over 50 lb",
      "Stage media pallet as close to the pot as access allows",
      "Stretch-and-flex before shift start",
    ],
  },
  {
    hazard: "Weather exposure (cold, heat, wind)",
    risk: "low",
    triggers: /.*/,
    mitigations: [
      "Check the blast-day weather verdict before mobilizing",
      "No blasting in winds over 40 km/h or temps below 3°C",
      "Hydration breaks every hour above 28°C",
    ],
  },
];

export const STANDARD_PPE = [
  "CSA steel-toe boots",
  "Blast hood / face shield (nozzle operator)",
  "P100 respirator",
  "Dual hearing protection",
  "Cut-resistant gloves",
  "High-visibility vest",
];

/**
 * Select applicable hazards for a scope of work. Trade packs installed via
 * franchise_spinup contribute `custom` entries, which always apply — a
 * pressure-washing company's FLHA leads with pressure-washing hazards.
 */
export function hazardsForScope(
  scope: string,
  extra: string[] = [],
  custom: HazardEntry[] = [],
): HazardEntry[] {
  const selected: HazardEntry[] = [
    ...custom,
    ...HAZARD_LIBRARY.filter((h) => h.triggers.test(scope)).map(
      ({ hazard, risk, mitigations }) => ({ hazard, risk, mitigations }),
    ),
  ];
  for (const e of extra) {
    selected.push({
      hazard: e,
      risk: "medium",
      mitigations: ["Crew-identified hazard — discuss controls at tailgate meeting."],
    });
  }
  return selected;
}
