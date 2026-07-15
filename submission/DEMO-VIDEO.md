# Evolved — 90-second demo video

**File:** [`evolved-demo.mp4`](evolved-demo.mp4) · 1920×1080 · 30 fps · ~86 seconds · H.264/AAC
**Hosted:** streams from the live deployment at
<https://powderblue-leopard-801168.hostingersite.com/demo.mp4> (served with a
real `video/mp4` content type and byte-range support, so submission platforms
can embed it directly — GitHub raw sends `nosniff`, which blocks playback).

A branded, captioned walkthrough of Evolved — Evolve Eco Blasting's operations
brain running live as an MCP Agentic Service Provider for the OKX AI Genesis
hackathon. Plays fully with the sound off (animated captions throughout).

## What it shows (two-act cut, per [`docs/DEMO.md`](../docs/DEMO.md))

1. **Title** — "Evolved — a real Alberta blasting company, run by an AI."
2. **The premise** — 67 tools, live as an MCP service; the real `/health` response.
3. **Act I · Photo-to-quote** — `quote_from_photo`: a texted driveway photo becomes
   a priced draft (520 sqft, medium blast, $4,947.18, 62.6% margin).
4. **Act I · Autonomous lifecycle** — `lifecycle_advance` streams the real audit log:
   approve → e-sign → weather-gated booking → FLHA → inventory burn-down → complete →
   invoice → on-chain settlement → learn → close, holding at the two human money gates.
5. **Act I · FLHA** — the day's hazard assessment drafted from the job scope, with
   real mitigations, PPE, and muster point.
6. **Act II · Paid on-chain (x402)** — the real `POST /mcp-paid` flow: `402 Payment
   Required` (scheme `exact`, network `eip155:1952`, test OKB) → `X-PAYMENT` proof →
   `200 OK` with the `X-PAYMENT-RESPONSE` settlement receipt.
7. **End card** — GitHub repo, live endpoint, "Try it live."

Every figure and payload in the video is **real data captured from the live
endpoint** (`https://powderblue-leopard-801168.hostingersite.com`) — the photo
quote, the lifecycle audit log, the FLHA hazards, and the x402 402→proof→receipt
headers were all recorded from real MCP calls. Synthetic/testnet data only; no
real secrets and no real funds.

## Music — royalty-free / CC0

The soundtrack is an **original lofi hip-hop track composed and synthesized
specifically for this video** (`build_music.py`, numpy + scipy — no third-party
samples, no external audio).

- **Source:** original composition, generated in-repo.
- **License:** **CC0 1.0 Universal (public domain dedication).** Free to reuse.
- No copyrighted material is used anywhere in the video.

## How it was built

- `render.py` — deterministic Pillow frame renderer (title, premise, photo-quote,
  lifecycle, FLHA, x402, end card) with animated captions, composited to 1080p30.
- `build_music.py` — the CC0 lofi track.
- `ffmpeg` — encodes the PNG frame sequence + audio to H.264/AAC MP4.

Brand: Boreal Void `#0a0a0a`, Aurora Neon `#4ade80`, Cyber Lime `#39ff14`,
X Layer cyan `#22d3ee`, Alloy Silver Evolve logo.
