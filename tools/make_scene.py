#!/usr/bin/env python3
"""Draw the bar the game takes place in.

Writes assets/scene/background.png, 960 x 540, in the same flat cartoon
style as the characters: flat colours with an ink line around each shape.
Everything is drawn straight from shapes, so there's no input art and the
output is the same every time.

The middle of the wall stays quiet, because that's where the heads are.
Busy things (the bottle shelf, the neon sign) go out to the sides.

Usage:
  python3 tools/make_scene.py
  python3 tools/make_scene.py --preview   # also write scene/preview.png with the characters
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "scene"
SEATED = ROOT / "assets" / "characters" / "seated"

W, H = 960, 540
SS = 3                     # drawn at 3x, then scaled down for smooth edges
LINE = 2                   # ink line around each shape, in scene pixels

INK = (34, 24, 30)
WALL = (232, 214, 186)
WALL_STRIPE = (224, 203, 172)
WOOD = (156, 98, 52)
WOOD_DARK = (112, 68, 36)
WOOD_LIGHT = (196, 150, 104)
PANEL = (186, 140, 96)
FLOOR = (124, 82, 50)
FLOOR_DARK = (98, 63, 38)
SHADE = (46, 92, 72)
BULB = (255, 232, 160)
FRAME = (178, 132, 60)
SKY = (150, 196, 222)
HILL = (120, 170, 96)
HILL_DARK = (92, 140, 76)
SUN = (250, 206, 92)
BOARD = (44, 62, 54)
CHALK = (232, 236, 228)
NEON = (255, 92, 160)
NEON_CORE = (255, 214, 236)
OLIVE = (128, 156, 60)

# Bottles on the shelf: (body colour, label colour, width, height).
BOTTLES = [
    ((64, 120, 72), (238, 226, 196), 18, 52),
    ((168, 96, 36), (40, 40, 40), 22, 44),
    ((190, 210, 220), (200, 48, 48), 16, 58),
    ((120, 40, 52), (238, 226, 196), 20, 48),
    ((80, 64, 40), (230, 190, 70), 24, 40),
    ((64, 120, 72), (200, 48, 48), 17, 54),
]


class Canvas:
    """Drawing helpers in scene pixels, each shape with an ink line."""

    def __init__(self):
        self.img = Image.new("RGBA", (W * SS, H * SS), WALL + (255,))
        self.d = ImageDraw.Draw(self.img)

    @staticmethod
    def s(v):
        return [round(x * SS) for x in v]

    def rect(self, box, fill, line=LINE, r=0):
        self.d.rounded_rectangle(self.s(box), radius=r * SS, fill=fill,
                                 outline=INK if line else None, width=round(line * SS))

    def ellipse(self, box, fill, line=LINE):
        self.d.ellipse(self.s(box), fill=fill, outline=INK if line else None,
                       width=round(line * SS))

    def poly(self, pts, fill, line=LINE):
        pts = [(x * SS, y * SS) for x, y in pts]
        self.d.polygon(pts, fill=fill, outline=INK if line else None, width=round(line * SS))

    def line(self, pts, colour, width):
        pts = [(x * SS, y * SS) for x, y in pts]
        self.d.line(pts, fill=colour, width=round(width * SS), joint="curve")

    def glow(self, box, colour, blur):
        """A soft blob of light, blended on top of what's there."""
        layer = Image.new("RGBA", self.img.size, colour + (0,))
        ImageDraw.Draw(layer).ellipse(self.s(box), fill=colour + (150,))
        layer = layer.filter(ImageFilter.GaussianBlur(blur * SS))
        self.img.alpha_composite(layer)
        self.d = ImageDraw.Draw(self.img)

    def done(self):
        return self.img.resize((W, H), Image.Resampling.LANCZOS)


def wall(c):
    for x in range(0, W, 48):
        c.rect((x + 14, 0, x + 34, 296), WALL_STRIPE, line=0)
    c.rect((-4, -4, W + 4, 16), WOOD_DARK)                  # crown moulding


def wainscot(c):
    c.rect((-4, 300, W + 4, 470), PANEL)
    for x in range(12, W, 120):                             # raised panels
        c.rect((x, 318, x + 96, 448), WOOD_LIGHT, r=4)
        c.rect((x + 8, 326, x + 88, 440), PANEL, line=1, r=3)
    c.rect((-4, 290, W + 4, 302), WOOD_DARK)                # chair rail
    c.rect((-4, 456, W + 4, 472), WOOD_DARK)                # baseboard


def floor(c):
    c.rect((-4, 470, W + 4, H + 4), FLOOR)
    for i, y in enumerate(range(486, H, 18)):
        c.line([(0, y), (W, y)], FLOOR_DARK, 1.5)
        for x in range(-60 + (i % 3) * 70, W, 210):         # staggered plank ends
            c.line([(x, y - 18), (x, y)], FLOOR_DARK, 1.5)


def shelf(c):
    """Back-bar shelf of bottles, out on the left."""
    c.rect((16, 70, 204, 290), WOOD_DARK, r=4)
    c.rect((26, 80, 194, 290), (70, 46, 34), line=1)
    for y in (162, 252):
        c.rect((20, y, 200, y + 10), WOOD)
    for row, base in enumerate((162, 252)):
        x = 36
        for i in range(5):
            body, label, bw, bh = BOTTLES[(i + row * 2) % len(BOTTLES)]
            top = base - bh
            c.rect((x + bw * 0.32, top - 16, x + bw * 0.68, top + 4), body, r=2)   # neck
            c.rect((x, top, x + bw, base), body, r=5)
            c.rect((x + 2, top + bh * 0.35, x + bw - 2, top + bh * 0.65), label, line=1)
            x += bw + 12


def lamp(c, x):
    """Pendant lamp hanging from the ceiling."""
    c.line([(x, 0), (x, 46)], INK, 2)
    c.glow((x - 70, 50, x + 70, 150), BULB, 18)
    c.ellipse((x - 9, 66, x + 9, 84), BULB)
    c.poly([(x - 12, 44), (x + 12, 44), (x + 34, 74), (x - 34, 74)], SHADE)


def picture(c):
    """Framed picture between the two heads, above the table."""
    box = (432, 150, 528, 222)
    c.rect((box[0] - 10, box[1] - 10, box[2] + 10, box[3] + 10), FRAME)
    c.rect(box, SKY, line=1.5)
    c.ellipse((494, 160, 514, 180), SUN, line=1.5)
    c.poly([(432, 222), (432, 196), (462, 180), (500, 204), (528, 192), (528, 222)], HILL, line=1.5)
    c.poly([(432, 222), (470, 204), (510, 222)], HILL_DARK, line=1.5)


def neon(c):
    """Neon cocktail glass out on the right."""
    x, y = 852, 96
    glass = [(x - 44, y), (x + 44, y), (x, y + 52)]
    stem = [(x, y + 52), (x, y + 104)]
    foot = [(x - 30, y + 106), (x + 30, y + 106)]
    pick = [(x + 6, y + 30), (x + 40, y - 20)]
    c.rect((x - 66, y - 34, x + 66, y + 124), BOARD, r=10)
    for width, colour in ((9, NEON), (3, NEON_CORE)):
        c.line(glass + [glass[0]], colour, width)
        c.line(stem, colour, width)
        c.line(foot, colour, width)
        c.line(pick, colour, width)
    c.ellipse((x + 2, y + 24, x + 16, y + 38), OLIVE, line=1.5)
    c.glow((x - 70, y - 30, x + 70, y + 120), NEON, 22)


def draw():
    c = Canvas()
    wall(c)
    shelf(c)
    picture(c)
    neon(c)
    for x in (480, 250, 710):
        lamp(c, x)
    wainscot(c)
    floor(c)
    return c.done()


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preview", action="store_true", help="write scene/preview.png")
    args = ap.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    bg = draw()
    bg.convert("RGB").save(OUT_DIR / "background.png", optimize=True)
    print("wrote", (OUT_DIR / "background.png").relative_to(ROOT))

    if args.preview:
        anchors = json.loads((SEATED / "anchors.json").read_text())
        scene = bg.copy()
        for name, file in (("bryan", "bryan_game"), ("table", "table"), ("jane", "jane_game")):
            layer = Image.open(SEATED / f"{file}.png").convert("RGBA")
            pos = anchors["layers"][name]
            scene.alpha_composite(layer, (pos["x"], pos["y"]))
        spot = anchors["napkin"]["spots"][anchors["napkin"]["start"]]
        scene.alpha_composite(Image.open(SEATED / "napkin.png").convert("RGBA"), (spot["x"], spot["y"]))
        scene.convert("RGB").save(OUT_DIR / "preview.png")
        print("wrote", (OUT_DIR / "preview.png").relative_to(ROOT))


if __name__ == "__main__":
    main()
