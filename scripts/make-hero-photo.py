# Evolved — premium GitHub hero + social-preview from the REAL Evolve aurora scene.
#
# Backgrounds/scenes only (Matt's direction: no machines/equipment). The base
# is the shared brand DNA of both Evolve companies — a real aurora over a misty
# boreal treeline — cropped cinematically, graded to the Boreal Void palette,
# with the chrome EVOLVED wordmark and one lime accent. Clean, high-end, quiet.
#
#   python scripts/make-hero-photo.py
#     -> assets/hero.png            (1600x600  README banner)
#     -> assets/social-preview.png  (1280x640  GitHub OG card)

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
DESKTOP = os.path.join(os.environ.get("USERPROFILE", ""), "Desktop")
FONTS = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts")
AURORA = os.path.join(DESKTOP, "Evolve_Hero_Aurora_1600x1067.png")

def font(name, size, fallback="arialbd.ttf"):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except OSError:
        return ImageFont.truetype(fallback, size)

def tracked_w(dr, s, f, tr):
    return sum(dr.textlength(c, font=f) + tr for c in s) - tr

def tracked(dr, pos, s, f, fill, tr, anchor="la"):
    x, y = pos
    total = tracked_w(dr, s, f, tr)
    if anchor == "ma": x -= total / 2
    elif anchor == "ra": x -= total
    for c in s:
        dr.text((x, y), c, font=f, fill=fill)
        x += dr.textlength(c, font=f) + tr

def graded_base(W, H, focus_y=0.46):
    """Crop the aurora photo to WxH, grade it, and fade the base to Boreal Void."""
    src = Image.open(AURORA).convert("RGB")
    sw, sh = src.size
    scale = max(W / sw, H / sh) * 1.06          # slight overscan for framing room
    rw, rh = int(sw * scale), int(sh * scale)
    src = src.resize((rw, rh), Image.LANCZOS)
    left = (rw - W) // 2
    top = int((rh - H) * focus_y)
    img = src.crop((left, top, left + W, top + H))

    # grade: deepen, cool the shadows toward the void, keep the aurora green alive
    img = ImageEnhance.Brightness(img).enhance(0.82)
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.12)

    # vignette + bottom fade to #0a0a0a so it melts into the README/OG background
    shade = Image.new("L", (W, H), 0)
    ds = ImageDraw.Draw(shade)
    for y in range(H):
        t = y / H
        # darker top-corners and a strong bottom gradient for text legibility
        a = int(150 * max(0.0, (t - 0.42) / 0.58) ** 1.35)
        ds.line([(0, y), (W, y)], fill=a)
    void = Image.new("RGB", (W, H), (10, 10, 10))
    img = Image.composite(void, img, shade)

    # soft edge vignette
    vig = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vig).ellipse([-W * 0.30, -H * 0.35, W * 1.30, H * 1.28], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(int(W * 0.10)))
    img = Image.composite(img, Image.new("RGB", (W, H), (3, 4, 3)), vig)
    return img.convert("RGBA")

def chrome_wordmark(dr_size, text, font_obj, track):
    """Return an RGBA layer with a brushed-chrome gradient fill of `text`."""
    W, H = dr_size
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    widths = [md.textlength(c, font=font_obj) for c in text]
    total = sum(widths) + track * (len(text) - 1)
    x = (W - total) // 2
    y = 0
    for c, cw in zip(text, widths):
        md.text((x, y), c, font=font_obj, fill=255)
        x += cw + track
    bbox = mask.getbbox()
    chrome = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    if bbox:
        x0, y0, x1, y1 = bbox
        bands = [
            (0.00, (248, 250, 252)), (0.30, (203, 213, 225)), (0.48, (150, 165, 185)),
            (0.52, (78, 92, 112)), (0.58, (226, 232, 240)), (0.82, (241, 245, 249)),
            (1.00, (150, 165, 185)),
        ]
        px = chrome.load()
        for yy in range(y0, y1):
            t = (yy - y0) / max(1, (y1 - y0))
            for i in range(len(bands) - 1):
                t0, c0 = bands[i]; t1, c1 = bands[i + 1]
                if t0 <= t <= t1:
                    f = (t - t0) / max(1e-6, t1 - t0)
                    col = tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                    break
            for xx in range(x0, x1):
                if mask.getpixel((xx, yy)):
                    px[xx, yy] = col + (255,)
    return chrome, total

def build(W, H, out, *, wordmark_px, sub_px, mono_px, show_logo=True, stamp=True):
    img = graded_base(W, H)
    cx = W // 2

    # soft central scrim so the chrome type lifts off the bright mist (keynote depth)
    scrim = Image.new("L", (W, H), 0)
    ImageDraw.Draw(scrim).ellipse(
        [cx - int(W * 0.42), int(H * 0.30), cx + int(W * 0.42), int(H * 1.02)], fill=118)
    scrim = scrim.filter(ImageFilter.GaussianBlur(int(W * 0.075)))
    img = Image.composite(Image.new("RGB", (W, H), (6, 8, 6)).convert("RGBA"), img, scrim)
    dr = ImageDraw.Draw(img)

    # real Evolve chrome logo, centered, above the wordmark
    if show_logo:
        logo = Image.open(os.path.join(ASSETS, "evolve-logo.png")).convert("RGBA")
        lh = int(H * 0.135)
        lw = int(logo.width * lh / logo.height)
        logo = logo.resize((lw, lh), Image.LANCZOS)
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(glow).ellipse(
            [cx - lw, int(H * 0.10), cx + lw, int(H * 0.10) + lh + int(H * 0.14)],
            fill=(74, 222, 128, 40))
        glow = glow.filter(ImageFilter.GaussianBlur(int(W * 0.045)))
        img = Image.alpha_composite(img, glow)
        img.alpha_composite(logo, (cx - lw // 2, int(H * 0.135)))
        dr = ImageDraw.Draw(img)

    # EVOLVED chrome wordmark
    wf = font("NeueMontreal-Bold.otf", wordmark_px)
    chrome, total = chrome_wordmark((W, H), "EVOLVED", wf, int(wordmark_px * 0.10))
    wy = int(H * 0.40)
    img.alpha_composite(chrome.crop((0, 0, W, H)).transform(
        (W, H), Image.AFFINE, (1, 0, 0, 0, 1, -wy), resample=Image.NEAREST), (0, 0)) if False else None
    # simpler: paste chrome shifted by drawing wordmark directly onto a positioned layer
    wlayer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wl_chrome, _ = chrome_wordmark((W, int(wordmark_px * 1.4)), "EVOLVED", wf, int(wordmark_px * 0.10))
    wlayer.alpha_composite(wl_chrome, (0, wy))
    img = Image.alpha_composite(img, wlayer)
    dr = ImageDraw.Draw(img)

    # lime accent underline
    uy = wy + int(wordmark_px * 1.02)
    uw = int(total * 0.5)
    dr.rectangle([cx - uw, uy, cx + uw, uy + max(4, int(H * 0.008))], fill=(57, 255, 20, 255))

    # tagline
    sf = font("NeueMontreal-Medium.otf", sub_px, fallback="arial.ttf")
    sub = "The company-in-a-box for the agent economy."
    tracked(dr, (cx, uy + int(H * 0.05)), sub, sf, (233, 238, 233, 255), 0, anchor="ma")

    # mono kicker
    mf = font("JetBrainsMono-Regular.ttf", mono_px, fallback="consola.ttf")
    kick = "ANY SERVICE BUSINESS · ONE CALL · PROVEN ON A REAL COMPANY · PAID ON-CHAIN"
    tracked(dr, (cx, uy + int(H * 0.05) + int(sub_px * 1.7)), kick, mf, (110, 200, 140, 255), int(mono_px * 0.16), anchor="ma")

    if stamp:
        stf = font("JetBrainsMono-Regular.ttf", int(mono_px * 0.9), fallback="consola.ttf")
        st = "OKX AI GENESIS · MCP AGENTIC SERVICE PROVIDER · X LAYER TESTNET 1952"
        tracked(dr, (cx, H - int(H * 0.075)), st, stf, (140, 150, 140, 255), int(mono_px * 0.14), anchor="ma")

    # bottom aurora hairline
    band = Image.new("RGBA", (W, max(3, int(H * 0.006))), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for xx in range(W):
        t = xx / W
        a = int(210 * (1 - abs(t - 0.5) * 2) ** 1.4)
        col = (57, 255, 20, a) if t < 0.5 else (34, 211, 238, a)
        bd.line([(xx, 0), (xx, band.height)], fill=col)
    img.alpha_composite(band, (0, H - band.height))

    img.convert("RGB").save(out, optimize=True)
    print("wrote", out, (W, H))

build(1600, 600, os.path.join(ASSETS, "hero.png"),
      wordmark_px=150, sub_px=30, mono_px=19)
build(1280, 640, os.path.join(ASSETS, "social-preview.png"),
      wordmark_px=140, sub_px=27, mono_px=17)


def build_og(out):
    """1200x630 link-preview card — the exact share copy, dark aurora + logo."""
    W, H = 1200, 630
    img = graded_base(W, H, focus_y=0.44)
    cx = W // 2
    scrim = Image.new("L", (W, H), 0)
    ImageDraw.Draw(scrim).ellipse(
        [cx - int(W * 0.46), int(H * 0.24), cx + int(W * 0.46), int(H * 1.04)], fill=128)
    scrim = scrim.filter(ImageFilter.GaussianBlur(int(W * 0.08)))
    img = Image.composite(Image.new("RGB", (W, H), (6, 8, 6)).convert("RGBA"), img, scrim)
    dr = ImageDraw.Draw(img)

    logo = Image.open(os.path.join(ASSETS, "evolve-logo.png")).convert("RGBA")
    lh = 92
    lw = int(logo.width * lh / logo.height)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    img.alpha_composite(logo, (cx - lw // 2, 74))
    dr = ImageDraw.Draw(img)

    wf = font("NeueMontreal-Bold.otf", 128)
    chrome, total = chrome_wordmark((W, 180), "EVOLVED", wf, 13)
    wlayer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wlayer.alpha_composite(chrome, (0, 232))
    img = Image.alpha_composite(img, wlayer)
    dr = ImageDraw.Draw(img)
    uy = 232 + 132
    dr.rectangle([cx - int(total * 0.5), uy, cx + int(total * 0.5), uy + 6], fill=(57, 255, 20, 255))

    sf = font("NeueMontreal-Medium.otf", 34, fallback="arial.ttf")
    tracked(dr, (cx, uy + 34), "Business-in-a-box, run by an AI. Paid on-chain.", sf, (236, 240, 236, 255), 0, anchor="ma")
    mf = font("JetBrainsMono-Regular.ttf", 20, fallback="consola.ttf")
    tracked(dr, (cx, uy + 92), "83 MCP TOOLS · x402 + X LAYER TESTNET · LIVE PLAYGROUND · EVOLVEDMCP.CLOUD",
            mf, (120, 205, 150, 255), 3, anchor="ma")

    band = Image.new("RGBA", (W, 5), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for xx in range(W):
        t = xx / W
        a = int(215 * (1 - abs(t - 0.5) * 2) ** 1.4)
        bd.line([(xx, 0), (xx, 5)], fill=((57, 255, 20, a) if t < 0.5 else (34, 211, 238, a)))
    img.alpha_composite(band, (0, H - 5))
    img.convert("RGB").save(out, optimize=True)
    print("wrote", out, (W, H))


build_og(os.path.join(ASSETS, "og.png"))
