# Evolved — OKX AI Genesis Hackathon · Master Checklist

_Last updated: 2026-07-16 (Fable). Deadline: form July 17 23:59 UTC; OKX listing review ~24h → treat **July 16** as the real cutoff._

**Live:** https://evolvedmcp.cloud (custom domain, SSL) · mirror https://powderblue-leopard-801168.hostingersite.com
**Repo:** https://github.com/kr8tiv-ai/evolved (public, MIT) · **HackQuest project:** "Evolved - Business in a box MCP" (score 90, Meets Entry Standard)
**Numbers of record:** 83 tools · 16 domains · 41 tests · v3.0.0

---

## A. Product / code (DONE ✅)
- [x] MCP server, 83 tools / 16 domains, stdio + Streamable HTTP (`/mcp` free, `/mcp-paid` x402)
- [x] x402 pay-per-call (402 challenge, scheme `exact`, `eip155:1952`) — live, verified
- [x] On-chain invoice settlement on X Layer testnet (EIP-681, read-only RPC verify, replay-protected, no keys held)
- [x] Autonomous lifecycle with two human money gates
- [x] Learning quote engine + market benchmark; receipts→books (tiered OCR); FLHA safety; dispatch; inventory; CRM; CFO
- [x] v3 domains: **Workbook spine** (Google Sheets via service account / CSV, 20 tabs), **Field ops** (photos, notes, crew clock, on-site JHA), **Growth** (reviews, reputation, Job P&L scorecard, dispatch board, brand config, franchise preview)
- [x] Trade packs (pressure-washing, line-painting, mobile-detailing) + `franchise_spinup` / `franchise_preview`
- [x] 41 tests green (incl. live X Layer testnet probe); adversarial-review hardened (29 findings + 2 more audit passes)
- [x] Security: per-IP rate limit, 256KB body cap, demo-tool whitelist, security headers, SECURITY.md threat model

## B. Deploy / hosting (DONE ✅)
- [x] **Custom domain evolvedmcp.cloud** live (Hostinger addon, SSL) — serving v3.0.0 / 83 tools
- [x] Mirror on powderblue-leopard subdomain kept as fallback
- [x] Demo video self-hosted at `/demo.mp4` (video/mp4 + byte ranges) on both domains
- [x] Self-hosted brand media route `/media/*` (hero video, scene imagery)
- [ ] **www.evolvedmcp.cloud** apex/www wiring — verify www resolves + SSL (root works; confirm www redirect)

## B2. Live-site social preview (DONE ✅)
- [x] Open Graph (og:title/description/url/image 1200×630) + Twitter `summary_large_image` in the playground head; canonical + theme-color
- [x] Branded link-preview card `assets/og.png` served at **/og.png** — "Business-in-a-box, run by an AI. Paid on-chain." over the boreal aurora
- [x] Deployed to both domains; tags + image verified reachable
- [x] Short X announcement (link-preview pull-through) saved to `submission/x-post-draft.md`

## C. Repo presentation (IN PROGRESS)
- [x] README: hero, badges, 60-sec judge tour, why-this-wins, lifecycle mermaid, 83-tool table, scaffolding, tests
- [x] docs/ up to date (TOOLS.md autogen 83, ARCHITECTURE workbook section, ADAPT, OKX-LISTING, DEPLOY, DEMO, GALLERY)
- [x] **GitHub hero / social-preview image** — DONE: premium composite from the real Evolve aurora boreal-treeline scene (backgrounds only, no equipment), chrome wordmark + keynote scrim; feeds README hero + `assets/social-preview.png` (`scripts/make-hero-photo.py`)
- [ ] GitHub repo **Settings → Social preview** upload (Matt — no API; `assets/social-preview.png` ready)
- [ ] CI workflow: `gh auth refresh -s workflow` then move `ci/github-actions-ci.yml` → `.github/workflows/` (Matt)

## D. Playground / design (DONE ✅, polish optional)
- [x] Cinematic hero with real Evolve jobsite footage, WebGL mouse-reactive aurora, squared UI, reveals, marquee, Judge Mode
- [x] Interactive cards hit the live service (voice, photo-quote, lifecycle, x402, workbook, scorecard, pack preview)
- [x] **Mobile: no horizontal drag** — page locked to viewport (html/body overflow-x hidden + max-width 100%, structural blocks capped, oversized ghost words hidden <680px + drift JS gated). Verified live at 390px: docScrollWidth==clientWidth, canPageScrollX false, forced horizontal drag snaps back to 0, zero overflow across all sections (hero/Judge Mode/on-chain/tools/footer).
- [ ] Optional polish: branded preloader + counter, SCROLL cue (apparel-site cues) — nice-to-have

## E. Demo video (DONE ✅)
- [x] 90.0s cut, 1080p, Neue Montreal + JetBrains Mono typography, evolvedmcp.cloud baked in
- [x] Soundtrack: "Background No Copyright Music" by absolutesound (Pixabay license)
- [x] Scenes: title → premise (83/16/41) → trade packs → intake → lifecycle → on-site JHA → workbook spine → x402 → end card
- [x] Committed to repo + deployed to both domains

## F. HackQuest submission (NEARLY DONE)
- [x] Project filled: intro, description (83/16/41 + workbook/field/growth), Sector AI, tech tags, deployment details, progress, fundraising
- [x] 4 gallery images + square logo tile uploaded; entry standard met (score 90)
- [x] Submit form pre-filled: prize tracks ×4, ASP name, ASP description (299/300), X handle @aurora_ventures, Telegram @matthaynes88
- [x] **Video link → https://evolvedmcp.cloud/demo.mp4?v=5** — DONE, persisted (90s cut)
- [ ] Public profile enriched (bio/location/GitHub/X) — score 86, keep
- [ ] **Final Submit** — needs Agent ID + X post link (Matt), then click Submit

## G. OKX ASP listing (OWNED BY A PARALLEL SESSION — not in this queue)
- [~] Register + list A2MCP ASP via Onchain OS (wallet email OTP + on-chain ERC-8004 registration) → **Agent ID**
- Answer sheet ready: `submission/OKX-LISTING-STEPS.md`, `submission/asp-manifest.json` (all evolvedmcp.cloud, 83/16)

## H. Matt-only manual steps
- [ ] OKX listing → capture **Agent ID** (parallel session assisting)
- [ ] Post X thread `#OKXAI` (`submission/x-post-draft.md`; video native on main post, `assets/x-post-card.png` on Reply 1) → **post link**
- [ ] Paste Agent ID + X post link into the open HackQuest submit tab → **Submit**
- [ ] Google form (`submission/PREFILLED-FORM.md` prefill link — all fields current)
- [ ] **HIGH-VALUE:** set `EVOLVED_PAYTO` to a testnet wallet, run 3–5 real X Layer testnet settlements, pin txHash + OKLink in README/X/video (judges called this the single strongest artifact — /stats currently shows 0)
- [ ] GitHub Settings → Social preview upload

---

### Judge verdict on record (2-pass adversarial + judge workflow)
"Places top-3 in Software Utility" — scores Best Product 8 / Revenue Rocket 6 / Software Utility 9 / Finance Copilot 7.
Weakest remaining artifact: `/stats` all zeros + placeholder payTo → the real-testnet-settlement step (H) is the #1 value move left.
