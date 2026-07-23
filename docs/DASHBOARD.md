# The owner dashboard — the system's eyes, the administration surface

The fourth surface. The field app is the crew's **hands**, the MCP is the
**brain**, the workbook is the **spine** — and the dashboard is the owner's
**eyes**: the administration surface. One login-protected, mobile-responsive web
app that reads the same ops workbook and turns it into an always-current picture
of the whole business — the place the owner reviews what the brain did.

Same brand system as the rest of Evolved — Boreal Void `#0a0a0a`, Aurora Neon
`#4ade80`. Deployed on Hostinger behind real authentication. A real Alberta
company runs on it today; because it reads the **spine** and not blasting-specific
tables, it works for any business `franchise_spinup` creates.

## What it gives the owner

- **Finance dashboard with interactive charts** — spend proportion, revenue and
  margin trends, job-profitability comparison.
- **Job P&Ls, quotes, invoices, and receivables** — every entity clickable
  through to the underlying document.
- **Receipts** — filterable records with pop-up receipt images.
- **Insights** — revenue last month, where the money actually went, margin
  trends, outstanding receivables.
- **Safety** — FLHAs, per-hazard mitigations, worker sign-offs, documented
  controls; audit-ready.
- **Maintenance** — equipment servicing, wear items, upcoming and overdue work.
- **Company inventory** — media, coatings, PPE, and consumables on hand, tied to
  a materials price tracker.

## How it plugs in — read-only, onto the spine

```mermaid
flowchart LR
    MCP["MCP brain"] --> WB["Workbook spine — Google Sheets · 25 tabs"]
    FA["Field app"] --> WB
    WB --> DASH["Owner dashboard — login-protected · read-only view"]
```

The contract is deliberately narrow: **the dashboard reads the spine, it does
not write it.** The brain (MCP) and the crew (field app) are the only writers;
the dashboard shows. That keeps it safe — it can never corrupt the books — and
decoupled: it works against a live Google Sheet (via the service account) or the
zero-credential CSV export, the same two modes as `workbook_status`.

| Mode | Source | Setup |
|---|---|---|
| Live | The Google Sheet built by `workbook_create` | Share it read-only with the dashboard (link-shared read-only is already the default) |
| Offline | The CSV bundle from `workbook_export` / `scripts/make-workbook-template.mjs` | Point the dashboard at the exported folder |

## Status & source

Live and open source (MIT): **[kr8tiv-ai/evolve-dashboard](https://github.com/kr8tiv-ai/evolve-dashboard)**,
deployed at **[ops.evolveecoblasting.com](https://ops.evolveecoblasting.com)**. A
fresh clone runs **credential-free in demo mode** against synthetic fixtures —
see the whole thing before wiring anything real:

```bash
git clone https://github.com/kr8tiv-ai/evolve-dashboard
cd evolve-dashboard && npm install && npm start   # http://127.0.0.1:5178 · demo@example.com / demo1234
```

It's company-agnostic: every business-specific thing (branding, labels, units,
tax, which tabs exist, column names) lives in one profile under
`config/profiles/`, so adapting it to your trade is a single file. Point it at
your own workbook + [router](https://github.com/kr8tiv-ai/evolve-ops-workbook)
and set your own login.

## Boundary

Everything in **this** repo is synthetic and template-only. The public system
reads a synthetic workbook; the real Evolve deployment reads the company's live
workbook behind authentication. No real customer data, financials, workbook IDs,
router endpoints, or secrets ship here — an adopter points their own dashboard at
their own spine.
