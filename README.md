# GrabTheNapkin

A small video game starring Bryan and Jane.

## Status

Milestones 1 and 2 work: a 30 second round with fork and phone decoys, a
start screen, a 3-2-1 countdown, and a top 10 leaderboard saved in the
browser. The spec is in
`docs/SPEC.md`.

## Layout

```
index.html             the game page
style.css              scales the 960 x 540 scene to fit the window
src/
  config.js            napkin timing, hit area and asset paths, all tunable
  round.js             the rules: when and where the napkin or a decoy shows, scoring
  leaderboard.js       the top 10, saved in the browser's localStorage
  main.js              screens, countdown, drawing the scene, clicks
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
      fork.png, phone.png                 decoys that pop up instead of the napkin
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

## Game spec

See [docs/SPEC.md](docs/SPEC.md) for how the game plays and the milestone plan.

## Running

It's a plain HTML and JavaScript browser game with no build step. From the
repo folder run:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 and press Play. Opening `index.html`
straight from the file system won't work, because browsers block loading the
art that way.

Click the napkin while it's on Bryan's lap for a point. It pops up on one
leg or the other at random. A click anywhere else costs a point (never below
0). The napkin gets quicker over the 30 seconds.

All paths are relative, so it also runs from GitHub Pages
(Settings > Pages > deploy from `main`, root folder).
