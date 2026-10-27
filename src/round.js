// One 30 second round: when the napkin shows, where, and the score.
// No drawing or DOM here, so the rules can be checked on their own.
// Times are in seconds since the round started.

import { ROUND_SECONDS, TIMING, FIRST_GAP, HIT_PADDING } from "./config.js";

const lerp = (a, b, t) => a + (b - a) * t;

export class Round {
  // spots: { name: { x, y } } top-left corners for the napkin.
  // size: { w, h } of the napkin. random: () => [0, 1), swappable for tests.
  constructor(spots, size, random = Math.random) {
    this.spots = spots;
    this.size = size;
    this.random = random;
    this.score = 0;
    this.grabs = 0;
    this.misses = 0;
    this.snatched = 0; // napkins nobody grabbed in time (Jane takes them)
    this.napkin = null; // { spot, shownAt, hideAt } while showing
    this.nextShowAt = FIRST_GAP;
    this.over = false;
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

  // Move the round forward to time t.
  // Loops so a long pause between frames (a background tab) still plays out
  // every napkin it skipped over, in order.
  update(t) {
    while (!this.over) {
      if (this.napkin && t >= this.napkin.hideAt) {
        this.snatched++;
        this.hide(this.napkin.hideAt);
      } else if (!this.napkin && this.nextShowAt >= ROUND_SECONDS) {
        if (t < ROUND_SECONDS) return;
        this.over = true;
      } else if (!this.napkin && t >= this.nextShowAt) {
        const shownAt = this.nextShowAt;
        const hideAt = Math.min(shownAt + this.upTime(shownAt), ROUND_SECONDS);
        this.napkin = { spot: this.pickSpot(), shownAt, hideAt };
      } else {
        return;
      }
    }
  }

  hide(t) {
    this.napkin = null;
    this.nextShowAt = t + this.gap(t);
  }

  // Napkin rectangle in scene pixels, or null when it isn't showing.
  napkinRect() {
    if (!this.napkin) return null;
    const { x, y } = this.spots[this.napkin.spot];
    return { x, y, w: this.size.w, h: this.size.h };
  }

  // A click or tap at scene point (x, y). Returns "grab", "miss" or null.
  click(x, y, t) {
    this.update(t);
    if (this.over) return null;
    const r = this.napkinRect();
    const p = HIT_PADDING;
    if (r && x >= r.x - p && x <= r.x + r.w + p && y >= r.y - p && y <= r.y + r.h + p) {
      this.score++;
      this.grabs++;
      this.hide(t);
      return "grab";
    }
    this.misses++;
    this.score = Math.max(this.score - 1, 0);
    return "miss";
  }
}
