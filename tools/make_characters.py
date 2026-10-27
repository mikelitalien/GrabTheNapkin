#!/usr/bin/env python3
"""Put the cartoon heads on generic cartoon bodies sitting on bar stools.

Reads assets/characters/cartoon/<name>.png (made by cartoonize.py) and writes:

  assets/characters/seated/<name>.png       full-size master, 900 px tall
  assets/characters/seated/<name>_game.png  450 px tall, for the 960x540 scene
  assets/characters/seated/<name>_stool.png the stool, shins and shoes, which stay put
  assets/characters/seated/<name>_upper.png head, body, lap and arms, which breathe and sway
  assets/characters/seated/jane_reach.png   Jane's upper half without the arm she reaches with
  assets/characters/seated/table.png        hightop table, same scale as _game
  assets/characters/seated/napkin.png       napkin layer that moves between Bryan's legs
  assets/characters/seated/fork.png         decoy that pops up instead of the napkin
  assets/characters/seated/phone.png        decoy that pops up instead of the napkin
  assets/characters/seated/anchors.json     where everything goes in the scene

Bodies are simple flat shapes in the same style as the heads: flat colours,
a thin ink line around each part and a thick ink outline around the whole
figure. Both face forward, with the table between them. Shirt and pants
colours come from the photos.

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

# Figures are laid out on a 640 x 900 grid and drawn at SS times that size,
# then scaled down, which gives smooth edges.
W, H = 640, 900
SS = 2
GAME_HEIGHT = 450
SCALE = GAME_HEIGHT / H
INK = (34, 24, 30)
OUTLINE_PX = 6             # outline around the whole figure
LINE_PX = 3                # line around each body part

HEAD_HEIGHT = 300          # head size on the 640 x 900 grid
HEAD_BOTTOM = 384          # where the head's flat bottom sits, over the collar
HEAD_TRIM = 0.03           # share of the head's bottom edge (with its ink line) cut off

TABLE_W = 440              # table canvas width on the grid

# Top-left corners in the 960 x 540 scene, for the _game images and table.png.
SCENE = {"bryan": (170, 90), "table": (370, 90), "jane": (470, 90)}
# Where the napkin can sit on Bryan, on the grid, named by the side of the
# screen the leg is on. The napkin starts on the screen-left leg.
LEGS = {"screen_left": (272, 662), "screen_right": (368, 662)}
NAPKIN_START = "screen_left"
# Each arm as shoulder x, elbow x and hand x on the grid. Shoulders are at
# y=384, elbows at y=520 and hands rest on the thighs at y=614.
ARMS = {"screen_left": (236, 214, 256), "screen_right": (404, 426, 384)}
ARM_PX = 44                # arm thickness on the grid
HAND_R = 26                # hand radius on the grid
# The upper body breathes and sways around this point on the grid, the
# middle of the seat, so the lap barely moves.
PIVOT = (320, 650)
# The arm Jane reaches across the table with.
REACH_ARM = "screen_left"

WOOD = (156, 98, 52)
WOOD_DARK = (112, 68, 36)
METAL = (120, 124, 134)
METAL_DARK = (88, 92, 102)
NAPKIN = (246, 244, 236)
NAPKIN_SHADE = (214, 210, 200)
STEEL = (198, 204, 214)
STEEL_SHADE = (150, 158, 172)
PHONE = (44, 46, 58)
SCREEN = (92, 170, 222)
SCREEN_GLARE = (150, 206, 240)

CHARACTERS = {
    "bryan": {
        "shirt": (52, 64, 98),
        "pants": (150, 124, 96),
        "shorts": True,
        "shoes": (70, 52, 40),
        "sleeves": "short",
    },
    "jane": {
        "shirt": (24, 24, 32),
        "pants": (226, 226, 232),
        "shorts": False,
        "shoes": (176, 132, 100),
        "sleeves": "none",
    },
}


class Figure:
    """Stack of flat-coloured parts, drawn back to front."""

    def __init__(self, w=W, h=H):
        self.size = (w * SS, h * SS)
        self.parts = []

    def part(self, colour):
        mask = Image.new("L", self.size, 0)
        self.parts.append((mask, colour))
        return ImageDraw.Draw(mask)

    def poly(self, colour, pts):
        self.part(colour).polygon([(x * SS, y * SS) for x, y in pts], fill=255)

    def ellipse(self, colour, box):
        self.part(colour).ellipse([v * SS for v in box], fill=255)

    def rrect(self, colour, box, r):
        self.part(colour).rounded_rectangle([v * SS for v in box], radius=r * SS, fill=255)

    def image(self, img, xy):
        """A ready-made picture (the head), outlined with the rest of the figure."""
        layer = Image.new("RGBA", self.size, (0, 0, 0, 0))
        img = img.resize((img.width * SS, img.height * SS), Image.Resampling.LANCZOS)
        layer.paste(img, (xy[0] * SS, xy[1] * SS))
        self.parts.append((layer.getchannel("A"), layer))

    def limb(self, colour, pts, width):
        """A thick rounded stroke through the given joints."""
        d = self.part(colour)
        s = [(x * SS, y * SS) for x, y in pts]
        d.line(s, fill=255, width=width * SS, joint="curve")
        r = width * SS / 2
        for x, y in (s[0], s[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)

    def render(self):
        union = Image.new("L", self.size, 0)
        for mask, _ in self.parts:
            union = ImageChops.lighter(union, mask)
        outline = union.filter(ImageFilter.MaxFilter(OUTLINE_PX * SS * 2 + 1))

        out = Image.new("RGBA", self.size, (0, 0, 0, 0))
        out.paste(INK + (255,), mask=outline)
        line = LINE_PX * SS * 2 + 1
        for mask, colour in self.parts:
            out.paste(INK + (255,), mask=mask)
            if isinstance(colour, Image.Image):
                out.alpha_composite(colour)
                continue
            inner = mask.filter(ImageFilter.MinFilter(line))
            out.paste(colour + (255,), mask=inner)
        return out.resize((self.size[0] // SS, self.size[1] // SS), Image.Resampling.LANCZOS)


def stool(f):
    """Bar stool from the front, seat centred at x=320, y=650."""
    for x in (262, 352):                              # back legs
        f.poly(WOOD_DARK, [(x, 660), (x + 26, 660), (x + 26, 880), (x, 880)])
    f.rrect(METAL, (214, 796, 426, 812), 8)           # footrest
    for x0, x1 in ((216, 244), (396, 424)):           # front legs
        f.poly(WOOD, [(x0 + 12, 660), (x1 + 12, 660), (x1, 892), (x0, 892)])
    f.ellipse(WOOD, (196, 630, 444, 680))             # seat


def legs(f, c, skin):
    """Shins and shoes, resting on the stool's footrest."""
    shin = skin if c["shorts"] else c["pants"]

    # Shins hang from the knees to the footrest.
    for x in (272, 368):
        f.limb(shin, [(x, 690), (x, 790)], 52 if c["shorts"] else 60)
    for x in (272, 368):
        f.ellipse(c["shoes"], (x - 44, 784, x + 44, 828))


def upper(f, c, skin, head, arms=("screen_left", "screen_right")):
    """Head, torso, lap and arms: the part of a seated figure that moves."""
    # Head goes behind the torso so the collar hides its cut-off bottom.
    f.image(head, ((W - head.width) // 2, HEAD_BOTTOM - head.height))

    # Torso. A tank top shows bare shoulders.
    if c["sleeves"] == "none":
        f.rrect(skin, (218, 356, 422, 450), 46)
        f.poly(c["shirt"], [(254, 362), (386, 362), (410, 420), (416, 640),
                            (224, 640), (230, 420)])
    else:
        f.rrect(c["shirt"], (218, 356, 422, 640), 46)

    # Thighs come toward the viewer, so they show as short shapes: the lap.
    f.rrect(c["pants"], (226, 604, 318, 704), 34)
    f.rrect(c["pants"], (322, 604, 414, 704), 34)

    # Arms down the sides, hands resting on the thighs.
    for side, (sx, ex, hx) in ARMS.items():
        if side not in arms:
            continue
        f.limb(skin, [(sx, 384), (ex, 520), (hx, 614)], 44)
        f.ellipse(skin, (hx - 26, 596, hx + 26, 644))
        if c["sleeves"] == "short":
            f.limb(c["shirt"], [(sx, 380), (sx + (ex - sx) // 2, 446)], 60)


def body(f, c, skin, head):
    """Seated body facing forward, centred at x=320."""
    legs(f, c, skin)
    upper(f, c, skin, head)


def table():
    """Hightop table on a pedestal, top at about chest height when seated."""
    f = Figure(TABLE_W, H)
    f.ellipse(METAL_DARK, (100, 852, 340, 896))       # base
    f.rrect(METAL, (204, 560, 236, 872), 12)          # pedestal
    f.ellipse(WOOD_DARK, (16, 516, 424, 588))         # edge of the top
    f.ellipse(WOOD, (16, 500, 424, 568))              # top
    return f.render()


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
    f.poly(NAPKIN, [(22, 44), (116, 36), (122, 72), (18, 80)])
    f.poly(NAPKIN_SHADE, [(20, 68), (120, 61), (122, 72), (18, 80)])
    f.poly(NAPKIN, [(50, 42), (76, 20), (98, 38)])          # corner flopping up
    img = f.render()
    return img.crop(img.getbbox())


def fork():
    """Decoy: a fork lying across the lap, tines to screen-right."""
    f = Figure()
    f.rrect(STEEL, (10, 50, 78, 70), 10)                    # handle
    f.rrect(STEEL_SHADE, (16, 61, 74, 70), 5)
    f.poly(STEEL, [(74, 52), (94, 36), (94, 84), (74, 68)])  # neck
    for y in (36, 54, 72):                                  # tines
        f.rrect(STEEL, (90, y, 130, y + 12), 5)
    img = f.render()
    return img.crop(img.getbbox())


def phone():
    """Decoy: a phone lying on the lap, screen up."""
    f = Figure()
    f.rrect(PHONE, (16, 30, 120, 82), 10)
    f.rrect(SCREEN, (26, 37, 110, 75), 4)
    f.poly(SCREEN_GLARE, [(40, 37), (58, 37), (40, 60)])
    img = f.render()
    return img.crop(img.getbbox())


DECOYS = {"fork": fork, "phone": phone}


def round_bottom(head):
    """Round off the bottom corners so hair doesn't end in a flat cut."""
    w, h = head.size
    mask = Image.new("L", (w * SS, h * SS), 0)
    r = int(w * 0.3) * SS
    ImageDraw.Draw(mask).rounded_rectangle([0, -r, w * SS, h * SS], radius=r, fill=255)
    mask = mask.resize((w, h), Image.Resampling.LANCZOS)
    head.putalpha(ImageChops.multiply(head.getchannel("A"), mask))
    return head


def load_head(name):
    head = Image.open(HEAD_DIR / f"{name}.png").convert("RGBA")
    head = head.crop((0, 0, head.width, round(head.height * (1 - HEAD_TRIM))))
    head = head.resize((round(head.width * HEAD_HEIGHT / head.height), HEAD_HEIGHT),
                       Image.Resampling.LANCZOS)
    return round_bottom(head)


def make(name, c):
    """The whole seated figure, plus the parts the game animates separately."""
    head = load_head(name)
    skin = skin_tone(head)

    f = Figure()
    stool(f)
    body(f, c, skin, head)
    parts = {"": f.render()}

    f = Figure()
    stool(f)
    legs(f, c, skin)
    parts["_stool"] = f.render()

    f = Figure()
    upper(f, c, skin, head)
    parts["_upper"] = f.render()

    if name == "jane":
        f = Figure()
        upper(f, c, skin, head, arms=[a for a in ARMS if a != REACH_ARM])
        parts["_reach"] = f.render()
    return parts, skin


def scene_point(name, x, y):
    """A point on a character's grid, in scene pixels."""
    ox, oy = SCENE[name]
    return {"x": ox + round(x * SCALE), "y": oy + round(y * SCALE)}


def to_game(img):
    return img.resize((round(img.width * SCALE), round(img.height * SCALE)),
                      Image.Resampling.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--preview", action="store_true", help="write seated/preview.png")
    args = ap.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    layers = {}
    rig = {}
    for name, c in CHARACTERS.items():
        parts, skin = make(name, c)
        img = parts.pop("")
        img.save(OUT_DIR / f"{name}.png", optimize=True)
        layers[name] = to_game(img)
        layers[name].save(OUT_DIR / f"{name}_game.png", optimize=True)
        print("wrote", (OUT_DIR / f"{name}.png").relative_to(ROOT))
        for suffix, part in parts.items():
            to_game(part).save(OUT_DIR / f"{name}{suffix}.png", optimize=True)
            print("wrote", (OUT_DIR / f"{name}{suffix}.png").relative_to(ROOT))
        rig[name] = {"pivot": scene_point(name, *PIVOT), "skin": "#%02x%02x%02x" % skin[:3]}

    # Jane's reaching arm is drawn by the game, from her shoulder, in the
    # same style: an ink outline around a flat skin-coloured stroke.
    sx, ex, hx = ARMS[REACH_ARM]
    rig["jane"].update({
        "shoulder": scene_point("jane", sx, 384),
        "elbow": scene_point("jane", ex, 520),
        "hand": scene_point("jane", hx, 614),
        "arm": round(ARM_PX * SCALE), "handR": round(HAND_R * SCALE),
        "line": LINE_PX * SCALE, "outline": OUTLINE_PX * SCALE,
    })

    layers["table"] = to_game(table())
    layers["table"].save(OUT_DIR / "table.png", optimize=True)
    nap = to_game(napkin())
    nap.save(OUT_DIR / "napkin.png", optimize=True)
    print("wrote", (OUT_DIR / "table.png").relative_to(ROOT))
    print("wrote", (OUT_DIR / "napkin.png").relative_to(ROOT))
    decoys = {}
    for name, draw in DECOYS.items():
        decoys[name] = to_game(draw())
        decoys[name].save(OUT_DIR / f"{name}.png", optimize=True)
        print("wrote", (OUT_DIR / f"{name}.png").relative_to(ROOT))

    # Napkin's top-left corner in the scene for each of Bryan's legs.
    bx, by = SCENE["bryan"]
    spots = {}
    for leg, (x, y) in LEGS.items():
        cx, cy = bx + round(x * SCALE), by + round(y * SCALE)
        spots[leg] = {"x": cx - nap.width // 2, "y": cy - nap.height // 2}
    anchors = {
        "scene": {"w": 960, "h": 540},
        "layers": {k: {"x": x, "y": y} for k, (x, y) in SCENE.items()},
        "napkin": {"w": nap.width, "h": nap.height, "start": NAPKIN_START, "spots": spots},
        # Decoys pop up on the same leg spots, centred where the napkin would be.
        "decoys": {k: {"w": d.width, "h": d.height} for k, d in decoys.items()},
        # Points the game needs to animate the characters.
        "rig": rig,
    }
    (OUT_DIR / "anchors.json").write_text(json.dumps(anchors, indent=2) + "\n")

    if args.preview:
        scene = Image.new("RGBA", (960, 540), (236, 228, 214, 255))
        for name in ("bryan", "jane", "table"):
            scene.alpha_composite(layers[name], SCENE[name])
        n = anchors["napkin"]["spots"][NAPKIN_START]
        scene.alpha_composite(nap, (n["x"], n["y"]))
        scene.convert("RGB").save(OUT_DIR / "preview.png")
        print("wrote", (OUT_DIR / "preview.png").relative_to(ROOT))


if __name__ == "__main__":
    main()
