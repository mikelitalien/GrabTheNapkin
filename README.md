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
    source/      original photos and crops (not committed, see .gitignore)
```

## Running

There's nothing to run yet. The plan is a browser game in plain HTML and
JavaScript, served locally with:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.
