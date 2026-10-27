#!/usr/bin/env python3
"""Put the cartoon heads on generic cartoon bodies sitting on bar stools.

Reads assets/characters/cartoon/<name>.png (made by cartoonize.py) and writes:

  assets/characters/seated/<name>.png       full-size master, 900 px tall
  assets/characters/seated/<name>_game.png  450 px tall, for the 960x540 scene
  assets/characters/seated/napkin.png       napkin layer for Bryan's lap
  assets/characters/seated/anchors.json     where things are in the game images

Bodies are simple flat shapes in the same style as the heads: flat colours,
a thin ink line around each part and a thick ink outline around the whole
figure. Bryan faces right (toward the table), Jane faces left. Shirt and
pants colours come from the photos.

Usage:
  python3 tools/make_characters.py
  python3 tools/make_characters.py --preview   # also write seated/preview.png
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
HEAD_DIR = ROOT / "assets" / "characters" / "cartoon"
OUT_DIR = ROOT / "assets" / "characters" / "seated"

# Bodies are laid out on a 640 x 900 grid and drawn at SS times that size,
# then scaled down, which gives smooth edges.
W, H = 640, 900
SS = 2
GAME_HEIGHT = 450
INK = (34, 24, 30)
OUTLINE_PX = 6             # outline around the whole figure
LINE_PX = 3                # line around each body part

HEAD_HEIGHT = 300          # head size on the 640 x 900 grid
HEAD_BOTTOM = 384          # where the head's flat bottom sits, over the collar
HEAD_TRIM = 0.03           # share of the head's bottom edge (with its ink line) cut off

WOOD = (156, 98, 52)
WOOD_DARK = (112, 68, 36)
METAL = (120, 124, 134)
NAPKIN = (246, 244, 236)
NAPKIN_SHADE = (214, 210, 200)

CHARACTERS = {
    "bryan": {
        "shirt": (52, 64, 98),
        "pants": (150, 124, 96),
        "shorts": True,
        "shoes": (70, 52, 40),
        "sleeves": "short",
        "faces": "right",
    },
    "jane": {
        "shirt": (24, 24, 32),
        "pants": (226, 226, 232),
        "shorts": False,
        "shoes": (176, 132, 100),
        "sleeves": "none",
        "faces": "left",
    },
}


class Figure:
    """Stack of flat-coloured parts, drawn back to front."""

    def __init__(self):
        self.parts = []

    def part(self, colour):
        mask = Image.new("L", (W * SS, H * SS), 0)
        self.parts.append((mask, colour))
        return ImageDraw.Draw(mask), mask

    def poly(self, colour, pts):
        d, _ = self.part(colour)
        d.polygon([(x * SS, y * SS) for x, y in pts], fill=255)

    def ellipse(self, colour, box):
        d, _ = self.part(colour)
        d.ellipse([v * SS for v in box], fill=255)

    def rrect(self, colour, box, r):
        d, _ = self.part(colour)
        d.rounded_rectangle([v * SS for v in box], radius=r * SS, fill=255)

    def image(self, img, xy):
        """A ready-made picture (the head), outlined with the rest of the figure."""
        layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
        img = img.resize((img.width * SS, img.height * SS), Image.Resampling.LANCZOS)
        layer.paste(img, (xy[0] * SS, xy[1] * SS))
        self.parts.append((layer.getchannel("A"), layer))

    def limb(self, colour, pts, width):
        """A thick rounded stroke through the given joints."""
        d, _ = self.part(colour)
        s = [(x * SS, y * SS) for x, y in pts]
        d.line(s, fill=255, width=width * SS, joint="curve")
        r = width * SS / 2
        for x, y in (s[0], s[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)

    def render(self):
        size = (W * SS, H * SS)
        union = Image.new("L", size, 0)
        for mask, _ in self.parts:
            union = ImageChops.lighter(union, mask)
        outline = union.filter(ImageFilter.MaxFilter(OUTLINE_PX * SS * 2 + 1))

        out = Image.new("RGBA", size, (0, 0, 0, 0))
        out.paste(INK + (255,), mask=outline)
        line = LINE_PX * SS * 2 + 1
        for mask, colour in self.parts:
            out.paste(INK + (255,), mask=mask)
            if isinstance(colour, Image.Image):
                out.alpha_composite(colour)
                continue
            inner = mask.filter(ImageFilter.MinFilter(line))
            out.paste(colour + (255,), mask=inner)
        return out.resize((W, H), Image.Resampling.LANCZOS)


def stool(f):
    """Bar stool, seat centred at x=300, y=640."""
    for x0, x1 in ((222, 246), (354, 378)):          # back legs
        f.poly(WOOD_DARK, [(x0 + 20, 650), (x1 + 20, 650), (x1 + 10, 892), (x0 + 10, 892)])
    f.rrect(METAL, (200, 800, 400, 816), 8)          # footrest ring
    for x0, x1 in ((196, 222), (378, 404)):          # front legs
        f.poly(WOOD, [(x0 + 18, 650), (x1 + 18, 650), (x1, 892), (x0, 892)])
    f.ellipse(WOOD, (180, 626, 420, 674))            # seat


def body(f, c, skin, head):
    """Seated body facing right. Jane is mirrored afterwards."""
    sleeve = c["shirt"] if c["sleeves"] == "short" else skin
    shin = skin if c["shorts"] else c["pants"]

    # Far arm, mostly hidden behind the torso, hand on the far thigh.
    f.limb(skin, [(250, 370), (240, 500), (330, 575)], 42)

    # Far leg, a little higher up the stool so both feet show.
    f.limb(shin, [(444, 620), (440, 790)], 50 if c["shorts"] else 58)
    f.limb(c["pants"], [(270, 606), (448, 598)], 72)
    f.ellipse(c["shoes"], (414, 772, 506, 812))

    # Head goes behind the torso so the collar hides its cut-off bottom.
    f.image(head, ((W - head.width) // 2, HEAD_BOTTOM - head.height))

    # Torso. A tank top shows bare shoulders.
    if c["sleeves"] == "none":
        f.rrect(skin, (200, 356, 400, 450), 46)
        f.poly(c["shirt"], [(234, 362), (366, 362), (390, 420), (396, 624),
                            (204, 624), (210, 420)])
    else:
        f.rrect(c["shirt"], (200, 356, 400, 624), 46)

    # Near leg: shin down to the footrest, thigh forward over the seat.
    f.limb(shin, [(470, 650), (470, 800)], 54 if c["shorts"] else 62)
    f.limb(c["pants"], [(250, 636), (476, 628)], 82)
    f.ellipse(c["shoes"], (442, 786, 548, 830))

    # Near arm: upper arm down the side, forearm resting on the thigh.
    f.limb(skin, [(372, 380), (388, 520), (472, 590)], 46)
    f.ellipse(skin, (452, 568, 500, 612))             # hand
    if c["sleeves"] == "short":
        f.limb(sleeve, [(372, 376), (382, 440)], 62)


def skin_tone(head):
    """Median colour of the cheeks."""
    w, h = head.size
    px = []
    for x0 in (0.30, 0.58):
        cheek = head.crop((int(w * x0), int(h * 0.5), int(w * (x0 + 0.12)), int(h * 0.6)))
        px += list(cheek.convert("RGB").get_flattened_data())
    px.sort(key=sum)
    return px[len(px) // 2]


def napkin():
    """Folded cloth napkin, separate so the game can pop it in and out."""
    f = Figure()
    f.poly(NAPKIN, [(24, 50), (154, 38), (164, 82), (20, 94)])
    f.poly(NAPKIN_SHADE, [(22, 80), (162, 70), (164, 82), (20, 94)])
    f.poly(NAPKIN, [(64, 46), (100, 20), (128, 42)])        # corner flopping up
    img = f.render()
    return img.crop(img.getbbox())


def make(name, c):
    head = Image.open(HEAD_DIR / f"{name}.png").convert("RGBA")
    head = head.crop((0, 0, head.width, round(head.height * (1 - HEAD_TRIM))))
    head = head.resize((round(head.width * HEAD_HEIGHT / head.height), HEAD_HEIGHT),
                       Image.Resampling.LANCZOS)
    head = round_bottom(head)
    skin = skin_tone(head)

    f = Figure()
    stool(f)
    # The figure is drawn facing right and mirrored for Jane. Pre-flip her
    # head so it ends up the right way round.
    flip = c["faces"] == "left"
    body(f, c, skin, head.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else head)
    img = f.render()
    return img.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else img


def round_bottom(head):
    """Round off the bottom corners so hair doesn't end in a flat cut."""
    w, h = head.size
    mask = Image.new("L", (w * SS, h * SS), 0)
    r = int(w * 0.3) * SS
    ImageDraw.Draw(mask).rounded_rectangle([0, -r, w * SS, h * SS], radius=r, fill=255)
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    head.putalpha(ImageChops.multiply(head.getchannel("A"), mask))
    return head


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preview", action="store_true", help="write seated/preview.png")
    args = ap.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    scale = GAME_HEIGHT / H
    anchors = {"game_height": GAME_HEIGHT}
    made = {}
    for name, c in CHARACTERS.items():
        img = make(name, c)
        img.save(OUT_DIR / f"{name}.png", optimize=True)
        game = img.resize((round(W * scale), GAME_HEIGHT), Image.Resampling.LANCZOS)
        game.save(OUT_DIR / f"{name}_game.png", optimize=True)
        made[name] = img
        print("wrote", (OUT_DIR / f"{name}.png").relative_to(ROOT))

    nap = napkin()
    nap_game = nap.resize((round(nap.width * scale), round(nap.height * scale)),
                          Image.Resampling.LANCZOS)
    nap_game.save(OUT_DIR / "napkin.png", optimize=True)
    # Centre of the napkin on Bryan's near thigh, in bryan_game.png pixels.
    anchors["bryan_lap"] = {"x": round(400 * scale), "y": round(600 * scale)}
    anchors["napkin_size"] = {"w": nap_game.width, "h": nap_game.height}
    (OUT_DIR / "anchors.json").write_text(json.dumps(anchors, indent=2) + "\n")
    print("wrote", (OUT_DIR / "napkin.png").relative_to(ROOT))

    if args.preview:
        sheet = Image.new("RGBA", (W * 2 + 120, H + 80), (236, 228, 214, 255))
        sheet.alpha_composite(made["bryan"], (40, 40))
        sheet.alpha_composite(made["jane"], (W + 80, 40))
        lap = anchors["bryan_lap"]
        sheet.alpha_composite(nap, (40 + round(lap["x"] / scale) - nap.width // 2,
                                    40 + round(lap["y"] / scale) - nap.height // 2))
        sheet.convert("RGB").save(OUT_DIR / "preview.png")
        print("wrote", (OUT_DIR / "preview.png").relative_to(ROOT))


if __name__ == "__main__":
    main()
