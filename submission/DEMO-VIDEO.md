# Evolved — 90-second demo video

**File:** [`evolved-demo.mp4`](evolved-demo.mp4) · 1920×1080 · 30 fps · 90 seconds · H.264/AAC
**Hosted:** streams from the live deployment at
<https://powderblue-leopard-801168.hostingersite.com/demo.mp4> (served with a
real `video/mp4` content type and byte-range support, so submission platforms
can embed it directly — GitHub raw sends `nosniff`, which blocks playback).

A branded, captioned walkthrough of Evolved — Evolve Eco Blasting's operations
brain running live as an MCP Agentic Service Provider for the OKX AI Genesis
hackathon. Plays fully with the sound off (animated captions throughout).

## What it shows (the any-business cut, 90.0s)

1. **Title** — "Evolved — any service business, run by an AI. Proven on a real
   Alberta company. Paid on-chain."
2. **The premise** — 83 tools / 16 domains / 41 tests, live as an MCP service;
   the real `/health` response.
3. **Any business, one call** — the trade packs: pressure washing, line
   painting, mobile detailing, and YOUR trade (one ~30-line entry) —
   `franchise_spinup` installs the rate card into the quoting engine and the
   trade's hazards into every JHA.
4. **Act I · Intake (text, voice, or photo)** — `quote_from_photo`: a texted
   driveway photo becomes a priced draft (520 sqft, medium blast, $4,947.18,
   62.6% margin) — one example of many intakes.
5. **Act I · Autonomous lifecycle** — `lifecycle_advance` streams the real audit log:
   approve → e-sign → weather-gated booking → FLHA → inventory burn-down → complete →
   invoice → on-chain settlement → learn → close, holding at the two human money gates.
6. **Act I · The JHA, authored on-site** — `flha_field_capture`: hazard
   assessments written by the crew standing in front of the hazards;
   auto-drafts are only starting points.
7. **The workbook spine** — `workbook_create` builds a live Google Sheets ops
   workbook (every collection a tab); `workbook_export` writes the identical
   20 tabs as CSV with zero credentials.
8. **Act II · Paid on-chain (x402)** — the real `POST /mcp-paid` flow: `402 Payment
   Required` (scheme `exact`, network `eip155:1952`, test OKB) → `X-PAYMENT` proof →
   `200 OK` with the `X-PAYMENT-RESPONSE` settlement receipt.
9. **End card** — GitHub repo, live endpoint, "Try it live."

Every figure and payload in the video is **real data captured from the live
endpoint** (`https://powderblue-leopard-801168.hostingersite.com`) — the photo
quote, the lifecycle audit log, the FLHA hazards, and the x402 402→proof→receipt
headers were all recorded from real MCP calls. Synthetic/testnet data only; no
real secrets and no real funds.

## Music — royalty-free (Pixabay Content License)

The soundtrack is **"Joyful Rhythm Walk (Funk)" by lightbeatsmusic**, licensed
under the [Pixabay Content License](https://pixabay.com/service/license-summary/)
(free for commercial use, no attribution required; the track is embedded in the
video, not redistributed standalone). Faded in/out and level-matched with
ffmpeg (`-af volume,afade`), AAC 192k.

An earlier cut used an original CC0 lofi track generated in-repo
(`build_music.py`, numpy + scipy) — kept for reproducibility if anyone wants a
fully CC0 build.

## How it was built

- [`render_video.py`](render_video.py) — deterministic Pillow frame renderer (title, premise, trade packs,
  photo-quote, lifecycle, on-site JHA, workbook spine, x402, end card) with animated
  captions, composited to 1080p30.
- `build_music.py` — the original CC0 lofi track (superseded by the licensed
  funk soundtrack in the current cut).
- `ffmpeg` — encodes the PNG frame sequence + audio to H.264/AAC MP4.

Brand: Boreal Void `#0a0a0a`, Aurora Neon `#4ade80`, Cyber Lime `#39ff14`,
X Layer cyan `#22d3ee`, Alloy Silver Evolve logo.
