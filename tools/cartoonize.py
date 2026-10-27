#!/usr/bin/env python3
"""Turn the character cutouts into cartoon-style game art.

Reads every transparent PNG in assets/characters/ and writes, for each one:

  assets/characters/cartoon/<name>.png         512 px tall master
  assets/characters/cartoon/<name>_sprite.png  160 px tall in-game sprite

The look is a flat cel-shaded cartoon: smoothed skin and cloth, a few
flat brightness bands, dark ink lines on strong edges and a thick
outline around the silhouette. Everything is deterministic, so running the
script again on the same input gives the same output.

Usage:
  python3 tools/cartoonize.py                 # all characters
  python3 tools/cartoonize.py bryan           # just one
  python3 tools/cartoonize.py --preview       # also write a side-by-side sheet

Needs Pillow and numpy (pip install -r tools/requirements.txt).
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CHAR_DIR = ROOT / "assets" / "characters"
OUT_DIR = CHAR_DIR / "cartoon"

MASTER_HEIGHT = 512
SPRITE_HEIGHT = 160
WORK_HEIGHT = 768          # resolution the filters run at
TONE_BANDS = 7             # flat brightness bands
INK = (34, 24, 30)         # line and outline colour
OUTLINE_PX = 6             # silhouette outline at WORK_HEIGHT
EDGE_THRESHOLD = 5.0       # higher means fewer interior lines
LINE_SIGMA = 3.0           # size of features that get a line
SMOOTH_PASSES = 2
SATURATION_BOOST = 1.15


def clean_alpha(alpha):
    """Hard-edge the soft cutout mask and drop stray specks."""
    a = alpha.filter(ImageFilter.GaussianBlur(1.5))
    a = a.point(lambda v: 255 if v >= 128 else 0)
    # Opening then closing removes specks and fills pinholes.
    a = a.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    a = a.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    return a


def bleed_colours(rgb, mask):
    """Push edge colours outward so smoothing doesn't pull in the old background."""
    rgb = rgb.copy()
    m = mask
    for _ in range(12):
        grown = rgb.filter(ImageFilter.MaxFilter(3))
        rgb = Image.composite(rgb, grown, m)
        m = m.filter(ImageFilter.MaxFilter(3))
    return rgb


def flatten(rgb):
    """Smooth away photo texture while keeping shapes, then boost colour."""
    for _ in range(SMOOTH_PASSES):
        rgb = rgb.filter(ImageFilter.MedianFilter(5))
    hsv = np.asarray(rgb.convert("HSV")).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * SATURATION_BOOST, 0, 255)
    return Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")


def quantize(rgb, mask):
    """Cel-shade: snap brightness to a few flat bands, keep smoothed colour.

    Banding brightness instead of picking a global palette keeps small
    colourful details (like the shirt graphic) that a palette would drop.
    """
    ycc = np.asarray(rgb.convert("YCbCr")).astype(np.float32)
    y = ycc[..., 0]
    step = 255 / TONE_BANDS
    ycc[..., 0] = np.clip((np.floor(y / step) + 0.5) * step, 0, 255)
    # Chroma carries no texture after this, so it reads as flat paint.
    for c in (1, 2):
        ch = Image.fromarray(ycc[..., c].astype(np.uint8))
        ycc[..., c] = np.asarray(ch.filter(ImageFilter.MedianFilter(7)))
    q = Image.fromarray(ycc.astype(np.uint8), "YCbCr").convert("RGB")
    q = q.filter(ImageFilter.ModeFilter(5))
    return Image.composite(q, Image.new("RGB", rgb.size, INK), mask)


def ink_lines(rgb, mask):
    """Dark lines from a difference of Gaussians, which picks out eyes, mouth and folds."""
    gray = rgb.convert("L").filter(ImageFilter.MedianFilter(3))
    g1 = np.asarray(gray.filter(ImageFilter.GaussianBlur(LINE_SIGMA))).astype(np.float32)
    g2 = np.asarray(gray.filter(ImageFilter.GaussianBlur(LINE_SIGMA * 1.6))).astype(np.float32)
    dog = g1 - g2
    lines = Image.fromarray(((dog < -EDGE_THRESHOLD) * 255).astype(np.uint8))
    # Drop isolated dots, then thicken a touch.
    lines = lines.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(3))
    # Only inside the body, not on the silhouette (the outline covers that).
    inner = mask.filter(ImageFilter.MinFilter(5))
    return Image.composite(lines, Image.new("L", lines.size, 0), inner)


def cartoonize(src):
    img = Image.open(src).convert("RGBA")
    bbox = img.getchannel("A").point(lambda v: 255 if v >= 128 else 0).getbbox()
    img = img.crop(bbox)

    scale = WORK_HEIGHT / img.height
    img = img.resize((round(img.width * scale), WORK_HEIGHT), Image.Resampling.LANCZOS)

    # Room for the outline on every side.
    pad = OUTLINE_PX * 2
    canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2))
    canvas.paste(img, (pad, pad))

    mask = clean_alpha(canvas.getchannel("A"))
    rgb = bleed_colours(canvas.convert("RGB"), mask)
    flat = quantize(flatten(rgb), mask)
    lines = ink_lines(rgb, mask)

    body = Image.composite(Image.new("RGB", flat.size, INK), flat, lines)

    outline_mask = mask.filter(ImageFilter.MaxFilter(OUTLINE_PX * 2 + 1))
    out = Image.new("RGBA", body.size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", body.size, INK + (255,)), mask=outline_mask)
    out.paste(body.convert("RGBA"), mask=mask)

    # Smooth the silhouette edge for the final downscale.
    alpha = out.getchannel("A").filter(ImageFilter.GaussianBlur(0.8))
    out.putalpha(alpha)
    return out


def fit_height(img, h):
    w = round(img.width * h / img.height)
    return img.resize((w, h), Image.Resampling.LANCZOS)


def preview_sheet(pairs, path):
    """Originals on top, cartoon versions below, on a neutral background."""
    h = 400
    cols = []
    for orig, toon in pairs:
        o = fit_height(orig, h)
        t = fit_height(toon, h)
        cols.append((o, t))
    width = sum(max(o.width, t.width) for o, t in cols) + 40 * (len(cols) + 1)
    sheet = Image.new("RGBA", (width, h * 2 + 120), (236, 228, 214, 255))
    x = 40
    for o, t in cols:
        sheet.alpha_composite(o, (x, 40))
        sheet.alpha_composite(t, (x, h + 80))
        x += max(o.width, t.width) + 40
    sheet.convert("RGB").save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("names", nargs="*", help="character names (default: all)")
    ap.add_argument("--preview", action="store_true", help="write cartoon/preview.png")
    args = ap.parse_args()

    sources = sorted(CHAR_DIR.glob("*.png"))
    if args.names:
        sources = [p for p in sources if p.stem in args.names]
    if not sources:
        raise SystemExit("no matching PNGs in " + str(CHAR_DIR))

    OUT_DIR.mkdir(exist_ok=True)
    pairs = []
    for src in sources:
        toon = cartoonize(src)
        fit_height(toon, MASTER_HEIGHT).save(OUT_DIR / f"{src.stem}.png", optimize=True)
        fit_height(toon, SPRITE_HEIGHT).save(OUT_DIR / f"{src.stem}_sprite.png", optimize=True)
        pairs.append((Image.open(src).convert("RGBA"), toon))
        print("wrote", OUT_DIR.relative_to(ROOT) / f"{src.stem}.png")

    if args.preview:
        preview_sheet(pairs, OUT_DIR / "preview.png")
        print("wrote", (OUT_DIR / "preview.png").relative_to(ROOT))


if __name__ == "__main__":
    main()
