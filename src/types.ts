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

export interface Database {
  meta: { company: string; currency: string; gstRate: number; seededAt: string };
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
}
