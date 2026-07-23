# Run YOUR business on Evolved — turnkey onboarding

Evolved is free and open source (MIT). You can run the whole system — the MCP
brain, the crew field app, the workbook backend, and a complete demo dataset —
at no cost, for any service business. This page is the **quick path** (the MCP +
your workbook, an afternoon). To stand up all four surfaces — workbook, router,
field app, dashboard, MCP — as one system, follow **[STAND-UP-YOUR-OWN.md](STAND-UP-YOUR-OWN.md)**.

## The 4 steps

### 1. Pick your trade

```bash
git clone https://github.com/kr8tiv-ai/evolved.git && cd evolved
npm install && npm run build
```

Point any MCP client at the server (see [CONNECT.md](CONNECT.md)) and spin up
your company in one call — a ready-made pack, or your own inline:

```
franchise_spinup {
  companyName: "Cascade Mobile Services",
  trade: "mobile power washing",
  unit: "hour",            // sqft | hour | unit | vehicle | flat
  currency: "USD",
  gstRate: 0.08,           // your sales-tax rate (0 = none)
  taxLabel: "Sales Tax",   // GST | VAT | HST | Sales Tax …
  customPack: {
    rateCard: [
      { depth: "very-light", label: "Rinse",        ratePerSqft: 45 },
      { depth: "light",      label: "Standard wash", ratePerSqft: 75 },
      { depth: "medium",     label: "Deep clean",    ratePerSqft: 120 },
      { depth: "heavy",      label: "Restoration",   ratePerSqft: 200 }
    ],
    hazards: [{ hazard: "High-pressure water", risk: "high", mitigations: ["Never aim at a person", "Trigger lock on moves"] }]
  },
  confirm: true
}
```

Now every quote, FLHA, invoice, and report speaks *your* trade, unit, tax, and
hazards — no blasting boilerplate, no fork.

### 2. Generate your workbook (the backend template)

```bash
node scripts/make-workbook-template.mjs pressure-washing "Cascade Mobile Services"
```

That writes your 25-tab operations workbook as a CSV bundle (`.data/workbook/`).
Import it into Google Sheets (**File → Import**), or go live and MCP-synced:

```
# set EVOLVED_GOOGLE_SA to a Google service-account JSON, then
workbook_create           # builds a real Google Sheet, link-shared read-only
workbook_sync             # pushes every change back into it
```

### 3. Connect the field app

Deploy the crew's phone front end — [kr8tiv-ai/evolve-field-app](https://github.com/kr8tiv-ai/evolve-field-app),
$0/month on Google Apps Script — and it feeds captures into the same brain
through the App Inbox. Full wiring: [FIELD-APP.md](FIELD-APP.md).

### 4. You're running

Ask your agent the things an owner asks:

> "Run the morning digest — what am I about to drop?"
> "Price 3 hours of deep clean at 123 Main St and draft the quote."
> "File everything the crew dropped in the inbox."

## What "free and open" means here

- **No paywall on real functionality.** Every tool, the field app, the workbook
  backend, and the full demo dataset run at no cost.
- **MIT across the board** — the MCP, the field app, and this backend template.
  Fork it, rebrand it, run your company on it.
- **The x402 rail is opt-in, not a toll.** It's built-in on-chain billing you
  can *switch on for your own deployment* if you want other agents to pay you
  per call — off by default, and never gating the free system.

## The boundary (for adopters and contributors)

Everything shipped here is **synthetic and template-only**. No real customer
data, financials, workbook IDs, secrets, or supplier terms. Bring your own —
the structure is the gift, not anyone's instance.
