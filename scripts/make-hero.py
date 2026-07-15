# Evolved — hero banner generator.
#
# Composites the real Evolve chrome logo with the EVOLVED product wordmark
# on the brand's Boreal Void / aurora palette (per the Evolve brand bible:
# Neue Montreal display type, JetBrains Mono labels, #0a0a0a / #4ade80 /
# #39ff14). Requires the brand fonts installed locally (they are licensed
# and not committed); falls back to Arial if absent.
#
#   python scripts/make-hero.py   ->  assets/hero.png (1600x540 @2x)

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1600, 540
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
FONTS = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts")

def font(name, size, fallback="arialbd.ttf"):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except OSError:
        return ImageFont.truetype(fallback, size)

# ---- base: Boreal Void vertical gradient -----------------------------------
img = Image.new("RGB", (W, H), "#0a0a0a")
for y in range(H):
    t = y / H
    v = int(10 - 5 * t)  # 0x0a -> 0x05
    for _ in [0]:
        pass
    img.paste((v, v, v), (0, y, W, y + 1))

# ---- aurora ribbons ---------------------------------------------------------
aur = Image.new("RGB", (W, H), "#000000")
d = ImageDraw.Draw(aur)
def ribbon(pts, color, width):
    d.line(pts, fill=color, width=width, joint="curve")
ribbon([(-100, 150), (300, 60), (700, 170), (1100, 70), (1700, 140)], "#4ade80", 90)
ribbon([(-100, 230), (400, 140), (900, 240), (1400, 120), (1700, 190)], "#39ff14", 42)
ribbon([(-100, 90), (350, 160), (800, 60), (1250, 150), (1700, 60)], "#22d3ee", 30)
aur = aur.filter(ImageFilter.GaussianBlur(46))
img = Image.blend(img, Image.composite(aur, img, aur.convert("L").point(lambda p: min(255, p * 3))), 0.55)

# dark veil to keep type legible
veil = Image.new("L", (W, H), 0)
dv = ImageDraw.Draw(veil)
dv.rectangle([0, 0, W, H], fill=70)
img = Image.composite(Image.new("RGB", (W, H), "#050505"), img, veil)

# ---- hairline grid floor ----------------------------------------------------
dg = ImageDraw.Draw(img, "RGBA")
for y in (H - 74, H - 50, H - 26):
    dg.line([(0, y), (W, y)], fill=(255, 255, 255, 14), width=1)

# ---- the real Evolve logo (left) -------------------------------------------
logo = Image.open(os.path.join(ASSETS, "evolve-logo.png")).convert("RGBA")
logo_h = 300
logo_w = int(logo.width * logo_h / logo.height)
logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
# soft aurora glow behind the mark
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([120, 60, 120 + logo_w + 80, 60 + logo_h + 120], fill=(74, 222, 128, 46))
glow = glow.filter(ImageFilter.GaussianBlur(70))
img = Image.alpha_composite(img.convert("RGBA"), glow)
img.alpha_composite(logo, (200, 110))

# vertical hairline separator
sep = ImageDraw.Draw(img)
sep.line([(640, 120), (640, H - 120)], fill=(255, 255, 255, 40), width=2)

# ---- EVOLVED chrome wordmark (right) ----------------------------------------
title_font = font("NeueMontreal-Bold.otf", 132)
text = "EVOLVED"
# tracked layout
track = 14
widths = [title_font.getbbox(c)[2] for c in text]
total_w = sum(widths) + track * (len(text) - 1)
tx = 700
ty = 128

# chrome gradient fill via mask
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

# lime underline block
ud = ImageDraw.Draw(img)
ud.rectangle([tx + 4, ty + 158, tx + total_w - 4, ty + 166], fill="#39ff14")

# ---- copy lines --------------------------------------------------------------
mono = font("JetBrainsMono-Bold.ttf", 30, fallback="consolab.ttf")
mono_s = font("JetBrainsMono-Regular.ttf", 19, fallback="consola.ttf")
mono_xs = font("JetBrainsMono-Regular.ttf", 17, fallback="consola.ttf")
def tracked(dr, pos, s, f, fill, tr):
    x, y = pos
    for ch in s:
        dr.text((x, y), ch, font=f, fill=fill)
        x += f.getbbox(ch)[2] + tr

dr = ImageDraw.Draw(img)
tracked(dr, (tx + 6, ty + 190), "BUSINESS MANAGEMENT IN A BOX", mono, "#f3f4f6", 6)
tracked(dr, (tx + 6, ty + 248), "A REAL COMPANY · RUN BY AN AUTONOMOUS AI · PAID ON-CHAIN", mono_s, "#4ade80", 2)

# bottom-center hackathon stamp
stamp = "OKX AI GENESIS HACKATHON · MCP AGENTIC SERVICE PROVIDER · X LAYER TESTNET 1952"
sw = sum(mono_xs.getbbox(c)[2] + 2 for c in stamp) - 2
tracked(dr, ((W - sw) // 2, H - 64), stamp, mono_xs, "#9ca3af", 2)

# ---- bottom aurora band -------------------------------------------------------
band = Image.new("RGBA", (W, 10), (0, 0, 0, 0))
bd = ImageDraw.Draw(band)
for xx in range(W):
    t = xx / W
    a = int(200 * (1 - abs(t - 0.5) * 2) ** 1.5)
    col = (57, 255, 20, a) if t < 0.5 else (34, 211, 238, a)
    bd.point((xx, 0), fill=col)
band = band.resize((W, 10))
img.alpha_composite(band.filter(ImageFilter.GaussianBlur(1)), (0, H - 10))

# ---- grain --------------------------------------------------------------------
try:
    grain = Image.open(os.path.join(os.path.dirname(ASSETS), "..", "..", "Documents", "Evolve Quote Template", "_grain.png")).convert("L")
    grain = grain.resize((W, H))
    img = Image.composite(img, Image.new("RGBA", (W, H), (255, 255, 255, 255)), grain.point(lambda p: 255 - p // 22))
except Exception:
    pass

out = os.path.join(ASSETS, "hero.png")
img.convert("RGB").save(out, optimize=True)
print("wrote", out, img.size)
