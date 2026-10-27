// One 30 second round: when the napkin (or a decoy) shows, where, and the score.
// No drawing or DOM here, so the rules can be checked on their own.
// Times are in seconds since the round started.

import { ROUND_SECONDS, TIMING, FIRST_GAP, HIT_PADDING, DECOY_CHANCE, DECOYS } from "./config.js";

const lerp = (a, b, t) => a + (b - a) * t;

export class Round {
  // spots: { name: { x, y } } top-left corners for the napkin.
  // size: { w, h } of the napkin. decoys: { kind: { w, h } }, centred on the
  // same spots. random: () => [0, 1), swappable for tests.
  constructor(spots, size, decoys = {}, random = Math.random) {
    this.spots = spots;
    this.size = size;
    this.decoySizes = decoys;
    this.random = random;
    this.score = 0;
    this.grabs = 0;
    this.misses = 0; // clicks on nothing
    this.decoyClicks = 0; // clicks on a fork or phone
    this.snatched = 0; // napkins nobody grabbed in time (Jane takes them)
    this.popup = null; // { kind, spot, shownAt, hideAt } while showing
    this.nextShowAt = FIRST_GAP;
    this.over = false;
    // What happened since the last takeEvents(), for animation and sound:
    // { type: "show", kind, at } when something pops up, { type: "snatch",
    // rect, at } when a napkin times out (Jane takes it), and { type:
    // "vanish", rect, at } when a decoy times out.
    this.events = [];
  }

  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  // How far through the round we are, 0 to 1.
  progress(t) {
    return Math.min(Math.max(t / ROUND_SECONDS, 0), 1);
  }

  timeLeft(t) {
    return Math.max(ROUND_SECONDS - t, 0);
  }

  upTime(t) {
    return lerp(TIMING.start.up, TIMING.end.up, this.progress(t));
  }

  gap(t) {
    const p = this.progress(t);
    const min = lerp(TIMING.start.gapMin, TIMING.end.gapMin, p);
    const max = lerp(TIMING.start.gapMax, TIMING.end.gapMax, p);
    return lerp(min, max, this.random());
  }

  pickSpot() {
    const names = Object.keys(this.spots);
    return names[Math.floor(this.random() * names.length)];
  }

  // "napkin" most of the time, otherwise one of the decoys that has art.
  pickKind() {
    const kinds = DECOYS.filter((k) => this.decoySizes[k]);
    if (!kinds.length || this.random() >= DECOY_CHANCE) return "napkin";
    return kinds[Math.floor(this.random() * kinds.length)];
  }

  // Move the round forward to time t.
  // Loops so a long pause between frames (a background tab) still plays out
  // every pop-up it skipped over, in order.
  update(t) {
    while (!this.over) {
      if (this.popup && t >= this.popup.hideAt) {
        const rect = this.popupRect();
        if (rect.kind === "napkin") {
          this.snatched++;
          this.events.push({ type: "snatch", rect, at: this.popup.hideAt });
        } else {
          this.events.push({ type: "vanish", rect, at: this.popup.hideAt });
        }
        this.hide(this.popup.hideAt);
      } else if (!this.popup && this.nextShowAt >= ROUND_SECONDS) {
        if (t < ROUND_SECONDS) return;
        this.over = true;
      } else if (!this.popup && t >= this.nextShowAt) {
        const shownAt = this.nextShowAt;
        const hideAt = Math.min(shownAt + this.upTime(shownAt), ROUND_SECONDS);
        this.popup = { kind: this.pickKind(), spot: this.pickSpot(), shownAt, hideAt };
        this.events.push({ type: "show", kind: this.popup.kind, at: shownAt });
      } else {
        return;
      }
    }
  }

  hide(t) {
    this.popup = null;
    this.nextShowAt = t + this.gap(t);
  }

  // What's showing and where, in scene pixels, or null when nothing is.
  // Decoys are centred where the napkin would sit on that leg.
  popupRect() {
    if (!this.popup) return null;
    const { kind, spot } = this.popup;
    const { x, y } = this.spots[spot];
    if (kind === "napkin") return { kind, x, y, w: this.size.w, h: this.size.h };
    const { w, h } = this.decoySizes[kind];
    const cx = x + this.size.w / 2;
    const cy = y + this.size.h / 2;
    return { kind, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
  }

  // Just the napkin's rectangle, or null when it isn't the napkin showing.
  napkinRect() {
    const r = this.popupRect();
    return r && r.kind === "napkin" ? r : null;
  }

  // A click or tap at scene point (x, y). Returns "grab", "decoy", "miss" or
  // null, and leaves what was hit (if anything) in this.lastHit.
  // pad: extra pixels around the target that still count, more for touch.
  click(x, y, t, pad = HIT_PADDING) {
    this.update(t);
    this.lastHit = null;
    if (this.over) return null;
    const r = this.popupRect();
    const p = pad;
    const hit = r && x >= r.x - p && x <= r.x + r.w + p && y >= r.y - p && y <= r.y + r.h + p;
    if (hit) this.lastHit = r;
    if (hit && r.kind === "napkin") {
      this.score++;
      this.grabs++;
      this.hide(t);
      return "grab";
    }
    this.score = Math.max(this.score - 1, 0);
    if (hit) {
      this.decoyClicks++;
      this.hide(t);
      return "decoy";
    }
    this.misses++;
    return "miss";
  }
}
