# GrabTheNapkin

A small video game starring Bryan and Jane.

## Status

Early days. So far there's character art and no game code yet.

## Layout

```
assets/
  characters/
    bryan.png    character cutout (transparent PNG)
    jane.png     character cutout (transparent PNG)
    cartoon/     cartoon game art made from the cutouts (generated)
      bryan.png, jane.png                 512 px tall
      bryan_sprite.png, jane_sprite.png   160 px tall, for the game
      preview.png                         before/after sheet
    source/      original photos and crops (not committed, see .gitignore)
tools/
  cartoonize.py  makes assets/characters/cartoon/ from the cutouts
```

## Regenerating the cartoon art

```
pip install -r tools/requirements.txt
python3 tools/cartoonize.py --preview
```

The output is deterministic. Tweak the look with the constants at the top of
`tools/cartoonize.py` (outline thickness, number of shading bands, line
detail) and run it again.

## Running

There's nothing to run yet. The plan is a browser game in plain HTML and
JavaScript, served locally with:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.
