# Evolved — X participation-post card.
#
# A 1600x900 (16:9) social card: the real Evolve chrome logo over a
# full-bleed aurora sweep, the chrome EVOLVED wordmark, the on-chain
# story, and the hackathon stamp. Brand bible: Boreal Void #0a0a0a,
# Aurora Neon #4ade80, Cyber Lime #39ff14, X Layer cyan #22d3ee,
# Neue Montreal display / JetBrains Mono labels (licensed, not
# committed; falls back to Arial/Consolas if absent).
#
#   python scripts/make-xcard.py   ->  assets/x-post-card.png

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 900
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
FONTS = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts")

def font(name, size, fallback="arialbd.ttf"):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except OSError:
        return ImageFont.truetype(fallback, size)

def tracked(dr, pos, s, f, fill, tr):
    x, y = pos
    for ch in s:
        dr.text((x, y), ch, font=f, fill=fill)
        x += f.getbbox(ch)[2] + tr

def tracked_w(s, f, tr):
    return sum(f.getbbox(c)[2] + tr for c in s) - tr

# ---- base: deep Boreal Void radial-ish gradient ------------------------------
img = Image.new("RGB", (W, H), "#0a0a0a")
for y in range(H):
    t = y / H
    v = int(12 - 8 * abs(t - 0.42))
    img.paste((v, v, v + 1), (0, y, W, y + 1))

# ---- aurora storm: diagonal ribbons, more drama than the hero ----------------
aur = Image.new("RGB", (W, H), "#000000")
d = ImageDraw.Draw(aur)
d.line([(-200, 700), (300, 480), (800, 640), (1300, 380), (1800, 560)], fill="#4ade80", width=150)
d.line([(-200, 560), (400, 700), (950, 500), (1500, 700), (1800, 520)], fill="#39ff14", width=60)
d.line([(-200, 240), (350, 120), (900, 260), (1450, 90), (1800, 220)], fill="#22d3ee", width=54)
d.line([(-200, 130), (500, 240), (1100, 90), (1800, 260)], fill="#4ade80", width=36)
aur = aur.filter(ImageFilter.GaussianBlur(60))
img = Image.blend(img, Image.composite(aur, img, aur.convert("L").point(lambda p: min(255, p * 3))), 0.6)

# dark center veil so type owns the frame
veil = Image.new("L", (W, H), 0)
dv = ImageDraw.Draw(veil)
dv.ellipse([W // 2 - 720, H // 2 - 400, W // 2 + 720, H // 2 + 400], fill=95)
veil = veil.filter(ImageFilter.GaussianBlur(120))
img = Image.composite(Image.new("RGB", (W, H), "#050505"), img, veil)

# ---- hairline grid floor (kept clear of the footer text) -----------------------
img = img.convert("RGBA")
dg = ImageDraw.Draw(img, "RGBA")
for y in (H - 40, H - 22):
    dg.line([(0, y), (W, y)], fill=(255, 255, 255, 13), width=1)
for x in range(0, W + 1, 100):
    dg.line([(x, H - 40), (x, H - 22)], fill=(255, 255, 255, 7), width=1)

# ---- the real Evolve chrome logo, centered up top -----------------------------
logo = Image.open(os.path.join(ASSETS, "evolve-logo.png")).convert("RGBA")
logo_h = 210
logo_w = int(logo.width * logo_h / logo.height)
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([W // 2 - logo_w, 40, W // 2 + logo_w, 60 + logo_h + 120], fill=(74, 222, 128, 52))
glow = glow.filter(ImageFilter.GaussianBlur(80))
img = Image.alpha_composite(img, glow)
img.alpha_composite(logo, ((W - logo_w) // 2, 78))

# ---- EVOLVED chrome wordmark, centered ----------------------------------------
title_font = font("NeueMontreal-Bold.otf", 172)
text = "EVOLVED"
track = 18
widths = [title_font.getbbox(c)[2] for c in text]
total_w = sum(widths) + track * (len(text) - 1)
tx = (W - total_w) // 2
ty = 316

mask = Image.new("L", (W, H), 0)
md = ImageDraw.Draw(mask)
x = tx
for c, cw in zip(text, widths):
    md.text((x, ty), c, font=title_font, fill=255)
    x += cw + track
chrome = Image.new("RGB", (W, H), "#0a0a0a")
bands = [
    (0.00, (248, 250, 252)), (0.30, (203, 213, 225)), (0.48, (148, 163, 184)),
    (0.52, (71, 85, 105)), (0.58, (226, 232, 240)), (0.80, (241, 245, 249)),
    (1.00, (148, 163, 184)),
]
bbox = mask.getbbox()
if bbox:
    x0, y0, x1, y1 = bbox
    hgt = y1 - y0
    for yy in range(y0, y1):
        t = (yy - y0) / max(1, hgt)
        for i in range(len(bands) - 1):
            t0, c0 = bands[i]
            t1, c1 = bands[i + 1]
            if t0 <= t <= t1:
                f = (t - t0) / max(1e-6, (t1 - t0))
                col = tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                break
        chrome.paste(col, (x0, yy, x1, yy + 1))
img.paste(chrome, (0, 0), mask)

# lime underline
ud = ImageDraw.Draw(img)
ud.rectangle([tx + 6, ty + 204, tx + total_w - 6, ty + 214], fill="#39ff14")

# ---- the story ----------------------------------------------------------------
mono_l = font("JetBrainsMono-Bold.ttf", 40, fallback="consolab.ttf")
mono_m = font("JetBrainsMono-Regular.ttf", 25, fallback="consola.ttf")
mono_s = font("JetBrainsMono-Regular.ttf", 20, fallback="consola.ttf")
dr = ImageDraw.Draw(img)

line1 = "A REAL COMPANY. RUN BY AN AI. PAID ON-CHAIN."
w1 = tracked_w(line1, mono_l, 5)
tracked(dr, ((W - w1) // 2, ty + 252), line1, mono_l, "#f3f4f6", 5)

line2 = "ANY SERVICE BUSINESS, SPUN UP IN ONE CALL"
w2 = tracked_w(line2, mono_m, 3)
tracked(dr, ((W - w2) // 2, ty + 322), line2, mono_m, "#4ade80", 3)

# ---- chip row -------------------------------------------------------------------
chips = ["67 MCP TOOLS", "x402 PAID TIER", "X LAYER TESTNET", "LIVE PLAYGROUND"]
chip_f = font("JetBrainsMono-Bold.ttf", 21, fallback="consolab.ttf")
pad_x, gap, ch_h = 26, 22, 52
chip_ws = [tracked_w(c, chip_f, 2) + pad_x * 2 for c in chips]
row_w = sum(chip_ws) + gap * (len(chips) - 1)
cx = (W - row_w) // 2
cy = ty + 396
for c, cw in zip(chips, chip_ws):
    dr.rounded_rectangle([cx, cy, cx + cw, cy + ch_h], radius=10,
                         outline=(74, 222, 128, 190), width=2, fill=(5, 8, 6, 210))
    tracked(dr, (cx + pad_x, cy + 14), c, chip_f, "#e5ffe9", 2)
    cx += cw + gap

# ---- footer ---------------------------------------------------------------------
foot = "OKX AI GENESIS HACKATHON  ·  #OKXAI  ·  POWDERBLUE-LEOPARD-801168.HOSTINGERSITE.COM  ·  GITHUB.COM/KR8TIV-AI/EVOLVED"
wf = tracked_w(foot, mono_s, 1)
tracked(dr, ((W - wf) // 2, H - 86), foot, mono_s, "#9ca3af", 1)

# ---- bottom aurora band -----------------------------------------------------------
band = Image.new("RGBA", (W, 12), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
for xx in range(W):
    t = xx / W
    a = int(220 * (1 - abs(t - 0.5) * 2) ** 1.4)
    col = (57, 255, 20, a) if t < 0.5 else (34, 211, 238, a)
    bd.line([(xx, 0), (xx, 12)], fill=col)
img.alpha_composite(band.filter(ImageFilter.GaussianBlur(1)), (0, H - 12))

out = os.path.join(ASSETS, "x-post-card.png")
img.convert("RGB").save(out, optimize=True)
print("wrote", out, img.size)
