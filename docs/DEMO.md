# The 90-second demo

> **v3 — the any-business cut (SHIPPED as `submission/evolved-demo.mp4`, 90.0s).**
> Title (any service business, run by an AI) → premise (84 tools / 16 domains /
> 51 tests, live `/health`) → **trade packs** (pressure washing, line painting,
> mobile detailing, YOUR trade — `franchise_spinup`) → intake by text, voice,
> or photo (`quote_from_photo`) → the autonomous lifecycle with two human money
> gates → **the JHA authored on-site** (`flha_field_capture`) → **the workbook
> spine** (`workbook_create` → Google Sheets; `workbook_export` → 25 CSV tabs,
> zero credentials) → the raw x402 402 → proof → receipt flow → end card.
> Renderer: `submission/render_video.py`. The classic 10-beat cut below still
> works as a live alternative.

Two ways to run it: the scripted terminal demo (zero setup beyond `npm run
build`), or live through any MCP client. Both tell the same story — one agent
running a company's whole day.

## Scripted: `npm run demo`

Drives a real MCP client against the real server over an in-memory transport.
Ten beats, ~15 seconds of runtime, prints every tool call and result:

| Beat | Tool | The story |
|---|---|---|
| 1 | `lead_capture` | A dental clinic wants its entrance concrete refreshed. Lead logged; the system refuses to hold a lead without a next action and a date. |
| 2 | `quote_price` | 520 sqft, light blast, moderate access. Returns the learned rate, subtotal, GST, 25% deposit, and a profitability check showing a 62% margin — before anything is promised. |
| 3 | `quote_create` | Formal quote, auto-numbered `ECO-Q-MMDDYY-NN`, valid 30 days, margin verdict stored on the record. |
| 4 | `quote_render` | The branded document: Boreal Void page, Cyber Lime underline, diamond bullets, payment schedule, big green total. Open the HTML, print to PDF, send. |
| 5 | `quote_update_status` → Accepted | The lead flips to Won and a job opens on the dispatch board automatically. |
| 6 | `job_schedule` | Booked for tomorrow with crew — and the booking comes back with a blast-day weather verdict. |
| 7 | `flha_open` | The morning-of hazard assessment, drafted from the job scope: pressurized lines, airborne particulate, pedestrian traffic — each with concrete mitigations, plus PPE and a muster point. |
| 8 | `receipt_ingest` | A diesel receipt from the road. Tiered OCR parses it, reconciles subtotal + GST = total, categorizes it as Fuel, matches it to the job. |
| 9 | `job_complete` + `flha_signoff` + `invoice_create` + `pricing_record_outcome` | Actuals recorded with a margin verdict, safety record closed incident-free, invoice out with the deposit applied, and the outcome teaches the rate engine. |
| 10 | `morning_digest` | Tomorrow, 6:30 AM: the one thing not to drop, money pulse, quotes out, weather, and every auto-raised action item. |

## Live: through an MCP client

Wire the server into Claude Desktop or Claude Code (config in the README),
then try:

> "Give me the business snapshot."

> "A property manager called — Northgate wants a 2,100 sqft parkade level
> profiled, medium blast, tight access. Price it, tell me the margin, and if
> it is healthy create the quote and render the document."

> "Ingest this receipt: PRINCESS AUTO / blast hose 50ft 189.99 / couplers
> 81.44 / SUBTOTAL 271.43 / GST 13.57 / TOTAL 285.00 — it's for job JOB-1043."

> "Run the morning digest. What am I about to drop?"

The seed data is arranged so the ball-drop catcher has something real to say:
a deposit sitting on an unscheduled job, an invoice unpaid 12 days, a quote
about to expire, and a finished job nobody invoiced.

Reset any time with the `demo_reset` tool or `npm run reset`.

## Recording the 90-second video

Suggested cut for the hackathon demo (≤90 seconds):

1. **0–10s** — README banner, one line: "This is a real company's operations
   brain, as an MCP agent."
2. **10–55s** — `npm run demo` running: pause on beat 2 (the profitability
   check), beat 4 (the branded quote), and beat 7 (the FLHA).
3. **55–80s** — an MCP client asking for the morning digest, showing the
   auto-raised action items.
4. **80–90s** — the OKX.AI angle: "Listed as a free A2MCP service — any agent
   in the marketplace can run a trade business with it."
