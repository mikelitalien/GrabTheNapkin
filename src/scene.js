// Draws the bar, Bryan and Jane, the napkin and all the little animations:
// breathing and swaying, the napkin popping up and flying off, Bryan's
// flinch, Jane reaching over to snatch a napkin you missed, and the "+1"
// and "-1" pops. Everything is timed in real seconds (performance.now), so
// animations carry on smoothly between screens.

import { ANIM, MISS_FLASH, SCORE_FLASH, JANE_LINES } from "./config.js";

const INK = "#22181e";

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpPt = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
// Overshoots a little, then settles: a springy pop.
const easeOutBack = (t) => 1 + 2.9 * (t - 1) ** 3 + 1.9 * (t - 1) ** 2;

export class Scene {
  constructor(ctx, anchors, images) {
    this.ctx = ctx;
    this.anchors = anchors;
    this.images = images;
    this.rig = anchors.rig;
    this.reset();
  }

  // Forget everything left over from the last round.
  reset() {
    this.flyers = []; // grabbed napkins flying off to the score { rect, at }
    this.vanishing = []; // decoys shrinking away { rect, at }
    this.texts = []; // "+1" and "-1" pops { text, colour, x, y, at, dur }
    this.flinchAt = -Infinity;
    this.arm = null; // Jane's reaching arm, see updateArm()
    this.bubble = null; // Jane's speech bubble { text, at }
    this.lastLine = "";
  }

  // --- things that happen ------------------------------------------------

  grabbed(rect, now) {
    this.flyers.push({ rect, at: now });
    const c = center(rect);
    this.texts.push({ text: "+1", colour: "#1e9e4a", x: c.x, y: rect.y - 8, at: now, dur: SCORE_FLASH });
    this.flinchAt = now;
    // Jane was on her way over: she pulls back empty-handed.
    if (this.arm && this.arm.mode === "reach") this.moveArm("down", now, this.rig.jane.hand, ANIM.armDown, false);
  }

  missed(x, y, now) {
    this.texts.push({ text: "-1", colour: "#d62c1f", x, y, at: now, dur: MISS_FLASH });
  }

  // A decoy that was clicked, or that timed out, shrinks away.
  vanished(rect, now) {
    this.vanishing.push({ rect, at: now });
  }

  // The napkin timed out. Jane's hand is on it, so she pulls it back.
  snatched(rect, now) {
    this.arm = {
      mode: "back", from: center(rect), to: this.gloatPoint(), at: now, dur: ANIM.pullBack, holding: true,
    };
    const lines = JANE_LINES.filter((l) => l !== this.lastLine);
    this.lastLine = lines[Math.floor(Math.random() * lines.length)];
    this.bubble = { text: this.lastLine, at: now };
  }

  // How much the score should swell right now, as a scale, when a grabbed
  // napkin lands on it.
  scorePulse(now) {
    let k = 0;
    for (const f of this.flyers) {
      const since = now - (f.at + ANIM.flyAway);
      if (since > -0.05 && since < 0.25) k = Math.max(k, 1 - Math.abs(since - 0.05) / 0.2);
    }
    return 1 + 0.25 * clamp01(k);
  }

  // --- Jane's arm ----------------------------------------------------------

  // Where she waves a snatched napkin: up by her face, on Bryan's side.
  gloatPoint() {
    const { shoulder } = this.rig.jane;
    return { x: shoulder.x - 32, y: shoulder.y - 52 };
  }

  moveArm(mode, now, to, dur, holding) {
    this.arm = { mode, from: this.handPos(now), to, at: now, dur, holding };
  }

  handPos(now) {
    const a = this.arm;
    if (!a) return this.rig.jane.hand;
    const p = clamp01((now - a.at) / a.dur);
    const pos = lerpPt(a.from, a.to, a.mode === "reach" ? easeOut(p) : easeInOut(p));
    if (a.mode === "gloat") {
      pos.x += 5 * Math.sin((now - a.at) * 16);
      pos.y += 3 * Math.sin((now - a.at) * 32);
    }
    return pos;
  }

  // Start a reach when a napkin is about to time out, and move the arm on
  // from one step to the next: reach, pull back, gloat, arm down.
  updateArm(now, round, roundStart) {
    const pop = round && !round.over ? round.popup : null;
    if (pop && pop.kind === "napkin") {
      const hideAt = roundStart + pop.hideAt;
      const reaching = this.arm && this.arm.mode === "reach" && this.arm.popup === pop;
      if (!reaching && now >= hideAt - ANIM.reach) {
        // Her hand lands on the napkin just as it times out.
        this.moveArm("reach", now, center(round.popupRect()), Math.max(hideAt - now, 0.05), false);
        this.arm.popup = pop;
      }
    }
    const a = this.arm;
    if (!a) return;
    if (a.mode === "reach" && a.popup !== pop) {
      // The napkin went without a snatch or a grab (a new round, say).
      this.moveArm("down", now, this.rig.jane.hand, ANIM.armDown, false);
      return;
    }
    const end = a.at + a.dur;
    if (now < end || a.mode === "reach") return;
    if (a.mode === "back") {
      this.arm = { mode: "gloat", from: a.to, to: a.to, at: end, dur: ANIM.gloat, holding: true };
    } else if (a.mode === "gloat") {
      this.arm = { mode: "down", from: a.to, to: this.rig.jane.hand, at: end, dur: ANIM.armDown, holding: true };
    } else {
      this.arm = null;
    }
  }

  // --- bodies --------------------------------------------------------------

  // Breathing, swaying, Bryan's flinch and Jane's lean, as a transform
  // around the middle of the seat.
  bodyMatrix(who, now) {
    const { pivot } = this.rig[who];
    const phase = who === "jane" ? 1.7 : 0;
    const breath = (Math.sin((2 * Math.PI * now) / ANIM.breathe + phase) + 1) / 2;
    let sy = 1 + ANIM.breatheDepth * breath;
    let deg = ANIM.sway * Math.sin((2 * Math.PI * now) / ANIM.swayPeriod + phase * 2);
    let dy = 0;
    if (who === "bryan") {
      const k = 1 - (now - this.flinchAt) / ANIM.flinch;
      if (k > 0) {
        const e = k * k;
        dy -= 12 * e;
        sy += 0.03 * e;
        deg += 5 * e * Math.sin((now - this.flinchAt) * 40);
      }
    } else if (this.arm) {
      // Lean toward Bryan as the hand goes over, and lean back to gloat.
      const hand = this.handPos(now);
      const rest = this.rig.jane.hand;
      deg -= 7 * clamp01((rest.x - hand.x) / 290);
      if (this.arm.mode === "gloat") deg += 3 * Math.sin(clamp01((now - this.arm.at) / 0.2) * Math.PI / 2);
    }
    return new DOMMatrix()
      .translate(pivot.x, pivot.y + dy)
      .rotate(deg)
      .scale(1, sy)
      .translate(-pivot.x, -pivot.y);
  }

  drawLayer(name, at, matrix) {
    const { ctx } = this;
    const { x, y } = this.anchors.layers[at];
    if (!matrix) return ctx.drawImage(this.images[name], x, y);
    ctx.save();
    ctx.setTransform(ctx.getTransform().multiply(matrix));
    ctx.drawImage(this.images[name], x, y);
    ctx.restore();
  }

  drawArm(now, matrix) {
    const { ctx } = this;
    const j = this.rig.jane;
    const s = matrix.transformPoint(new DOMPoint(j.shoulder.x, j.shoulder.y));
    const h = this.handPos(now);
    const dx = h.x - s.x;
    const dy = h.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    // Bow the arm out a little to the side, like a bent elbow. At rest that
    // bulges outward; reaching over the table it arcs upward.
    const bend = 26;
    const c = { x: (s.x + h.x) / 2 - (dy / len) * bend, y: (s.y + h.y) / 2 + (dx / len) * bend };

    ctx.save();
    ctx.lineCap = "round";
    for (const [width, colour] of [[j.arm + 2 * j.outline, INK], [j.arm - 2 * j.line, j.skin]]) {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(c.x, c.y, h.x, h.y);
      ctx.lineWidth = width;
      ctx.strokeStyle = colour;
      ctx.stroke();
    }

    const a = this.arm;
    if (a && a.holding) {
      const nap = this.images.napkin;
      ctx.save();
      ctx.translate(h.x, h.y - 6);
      if (a.mode === "gloat") ctx.rotate(0.25 * Math.sin((now - a.at) * 16));
      if (a.mode === "down") ctx.globalAlpha = 1 - clamp01((now - a.at) / a.dur);
      ctx.drawImage(nap, -nap.width / 2, -nap.height / 2);
      ctx.restore();
    }

    for (const [r, colour] of [[j.handR + j.outline, INK], [j.handR - j.line, j.skin]]) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
    }
    ctx.restore();
  }

  // --- the napkin and decoys ----------------------------------------------

  // What's on Bryan's lap, springing up as it appears.
  drawPopup(now, round, roundStart) {
    const r = round && round.popupRect();
    if (!r) return;
    const p = clamp01((now - (roundStart + round.popup.shownAt)) / ANIM.popIn);
    const s = easeOutBack(p);
    if (s <= 0) return;
    const img = this.images[r.kind];
    const cx = r.x + r.w / 2;
    const bottom = r.y + r.h;
    this.ctx.drawImage(img, cx - (r.w * s) / 2, bottom - r.h * s, r.w * s, r.h * s);
  }

  drawVanishing(now) {
    const { ctx } = this;
    this.vanishing = this.vanishing.filter((v) => now - v.at < ANIM.popOut);
    for (const v of this.vanishing) {
      const s = 1 - easeIn((now - v.at) / ANIM.popOut);
      const c = center(v.rect);
      ctx.drawImage(this.images[v.rect.kind], c.x - (v.rect.w * s) / 2, c.y - (v.rect.h * s) / 2, v.rect.w * s, v.rect.h * s);
    }
  }

  // Grabbed napkins fly up in an arc and land on the score, spinning.
  drawFlyers(now) {
    const { ctx } = this;
    const target = { x: 110, y: 40 };
    this.flyers = this.flyers.filter((f) => now - f.at < ANIM.flyAway + 0.3);
    for (const f of this.flyers) {
      const k = (now - f.at) / ANIM.flyAway;
      if (k >= 1) continue;
      const pos = lerpPt(center(f.rect), target, easeIn(k));
      pos.y -= 120 * Math.sin(Math.PI * k);
      const s = 1 - 0.5 * k;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(k * Math.PI * 3);
      ctx.globalAlpha = 1 - 0.6 * k;
      ctx.drawImage(this.images.napkin, (-f.rect.w * s) / 2, (-f.rect.h * s) / 2, f.rect.w * s, f.rect.h * s);
      ctx.restore();
    }
  }

  drawTexts(now) {
    const { ctx } = this;
    this.texts = this.texts.filter((m) => now - m.at < m.dur);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "white";
    for (const m of this.texts) {
      const k = (now - m.at) / m.dur;
      const size = 34 * (0.6 + 0.4 * easeOutBack(clamp01(k * 5)));
      ctx.font = `bold ${Math.round(size)}px system-ui, sans-serif`;
      ctx.globalAlpha = 1 - easeIn(k);
      ctx.fillStyle = m.colour;
      ctx.strokeText(m.text, m.x, m.y - 34 * k);
      ctx.fillText(m.text, m.x, m.y - 34 * k);
    }
    ctx.restore();
  }

  // Jane's speech bubble, next to her head.
  drawBubble(now) {
    const b = this.bubble;
    if (!b) return;
    const age = now - b.at;
    if (age > ANIM.bubble) {
      this.bubble = null;
      return;
    }
    const { ctx } = this;
    const s = easeOutBack(clamp01(age / 0.18));
    const tail = { x: 700, y: 200 }; // by Jane's cheek, toward the empty wall
    ctx.save();
    ctx.globalAlpha = 1 - clamp01((age - (ANIM.bubble - 0.2)) / 0.2);
    ctx.translate(tail.x, tail.y);
    ctx.scale(s, s);
    ctx.font = "bold 26px system-ui, sans-serif";
    const w = ctx.measureText(b.text).width + 32;
    const h = 46;
    const x = 14;
    const y = -h - 30;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.moveTo(x + 18, y + h - 1);
    ctx.lineTo(0, 0);
    ctx.lineTo(x + 40, y + h - 1);
    ctx.fillStyle = "white";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textBaseline = "middle";
    ctx.fillText(b.text, x + 16, y + h / 2 + 1);
    ctx.restore();
  }

  // --- the whole scene ------------------------------------------------------

  draw(now, round, roundStart) {
    this.updateArm(now, round, roundStart);
    const { ctx } = this;
    ctx.drawImage(this.images.background, 0, 0);
    this.drawLayer("bryan_stool", "bryan");
    this.drawLayer("bryan_upper", "bryan", this.bodyMatrix("bryan", now));
    this.drawPopup(now, round, roundStart);
    this.drawVanishing(now);
    this.drawLayer("table", "table");
    this.drawLayer("jane_stool", "jane");
    const jane = this.bodyMatrix("jane", now);
    if (this.arm) {
      this.drawLayer("jane_reach", "jane", jane);
      this.drawArm(now, jane);
    } else {
      this.drawLayer("jane_upper", "jane", jane);
    }
    this.drawFlyers(now);
    this.drawTexts(now);
    this.drawBubble(now);
  }
}
