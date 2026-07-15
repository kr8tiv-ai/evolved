/**
 * Evolved — synthetic demo dataset.
 *
 * Every name, phone number, address, and dollar figure below is invented.
 * The shape mirrors the real operations workbook; the contents do not. Dates
 * are generated relative to "now" so the demo always looks alive: an urgent
 * unpaid invoice, a quote about to expire, a job finished but not invoiced,
 * and a learning loop that has already converged driveways to ~$9/sqft.
 */

import type { Database } from "./types.js";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysAhead(n: number): string {
  return daysAgo(-n);
}

export function buildSeed(): Database {
  const seededAt = new Date().toISOString();

  return {
    meta: {
      company: "Evolve Eco Blasting (demo dataset — fully synthetic)",
      currency: "CAD",
      gstRate: 0.05,
      seededAt,
    },

    customers: [
      { id: "CUST-001", name: "Northgate Property Group", phone: "780-555-0101", email: "ops@northgate.example", address: "12204 Jasper Ave, Edmonton", notes: "Property manager — three sites, repeat work.", createdAt: isoDaysAgo(92) },
      { id: "CUST-002", name: "Sandra Kowalczyk", phone: "780-555-0102", address: "8811 Silver Berry Rd, Edmonton", notes: "Exposed-aggregate driveway referral.", createdAt: isoDaysAgo(41) },
      { id: "CUST-003", name: "Bighorn Equipment Ltd.", phone: "403-555-0103", email: "shop@bighorn.example", address: "271 Industrial Way, Red Deer", notes: "Fleet trailers and skid frames.", createdAt: isoDaysAgo(60) },
      { id: "CUST-004", name: "Marcus Tran", phone: "587-555-0104", address: "4415 Orchards Blvd SW, Edmonton", notes: "Garage pad + sidewalk package.", createdAt: isoDaysAgo(19) },
      { id: "CUST-005", name: "Willow Creek Homes", phone: "780-555-0105", email: "site@willowcreek.example", address: "Show home: 1203 Meadowview Dr, Leduc", notes: "Builder — show-home refresh contract potential.", createdAt: isoDaysAgo(11) },
      { id: "CUST-006", name: "Dale Petersen", phone: "780-555-0106", address: "56 Ravine Cres, Sherwood Park", notes: "Cast-iron patio set + fence line.", createdAt: isoDaysAgo(6) },
    ],

    leads: [
      { id: "LEAD-001", customerId: "CUST-005", source: "Website form", stage: "Site visit", summary: "Willow Creek Homes — show-home driveway + walkway refresh", nextAction: "Walk the site with the builder rep, measure both areas", nextActionDate: daysAhead(1), createdAt: isoDaysAgo(11), updatedAt: isoDaysAgo(2) },
      { id: "LEAD-002", customerId: "CUST-006", source: "Referral", stage: "Quoted", summary: "Dale Petersen — cast-iron patio set, dustless strip", nextAction: "Follow up on quote", nextActionDate: daysAhead(2), createdAt: isoDaysAgo(6), updatedAt: isoDaysAgo(3) },
      { id: "LEAD-003", customerId: "CUST-001", source: "Repeat client", stage: "Contacted", summary: "Northgate — parkade line-marking removal, 3 levels", nextAction: "Send ballpark range, book measure", nextActionDate: daysAgo(1), createdAt: isoDaysAgo(9), updatedAt: isoDaysAgo(4) },
      { id: "LEAD-004", customerId: "CUST-003", source: "Phone", stage: "New", summary: "Bighorn — six flat-deck trailers, blast and prime", nextAction: "Call back with shop-rate options", nextActionDate: daysAhead(1), createdAt: isoDaysAgo(2), updatedAt: isoDaysAgo(2) },
    ],

    quotes: [
      {
        id: "ECO-Q-DEMO-01",
        customerId: "CUST-002",
        siteAddress: "8811 Silver Berry Rd, Edmonton",
        lines: [{ description: "Exposed-aggregate driveway — medium blast, substrate profiling", sqft: 640, depth: "medium", surface: "exposed-aggregate", amount: 6010 }],
        sqftTotal: 640,
        subtotal: 6010, gst: 300.5, total: 6310.5, depositRequired: 1577.63,
        status: "Accepted", validUntil: daysAhead(9),
        notes: "Accepted after one follow-up. Cure date verified — poured 2019.",
        createdAt: isoDaysAgo(21), updatedAt: isoDaysAgo(13),
      },
      {
        id: "ECO-Q-DEMO-02",
        customerId: "CUST-004",
        siteAddress: "4415 Orchards Blvd SW, Edmonton",
        lines: [
          { description: "Garage pad — light blast, sealer removal", sqft: 480, depth: "light", surface: "garage-pad", amount: 2050 },
          { description: "Front sidewalk — light blast", sqft: 220, depth: "light", surface: "sidewalk", amount: 825 },
        ],
        sqftTotal: 700,
        subtotal: 2875, gst: 143.75, total: 3018.75, depositRequired: 754.69,
        status: "Sent", validUntil: daysAhead(5),
        notes: "Client comparing one other bid.",
        createdAt: isoDaysAgo(9), updatedAt: isoDaysAgo(9),
      },
      {
        id: "ECO-Q-DEMO-03",
        customerId: "CUST-006",
        siteAddress: "56 Ravine Cres, Sherwood Park",
        lines: [{ description: "Cast-iron patio set (4 chairs, table) — dustless strip, complete clean", amount: 450 }],
        subtotal: 450, gst: 22.5, total: 472.5, depositRequired: 118.13,
        status: "Sent", validUntil: daysAhead(24),
        notes: "Optional repaint add-on discussed at +$200.",
        createdAt: isoDaysAgo(8), updatedAt: isoDaysAgo(8),
      },
      {
        id: "ECO-Q-DEMO-04",
        customerId: "CUST-003",
        siteAddress: "271 Industrial Way, Red Deer",
        lines: [{ description: "Two flat-deck trailers — heavy blast, rust and coating removal", sqft: 380, depth: "heavy", surface: "trailer", amount: 5760 }],
        sqftTotal: 380,
        subtotal: 5760, gst: 288, total: 6048, depositRequired: 1512,
        status: "Accepted", validUntil: daysAgo(2),
        notes: "Fleet pilot — four more trailers if quality lands.",
        createdAt: isoDaysAgo(34), updatedAt: isoDaysAgo(28),
      },
    ],

    jobs: [
      {
        id: "JOB-1041",
        quoteId: "ECO-Q-DEMO-04",
        customerId: "CUST-003",
        siteAddress: "271 Industrial Way, Red Deer",
        scope: "Two flat-deck trailers — heavy blast, rust and coating removal",
        status: "Complete",
        scheduledDate: daysAgo(6),
        crew: ["T. Field", "R. Nozzle"],
        depositPaid: true,
        actuals: {
          hoursWorked: 14, crewSize: 2, wages: 1260, materials: 1080, fuel: 252,
          totalCost: 2592 + 691, revenue: 5760, profit: 5760 - 3283, marginPct: 43,
          verdict: "healthy", completedAt: isoDaysAgo(5),
        },
        createdAt: isoDaysAgo(28), updatedAt: isoDaysAgo(5),
      },
      {
        id: "JOB-1042",
        quoteId: "ECO-Q-DEMO-01",
        customerId: "CUST-002",
        siteAddress: "8811 Silver Berry Rd, Edmonton",
        scope: "Exposed-aggregate driveway — medium blast",
        status: "Booked",
        scheduledDate: undefined, // deposit in, not yet scheduled → auto-raise
        crew: [],
        depositPaid: true,
        createdAt: isoDaysAgo(12), updatedAt: isoDaysAgo(12),
      },
      {
        id: "JOB-1043",
        customerId: "CUST-001",
        siteAddress: "12204 Jasper Ave, Edmonton",
        scope: "Storefront concrete apron — light blast, gum and grime profiling",
        status: "Confirmed",
        scheduledDate: daysAhead(0),
        crew: ["T. Field"],
        depositPaid: true,
        createdAt: isoDaysAgo(7), updatedAt: isoDaysAgo(1),
      },
    ],

    receipts: [
      {
        id: "RCPT-2001", vendor: "Prairie Abrasives Supply", date: daysAgo(9),
        amountBeforeTax: 1190.48, gst: 59.52, total: 1250,
        category: "Abrasive media", paymentMethod: "visa", jobId: "JOB-1041",
        lineItems: [{ description: "Crushed glass 40/70 — 30 bags", amount: 1050 }, { description: "Garnet 80 mesh — 4 bags", amount: 140.48 }],
        ocr: { model: "haiku", escalated: false, confidence: 0.96, warnings: [] },
        createdAt: isoDaysAgo(9),
      },
      {
        id: "RCPT-2002", vendor: "Petro-Canada", date: daysAgo(6),
        amountBeforeTax: 156.19, gst: 7.81, total: 164,
        category: "Fuel", paymentMethod: "debit", jobId: "JOB-1041",
        lineItems: [{ description: "Diesel 118.2 L", amount: 156.19 }],
        ocr: { model: "haiku", escalated: false, confidence: 0.94, warnings: [] },
        createdAt: isoDaysAgo(6),
      },
      {
        id: "RCPT-2003", vendor: "Princess Auto", date: daysAgo(4),
        amountBeforeTax: 271.43, gst: 13.57, total: 285,
        category: "Equipment", paymentMethod: "visa",
        lineItems: [{ description: "Blast hose 50 ft", amount: 189.99 }, { description: "Quick couplers x4", amount: 81.44 }],
        ocr: { model: "sonnet", escalated: true, confidence: 0.91, warnings: ["Escalated from Haiku (confidence 0.62) — faded thermal paper."] },
        createdAt: isoDaysAgo(4),
      },
      {
        id: "RCPT-2004", vendor: "Mark's Work Wearhouse", date: daysAgo(15),
        amountBeforeTax: 133.33, gst: 6.67, total: 140,
        category: "Safety gear", paymentMethod: "visa",
        lineItems: [{ description: "P100 cartridges x6", amount: 89.94 }, { description: "Cut-resistant gloves", amount: 43.39 }],
        ocr: { model: "haiku", escalated: false, confidence: 0.97, warnings: [] },
        createdAt: isoDaysAgo(15),
      },
    ],

    actionItems: [],

    flhas: [
      {
        id: "FLHA-3001",
        jobId: "JOB-1041",
        date: daysAgo(6),
        crew: ["T. Field", "R. Nozzle"],
        siteConditions: "Shop yard, dry, 19°C, light wind. Forklift traffic on east side.",
        hazards: [
          { hazard: "High-pressure air and media lines", risk: "high", mitigations: ["Whip checks installed at every coupling", "Deadman switch tested before first blast"] },
          { hazard: "Noise exposure (compressor and nozzle)", risk: "medium", mitigations: ["Dual hearing protection inside the work zone"] },
          { hazard: "Forklift traffic (site-specific)", risk: "medium", mitigations: ["Cone off blast zone; forklift operator briefed on exclusion area"] },
        ],
        ppeConfirmed: ["CSA steel-toe boots", "Blast hood / face shield (nozzle operator)", "P100 respirator", "Dual hearing protection", "Cut-resistant gloves", "High-visibility vest"],
        musterPoint: "Front gate, north entrance",
        openedBy: "T. Field",
        openedAt: isoDaysAgo(6),
        signoff: { signedBy: ["T. Field", "R. Nozzle"], incidentFree: true, notes: "No incidents. Media contained and reclaimed.", signedAt: isoDaysAgo(6) },
      },
    ],

    invoices: [
      {
        id: "ECO-INV-9001",
        jobId: "JOB-1040", // historical job, already paid
        customerId: "CUST-001",
        lines: [{ description: "Parkade level P1 — line-marking removal, 2,100 sqft medium blast", amount: 14740 }],
        subtotal: 14740, gst: 737, total: 15477, depositApplied: 3869.25, balanceDue: 11607.75,
        status: "Paid", dueDate: daysAgo(20), createdAt: isoDaysAgo(35),
      },
      {
        id: "ECO-INV-9002",
        jobId: "JOB-1039",
        customerId: "CUST-003",
        lines: [{ description: "Skid frame set — heavy blast and prime prep", amount: 2320 }],
        subtotal: 2320, gst: 116, total: 2436, depositApplied: 609, balanceDue: 1827,
        status: "Sent", dueDate: daysAgo(3), createdAt: isoDaysAgo(12), // unpaid 12 days → auto-raise
      },
    ],

    rateTable: [
      { depth: "very-light", label: "Very light (surface film, paint haze)", baseRate: 2.5, learnedRate: 2.5, samples: 0 },
      { depth: "light", label: "Light (sealer, light coatings)", baseRate: 3.75, learnedRate: 3.9, samples: 3 },
      { depth: "medium", label: "Medium (epoxy, exposed aggregate, rust)", baseRate: 6.9, learnedRate: 8.85, samples: 5 },
      { depth: "heavy", label: "Heavy (thick coatings, membrane, corrosion)", baseRate: 14.5, learnedRate: 14.5, samples: 1 },
    ],

    pricingOutcomes: [
      // The learning loop's memory: residential driveways win comfortably at ~$9/sqft.
      { id: "OUT-01", jobId: "JOB-1031", surface: "driveway", depth: "medium", sqft: 520, quotedRate: 8.75, actualCostPerSqft: 4.9, marginPct: 38, won: true, recordedAt: isoDaysAgo(78) },
      { id: "OUT-02", jobId: "JOB-1033", surface: "driveway", depth: "medium", sqft: 610, quotedRate: 9.0, actualCostPerSqft: 5.1, marginPct: 41, won: true, recordedAt: isoDaysAgo(64) },
      { id: "OUT-03", jobId: "JOB-1035", surface: "driveway", depth: "medium", sqft: 445, quotedRate: 9.25, actualCostPerSqft: 5.4, marginPct: 39, won: true, recordedAt: isoDaysAgo(49) },
      { id: "OUT-04", jobId: "JOB-1036", surface: "driveway", depth: "medium", sqft: 700, quotedRate: 9.0, actualCostPerSqft: 4.8, marginPct: 44, won: true, recordedAt: isoDaysAgo(37) },
      { id: "OUT-05", jobId: "JOB-1038", surface: "exposed-aggregate", depth: "medium", sqft: 640, quotedRate: 8.9, actualCostPerSqft: 5.2, marginPct: 40, won: true, recordedAt: isoDaysAgo(24) },
      { id: "OUT-06", jobId: "JOB-1041", surface: "trailer", depth: "heavy", sqft: 380, quotedRate: 15.16, actualCostPerSqft: 8.6, marginPct: 43, won: true, recordedAt: isoDaysAgo(5) },
      { id: "OUT-07", jobId: "JOB-1032", surface: "garage-pad", depth: "light", sqft: 480, quotedRate: 4.1, actualCostPerSqft: 2.4, marginPct: 36, won: true, recordedAt: isoDaysAgo(70) },
      { id: "OUT-08", jobId: "JOB-1034", surface: "sidewalk", depth: "light", sqft: 260, quotedRate: 3.9, actualCostPerSqft: 2.5, marginPct: 33, won: true, recordedAt: isoDaysAgo(58) },
    ],

    quoteCounter: {},

    suppliers: [
      { id: "SUP-001", name: "Prairie Abrasives Supply", location: "Edmonton", phone: "780-555-0301", website: "prairieabrasives.example", products: "Crushed glass, garnet, soda media", createdAt: isoDaysAgo(120) },
      { id: "SUP-002", name: "Northside Safety Co.", location: "Edmonton", phone: "780-555-0302", products: "PPE, respirator cartridges, hearing protection", createdAt: isoDaysAgo(100) },
      { id: "SUP-003", name: "Foothills Equipment Rentals", location: "Leduc", phone: "780-555-0303", products: "Compressors, hose, couplers", createdAt: isoDaysAgo(80) },
    ],

    crew: [
      { id: "CREW-001", name: "T. Field", role: "lead-tech", phone: "780-555-0401", certifications: ["CSTS-2020", "First Aid Level 1", "Respirator fit-tested"], hourlyRate: 45, active: true, createdAt: isoDaysAgo(200) },
      { id: "CREW-002", name: "R. Nozzle", role: "tech", phone: "780-555-0402", certifications: ["CSTS-2020", "Respirator fit-tested"], hourlyRate: 38, active: true, createdAt: isoDaysAgo(150) },
    ],

    inventory: [
      { id: "INV-001", section: "Materials & Media", name: "Crushed glass 40/70", unit: "50 lb bag", onHand: 22, parLevel: 40, reorderAt: 15, preferredSupplierId: "SUP-001", lastUnitCost: 35, lastSupplier: "Prairie Abrasives Supply", lastPurchasedAt: daysAgo(9) },
      { id: "INV-002", section: "Materials & Media", name: "Garnet 80 mesh", unit: "55 lb bag", onHand: 6, parLevel: 12, reorderAt: 5, preferredSupplierId: "SUP-001", lastUnitCost: 35.12, lastSupplier: "Prairie Abrasives Supply", lastPurchasedAt: daysAgo(9) },
      { id: "INV-003", section: "Consumables & PPE", name: "P100 cartridges", unit: "pair", onHand: 4, parLevel: 10, reorderAt: 4, preferredSupplierId: "SUP-002", lastUnitCost: 14.99, lastSupplier: "Mark's Work Wearhouse", lastPurchasedAt: daysAgo(15) },
      { id: "INV-004", section: "Consumables & PPE", name: "Cut-resistant gloves", unit: "pair", onHand: 8, parLevel: 8, reorderAt: 3, lastUnitCost: 21.7, lastPurchasedAt: daysAgo(15) },
      { id: "INV-005", section: "Equipment & General", name: "Blast hose 50 ft", unit: "each", onHand: 3, parLevel: 3, reorderAt: 1, lastUnitCost: 189.99, lastSupplier: "Princess Auto", lastPurchasedAt: daysAgo(4) },
      { id: "INV-006", section: "Equipment & General", name: "Quick couplers", unit: "each", onHand: 9, parLevel: 8, reorderAt: 4, lastUnitCost: 20.36, lastSupplier: "Princess Auto", lastPurchasedAt: daysAgo(4) },
    ],

    inventoryMovements: [
      { id: "MOV-001", itemId: "INV-001", delta: 30, reason: "received", receiptId: "RCPT-2001", unitCost: 35, at: isoDaysAgo(9) },
      { id: "MOV-002", itemId: "INV-001", delta: -14, reason: "consumed", jobId: "JOB-1041", at: isoDaysAgo(6) },
      { id: "MOV-003", itemId: "INV-002", delta: 4, reason: "received", receiptId: "RCPT-2001", unitCost: 35.12, at: isoDaysAgo(9) },
      { id: "MOV-004", itemId: "INV-003", delta: -2, reason: "consumed", jobId: "JOB-1041", at: isoDaysAgo(6) },
    ],

    priceLog: [
      { id: "PL-001", date: daysAgo(9), supplier: "Prairie Abrasives Supply", product: "Crushed glass 40/70", itemId: "INV-001", unitType: "50 lb bag", qty: 30, unitPrice: 35, totalPaid: 1050, receiptId: "RCPT-2001" },
      { id: "PL-002", date: daysAgo(74), supplier: "Prairie Abrasives Supply", product: "Crushed glass 40/70", itemId: "INV-001", unitType: "50 lb bag", qty: 25, unitPrice: 31.5, totalPaid: 787.5 },
      { id: "PL-003", date: daysAgo(9), supplier: "Prairie Abrasives Supply", product: "Garnet 80 mesh", itemId: "INV-002", unitType: "55 lb bag", qty: 4, unitPrice: 35.12, totalPaid: 140.48, receiptId: "RCPT-2001" },
    ],

    vendors: [
      { canonical: "Prairie Abrasives Supply", aliases: ["prairie abrasives supply"], category: "Abrasive media", firstSeen: daysAgo(74), totalSpend: 2037.5, receipts: 2 },
      { canonical: "Petro-Canada", aliases: ["petro canada"], category: "Fuel", firstSeen: daysAgo(6), totalSpend: 164, receipts: 1 },
      { canonical: "Princess Auto", aliases: ["princess auto"], category: "Equipment", firstSeen: daysAgo(4), totalSpend: 285, receipts: 1 },
      { canonical: "Mark's Work Wearhouse", aliases: ["mark s work wearhouse"], category: "Safety gear", firstSeen: daysAgo(15), totalSpend: 140, receipts: 1 },
    ],

    inbox: [
      {
        id: "INBX-001", at: isoDaysAgo(0), capturedBy: "R. Nozzle", category: "quick",
        summary: "Neighbor at the Silver Berry job asked for a card - wants her garage pad done",
        fields: { phone: "780-555-0177", where: "Silver Berry Rd" }, status: "NEW",
      },
    ],

    todos: [
      { id: "TODO-001", task: "Fit-test new P100 cartridges before Thursday job", category: "Safety", priority: "high", status: "Open", added: daysAgo(2), due: daysAhead(2) },
      { id: "TODO-002", task: "Call Foothills about compressor service interval", category: "Equipment", priority: "normal", status: "Open", added: daysAgo(5) },
    ],

    payments: [],
    esigns: [],
    lifecycles: [],
    reviews: [
      { id: "REV-001", jobId: "JOB-1041", customerId: "CUST-003", status: "received", rating: 5, comment: "Both trailers came back looking factory-fresh. Crew was in and out in two days and left the yard spotless.", requestedAt: isoDaysAgo(5), receivedAt: isoDaysAgo(3) },
    ],
    insights: [],
    insightWeights: {},
    activity: [],
    usedTxHashes: [],
    customHazards: [],
    photos: [
      { id: "PHOTO-001", jobId: "JOB-1041", kind: "before", caption: "Trailer decks — heavy rust, failed coating", takenBy: "R. Nozzle", at: isoDaysAgo(6) },
      { id: "PHOTO-002", jobId: "JOB-1041", kind: "after", caption: "White-metal finish, ready for primer", takenBy: "R. Nozzle", at: isoDaysAgo(5) },
    ],
    fieldNotes: [
      { id: "FN-001", jobId: "JOB-1041", text: "Yard manager asked about doing their loader bucket next month", by: "R. Nozzle", source: "voice", at: isoDaysAgo(5) },
    ],
    timeEntries: [
      { id: "TIME-001", crewName: "R. Nozzle", jobId: "JOB-1041", inAt: isoDaysAgo(6), outAt: isoDaysAgo(6), hours: 7, wage: 315 },
      { id: "TIME-002", crewName: "T. Field", jobId: "JOB-1041", inAt: isoDaysAgo(6), outAt: isoDaysAgo(6), hours: 7, wage: 315 },
    ],
  };
}
