# Grab the Napkin: game spec

A whack-a-mole style browser game starring Bryan and Jane.

## The idea

Bryan and Jane are sitting at a hightop table. Bryan has a napkin on his lap.
The napkin keeps popping into view and disappearing, like the mole in
whack-a-mole. Click the napkin while it's showing to grab it and score a
point. Each round lasts 30 seconds. Scores go on a saved leaderboard.

## How it plays

1. **Start screen.** Title, the leaderboard, and a "Play" button.
2. **Round.** A 3-2-1 countdown, then 30 seconds of play.
   - The napkin appears on Bryan's lap for a short time, then disappears.
   - Clicking (or tapping) the napkin while it's showing scores 1 point and
     hides it right away. Each appearance can only be scored once.
   - Clicking when the napkin isn't showing is a miss and costs 1 point.
     The score never goes below 0. A miss gets a quick red "-1" so the
     player knows why.
   - The score and the time left are always on screen.
3. **Game over.** Shows the final score. If it makes the leaderboard, the
   player types a name and it's saved. Then "Play again" or "Back to start".

### Napkin timing (the whack-a-mole part)

Defaults, all in one config block at the top of the game code so they're
easy to tune:

| Setting | Start of round | End of round |
| --- | --- | --- |
| Time the napkin stays up | 1.2 s | 0.5 s |
| Gap before the next napkin | 0.4 to 1.5 s, random | 0.2 to 0.8 s, random |

The game gets faster in a straight line over the 30 seconds. The gap is
random so players can't just click to a rhythm.

## The scene

- One fixed scene, 960 x 540 (16:9), scaled to fit the browser window.
- A bar or restaurant background, with a hightop table in the middle.
- Bryan sits on a stool on the left, turned a little toward the table, so his
  lap is in plain view beside the table rather than hidden under it.
- Jane sits on a stool on the right side of the table.
- Bryan and Jane are cartoon heads (from `assets/characters/cartoon/`) on
  generic cartoon bodies, sitting on stools. The bodies are simple flat
  shapes drawn to match the heads, with shirt colors taken from the photos
  (Bryan in blue, Jane in black). The stools, table and background are drawn
  in the same style.
- The napkin is its own image layered on Bryan's lap, so it can pop in and
  out.

## Leaderboard

- Top 10 scores, highest first. Ties go to whoever got the score first.
- Each entry has a name (up to 12 characters), the score and the date.
- Saved in the browser with `localStorage`, so it survives page reloads and
  restarts but lives only in that browser on that computer.
- The last name typed is remembered and filled in next time.
- A "Clear scores" button on the start screen, with a confirm step.

## Tech

- Plain HTML, CSS and JavaScript. No frameworks, no build step, no installs.
- Drawn with an HTML `<canvas>`.
- Run it with `python3 -m http.server 8000` from the repo root and open
  http://localhost:8000.
- Works with a mouse and with touch (phones and tablets).
- Planned layout:

```
index.html
src/
  main.js         start screen, game loop, screens
  config.js       timing and scene settings
  leaderboard.js  load and save scores
style.css
assets/
  characters/cartoon/   existing character art
  scene/                background, table, stools, napkin
```

- Source photos never go in the repo (already covered by `.gitignore`).

## Milestones

### Milestone 1: Playable round

The core loop works end to end, with placeholder art where needed.

- `index.html` loads and shows the scene: background, hightop table, Bryan
  and Jane on stools.
- The napkin appears and disappears on Bryan's lap with the timing above.
- Clicking the napkin scores a point, and a miss costs one. Score and a 30
  second timer are shown.
- When time runs out, the round stops and the final score is shown with a
  "Play again" button.

**Done when:** you can play a full 30 second round in the browser and the
score is right.

### Milestone 2: Scores and leaderboard

- Start screen with title, leaderboard and "Play".
- 3-2-1 countdown before each round.
- Game over screen with name entry when the score makes the top 10.
- Leaderboard saved in `localStorage`, shown on the start and game over
  screens, with "Clear scores".

**Done when:** scores from several rounds show up in the right order and are
still there after reloading the page.

### Milestone 3: Polish

- Final scene art: background, table, stools and napkin in the cartoon style.
- Napkin animations: slides or pops up onto the lap, and flies away when
  grabbed.
- When you don't grab the napkin in time, Jane reaches over and snatches it
  with a smug look.
- Feedback: a "+1" pop when you score, and a small reaction from Bryan or Jane.
- Sound effects (pop, grab, end buzzer) with a mute button.
- Works well on a phone: touch, layout scaling, no page scrolling.
- A "New high score!" moment on the game over screen.

**Done when:** it looks and sounds finished, and plays well on a laptop and a
phone.

## Open questions

These are the defaults I picked. Each is easy to change.

1. **Napkin behavior.** Decided: when you don't grab the napkin in time,
   Jane reaches over and snatches it first, with a smug look. Until the
   animation is built in milestone 3, the napkin just disappears.
2. **Misses.** Decided: a wrong click costs 1 point, and the score never
   drops below 0.
3. **One spot or several.** Classic whack-a-mole has several holes. Here
   there's one spot, Bryan's lap. Later, the napkin could also show up on
   Jane's lap or on the table, or a decoy (a fork, a phone) could appear that
   costs a point if clicked.
4. **Leaderboard location.** Decided: saved in the browser (`localStorage`),
   so each device has its own list. A shared online board could come later.
5. **Names.** Decided: free text up to 12 characters.
6. **Speed-up.** Decided: every round speeds up from easy to fast, with no
   difficulty levels, so there's one fair leaderboard.
7. **Bodies.** Generic cartoon bodies under the real heads (decided). Should
   the bodies move at all, like Bryan reaching for the napkin, or stay still?
8. **Hosting.** Just run locally for now, or put it online later (for
   example GitHub Pages) so others can play?
