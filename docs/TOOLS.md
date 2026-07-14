# Tool catalog

Generated from the live server — 27 tools. Every tool returns JSON.

## Quoting intelligence

### `quote_price`

Price an abrasive-blasting job with the company rate engine: learned $/sqft rates by blast depth and surface, access factor, mobilization, 5% GST, 25% deposit — plus a full profitability check (media, labor, fuel, overhead, break-even rate, margin verdict). Use this before creating any quote.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `sqft` | number | yes | Square footage of the work area |
| `depth` | `very-light` · `light` · `medium` · `heavy` | yes | Blast depth required |
| `surface` | `driveway` · `sidewalk` · `patio` · `garage-pad` · `exposed-aggregate` · `trailer` · `equipment` · `fence` · `brick` · `other` | no | Surface type (drives learned pricing) |
| `access` | `easy` · `moderate` · `difficult` | no | Site access difficulty (default easy) |
| `mobilization` | boolean | no | Include the mobilization fee (default true) |

### `quote_create`

Create a formal quote in the books (auto-numbered ECO-Q-MMDDYY-NN, valid 30 days) for a customer, from one or more priced lines. Runs the profitability check and stores the verdict. If a custom price is below break-even it is honoured but flagged — never silently raised.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `customerId` | string | yes | Existing customer id (see pipeline tools to create one) |
| `siteAddress` | string | yes |  |
| `lines` | array of objects | yes |  |
| `notes` | string | no |  |
| `leadId` | string | no |  |

### `quote_render`

Render a quote as a polished, dark-brand HTML document (Boreal Void page, Cyber Lime underline, Aurora Neon labels, diamond bullets, payment schedule with the big green total) ready to print to PDF and send. Returns the file path and the HTML.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `quoteId` | string | yes |  |

### `quote_update_status`

Move a quote through its lifecycle: Draft → Sent → Accepted/Declined/Expired. Accepting a quote automatically opens a job in the dispatch pipeline and marks the lead Won.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `quoteId` | string | yes |  |
| `status` | `Draft` · `Sent` · `Accepted` · `Declined` · `Expired` | yes |  |

### `quote_list`

List quotes, optionally filtered by status. Includes totals, validity, and profitability verdicts.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `status` | `Draft` · `Sent` · `Accepted` · `Declined` · `Expired` | no |  |

### `pricing_rates`

Show the live rate table: base market rates by blast depth, the learned effective rates by surface (driven by real job outcomes at healthy margins), access factors, and the mobilization fee. This is the quoting engine's brain.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `surface` | `driveway` · `sidewalk` · `patio` · `garage-pad` · `exposed-aggregate` · `trailer` · `equipment` · `fence` · `brick` · `other` | no | Show the learned rate for a specific surface |

### `pricing_record_outcome`

Record a job outcome (won/lost, quoted rate, actual cost per sqft, margin) into the pricing learning loop. Wins at healthy margins pull future quotes for that surface+depth toward what actually works — every job makes the next quote smarter.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | yes |  |
| `surface` | `driveway` · `sidewalk` · `patio` · `garage-pad` · `exposed-aggregate` · `trailer` · `equipment` · `fence` · `brick` · `other` | yes |  |
| `depth` | `very-light` · `light` · `medium` · `heavy` | yes |  |
| `sqft` | number | yes |  |
| `quotedRate` | number | yes | $/sqft quoted |
| `actualCostPerSqft` | number | yes |  |
| `won` | boolean | yes |  |

## Money

### `receipt_ingest`

Run a receipt through the tiered extraction pipeline: fast model first, automatic escalation to a stronger model when confidence is low or the math does not reconcile. The result is categorized (media, fuel, equipment, safety gear, ...), optionally matched to a job for per-job P&L, duplicate-guarded, and posted straight to the expense ledger. Paper to books in one call.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `text` | string | yes | Raw receipt text (from a photo OCR or typed) |
| `jobId` | string | no | Job to attribute this cost to |

### `expense_report`

Expense breakdown by category and vendor for a month (YYYY-MM, default current). Shows OCR provenance and reclaimable GST — the bookkeeping view an accountant actually wants.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `month` | string | no |  |

### `invoice_create`

Invoice a completed job: pulls the quote lines, applies the deposit already collected, computes 5% GST and the balance due (net 14). Marks the job Invoiced.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | yes |  |
| `extraLines` | array of objects | no |  |

### `invoice_render`

Render an invoice in the company's dark brand as a self-contained HTML document ready to print to PDF.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string | yes |  |

### `pnl_report`

Profit & loss for a month or the whole book: revenue from paid invoices, expenses from the receipt ledger, per-job margins from recorded actuals, and the business scorecard (win rate, average $/sqft, overall margin).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `month` | string | no | YYYY-MM; omit for all-time |

## Pipeline

### `lead_capture`

Log a new lead into the sales funnel (New → Contacted → Site visit → Quoted → Won/Lost). Creates the customer record if needed. Company rule: every open lead carries a NEXT ACTION with a date — this tool enforces it.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Customer or company name |
| `phone` | string | no |  |
| `email` | string | no |  |
| `address` | string | no |  |
| `source` | string | yes | Where the lead came from (referral, website, phone, ...) |
| `summary` | string | yes | What they want, in one line |
| `nextAction` | string | yes | The concrete next step |
| `nextActionDate` | string | no | YYYY-MM-DD, default tomorrow |

### `lead_update`

Move a lead through the funnel and refresh its next action. Won/Lost closes it out.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `leadId` | string | yes |  |
| `stage` | `New` · `Contacted` · `Site visit` · `Quoted` · `Won` · `Lost` | no |  |
| `nextAction` | string | no |  |
| `nextActionDate` | string | no |  |
| `notes` | string | no |  |

### `pipeline_view`

The whole funnel at a glance: open leads by stage with next actions, quotes out with age, and jobs by dispatch status. The first tool to reach for when asked 'where's the business at?'

_No parameters._

### `job_schedule`

Book a job onto the dispatch board: date, crew, deposit status. Moves it along Awaiting acceptance → Booked → Confirmed → In progress. Checks the blast-day weather verdict for the chosen date.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | yes |  |
| `scheduledDate` | string | yes | YYYY-MM-DD |
| `crew` | array of string | no |  |
| `depositPaid` | boolean | no |  |
| `status` | `Booked` · `Confirmed` · `In progress` | no |  |

### `job_complete`

Close out a job with real numbers: hours, crew size, materials, fuel. Computes wages from the loaded crew rate, total cost, profit, margin, and a verdict — then feeds the per-job P&L. Follow with pricing_record_outcome to teach the quoting engine, and invoice_create to get paid.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | yes |  |
| `hoursWorked` | number | yes |  |
| `crewSize` | integer | yes |  |
| `materials` | number | yes |  |
| `fuel` | number | yes |  |
| `revenue` | number | yes | Job revenue before GST (usually the quote subtotal) |

### `customer_list`

Customer book with contact details and their quotes/jobs at a glance.

_No parameters._

## Safety

### `flha_open`

Open the day's FLHA for a job before work starts. Drafts the hazard list automatically from the job scope using the abrasive-blasting hazard library — each hazard comes with specific mitigations, not boilerplate — plus standard PPE and a muster point. Crew adds site-specific hazards on top. No FLHA, no blasting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | yes |  |
| `crew` | array of string | yes |  |
| `siteConditions` | string | yes | Weather, ground, traffic, occupancy — what the crew sees on arrival |
| `extraHazards` | array of string | no | Site-specific hazards the crew identified |
| `musterPoint` | string | no |  |
| `openedBy` | string | yes |  |

### `flha_signoff`

Close the day's FLHA: every crew member signs, incident status is recorded, and the assessment becomes part of the job's permanent safety record. Flags any crew member who has not signed.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `flhaId` | string | yes |  |
| `signedBy` | array of string | yes |  |
| `incidentFree` | boolean | yes |  |
| `notes` | string | no |  |

### `safety_log`

The FLHA history: open assessments needing sign-off, signed records, and incident flags across all jobs.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `jobId` | string | no |  |

## Autonomous ops

### `morning_digest`

The 6:30 AM owner briefing, on demand: the one thing not to drop today, today's jobs with crews, money pulse (month revenue, expenses, receivables), quotes out with age, leads needing a touch, auto-raised action items, five-day blast-day weather verdicts, and system health. One call, whole business.

_No parameters._

### `action_items_scan`

Run the ball-drop catcher across the books. Auto-raises items for: deposit in but unscheduled, invoice unpaid 7+ days, quote unanswered 7 days, quote expiring within 7 days, job complete but not invoiced, and open leads with stale next actions. Deduplicates against items already open.

_No parameters._

### `action_item_resolve`

Mark an action item handled. It leaves the digest and the open list.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `actionItemId` | string | yes |  |
| `resolution` | string | no |  |

### `weather_check`

Five-day forecast with blast-day verdicts (Good blast day / Marginal / No-go) using the company's gating thresholds: no blasting at precip ≥50%, wind >40 km/h, or highs below 3°C.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `days` | integer | no |  |

### `business_snapshot`

Everything on one screen: funnel counts, money position, open safety items, and open action items. The health check an investor or owner asks for first.

_No parameters._

### `demo_reset`

Restore the synthetic demo dataset to its seeded state (all names, numbers, and dollar figures are invented). Useful between demo runs.

_No parameters._
