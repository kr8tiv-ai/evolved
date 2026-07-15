# Evolved — HackQuest gallery image set.
#
# Four cohesive 1280x720 on-brand cards: cover, autonomous lifecycle,
# on-chain x402 flow, and the toolkit/domains grid. Boreal Void + aurora,
# the real Evolve chrome logo, Neue Montreal / JetBrains Mono where installed
# (Arial/Consolas fallback otherwise).
#
#   python scripts/make-gallery.py  ->  ../../HACKQUEST-IMAGES/0X-*.png

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
OUT = os.path.join(HERE, "..", "..", "..", "Desktop", "HACKQUEST-IMAGES")
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)
FONTS = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "Windows", "Fonts")

W, H = 1280, 720
VOID = (10, 10, 10)
AURORA = (74, 222, 128)
LIME = (57, 255, 20)
ICE = (34, 211, 238)
SILVER = (243, 244, 246)
DIM = (156, 163, 175)
LINE = (31, 41, 55)


def font(name, size, fb="arialbd.ttf"):
    try:
        return ImageFont.truetype(os.path.join(FONTS, name), size)
    except OSError:
        try:
            return ImageFont.truetype(fb, size)
        except OSError:
            return ImageFont.load_default()


NM = lambda s: font("NeueMontreal-Bold.otf", s, "arialbd.ttf")
NMM = lambda s: font("NeueMontreal-Medium.otf", s, "arial.ttf")
JB = lambda s: font("JetBrainsMono-Bold.ttf", s, "consolab.ttf")
JBR = lambda s: font("JetBrainsMono-Regular.ttf", s, "consola.ttf")


def base(with_grid=True):
    img = Image.new("RGB", (W, H), VOID)
    for y in range(H):
        v = int(10 - 5 * (y / H))
        img.paste((v, v, v), (0, y, W, y + 1))
    aur = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(aur)
    d.line([(-100, 130), (300, 60), (760, 150), (1180, 70), (1380, 120)], fill=AURORA, width=80, joint="curve")
    d.line([(-100, 220), (420, 150), (900, 230), (1380, 120)], fill=LIME, width=34, joint="curve")
    d.line([(-100, 80), (380, 150), (820, 60), (1280, 150)], fill=ICE, width=26, joint="curve")
    aur = aur.filter(ImageFilter.GaussianBlur(60))
    m = aur.convert("L").point(lambda p: min(255, p * 3))
    img = Image.blend(img, Image.composite(aur, img, m), 0.5)
    veil = Image.new("RGB", (W, H), (5, 5, 5))
    vm = Image.new("L", (W, H), 90)
    img = Image.composite(veil, img, vm)
    if with_grid:
        dg = ImageDraw.Draw(img, "RGBA")
        for y in range(120, H, 60):
            dg.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)
    return img


def tracked(d, pos, s, f, fill, tr):
    x, y = pos
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += f.getbbox(ch)[2] + tr
    return x


def tracked_w(s, f, tr):
    return sum(f.getbbox(ch)[2] + tr for ch in s) - tr


def chrome_text(img, text, x, y, size, track=8):
    tf = NM(size)
    widths = [tf.getbbox(c)[2] for c in text]
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    cx = x
    for c, cw in zip(text, widths):
        md.text((cx, y), c, font=tf, fill=255)
        cx += cw + track
    bbox = mask.getbbox()
    chrome = Image.new("RGB", (W, H), VOID)
    bands = [(0.0, (248, 250, 252)), (0.32, (203, 213, 225)), (0.5, (100, 116, 139)),
             (0.56, (226, 232, 240)), (0.8, (241, 245, 249)), (1.0, (148, 163, 184))]
    if bbox:
        y0, y1 = bbox[1], bbox[3]
        for yy in range(y0, y1):
            t = (yy - y0) / max(1, y1 - y0)
            for i in range(len(bands) - 1):
                t0, c0 = bands[i]; t1, c1 = bands[i + 1]
                if t0 <= t <= t1:
                    f = (t - t0) / max(1e-6, t1 - t0)
                    col = tuple(int(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                    break
            else:
                col = bands[-1][1]
            chrome.paste(col, (bbox[0], yy, bbox[2], yy + 1))
    img.paste(chrome, (0, 0), mask)
    return cx  # end x


def logo(img, h_px, x, y, glow=True):
    lg = Image.open(os.path.join(ASSETS, "evolve-logo.png")).convert("RGBA")
    w_px = int(lg.width * h_px / lg.height)
    lg = lg.resize((w_px, h_px), Image.LANCZOS)
    if glow:
        g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        gd.ellipse([x - 30, y - 20, x + w_px + 30, y + h_px + 40], fill=(74, 222, 128, 55))
        img_rgba = img.convert("RGBA")
        img_rgba = Image.alpha_composite(img_rgba, g.filter(ImageFilter.GaussianBlur(45)))
        img.paste(img_rgba.convert("RGB"), (0, 0))
    img.paste(lg, (x, y), lg)
    return w_px


def stamp(img):
    d = ImageDraw.Draw(img)
    s = "OKX AI GENESIS HACKATHON  ·  MCP AGENTIC SERVICE PROVIDER  ·  X LAYER TESTNET 1952"
    f = JBR(15)
    tracked(d, ((W - tracked_w(s, f, 2)) // 2, H - 44), s, f, DIM, 2)
    band = Image.new("RGBA", (W, 6), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    for xx in range(W):
        t = xx / W
        a = int(210 * (1 - abs(t - 0.5) * 2) ** 1.4)
        bd.point((xx, 0), fill=((57, 255, 20, a) if t < 0.5 else (34, 211, 238, a)))
    img.paste(Image.alpha_composite(img.convert("RGBA").crop((0, H - 6, W, H)), band).convert("RGB"), (0, H - 6))


def card_frame(d, x, y, w, h, accent=LINE):
    d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=(13, 15, 14), outline=accent, width=2)


# ---------------- 01 · COVER ----------------
def cover():
    img = base()
    lw = logo(img, 150, 150, 150)
    d = ImageDraw.Draw(img)
    d.line([(150 + lw + 70, 150), (150 + lw + 70, 340)], fill=(255, 255, 255, 40), width=2)
    tx = 150 + lw + 130
    chrome_text(img, "EVOLVED", tx, 150, 120, 14)
    d.rounded_rectangle([tx + 4, 300, tx + 4 + tracked_w("EVOLVED", NM(120), 14) - 30, 310], radius=4, fill=LIME)
    tracked(d, (tx + 6, 336), "BUSINESS MANAGEMENT IN A BOX", JB(30), SILVER, 5)
    tracked(d, (tx + 6, 392), "ANY SERVICE BUSINESS, ONE CALL  ·  RUN BY AN AI  ·  PAID ON-CHAIN", JBR(19), AURORA, 1)
    # chips
    chips = ["65+ MCP TOOLS", "13 DOMAINS", "X LAYER TESTNET", "LIVE PLAYGROUND", "OPEN SOURCE · MIT"]
    cx = 150
    cy = 500
    for c in chips:
        cf = JBR(17)
        cw = tracked_w(c, cf, 2) + 34
        d.rounded_rectangle([cx, cy, cx + cw, cy + 40], radius=20, outline=AURORA, width=1, fill=(12, 20, 15))
        tracked(d, (cx + 17, cy + 11), c, cf, SILVER, 2)
        cx += cw + 16
    stamp(img)
    img.save(os.path.join(OUT, "01-cover.png"), optimize=True)


# ---------------- 02 · LIFECYCLE ----------------
def lifecycle():
    img = base()
    logo(img, 60, 60, 54, glow=False)
    d = ImageDraw.Draw(img)
    tracked(d, (150, 66), "ONE AGENT — LEAD TO PAID", NM(40) if False else JB(30), SILVER, 3)
    tracked(d, (150, 112), "HUMANS APPROVE ONLY THE TWO MONEY GATES", JBR(18), AURORA, 3)
    stages = [
        ("LEAD", "typed · voice · photo", AURORA),
        ("QUOTE", "learned rate + margin", AURORA),
        ("APPROVE", "human money gate", LIME),
        ("E-SIGN", "HMAC · booked", AURORA),
        ("FLHA", "hazards from scope", AURORA),
        ("WORK", "actuals · burn-down", AURORA),
        ("INVOICE", "deposit applied", AURORA),
        ("SETTLE", "human money gate", LIME),
        ("PAID", "OKB on X Layer", ICE),
    ]
    n = len(stages)
    m = 70
    gap = 18
    cw = (W - 2 * m - (n - 1) * gap) / n
    ch = 150
    cy = 250
    for i, (t, s, col) in enumerate(stages):
        x = m + i * (cw + gap)
        gate = col == LIME
        card_frame(d, x, cy, cw, ch, accent=(LIME if gate else LINE))
        if gate:
            d.rounded_rectangle([x, cy, x + cw, cy + ch], radius=14, outline=LIME, width=3)
            tracked(d, (x + 12, cy + 14), "LOCK", JB(13), LIME, 1)
        tf = JB(19)
        tw = tracked_w(t, tf, 1)
        tracked(d, (x + (cw - tw) / 2, cy + 52), t, tf, (LIME if gate else SILVER), 1)
        sf = JBR(11)
        # wrap sublabel to 2 lines
        words = s.split(" ")
        line1 = words[0]
        line2 = " ".join(words[1:])
        tracked(d, (x + (cw - tracked_w(line1, sf, 0)) / 2, cy + 92), line1, sf, DIM, 0)
        if line2:
            tracked(d, (x + (cw - tracked_w(line2, sf, 0)) / 2, cy + 108), line2, sf, DIM, 0)
        if i < n - 1:
            ax = x + cw + gap / 2
            d.line([(x + cw + 2, cy + ch / 2), (ax + 5, cy + ch / 2)], fill=AURORA, width=2)
    # learning loop caption
    tracked(d, (m, cy + ch + 60), "WON JOBS TEACH THE RATE ENGINE  ·  THE BOOKS RE-AUDIT THEMSELVES DAILY  ·  NOTHING DROPPED", JBR(17), AURORA, 2)
    # big proof line
    tracked(d, (m, cy + ch + 120), "Proven on Evolve Eco Blasting, a real Alberta abrasive-blasting company.", NMM(26) if False else JBR(20), SILVER, 0)
    stamp(img)
    img.save(os.path.join(OUT, "02-lifecycle.png"), optimize=True)


# ---------------- 03 · ON-CHAIN ----------------
def onchain():
    img = base()
    logo(img, 60, 60, 54, glow=False)
    d = ImageDraw.Draw(img)
    tracked(d, (150, 66), "PAID ON-CHAIN — x402 ON X LAYER", JB(30), SILVER, 3)
    tracked(d, (150, 112), "EVOLVED NEVER HOLDS KEYS  ·  READ-ONLY RPC  ·  REPLAY-PROTECTED  ·  TESTNET", JBR(17), AURORA, 2)
    panels = [
        ("1  ·  CHALLENGE", ["POST /mcp-paid", "(no payment)", "", "HTTP 402 Payment Required", '"scheme": "exact"', '"network": "eip155:1952"'], LINE),
        ("2  ·  PROOF", ["X-PAYMENT:", '{"txHash":"0x..."}', "", "verified on X Layer", "testnet by read-only", "RPC — or simulated"], AURORA),
        ("3  ·  RECEIPT", ["HTTP 200 OK", "X-PAYMENT-RESPONSE:", '{"settled": true}', "", "the service, unlocked", '"serverInfo": evolved'], LIME),
    ]
    pw = 350
    ph = 300
    gap = 40
    total = pw * 3 + gap * 2
    x0 = (W - total) // 2
    cy = 210
    for i, (title, lines, accent) in enumerate(panels):
        x = x0 + i * (pw + gap)
        card_frame(d, x, cy, pw, ph, accent=accent)
        tracked(d, (x + 24, cy + 22), title, JB(20), accent if accent != LINE else SILVER, 2)
        d.line([(x + 24, cy + 58), (x + pw - 24, cy + 58)], fill=LINE, width=1)
        yy = cy + 78
        for ln in lines:
            col = LIME if ln.startswith("HTTP 200") or '"settled"' in ln else (
                ICE if ln.startswith("HTTP 402") else (DIM if ln.startswith("(") or ln == "" else SILVER))
            tracked(d, (x + 24, yy), ln, JBR(16), col, 0)
            yy += 30
        if i < 2:
            ax = x + pw + gap / 2
            d.text((ax - 8, cy + ph / 2 - 14), ">", font=JB(30), fill=AURORA)
    # invoice line
    tracked(d, (x0, cy + ph + 46), "Invoices settle on-chain too: an EIP-681 request in test OKB, verified, flips the invoice to Paid.", JBR(17), SILVER, 0)
    tracked(d, (x0, cy + ph + 80), "Two rails: the business earns on-chain from customers; the agent service earns on-chain per call.", JBR(17), AURORA, 0)
    stamp(img)
    img.save(os.path.join(OUT, "03-onchain.png"), optimize=True)


# ---------------- 04 · TOOLKIT ----------------
def toolkit():
    img = base()
    logo(img, 60, 60, 54, glow=False)
    d = ImageDraw.Draw(img)
    tracked(d, (150, 66), "65+ TOOLS  ·  13 DOMAINS  ·  ANY TRADE IN ONE CALL", JB(28), SILVER, 2)
    tracked(d, (150, 112), "THE WHOLE MCP SPEC — TOOLS, RESOURCES, PROMPTS", JBR(17), AURORA, 2)
    domains = [
        "Quoting intelligence", "Money & invoicing", "Pipeline & dispatch",
        "FLHA safety", "Autonomous ops", "Inventory control",
        "Contacts / CRM", "Ops-sheet engine", "Accounting depth",
        "On-chain (X Layer)", "Autonomous lifecycle", "Frontier: photo/voice/CFO",
    ]
    cols = 4
    rows = 3
    m = 90
    gw = (W - 2 * m - (cols - 1) * 20) / cols
    gh = 96
    gy = 180
    for i, dom in enumerate(domains):
        r = i // cols
        c = i % cols
        x = m + c * (gw + 20)
        y = gy + r * (gh + 18)
        card_frame(d, x, y, gw, gh, accent=LINE)
        d.rounded_rectangle([x, y, x + 6, y + gh], radius=3, fill=AURORA)
        # wrap
        f = JB(17)
        words = dom.split(" ")
        if tracked_w(dom, f, 0) <= gw - 40:
            tracked(d, (x + 22, y + 36), dom, f, SILVER, 0)
        else:
            mid = len(words) // 2 + 1
            l1 = " ".join(words[:mid]); l2 = " ".join(words[mid:])
            tracked(d, (x + 22, y + 22), l1, f, SILVER, 0)
            tracked(d, (x + 22, y + 50), l2, f, SILVER, 0)
    # trade packs strip
    ty = gy + rows * (gh + 18) + 12
    tracked(d, (m, ty), "TRADE PACKS SHIP TODAY:", JB(18), LIME, 1)
    tracked(d, (m + 320, ty), "pressure washing  ·  line painting  ·  mobile detailing", JBR(18), SILVER, 0)
    tracked(d, (m, ty + 40), "franchise_spinup { tradePack } re-seeds the entire OS — rate card, hazards, books — add yours in one file.", JBR(17), DIM, 0)
    stamp(img)
    img.save(os.path.join(OUT, "04-toolkit.png"), optimize=True)


cover()
lifecycle()
onchain()
toolkit()
# also drop a 1280x720 cover-derived logo tile already exists; copy hero social too
print("gallery written to", OUT)
for f in sorted(os.listdir(OUT)):
    print(" -", f)
