#!/usr/bin/env python3
"""Generate the Evolved favicon set from the Evolve brand mark.

Crops the emblem (arc + treeline + E-swish blades) out of the square project
logo — dropping the EVOLVE wordmark so it reads at 16px — lifts it off the
dark plate as a silver-white mark, then composites it on a Boreal Void tile
with a faint Aurora Neon underglow. Emits .ico + PNG icons + webmanifest into
media/ so the browser tab, iOS home screen, and Android PWA all get it.
"""
from PIL import Image, ImageFilter
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "project-logo.png")
OUT = os.path.join(ROOT, "media")

VOID = (10, 10, 10, 255)        # Boreal Void #0a0a0a
SILVER = (238, 242, 240)        # Alloy Silver-white mark
LIME = (57, 255, 20)            # Cyber Lime underglow

def lift_mark(src):
    """Return the emblem as a silver-white RGBA cutout (wordmark removed)."""
    # The emblem sits in the top ~55% of the square; the wordmark is below.
    region = src.crop((0, 84, src.width, 322)).convert("RGB")
    lum = region.convert("L")                      # white mark -> bright, plate -> dark
    alpha = lum.point(lambda p: 0 if p < 42 else min(255, int((p - 42) * 1.45)))
    mark = Image.new("RGBA", region.size, SILVER + (0,))
    mark.putalpha(alpha)
    return mark.crop(mark.getbbox())

def tile(size, mark, pad_frac=0.20, glow=True):
    """Compose the mark centered on a Boreal Void square with an underglow."""
    canvas = Image.new("RGBA", (size, size), VOID)
    if glow:
        g = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = Image.new("L", (size, size), 0)
        from PIL import ImageDraw
        d = ImageDraw.Draw(gd)
        r = int(size * 0.42)
        cx, cy = size // 2, int(size * 0.56)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=90)
        gd = gd.filter(ImageFilter.GaussianBlur(size * 0.11))
        glow_layer = Image.new("RGBA", (size, size), LIME + (0,))
        glow_layer.putalpha(gd)
        canvas = Image.alpha_composite(canvas, glow_layer)
    avail = int(size * (1 - 2 * pad_frac))
    mw, mh = mark.size
    scale = min(avail / mw, avail / mh)
    m = mark.resize((max(1, int(mw * scale)), max(1, int(mh * scale))), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas

def main():
    src = Image.open(SRC).convert("RGBA")
    mark = lift_mark(src)
    # Clean Boreal Void tile + crisp silver mark — reads at every size.
    base = tile(512, mark, glow=False)

    # PWA / Apple / general PNG icons
    base.save(os.path.join(OUT, "icon-512.png"))
    base.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, "icon-192.png"))
    # iOS strips alpha and rounds corners itself — give it a full-bleed dark tile
    base.resize((180, 180), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"))
    base.resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, "icon-32.png"))
    base.resize((16, 16), Image.LANCZOS).save(os.path.join(OUT, "icon-16.png"))

    # Multi-resolution .ico for the browser tab
    base.save(os.path.join(OUT, "favicon.ico"),
              sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    print("wrote:", ", ".join(sorted(
        f for f in os.listdir(OUT) if f.startswith(("icon-", "favicon", "apple-touch")))))

if __name__ == "__main__":
    main()
