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
    cartoon/     cartoon head art made from the cutouts (generated)
      bryan.png, jane.png                 512 px tall
      bryan_sprite.png, jane_sprite.png   128 px tall, for the game
      preview.png                         before/after sheet
    seated/      heads on cartoon bodies on bar stools, plus table (generated)
      bryan.png, jane.png                 640 x 900 masters
      bryan_game.png, jane_game.png       320 x 450, for the 960 x 540 scene
      table.png                           hightop table, same scale
      napkin.png                          napkin layer, moves between Bryan's legs
      anchors.json                        where each layer and napkin spot is in the scene
      preview.png                         the whole scene, napkin on
    source/      original photos and crops (not committed, see .gitignore)
tools/
  cartoonize.py        makes assets/characters/cartoon/ from the cutouts
  make_characters.py   makes assets/characters/seated/ from the cartoon heads
```

## Regenerating the cartoon art

```
pip install -r tools/requirements.txt
python3 tools/cartoonize.py --preview
python3 tools/make_characters.py --preview
```

The output is deterministic. Tweak the look with the constants at the top of
`tools/cartoonize.py` (outline thickness, number of shading bands, line
detail, where the head crop stops) and run it again.

## Running

There's nothing to run yet. The plan is a browser game in plain HTML and
JavaScript, served locally with:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.
