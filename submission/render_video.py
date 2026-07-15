"""
Evolved demo video — deterministic frame renderer (Pillow) -> ffmpeg.
On-brand: Boreal Void #0a0a0a, Aurora Neon #4ade80, Cyber Lime #39ff14,
X Layer cyan #22d3ee, Alloy Silver logo. Animated captions throughout.
All content is real data captured from the live endpoint.

Rendering model: panel CARD backgrounds are alpha_composited onto the opaque
base; every FOREGROUND element (text, badges, bars, lines) is drawn onto a
transparent layer that is flattened on top last. This makes per-element
opacity fades composite correctly (direct translucent draws on an RGBA image
that is later flattened would otherwise show at full opacity).
"""
import sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

import os
W, H, FPS = 1920, 1080, 30
HERE = os.environ.get("EVOLVED_VIDEO_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "video-work"))
LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "evolve-logo.png")

# ---- palette -----------------------------------------------------------
BG      = (10, 10, 10)
PANEL   = (17, 19, 17)
PANEL2  = (13, 15, 13)
GREEN   = (74, 222, 128)
LIME    = (57, 255, 20)
CYAN    = (34, 211, 238)
SILVER  = (214, 216, 220)
TEXT    = (240, 242, 244)
DIM     = (150, 158, 150)
DIM2    = (104, 112, 104)
AMBER   = (255, 176, 66)
REDX    = (248, 113, 113)
BORDER  = (36, 44, 36)

FONTS = {
    'black':  r"C:\Windows\Fonts\seguibl.ttf",
    'semi':   r"C:\Windows\Fonts\seguisb.ttf",
    'reg':    r"C:\Windows\Fonts\segoeui.ttf",
    'bold':   r"C:\Windows\Fonts\segoeuib.ttf",
    'bahn':   r"C:\Windows\Fonts\bahnschrift.ttf",
    'mono':   r"C:\Windows\Fonts\consola.ttf",
    'monob':  r"C:\Windows\Fonts\consolab.ttf",
}
_fc = {}
def F(name, size):
    k = (name, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONTS[name], size)
    return _fc[k]

# ---- easing ------------------------------------------------------------
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def smooth(x): x = clamp(x); return x*x*(3-2*x)
def ease_out(x): x = clamp(x); return 1-(1-x)**3
def ease_in(x): x = clamp(x); return x**3

# ---- foreground layer --------------------------------------------------
_LAYER = None
_LD = None
def begin_layer():
    global _LAYER, _LD
    _LAYER = Image.new('RGBA', (W, H), (0,0,0,0))
    _LD = ImageDraw.Draw(_LAYER)
    return _LD
def flatten(img):
    return Image.alpha_composite(img, _LAYER)

# ---- text helpers (draw on the foreground layer) -----------------------
def tw(text, font, tracking=0):
    if not text: return 0
    w = sum(_LD.textlength(c, font=font) for c in text)
    return w + tracking*(len(text)-1)

def rgba(col, a): return (col[0], col[1], col[2], int(clamp(a,0,255)))

def draw_tracked(xy, text, font, col, tracking=0, anchor='la', alpha=255):
    if alpha <= 0: return
    x, y = xy
    total = tw(text, font, tracking)
    if anchor[0] == 'm': x -= total/2
    elif anchor[0] == 'r': x -= total
    cx = x
    for c in text:
        _LD.text((cx, y), c, font=font, fill=rgba(col, alpha))
        cx += _LD.textlength(c, font=font) + tracking

def T(xy, text, font, col, alpha=255, anchor='la'):
    if alpha <= 0: return
    _LD.text(xy, text, font=font, fill=rgba(col, alpha), anchor=anchor)

def rrect(box, radius, fill=None, outline=None, width=1):
    _LD.rounded_rectangle(box, radius=radius,
                          fill=fill, outline=outline, width=width)

def line(pts, fill, width=1):
    _LD.line(pts, fill=fill, width=width)

def ellipse(box, fill):
    _LD.ellipse(box, fill=fill)

# ---- background --------------------------------------------------------
def build_base():
    base = Image.new('RGB', (W, H), BG)
    grid = Image.new('RGBA', (W, H), (0,0,0,0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 64): gd.line([(x,0),(x,H)], fill=(255,255,255,4), width=1)
    for y in range(0, H, 64): gd.line([(0,y),(W,y)], fill=(255,255,255,4), width=1)
    base = Image.alpha_composite(base.convert('RGBA'), grid).convert('RGB')
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse([-500,-500,900,700], fill=40)
    glow = glow.filter(ImageFilter.GaussianBlur(220))
    base = Image.composite(Image.new('RGB',(W,H),(16,40,26)), base, glow)
    vig = Image.new('L', (W, H), 0)
    ImageDraw.Draw(vig).ellipse([-300,-260,W+300,H+260], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(260))
    base = Image.composite(base, Image.new('RGB',(W,H),(2,3,2)), vig)
    noise = (np.random.default_rng(3).random((H,W,1))*255).astype(np.uint8)
    nimg = Image.fromarray(np.repeat(noise,3,axis=2)).point(lambda p:int((p-128)*0.05))
    arr = np.clip(np.asarray(base).astype(np.int16)+np.asarray(nimg).astype(np.int16),0,255).astype(np.uint8)
    return Image.fromarray(arr).convert('RGBA')

BASE = build_base()

_logo_raw = Image.open(LOGO_PATH).convert('RGBA')
def logo_scaled(height, tint=SILVER, alpha=255):
    w = int(_logo_raw.width * height / _logo_raw.height)
    im = _logo_raw.resize((w, height), Image.LANCZOS)
    a = im.split()[3]
    solid = Image.new('RGBA', im.size, tint+(0,))
    solid.putalpha(a.point(lambda p: int(p*alpha/255)))
    return solid
LOGO_SMALL = logo_scaled(50)

def panel_bg(img, box, radius=18, fill=PANEL, border=BORDER, bw=2, alpha=255):
    ov = Image.new('RGBA', (W,H), (0,0,0,0))
    ImageDraw.Draw(ov).rounded_rectangle(box, radius=radius,
        fill=fill+(int(alpha),), outline=border+(int(alpha),), width=bw)
    img.alpha_composite(ov)

# ---- shared chrome (draws on foreground layer) -------------------------
def scene_chrome(img, act_label, prog, t, show_logo=True):
    a = int(255*smooth(t/0.4))
    if show_logo:
        lg = LOGO_SMALL.point(lambda p:int(p*a/255))
        img.alpha_composite(lg_full(lg, 70, 54))
    if act_label:
        draw_tracked((W-70, 74), act_label, F('bahn', 26), GREEN, tracking=5, anchor='ra', alpha=int(a*0.9))
    bx0, bx1, by = 70, W-70, H-42
    line([(bx0,by),(bx1,by)], rgba(BORDER,220), width=3)
    px = bx0 + (bx1-bx0)*clamp(prog)
    line([(bx0,by),(px,by)], rgba(GREEN,255), width=3)
    ellipse([px-5,by-5,px+5,by+5], rgba(LIME,255))

def lg_full(lg, x, y):
    """place a small RGBA logo on a full-frame transparent canvas for compositing."""
    c = Image.new('RGBA', (W,H), (0,0,0,0))
    c.paste(lg, (x,y), lg)
    return c

def caption(lines, t, appear=0.0, y=None, maxa=255):
    p = smooth((t-appear)/0.45)
    if p <= 0: return
    a = int(maxa*p)
    rise = int(20*(1-ease_out((t-appear)/0.5)))
    if y is None: y = H-196
    x = W//2
    font = F('semi', 40); lh = 52
    yy = y - rise
    widest = max(tw(ln, font) for ln in lines)
    rrect([x-widest/2-30, yy-4, x-widest/2-24, yy+lh*len(lines)-12], radius=3, fill=rgba(GREEN,a))
    for i, ln in enumerate(lines):
        T((x, yy+i*lh), ln, font, TEXT, alpha=a, anchor='ma')

def kicker(text, x, y, t, appear=0.0, color=GREEN, size=26, anchor='la'):
    a = int(255*smooth((t-appear)/0.4))
    draw_tracked((x,y), text, F('bahn', size), color, tracking=5, anchor=anchor, alpha=a)

def result_card(img, box, title, rows, t, appear, accent=GREEN):
    ap = smooth((t-appear)/0.5)
    if ap<=0: return
    x0,y0,x1,y1 = box
    panel_bg(img, box, radius=18, fill=PANEL, alpha=int(240*ap))
    # header divider + title
    line([(x0,y0+56),(x1,y0+56)], rgba(BORDER,int(255*ap)), width=2)
    draw_tracked((x0+26,y0+16), title, F('monob',24), accent, tracking=1, alpha=int(255*ap))
    yy = y0+84
    for i,(label, val, col) in enumerate(rows):
        ra = smooth((t-appear-0.15-i*0.09)/0.4)
        if ra<=0: continue
        T((x0+28,yy), label, F('reg',30), DIM, int(255*ra))
        draw_tracked((x1-28,yy), val, F('monob' if col!=DIM else 'mono',31), col, anchor='ra', alpha=int(255*ra))
        yy += 52

# =======================================================================
#  SCENES  (each: d=begin_layer(); ... ; return flatten(img))
# =======================================================================
def s_title(t, dur):
    img = BASE.copy(); begin_layer()
    cx = W//2
    lp = ease_out(t/0.9); lh = int(150*lp)
    if lh > 6:
        a = int(255*smooth(t/0.7))
        lg = logo_scaled(lh, alpha=a)
        img.alpha_composite(lg_full(lg, cx-lg.width//2, 250-lg.height//2))
    a2 = smooth((t-0.55)/0.6)
    draw_tracked((cx,340), "EVOLVED", F('black',128), TEXT, tracking=14, anchor='ma', alpha=int(255*a2))
    ulp = ease_out((t-1.0)/0.7)
    if ulp>0:
        uw=int(430*ulp); rrect([cx-uw//2,500,cx+uw//2,508], radius=4, fill=rgba(LIME,255))
    a3 = smooth((t-1.35)/0.7)
    T((cx,552), "Any service business, run by an AI.", F('semi',48), SILVER, int(255*a3), 'ma')
    a3b = smooth((t-1.75)/0.6)
    T((cx,616), "Proven on a real Alberta company. Paid on-chain.", F('reg',32), DIM, int(255*a3b), 'ma')
    a4 = smooth((t-2.1)/0.7)
    draw_tracked((cx,690), "OKX AI GENESIS    ·    MCP AGENTIC SERVICE PROVIDER    ·    X LAYER TESTNET",
                 F('bahn',27), GREEN, tracking=6, anchor='ma', alpha=int(220*a4))
    return flatten(img)

def s_premise(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "THE PREMISE", t/dur, t)
    kicker("NOT A CHATBOT IN A SUIT", 70, 150, t, 0.1)
    a = smooth((t-0.25)/0.6)
    T((70,205), "The operating system of a real company,", F('black',62), TEXT, int(255*a))
    a2 = smooth((t-0.5)/0.6)
    T((70,285), "live as an MCP service.", F('black',62), GREEN, int(255*a2))
    chips = [("83","TOOLS · 16 DOMAINS"),("2","OKX RAILS · x402 + X LAYER"),
             ("41","TESTS PASSING"),("2","HUMAN GATES · BOTH MONEY")]
    y0=430
    for i,(big,small) in enumerate(chips):
        ap = smooth((t-0.7-i*0.13)/0.5)
        if ap<=0: continue
        bx = 70 + i*452
        panel_bg(img,[bx,y0,bx+420,y0+150], radius=16, fill=PANEL, alpha=int(235*ap))
        draw_tracked((bx+28,y0+26), big, F('black',68), LIME, alpha=int(255*ap))
        draw_tracked((bx+28,y0+112), small, F('bahn',22), DIM, tracking=3, alpha=int(255*ap))
    ap = smooth((t-1.4)/0.6)
    if ap>0:
        by=632
        draw_tracked((70,by), "GET /health", F('monob',26), CYAN, alpha=int(255*ap))
        T((250,by), '{ "ok": true, "service": "evolved", "protocol": "MCP Streamable HTTP", "tools": 83 }',
          F('mono',26), DIM, int(255*ap))
        draw_tracked((70,by+44), "LIVE", F('bahn',20), GREEN, tracking=3, alpha=int(255*ap))
        T((146,by+44), "powderblue-leopard-801168.hostingersite.com", F('mono',24), DIM2, int(255*ap))
    caption(["Evolve Eco Blasting's real ops brain — reimplemented, extended,",
             "and running live as an agent-callable service."], t, 1.0)
    return flatten(img)

TRADE_CARDS = [
    ("PRESSURE WASHING", "Rinse $0.30 · Wash $0.50 · Deep $0.85 · Strip $1.50 /sqft",
     "wand injection · wet-surface slips · ladder work", GREEN),
    ("LINE PAINTING", "Re-stripe $0.22 · New $0.35 · Layout $0.55 · Stencils $1.10 /sqft",
     "live traffic · fumes & overspray · heat stress", CYAN),
    ("MOBILE DETAILING", "Express $8 · Full $14 · Detail $24 · Restore $45 /unit",
     "chemical exposure · customer property", AMBER),
    ("YOUR TRADE", "one entry in src/trades.ts — rate card + hazards, ~30 lines",
     "then brand_configure makes it feel like YOUR company", LIME),
]

def s_trade(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "ANY BUSINESS, ONE CALL", t/dur, t)
    kicker("THE ADAPTABLE TOOLKIT", 70, 150, t, 0.1)
    a = smooth((t-0.2)/0.5)
    T((70,200), "Pick a trade. The whole machine is yours.", F('black',58), TEXT, int(255*a))
    a2 = smooth((t-0.5)/0.5)
    draw_tracked((70,286), "franchise_spinup { tradePack, companyName, confirm }", F('monob',30), GREEN, alpha=int(255*a2))
    y0 = 360
    for i,(name, rates, hz, col) in enumerate(TRADE_CARDS):
        at = 0.75 + i*0.5
        la = smooth((t-at)/0.5)
        if la<=0: break
        rise = int(18*(1-ease_out((t-at)/0.55)))
        yy = y0 + i*118 - rise
        panel_bg(img,[70, yy, 1850, yy+100], radius=14, fill=PANEL, alpha=int(235*la))
        aa=int(255*la)
        draw_tracked((100,yy+16), name, F('bahn',30), col, tracking=3, alpha=aa)
        T((100,yy+58), rates, F('mono',25), SILVER, aa)
        T((1100,yy+22), "hazards → every JHA:", F('reg',22), DIM2, int(aa*0.9))
        T((1100,yy+54), hz, F('reg',24), DIM, int(aa*0.95))
    caption(["Rate card into the quoting engine, trade hazards into every JHA,",
             "empty books, full machinery — quoting, dispatch, payroll clock, on-chain invoicing."], t, 2.6)
    return flatten(img)

def s_photo(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "ACT I · THE ENGAGEMENT", t/dur, t)
    kicker("INTAKE · TEXT, VOICE, OR PHOTO", 70, 150, t, 0.1)
    a = smooth((t-0.2)/0.5)
    T((70,200), "A customer texts a photo.", F('black',58), TEXT, int(255*a))
    px0,py0,px1,py1 = 70, 300, 640, 760
    ap = smooth((t-0.35)/0.5)
    if ap>0:
        panel_bg(img,[px0,py0,px1,py1],radius=28, fill=(20,22,20), alpha=int(240*ap))
        # faux driveway 'photo' pasted onto base (background)
        iw = Image.new('RGB',(px1-px0-40, 300),(60,62,66)); idw = ImageDraw.Draw(iw)
        for yy in range(0,300,6):
            sh = 46+int(26*math.sin(yy*0.05)); idw.line([(0,yy),(iw.width,yy)], fill=(sh,sh+2,sh+4))
        idw.polygon([(iw.width*0.32,0),(iw.width*0.68,0),(iw.width*0.95,300),(iw.width*0.05,300)], fill=(84,86,90))
        idw.polygon([(iw.width*0.34,0),(iw.width*0.66,0),(iw.width*0.9,300),(iw.width*0.1,300)], outline=(120,122,126), width=2)
        for (sx,sy,sr) in [(0.45,0.6,26),(0.6,0.75,34),(0.5,0.4,16)]:
            idw.ellipse([iw.width*sx-sr,300*sy-sr,iw.width*sx+sr,300*sy+sr], fill=(52,50,48))
        photo = Image.new('RGBA',(W,H),(0,0,0,0)); photo.paste(iw.filter(ImageFilter.GaussianBlur(0.6)),(px0+20,py0+70))
        photo.putalpha(photo.split()[3].point(lambda p:int(p*ap)))
        img.alpha_composite(photo)
        draw_tracked((px0+28,py0+24),"INCOMING  ·  MMS", F('bahn',20), GREEN, tracking=3, alpha=int(255*ap))
        T((px0+28,py0+388),'"driveway, old sealer peeling, oil staining"', F('reg',27), DIM, int(255*ap))
        T((px0+28,py0+424),'≈ 20 × 26 ft', F('mono',26), SILVER, int(255*ap))
    aa = smooth((t-1.0)/0.4)
    T((694,516),"→", F('semi',70), GREEN, int(255*aa))
    rows=[("Estimated area","520 sqft",TEXT),("Blast depth","medium",TEXT),
          ("Learned price","$4,947.18",GREEN),("Projected margin","62.6%  healthy",LIME),
          ("Projected profit","$2,950.21",TEXT)]
    result_card(img,[790,300,1470,700], "quote_from_photo → priced draft", rows, t, 1.15)
    ac = smooth((t-1.9)/0.5)
    T((790,716),"measure-to-confirm clause · feeds the learning loop", F('reg',25), DIM2, int(255*ac))
    caption(["Seconds, not a site visit — surface, area, and blast depth,",
             "priced through the learning rate engine with a profitability check."], t, 1.2)
    return flatten(img)

LC_STEPS = [
    ("start",     "Lead opened · 520 sqft driveway, medium blast", "→ ECO-Q-071526-03 · $5,649.88 (learned from 4 winning jobs)", GREEN, False),
    ("gate",      "HUMAN GATE · owner approved the quote", "money gate cleared", LIME, True),
    ("e-sign",    "Dr. A. Rahman accepted the quote", "job opened · deposit recorded · declines are final", GREEN, False),
    ("scheduled", "Booked 2026-07-17 — first Good blast day", "17°C · wind 19 · precip 1% (weather-gated)", CYAN, False),
    ("flha",      "FLHA drafted from the job scope", "5 hazards, each with mitigations", GREEN, False),
    ("inventory", "9 bags Crushed glass 40/70 consumed", "burned down against the job P&L", GREEN, False),
    ("complete",  "Work done · 78.25% margin (healthy)", "FLHA signed off incident-free", GREEN, False),
    ("invoiced",  "Invoice issued · balance $4,237.41 CAD", "= 42.374100 test OKB · EIP-681 on X Layer", CYAN, False),
    ("gate",      "HUMAN GATE · confirm settlement", "txHash (live) or simulated (demo)", LIME, True),
    ("paid",      "Settled · invoice + job flip to Paid", "replay-protected · one tx settles one thing", GREEN, False),
    ("learned",   "Outcome recorded — rate engine got smarter", "won jobs teach pricing for this surface", GREEN, False),
    ("closed",    "Lifecycle complete · lead to paid", "one agent · two human money gates", LIME, False),
]

def s_lifecycle(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "ACT I · THE ENGAGEMENT", t/dur, t)
    kicker("AUTONOMOUS LIFECYCLE", 70, 128, t, 0.05)
    a = smooth((t-0.15)/0.5)
    T((70,172),"lifecycle_advance", F('monob',44), TEXT, int(255*a))
    T((530,188),"one agent runs the whole engagement", F('reg',30), DIM, int(255*a))
    tx0,ty0,tx1,ty1 = 70, 250, 1850, 942
    pa = smooth((t-0.25)/0.5)
    if pa>0:
        panel_bg(img,[tx0,ty0,tx1,ty1],radius=16, fill=(12,13,12), alpha=int(246*pa))
        for i,c in enumerate([(255,95,86),(255,189,46),(39,201,63)]):
            ellipse([tx0+26+i*26, ty0+22, tx0+40+i*26, ty0+36], rgba(c,int(255*pa)))
        draw_tracked((tx0+140,ty0+18),"POST /mcp  ·  audit log", F('mono',24), DIM2, tracking=1, alpha=int(255*pa))
        line([(tx0,ty0+56),(tx1,ty0+56)], rgba(BORDER,int(255*pa)), width=2)
    start_t, stagger = 0.7, 1.42
    line_y, lh = ty0+78, 46
    for i,(tag, main, sub, col, gate) in enumerate(LC_STEPS):
        at = start_t + i*stagger
        la = smooth((t-at)/0.4)
        if la<=0: break
        rise = int(12*(1-ease_out((t-at)/0.45)))
        y = line_y + i*lh - rise
        aa = int(255*la)
        if gate:
            rrect([tx0+16,y-3,tx1-16,y+lh-12], radius=8, fill=rgba((30,34,16),int(80*la)), outline=rgba(LIME,int(150*la)), width=1)
        draw_tracked((tx0+34,y+4), "●", F('mono',22), col, alpha=aa)
        draw_tracked((tx0+70,y+3), tag.upper(), F('bahn',23), col, tracking=2, alpha=aa)
        mfont = F('semi',28)
        T((tx0+250,y), main, mfont, (LIME if gate else TEXT), aa)
        mw = _LD.textlength(main, font=mfont)
        T((tx0+250+mw+22, y+3), sub, F('reg',22), DIM2, int(aa*0.9))
    if t < stagger*2+start_t:
        caption(["One command: lead → e-sign → weather-gated booking →",
                 "FLHA → invoice → on-chain settlement → review."], t, 0.6)
    elif t < stagger*9+start_t:
        caption(["Everything between the gates advances automatically —",
                 "and every step lands in the audit log."], t, 0.0)
    else:
        caption(["It stops at exactly two human gates. Both about money.",
                 "Agentic where it should be, accountable where it must be."], t, 0.0)
    return flatten(img)

FLHA_HAZ = [
    ("Airborne particulate / dust","HIGH","Dustless vapor blasting · P100 respirators · 25 ft exclusion zone · silica-free media",REDX),
    ("High-pressure air & media lines","HIGH","Whip checks at every coupling · deadman tested · never point the nozzle at anyone",REDX),
    ("Public & client proximity","MED","Barricade tape · client briefed on exclusion zone · spotter within 15 ft of a walkway",AMBER),
    ("Slips / wet surfaces","MED","Route hoses to edges · squeegee standing water · CSA slip-resistant boots",AMBER),
    ("Noise (compressor + nozzle)","MED","Dual hearing protection in the work zone · compressor sited away from buildings",AMBER),
]

def s_flha(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "ACT I · THE ENGAGEMENT", t/dur, t)
    kicker("SAFETY · JHA, AUTHORED ON-SITE", 70, 132, t, 0.05)
    a = smooth((t-0.15)/0.5)
    T((70,180),"The crew writes the JHA on-site.", F('black',56), TEXT, int(255*a))
    T((940,202),"flha_field_capture — auto-drafts are only starting points", F('reg',28), DIM, int(255*a))
    y0=282
    for i,(hz, risk, mit, rc) in enumerate(FLHA_HAZ):
        at = 0.5 + i*0.42
        la = smooth((t-at)/0.5)
        if la<=0: break
        rise = int(18*(1-ease_out((t-at)/0.55)))
        yy = y0 + i*104 - rise
        panel_bg(img,[70, yy, 1540, yy+88], radius=14, fill=PANEL, alpha=int(235*la))
        aa=int(255*la)
        rrect([90, yy+24, 176, yy+64], radius=9, fill=rgba(rc,int(42*la)), outline=rgba(rc,aa), width=2)
        draw_tracked((133,yy+34), risk, F('bahn',22), rc, tracking=1, anchor='ma', alpha=aa)
        T((200,yy+15), hz, F('semi',30), TEXT, aa)
        T((200,yy+52), mit, F('reg',22), DIM, int(aa*0.92))
    ra = smooth((t-1.4)/0.6)
    if ra>0:
        panel_bg(img,[1590,282,1850,802], radius=14, fill=PANEL2, alpha=int(235*ra))
        draw_tracked((1614,306),"PPE CONFIRMED", F('bahn',22), GREEN, tracking=2, alpha=int(255*ra))
        for j,p in enumerate(["Steel-toe boots","Blast hood","P100 respirator","Dual hearing","Cut gloves","Hi-vis vest"]):
            pa=smooth((t-1.55-j*0.08)/0.4)
            if pa<=0: break
            T((1614,352+j*44), "✓  "+p, F('reg',26), TEXT, int(255*pa))
        draw_tracked((1614,636),"MUSTER POINT", F('bahn',22), GREEN, tracking=2, alpha=int(255*ra))
        T((1614,678),"Truck staging area", F('semi',27), SILVER, int(255*ra))
        draw_tracked((1614,732),"UNCONTROLLED → CONTROLLED", F('bahn',18), DIM2, tracking=2, alpha=int(255*ra))
    caption(["Captured by the people standing in front of the hazards,",
             "signed off by the crew at end of day — the permanent safety record."], t, 1.6)
    return flatten(img)

WB_TABS = ["Start Here","Quotes","Customers","Leads","Dispatch","Expenses","Invoices",
           "Inventory","Suppliers","Crew","Time Log","Job Photos","Field Notes",
           "Safety (FLHA)","Reviews","Action Items","To-Do","Rate Table","Job P&L","Record Log"]

def s_workbook(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "THE WORKBOOK SPINE", t/dur, t)
    kicker("YOUR BOOKS, YOUR SHEET", 70, 150, t, 0.1)
    a = smooth((t-0.2)/0.5)
    T((70,200), "The whole OS is a real workbook.", F('black',58), TEXT, int(255*a))
    a2 = smooth((t-0.55)/0.5)
    draw_tracked((70,290), "workbook_create", F('monob',30), GREEN, alpha=int(255*a2))
    T((360,292), "→ a live Google Sheets ops workbook, every collection a tab", F('reg',28), DIM, int(255*a2))
    a3 = smooth((t-0.85)/0.5)
    draw_tracked((70,342), "workbook_export", F('monob',30), CYAN, alpha=int(255*a3))
    T((360,344), "→ the identical 20 tabs as CSV — zero credentials, works offline", F('reg',28), DIM, int(255*a3))
    # tab chips grid, 5 columns
    x0, y0, cw, chh, gx, gy = 70, 440, 340, 74, 18, 16
    for i, tab in enumerate(WB_TABS):
        at = 1.1 + i*0.09
        la = smooth((t-at)/0.4)
        if la<=0: break
        col = i % 5; row = i // 5
        bx = x0 + col*(cw+gx); by = y0 + row*(chh+gy)
        panel_bg(img,[bx,by,bx+cw,by+chh], radius=12, fill=PANEL, alpha=int(230*la))
        aa = int(255*la)
        rrect([bx+16,by+26,bx+22,by+48], radius=2, fill=rgba(GREEN,aa))
        T((bx+38,by+22), tab, F('semi',26), TEXT, aa)
    caption(["The spine the production company runs on — synced by the agent,",
             "readable by any human, portable to any business."], t, 3.2)
    return flatten(img)

def s_x402(t, dur):
    img = BASE.copy(); begin_layer()
    scene_chrome(img, "ACT II · PAID ON-CHAIN", t/dur, t)
    kicker("x402 · PAY-PER-CALL", 70, 130, t, 0.05)
    a = smooth((t-0.15)/0.5)
    T((70,178),"Evolved bills per call.", F('black',56), TEXT, int(255*a))
    T((700,198),"402 challenge  →  payment proof  →  settlement receipt", F('reg',28), DIM, int(255*a))
    # STEP 1 — 402 challenge
    x0,y0,x1,y1 = 70, 262, 940, 906
    p1 = smooth((t-0.3)/0.5)
    if p1>0:
        panel_bg(img,[x0,y0,x1,y1],radius=16, fill=(13,13,12), alpha=int(246*p1))
        line([(x0,y0+52),(x1,y0+52)], rgba(BORDER,int(255*p1)), width=2)
        draw_tracked((x0+24,y0+14),"POST /mcp-paid", F('monob',26), CYAN, alpha=int(255*p1))
        draw_tracked((x1-24,y0+16),"NO PAYMENT", F('bahn',20), DIM2, tracking=2, anchor='ra', alpha=int(255*p1))
        ba = smooth((t-0.7)/0.4)
        if ba>0:
            rrect([x0+24,y0+74,x0+270,y0+130], radius=10, fill=rgba(AMBER,int(34*ba)), outline=rgba(AMBER,int(255*ba)), width=2)
            draw_tracked((x0+42,y0+84),"402", F('black',36), AMBER, alpha=int(255*ba))
            draw_tracked((x0+130,y0+82),"PAYMENT", F('bahn',18), AMBER, tracking=2, alpha=int(255*ba))
            draw_tracked((x0+130,y0+105),"REQUIRED", F('bahn',18), AMBER, tracking=2, alpha=int(255*ba))
        lines1=[("accepts","[",DIM),("  scheme",'"exact"',GREEN),
                ("  network",'"eip155:1952"  X Layer testnet',CYAN),
                ("  asset",'"OKB" · maxAmount 1e14',TEXT),("  payTo",'0x…e0e1',DIM),
                ("  resource",'"/mcp-paid"',TEXT),("","]",DIM)]
        yy=y0+156
        for i,(k,v,c) in enumerate(lines1):
            la=smooth((t-0.9-i*0.12)/0.4)
            if la<=0: break
            if k: T((x0+30,yy),k,F('mono',26),DIM2,int(255*la)); draw_tracked((x0+250,yy),v,F('mono',26),c,alpha=int(255*la))
            else: T((x0+30,yy),v,F('mono',26),DIM2,int(255*la))
            yy+=46
    aa=smooth((t-2.4)/0.4)
    if aa>0:
        draw_tracked((1000,530),"→", F('semi',60), GREEN, alpha=int(255*aa))
        draw_tracked((972,470),"X-PAYMENT", F('bahn',22), GREEN, tracking=2, alpha=int(255*aa))
        T((968,600),'{ "simulated":', F('mono',22), DIM, int(255*aa))
        T((968,628),'  true }', F('mono',22), DIM, int(255*aa))
    # STEP 2 — 200 + receipt
    x0,y0,x1,y1 = 1120, 262, 1850, 906
    p2 = smooth((t-2.7)/0.5)
    if p2>0:
        panel_bg(img,[x0,y0,x1,y1],radius=16, fill=(12,15,12), alpha=int(246*p2))
        line([(x0,y0+52),(x1,y0+52)], rgba(BORDER,int(255*p2)), width=2)
        draw_tracked((x0+24,y0+14),"POST /mcp-paid", F('monob',26), CYAN, alpha=int(255*p2))
        draw_tracked((x1-24,y0+16),"+ PROOF", F('bahn',20), GREEN, tracking=2, anchor='ra', alpha=int(255*p2))
        ba=smooth((t-3.1)/0.4)
        if ba>0:
            rrect([x0+24,y0+74,x0+230,y0+130], radius=10, fill=rgba(GREEN,int(34*ba)), outline=rgba(GREEN,int(255*ba)), width=2)
            draw_tracked((x0+42,y0+84),"200", F('black',36), GREEN, alpha=int(255*ba))
            draw_tracked((x0+134,y0+92),"OK", F('bahn',22), GREEN, tracking=2, alpha=int(255*ba))
        ra=smooth((t-3.4)/0.5)
        if ra>0:
            draw_tracked((x0+30,y0+156),"X-PAYMENT-RESPONSE", F('bahn',22), CYAN, tracking=2, alpha=int(255*ra))
            recs=[('settled','true',LIME),('mode','"simulated"',TEXT),('detail','settlement accepted',DIM)]
            yy=y0+202
            for i,(k,v,c) in enumerate(recs):
                la=smooth((t-3.55-i*0.15)/0.4)
                if la<=0: break
                T((x0+30,yy),k,F('mono',26),DIM2,int(255*la)); draw_tracked((x0+230,yy),v,F('monob',26),c,alpha=int(255*la))
                yy+=48
            ua=smooth((t-4.2)/0.5)
            if ua>0:
                line([(x0+24,yy+10),(x1-24,yy+10)], rgba(BORDER,int(255*ua)), width=1)
                T((x0+30,yy+26),"→ MCP tool surface unlocked", F('semi',27), GREEN, int(255*ua))
                T((x0+30,yy+66),"free A2MCP tier at /mcp stays free", F('reg',24), DIM2, int(255*ua))
    sa=smooth((t-4.6)/0.5)
    if sa>0:
        draw_tracked((70,860),"/stats", F('monob',24), CYAN, alpha=int(255*sa))
        T((190,860),'paidApiCalls ▲  ·  counters survive demo resets  ·  TESTNET ONLY — no real funds',
          F('mono',24), DIM, int(255*sa))
    if t < 2.6:
        caption(["An unpaid call gets a spec-shaped 402 — scheme exact,",
                 "network eip155:1952, priced in test OKB on OKX X Layer."], t, 0.7)
    else:
        caption(["Proof in the X-PAYMENT header unlocks the call;",
                 "the reply carries an on-chain settlement receipt."], t, 0.0)
    return flatten(img)

def s_end(t, dur):
    img = BASE.copy(); begin_layer()
    cx=W//2
    lp=ease_out(t/0.8); lh=int(120*lp)
    if lh>6:
        a=int(255*smooth(t/0.7)); lg=logo_scaled(lh,alpha=a)
        img.alpha_composite(lg_full(lg,cx-lg.width//2,208-lg.height//2))
    a2=smooth((t-0.5)/0.6)
    draw_tracked((cx,300),"TRY IT LIVE", F('black',96), TEXT, tracking=10, anchor='ma', alpha=int(255*a2))
    ulp=ease_out((t-0.9)/0.6)
    if ulp>0:
        uw=int(360*ulp); rrect([cx-uw//2,432,cx+uw//2,440],radius=4,fill=rgba(LIME,255))
    ctas=[("GITHUB","github.com/kr8tiv-ai/evolved",GREEN),
          ("LIVE ENDPOINT","powderblue-leopard-801168.hostingersite.com",CYAN),
          ("PLAYGROUND","zero install · /mcp · /mcp-paid · /health",SILVER)]
    for i,(k,v,c) in enumerate(ctas):
        ca=smooth((t-1.3-i*0.22)/0.5)
        if ca<=0: continue
        y=505+i*88
        draw_tracked((cx-440,y),k, F('bahn',26), c, tracking=4, alpha=int(255*ca))
        T((cx-40,y-4),v, F('semi',34), TEXT, int(255*ca))
    a3=smooth((t-2.4)/0.7)
    if a3>0:
        draw_tracked((cx,800),"OKX AI GENESIS   ·   X LAYER TESTNET 1952   ·   TESTNET ONLY, SYNTHETIC DATA",
                     F('bahn',24), GREEN, tracking=5, anchor='ma', alpha=int(210*a3))
        T((cx,858),"Evolved never holds keys and cannot move funds — by construction.",
          F('reg',26), DIM2, int(255*a3),'ma')
    return flatten(img)

# =======================================================================
#  TIMELINE
# =======================================================================
SCENES = [
    (5.5,  s_title),
    (8.0,  s_premise),
    (8.5,  s_trade),
    (11.5, s_photo),
    (20.0, s_lifecycle),
    (8.5,  s_flha),
    (8.5,  s_workbook),
    (15.5, s_x402),
    (8.0,  s_end),
]
OVERLAP = 0.5
starts=[0.0]
for i in range(1,len(SCENES)):
    starts.append(starts[-1]+SCENES[i-1][0]-OVERLAP)
TOTAL = starts[-1]+SCENES[-1][0]

def render_frame(gt):
    active=[]
    for i,(dur,fn) in enumerate(SCENES):
        s=starts[i]; e=s+dur
        if s-1e-6 <= gt <= e+1e-6: active.append((i, gt-s))
    if not active: active=[(len(SCENES)-1, SCENES[-1][0])]
    if len(active)==1:
        i,tl=active[0]; img=SCENES[i][1](tl,SCENES[i][0]).convert('RGB')
    else:
        (i0,tl0),(i1,tl1)=active[0],active[1]
        s_ov=starts[i1]; e_ov=starts[i0]+SCENES[i0][0]
        f=smooth((gt-s_ov)/max(1e-6,(e_ov-s_ov)))
        a=np.asarray(SCENES[i0][1](tl0,SCENES[i0][0]).convert('RGB')).astype(np.float32)
        b=np.asarray(SCENES[i1][1](tl1,SCENES[i1][0]).convert('RGB')).astype(np.float32)
        img=Image.fromarray((a*(1-f)+b*f).clip(0,255).astype(np.uint8))
    fade=1.0
    if gt<0.7: fade=smooth(gt/0.7)
    if gt>TOTAL-0.9: fade=min(fade, smooth((TOTAL-gt)/0.9))
    if fade<1.0:
        img=Image.fromarray((np.asarray(img).astype(np.float32)*fade).clip(0,255).astype(np.uint8))
    return img

def main():
    mode = sys.argv[1] if len(sys.argv)>1 else 'full'
    print(f"TOTAL duration = {TOTAL:.2f}s  ({int(TOTAL*FPS)} frames)")
    print("scene starts:", [f"{s:.1f}" for s in starts])
    if mode=='probe':
        for tt in [float(x) for x in sys.argv[2:]]:
            render_frame(tt).save(f"{HERE}\\probe_{int(tt*10):04d}.png"); print("saved", tt)
        return
    if mode=='dur': return
    import os
    nfr=int(round(TOTAL*FPS))
    fr=f"{HERE}\\frames"
    os.makedirs(fr, exist_ok=True)
    lo = int(sys.argv[2]) if len(sys.argv)>2 else 0
    hi = int(sys.argv[3]) if len(sys.argv)>3 else nfr
    for f in range(lo, hi):
        render_frame(f/FPS).convert('RGB').save(f"{fr}\\f{f:05d}.png")
        if f%120==0: print(f"frame {f}/{nfr}  t={f/FPS:.1f}s", flush=True)
    print("frames done", lo, hi)

if __name__=="__main__":
    main()
