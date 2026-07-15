# Tool catalog

Generated from the live server — 65 tools. Every tool returns JSON.

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

## Inventory control

### `inventory_status`

Stock levels across all three sections (Materials & Media, Consumables & PPE, Equipment & General) with par levels, reorder thresholds, low-stock flags, and last-paid pricing. The count that used to live on a clipboard.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `section` | `Materials & Media` · `Consumables & PPE` · `Equipment & General` | no |  |
| `lowStockOnly` | boolean | no |  |

### `inventory_receive`

Book received stock: bumps on-hand, records the movement, updates last-paid cost/supplier, and appends to the price log (so the price-watch and reorder engines learn real COD pricing). Link the receipt id when it came through the receipt pipeline.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item` | string | yes | Item id or name (fuzzy match ok) |
| `qty` | number | yes |  |
| `unitCost` | number | no |  |
| `supplier` | string | no |  |
| `receiptId` | string | no |  |

### `inventory_consume`

Log media/consumable usage against a job. Decrements stock, records the burn-down movement (fuel for per-job P&L and reorder forecasting), and warns the moment an item crosses its reorder threshold.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `item` | string | yes | Item id or name (fuzzy match ok) |
| `qty` | number | yes |  |
| `jobId` | string | no |  |

### `inventory_reorder_suggestions`

Everything at or below its reorder point, with suggested order quantity (back to par), preferred supplier, last-paid unit price, estimated cost, and recent burn rate so nothing runs out mid-job.

_No parameters._

### `price_watch`

Supplier price history per product from real purchases: last price vs previous, percent change, and spike flags (≥10% increase). Catches supplier creep before it eats the margin.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `product` | string | no | Filter to one product (fuzzy) |

## Contacts / CRM

### `contact_search`

One search across the whole rolodex. Customers come back with their quotes, jobs, and open balance; suppliers with their pricebook summary; crew with certifications and rate.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | yes |  |

### `supplier_add`

Add a supplier to the rolodex with products carried and contact details.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes |  |
| `location` | string | no |  |
| `phone` | string | no |  |
| `website` | string | no |  |
| `products` | string | no |  |
| `notes` | string | no |  |

### `supplier_pricebook`

What the company actually pays each supplier, by product: purchase history from the price log with latest unit prices — the negotiating sheet for the next order.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `supplier` | string | no |  |

### `crew_add`

Add a crew member with role, certifications, and loaded hourly rate. Feeds job costing and FLHA rosters.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes |  |
| `role` | `lead-tech` · `tech` · `apprentice` | yes |  |
| `phone` | string | no |  |
| `certifications` | array of string | no |  |
| `hourlyRate` | number | yes |  |

### `crew_roster`

Active crew with roles, rates, certifications, expiring-cert flags, and current job assignments from the dispatch board.

_No parameters._

## Ops-sheet engine

### `sheet_tabs`

The data spine as an operations workbook: every tab with its row count. This is the system of record — every tool writes through it.

_No parameters._

### `sheet_read`

Read any tab as headers + rows (display values), like the production router's readTab.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tab` | string | yes |  |
| `maxRows` | integer | no |  |

### `sheet_append_todo`

Append-only write to the To-Do tab (the workbook discipline: insert, never overwrite).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `task` | string | yes |  |
| `category` | string | no |  |
| `priority` | `low` · `normal` · `high` | no |  |
| `due` | string | no |  |

### `inbox_submit`

The crew-facing capture path: anything from the field lands as exactly one append-only inbox row (lead, receipt note, job photo note, supplier, todo, quick thought). Nothing touches the books directly — the filing engine routes it.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `capturedBy` | string | yes |  |
| `category` | `lead` · `receipt` · `todo` · `supplier` · `quick` · `job_note` | yes |  |
| `summary` | string | yes |  |
| `fields` | object | no |  |

### `inbox_list`

Inbox rows by status — NEW rows await filing; NEEDS REVIEW rows want a human or smarter judgment.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `status` | `NEW` · `FILED` · `NEEDS REVIEW` | no |  |

### `inbox_file`

Deterministically route NEW inbox rows to the right book: lead → Leads (+customer), todo → To-Do, supplier → Suppliers, receipt → the OCR expense pipeline, quick → keyword-sniffed or NEEDS REVIEW. Append-only, idempotent per row, exactly like the production autopilot.

_No parameters._

## Accounting depth

### `vendor_rollup`

Canonicalized vendor spend: total spend, receipt count, category, first seen — with new-vendor flags. Misspellings and variants roll up to one vendor record.

_No parameters._

### `receipt_report`

The 3-day style audit: receipts with OCR warnings, arithmetic that does not reconcile (subtotal + GST ≠ total), future/stale dates, and missing job attribution on job-sized spends. Clean receipts are counted, dirty ones are itemized.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `days` | integer | no |  |

### `invoice_remind`

Draft polite-but-firm reminder messages for every unpaid invoice, escalating tone with age (gentle < 7 days, direct 7–20, final notice 21+). Brand voice: no exclamation points, abrasive blasting not sandblasting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string | no | One invoice, or omit for all outstanding |

## On-chain payments (X Layer testnet)

### `invoice_payment_request`

Turn an invoice's balance due into an on-chain payment request on OKX X Layer TESTNET: EIP-681 payment URI, recipient, amount in test OKB (fixed synthetic FX rate), chain details, and explorer link. Testnet and demo funds only — Evolved never signs or moves assets.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `invoiceId` | string | yes |  |
| `payTo` | string | no | Override recipient address (0x…); default is the documented demo address |

### `invoice_payment_check`

Confirm settlement of a payment request. Live mode verifies the transaction hash on X Layer testnet via read-only RPC (exists, succeeded, correct recipient, sufficient value); simulated mode (default demo) accepts a simulated settlement and labels it clearly. On confirmation the invoice flips to Paid and the job to Paid.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `paymentId` | string | yes |  |
| `txHash` | string | no | X Layer testnet transaction hash (required in live mode) |
| `simulate` | boolean | no | Demo-mode settlement without a real transaction |

### `xlayer_status`

Live read-only connectivity check against the X Layer testnet RPC: chain id and latest block. Proof the on-chain rail is real, not a mock.

_No parameters._

### `x402_info`

How Evolved monetizes as an ASP: the HTTP endpoint exposes POST /mcp (free) and POST /mcp-paid (x402). The paid route answers 402 Payment Required with an accepts envelope (scheme exact, network eip155:1952) until the caller presents payment proof in the X-PAYMENT header. Returns the exact envelope and a curl walkthrough.

_No parameters._

## Autonomous lifecycle

### `lifecycle_start`

Kick off the full lead-to-paid lifecycle from one description: creates the lead and customer, prices the work with the learning engine, drafts the quote, and pauses at the human money gate (approve-quote). From there lifecycle_advance runs everything: e-sign, weather-gated booking, FLHA, completion with actuals and inventory burn-down, invoicing, on-chain payment on X Layer testnet, review request, and the pricing learning loop.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `customerName` | string | yes |  |
| `phone` | string | no |  |
| `siteAddress` | string | yes |  |
| `summary` | string | yes | What the customer wants, one line |
| `surface` | `driveway` · `sidewalk` · `patio` · `garage-pad` · `exposed-aggregate` · `trailer` · `equipment` · `fence` · `brick` · `other` | yes |  |
| `sqft` | number | yes |  |
| `depth` | `very-light` · `light` · `medium` · `heavy` | yes |  |
| `access` | `easy` · `moderate` · `difficult` | no |  |

### `lifecycle_advance`

Push a lifecycle forward through every stage it can reach. Provide approveQuote:true to clear the quote money gate, esignSigner to record client acceptance, and simulatePayment:true or txHash to settle the on-chain invoice. Everything between gates advances automatically and is logged step by step.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lifecycleId` | string | yes |  |
| `approveQuote` | boolean | no |  |
| `esignSigner` | string | no |  |
| `simulatePayment` | boolean | no |  |
| `txHash` | string | no |  |

### `lifecycle_status`

Every lifecycle with stage, open gates, and full step log — the audit trail of an autonomous engagement.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `lifecycleId` | string | no |  |

### `quote_esign_sign`

Record a client's e-signature on a sent quote using its HMAC acceptance token. Signature is verified against the token, timestamped, and becomes part of the permanent record. Accepting opens the job (or, when the quote belongs to a lifecycle, the lifecycle consumes the signature on its next advance).

| Parameter | Type | Required | Description |
|---|---|---|---|
| `esignId` | string | yes |  |
| `token` | string | yes |  |
| `signerName` | string | yes |  |
| `decision` | `accept` · `decline` | yes |  |

### `review_record`

Log the customer's post-job review (1–5 rating and comment) against the review request — closes the loop on the engagement and builds the reputation ledger.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `reviewId` | string | yes |  |
| `rating` | integer | yes |  |
| `comment` | string | no |  |

## Frontier

### `quote_from_photo`

A customer texts a photo; this turns it into a priced, branded draft quote. Vision (Claude, when a key is present) or a deterministic offline estimator (real JPEG/PNG pixel parsing + hints) estimates surface, area, condition, and blast depth; the learning rate engine prices it with a full profitability check; optionally books it straight into the ledger as a draft quote. Every photo quote carries a measure-to-confirm clause and feeds the learning loop when the job closes.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `imageBase64` | string | no | The customer's photo, base64 (JPEG/PNG) |
| `mediaType` | string | no | image/jpeg or image/png |
| `surface` | `driveway` · `sidewalk` · `patio` · `garage-pad` · `exposed-aggregate` · `trailer` · `equipment` · `fence` · `brick` · `other` | no |  |
| `approxWidthFt` | number | no |  |
| `approxLengthFt` | number | no |  |
| `conditionNote` | string | no |  |
| `customerName` | string | no | Provide to create the draft quote in the books |
| `siteAddress` | string | no |  |

### `voice_command`

Field crew talk, the books listen. Deterministic intent parsing handles: media/consumable usage ('used four bags of crushed glass on the Kowalczyk job'), FLHA start ('open the FLHA for job 1043'), navigation ('next stop?'), receipt logging ('log receipt: PETRO-CANADA … TOTAL $150'), todos ('remind me to grab couplers'), job status — and anything unrecognized is captured to the App Inbox so no thought is ever lost. Returns the action taken plus a short spoken-style reply.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `utterance` | string | yes |  |
| `speaker` | string | no | Crew member name (default: crew) |

### `cfo_forecast`

Answer the questions owners lose sleep over, with numbers: add a second truck (capex, added fixed cost, utilization ramp, break-even month), change rates (with price elasticity), or shock demand. 12-month monthly cash table grounded in the company's actual books and cost model, seasonality from the blast-day weather gates, and every assumption stated in the output.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `scenario` | `baseline` · `add-truck` · `rate-change` · `demand-shock` | yes |  |
| `truckCapexCad` | number | no |  |
| `truckMonthlyFixedCad` | number | no |  |
| `extraCrew` | integer | no |  |
| `ratePct` | number | no | rate-change: percent, e.g. 10 or -5 |
| `demandPct` | number | no | demand-shock: percent, e.g. -20 |

### `cfo_health`

The CFO one-pager: receivables aging, customer concentration risk, monthly run-rate from the books, weather-capacity outlook (share of blastable days ahead), review reputation, and the three numbers to fix first.

_No parameters._

## Business-in-a-box

### `insights_generate`

The deterministic business brain: spend pulse vs last month, top and new vendors, inbox backlog, reorder alerts, pending on-chain settlements. Insights are fingerprint-deduplicated (refreshed, never duplicated) and ranked by learned importance weights that your feedback trains.

_No parameters._

### `insight_feedback`

Rate an insight (Important / Not important / Done). Ratings adjust per-category weights, so the brain learns what this owner actually cares about — the feedback loop from the production Insights tab.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `insightId` | string | yes |  |
| `rating` | `Important` · `Not important` · `Done` | yes |  |

### `activity_feed`

The audit trail: every capture, filing, receipt, payment, and voice command in reverse-chronological order.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `limit` | integer | no |  |

### `backup_create`

Full snapshot of the data spine to a timestamped backup file — the never-pruned safety net.

_No parameters._

### `backup_list`

Every backup snapshot on file.

_No parameters._

### `franchise_spinup`

The productization story in one call: re-seed the entire operations brain for a NEW company — any name, any trade, your rate card — with empty books and the full machinery intact (quoting engine, receipts pipeline, FLHA library, digest, learning loop, on-chain invoicing). This is how one company's ops system becomes anyone's. DESTRUCTIVE to current demo data: requires confirm:true.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `companyName` | string | yes |  |
| `trade` | string | yes | e.g. pressure washing, line painting, mobile detailing |
| `region` | string | no |  |
| `currency` | string | no |  |
| `gstRate` | number | no |  |
| `rates` | array of objects | no | Custom rate card — must cover all four depths; defaults to the blasting card |
| `confirm` | boolean | yes | Must be true — this replaces the current demo dataset |
