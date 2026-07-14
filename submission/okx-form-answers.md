# OKX AI Genesis Hackathon — Google form answers (draft)

Form: https://forms.gle/mddEUagmDbyV37ws8 — deadline July 17, 2026, 23:59 UTC.
Matt submits this by hand. Field labels may differ slightly; map by meaning.

---

**ASP name:** Evolved

**One-line description:**
Business management in a box — the complete operations brain of a real industrial-services company, packaged as an A2MCP agentic service.

**Full description / what it does:**
Evolved packages the live operating system of Evolve Eco Blasting (an abrasive-blasting company in Edmonton, Canada) as a Model Context Protocol service with 27 tools across five domains. An agent driving Evolved runs a field-services business end to end: a quote engine with learned $/sqft rates and a profitability check on every price (media, labor, fuel, overhead, break-even); branded quote and invoice documents; a tiered-OCR receipt pipeline that reconciles arithmetic, escalates on low confidence, deduplicates, and matches costs to jobs; a lead funnel with enforced next actions; weather-gated dispatch; field-level hazard assessments with per-hazard mitigations and crew sign-off; auto-raised action items for anything stalled (deposit unscheduled, invoice unpaid, quote expiring, job done but not invoiced); and a one-call morning digest. Two feedback loops set it apart: pricing that learns from recorded job outcomes, and books that audit themselves daily. Real-world use case, non-crypto, born from a system that runs a real company today.

**Category:** Software Utility (secondary fit: Finance Copilot)

**ASP type:** A2MCP — free endpoint (results returned directly); x402 paid tier planned via the OKX Payment SDK.

**Service / endpoint URL:** https://powderblue-leopard-801168.hostingersite.com/mcp (LIVE — health check at /health)

**Agent ID:** ← fill after Onchain OS registration

**Repository:** https://github.com/kr8tiv-ai/evolved

**Demo:** `npm run demo` runs the full loop (lead → quote → job → safety → books → digest) with zero credentials; demo video attached to the X post.

**X post link (#OKXAI):** ← fill after posting

**Team / contact:**
Matt Haynes — KR8TIV AI / Aurora Ventures — GitHub: Matt-Aurora-Ventures — email: lucidbloks@gmail.com

**Anything else / why it should win:**
Every rate, rule, and workflow in Evolved is production truth from a company that uses this system daily — including fixes for real incidents (a receipt parser that undercounted $1,250 as $1.25 is fixed and regression-tested here). It is the difference between "AI that talks about business" and "AI that runs one." Open source (MIT), synthetic demo data, no secrets.

---

## Pre-submission checklist (Matt)

1. [x] Deploy to a public host — DONE: https://powderblue-leopard-801168.hostingersite.com/mcp (Hostinger managed hosting; see docs/DEPLOY-HOSTINGER.md).
2. [ ] Onchain OS: install skill, log in to Agentic Wallet (your email), register A2MCP ASP, list it (prompts in docs/OKX-LISTING.md; answers in submission/asp-manifest.json).
3. [ ] Record the ≤90s demo (cut plan in docs/DEMO.md).
4. [ ] Post on X with #OKXAI (draft in submission/x-post-draft.md) + video.
5. [ ] Fill this form with the endpoint URL, Agent ID, and X post link.
6. [ ] Confirm the listing passes review (~24h) — required for eligibility, so do not leave it past July 16.
