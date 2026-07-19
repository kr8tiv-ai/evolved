# Make it yours — Evolved as an adaptable toolkit

Evolved is one company's operating system with the company made swappable.
Everything trade-specific lives in three places: the rate card, the hazard
library, and the seed data. Swap those and the whole machine — quoting with
a learning loop, receipts-to-books, FLHA safety, dispatch, digest, CFO
simulations, on-chain invoicing, the x402 paid tier — runs your business
instead.

## The 60-second version (no code)

Point any MCP client at the server and call:

```
franchise_spinup {
  companyName: "Glacier Pressure Washing",
  tradePack: "pressure-washing",
  region: "Calgary",
  confirm: true
}
```

Done. Empty books, your trade's rate card, your trade's hazards in every
FLHA the system drafts, and the full 83-tool surface live for the new
company. Three packs ship today — `pressure-washing`, `line-painting`,
`mobile-detailing` — and the `evolved://trade-packs` MCP resource lists
them with full contents.

**No fork needed for a brand-new trade.** Pass a whole pack inline:

```
franchise_spinup {
  companyName: "Aurora Mobile Detailing",
  trade: "mobile detailing",
  unit: "vehicle",
  customPack: {
    rateCard: [
      { depth: "very-light", label: "Express exterior",  ratePerSqft: 60 },
      { depth: "light",      label: "Full ext + interior", ratePerSqft: 120 },
      { depth: "medium",     label: "Full detail",        ratePerSqft: 220 },
      { depth: "heavy",      label: "Restoration",        ratePerSqft: 450 }
    ],
    hazards: [{ hazard: "Chemical exposure", risk: "medium", mitigations: ["Nitrile gloves", "SDS in the truck"] }]
  },
  confirm: true
}
```

**Pricing speaks your unit.** `unit` sets what the rate card charges *per* —
`sqft` (default), `hour`, `unit`, `vehicle`, `linear ft`. `quote_price` then
takes a `quantity` and prices it at `quantity × tier rate + mobilization`, and
every quote says the right noun. A detailer quotes per vehicle, not "per 100
sqft of car."

## The 10-minute version (your own trade)

1. Fork the repo.
2. Add a pack to [`src/trades.ts`](../src/trades.ts) — a rate card
   (four price tiers; call them whatever your trade calls them) and your
   trade's hazards with real mitigations. That's the whole contract.
3. Optionally reshape the seed (`src/seed.ts`) so the demo dataset tells
   your story, and re-run `python scripts/make-hero.py` with your logo.
4. `npm run build && npm test` — the suite validates your pack loads,
   prices, and drafts FLHAs.
5. Deploy anywhere Node 20 runs (`docs/DEPLOY-HOSTINGER.md` shows a
   $0-extra path), and list your own ASP on OKX.AI
   (`docs/OKX-LISTING.md`).

## What adapts automatically

| You change | The system responds |
|---|---|
| Rate card | quote_price, quote_from_photo, lifecycle pricing, break-even math, CFO baselines |
| Trade hazards | Every FLHA drafted by flha_open, voice_command, and the lifecycle leads with your hazards |
| gstRate / currency | GST math across quotes, invoices, and reports |
| `EVOLVED_PAYTO` | On-chain settlement flows to your testnet address |
| Seed data | Playground ticker, digest, snapshot, CFO charts — all rendered from the books |

## What we would love PRs for

More trade packs, locale/tax profiles beyond Alberta GST, an
LLM-fallback layer for the voice grammar, and per-tenant store handles
(the seam is `EVOLVED_DATA_DIR`). MIT licensed — take it, rebrand it,
run your company on it.
