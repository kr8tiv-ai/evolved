/**
 * Evolved — core domain types.
 *
 * The data model mirrors the tabs of a real operations workbook that runs a
 * working industrial-services company (leads → quotes → dispatch → receipts →
 * P&L → safety), so an agent operating these tools is operating a business.
 */

export type BlastDepth = "very-light" | "light" | "medium" | "heavy";

export type SurfaceKind =
  | "driveway"
  | "sidewalk"
  | "patio"
  | "garage-pad"
  | "exposed-aggregate"
  | "trailer"
  | "equipment"
  | "fence"
  | "brick"
  | "other";

export type LeadStage =
  | "New"
  | "Contacted"
  | "Site visit"
  | "Quoted"
  | "Won"
  | "Lost";

export type QuoteStatus =
  | "Draft"
  | "Sent"
  | "Accepted"
  | "Declined"
  | "Expired";

export type JobStatus =
  | "Awaiting acceptance"
  | "Booked"
  | "Confirmed"
  | "In progress"
  | "Complete"
  | "Invoiced"
  | "Paid";

export type ExpenseCategory =
  | "Abrasive media"
  | "Fuel"
  | "Equipment"
  | "Equipment rental"
  | "Vehicle & maintenance"
  | "Safety gear"
  | "Insurance"
  | "Marketing"
  | "Office & software"
  | "Meals & travel"
  | "Other";

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  customerId: string;
  source: string;
  stage: LeadStage;
  summary: string;
  nextAction: string;
  nextActionDate: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLine {
  description: string;
  sqft?: number;
  depth?: BlastDepth;
  surface?: SurfaceKind;
  amount: number;
}

export interface Quote {
  id: string; // ECO-Q-MMDDYY-NN
  customerId: string;
  leadId?: string;
  siteAddress: string;
  lines: QuoteLine[];
  sqftTotal?: number;
  subtotal: number;
  gst: number;
  total: number;
  depositRequired: number;
  status: QuoteStatus;
  validUntil: string;
  profitability?: ProfitabilityCheck;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfitabilityCheck {
  estimatedCosts: {
    media: number;
    labor: number;
    fuel: number;
    overhead: number;
    total: number;
  };
  profit: number;
  marginPct: number;
  breakEvenRate: number;
  verdict: "healthy" | "thin" | "below-break-even";
  advisory: string;
}

export interface Job {
  id: string;
  quoteId?: string;
  customerId: string;
  siteAddress: string;
  scope: string;
  status: JobStatus;
  scheduledDate?: string;
  crew: string[];
  depositPaid: boolean;
  actuals?: JobActuals;
  createdAt: string;
  updatedAt: string;
}

export interface JobActuals {
  hoursWorked: number;
  crewSize: number;
  wages: number;
  materials: number;
  fuel: number;
  totalCost: number;
  revenue: number;
  profit: number;
  marginPct: number;
  verdict: "healthy" | "thin" | "loss";
  completedAt: string;
}

export interface Receipt {
  id: string;
  vendor: string;
  date: string;
  amountBeforeTax: number;
  gst: number;
  total: number;
  category: ExpenseCategory;
  paymentMethod?: string;
  jobId?: string;
  lineItems: { description: string; amount: number }[];
  ocr: {
    model: "haiku" | "sonnet" | "manual";
    escalated: boolean;
    confidence: number;
    warnings: string[];
  };
  createdAt: string;
}

export interface ActionItem {
  id: string;
  rule: string;
  severity: "info" | "warn" | "urgent";
  message: string;
  relatedId?: string;
  raisedAt: string;
  resolvedAt?: string;
}

export interface HazardEntry {
  hazard: string;
  risk: "low" | "medium" | "high";
  mitigations: string[];
}

export interface Flha {
  id: string;
  jobId: string;
  date: string;
  crew: string[];
  siteConditions: string;
  hazards: HazardEntry[];
  ppeConfirmed: string[];
  musterPoint: string;
  openedBy: string;
  openedAt: string;
  signoff?: {
    signedBy: string[];
    incidentFree: boolean;
    notes: string;
    signedAt: string;
  };
}

export interface Invoice {
  id: string; // ECO-INV-...
  jobId: string;
  customerId: string;
  lines: QuoteLine[];
  subtotal: number;
  gst: number;
  total: number;
  depositApplied: number;
  balanceDue: number;
  status: "Draft" | "Sent" | "Paid" | "Overdue";
  dueDate: string;
  createdAt: string;
}

export interface RateEntry {
  depth: BlastDepth;
  label: string;
  baseRate: number; // CAD per sqft — market mid-range floor
  learnedRate: number; // adjusted by the pricing learning loop
  samples: number; // how many job outcomes have informed learnedRate
}

export interface PricingOutcome {
  id: string;
  jobId: string;
  surface: SurfaceKind;
  depth: BlastDepth;
  sqft: number;
  quotedRate: number;
  actualCostPerSqft: number;
  marginPct: number;
  won: boolean;
  recordedAt: string;
}

// ---------- contacts / CRM ----------

export interface Supplier {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  website?: string;
  products?: string;
  notes?: string;
  createdAt: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: "lead-tech" | "tech" | "apprentice";
  phone?: string;
  certifications: string[];
  hourlyRate: number;
  active: boolean;
  createdAt: string;
}

// ---------- inventory ----------

export type InventorySection =
  | "Materials & Media"
  | "Consumables & PPE"
  | "Equipment & General";

export interface InventoryItem {
  id: string;
  section: InventorySection;
  name: string;
  unit: string;
  onHand: number;
  parLevel: number;
  reorderAt: number;
  preferredSupplierId?: string;
  lastUnitCost?: number;
  lastSupplier?: string;
  lastPurchasedAt?: string;
  notes?: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  delta: number;
  reason: "received" | "consumed" | "adjustment";
  jobId?: string;
  receiptId?: string;
  unitCost?: number;
  at: string;
}

export interface PriceLogEntry {
  id: string;
  date: string;
  supplier: string;
  product: string;
  itemId?: string;
  unitType: string;
  qty: number;
  unitPrice: number;
  totalPaid: number;
  receiptId?: string;
  notes?: string;
}

export interface VendorRecord {
  canonical: string;
  aliases: string[];
  category: string;
  firstSeen: string;
  totalSpend: number;
  receipts: number;
}

// ---------- app inbox (field capture) ----------

export interface InboxRow {
  id: string;
  at: string;
  capturedBy: string;
  category: string;
  summary: string;
  fields: Record<string, string>;
  status: "NEW" | "FILED" | "NEEDS REVIEW";
  filedTo?: string;
}

export interface Todo {
  id: string;
  task: string;
  category: string;
  priority: "low" | "normal" | "high";
  status: "Open" | "Done";
  added: string;
  due?: string;
  notes?: string;
}

// ---------- on-chain payments (X Layer testnet) ----------

export interface PaymentRequest {
  id: string;
  invoiceId: string;
  network: string; // CAIP-2, e.g. eip155:1952 (X Layer testnet)
  chainId: number;
  payTo: string;
  asset: { symbol: string; address: string | null; decimals: number };
  amountCad: number;
  amountAsset: string; // human units
  amountBaseUnits: string; // integer string
  uri: string; // EIP-681
  status: "pending" | "paid" | "expired";
  mode: "simulated" | "live";
  txHash?: string;
  createdAt: string;
  paidAt?: string;
  expiresAt: string;
}

// ---------- e-sign ----------

export interface EsignRecord {
  id: string;
  quoteId: string;
  token: string;
  status: "sent" | "signed" | "declined";
  signerName?: string;
  signedAt?: string;
  sentAt: string;
}

// ---------- autonomous lifecycle ----------

export interface LifecycleGate {
  gate: "approve-quote" | "confirm-payment";
  reason: string;
  raisedAt: string;
  clearedAt?: string;
}

export interface Lifecycle {
  id: string;
  stage: string;
  leadId?: string;
  customerId?: string;
  quoteId?: string;
  esignId?: string;
  jobId?: string;
  flhaId?: string;
  invoiceId?: string;
  paymentId?: string;
  reviewId?: string;
  gates: LifecycleGate[];
  log: { at: string; step: string; detail: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRequest {
  id: string;
  jobId: string;
  customerId: string;
  status: "requested" | "received";
  rating?: number;
  comment?: string;
  requestedAt: string;
  receivedAt?: string;
}

// ---------- insights / activity / backups ----------

export interface Insight {
  id: string;
  date: string;
  category: string;
  text: string;
  suggestedAction?: string;
  score: number;
  status: "New" | "Important" | "Not important" | "Done";
  fingerprint: string;
}

export interface ActivityEvent {
  at: string;
  source: string;
  message: string;
}

export interface Database {
  meta: {
    company: string; currency: string; gstRate: number; seededAt: string;
    /** Lifetime settled x402 paid calls on this deployment (survives resets). */
    paidCalls?: number;
  };
  customers: Customer[];
  leads: Lead[];
  quotes: Quote[];
  jobs: Job[];
  receipts: Receipt[];
  actionItems: ActionItem[];
  flhas: Flha[];
  invoices: Invoice[];
  rateTable: RateEntry[];
  pricingOutcomes: PricingOutcome[];
  quoteCounter: Record<string, number>; // per-MMDDYY sequence
  // ---- parity expansion ----
  suppliers: Supplier[];
  crew: CrewMember[];
  inventory: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  priceLog: PriceLogEntry[];
  vendors: VendorRecord[];
  inbox: InboxRow[];
  todos: Todo[];
  payments: PaymentRequest[];
  esigns: EsignRecord[];
  lifecycles: Lifecycle[];
  reviews: ReviewRequest[];
  insights: Insight[];
  insightWeights: Record<string, number>;
  activity: ActivityEvent[];
  /** On-chain replay protection: every testnet tx hash ever accepted. */
  usedTxHashes: string[];
}
