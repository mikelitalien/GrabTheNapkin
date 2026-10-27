// Confetti for a new high score, on its own canvas over the whole window
// (above the game over screen), so it doesn't get dimmed by the overlay.

import { CONFETTI } from "./config.js";

const COLOURS = ["#f1c40f", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6", "#ffffff"];

export class Confetti {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.bits = [];
    this.until = 0;
  }

  start(now) {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.h = h;
    const size = Math.max(6, Math.min(w, h) / 60);
    this.bits = Array.from({ length: CONFETTI.count }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h * 0.6 - 20,
      vx: (Math.random() - 0.5) * w * 0.15,
      vy: h * (0.25 + Math.random() * 0.25),
      spin: (Math.random() - 0.5) * 12,
      w: size * (0.8 + Math.random() * 0.6),
      h: size * 0.5,
      colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
    }));
    this.started = now;
    this.until = now + CONFETTI.seconds;
    this.canvas.hidden = false;
  }

  stop() {
    this.bits = [];
    this.until = 0;
    this.canvas.hidden = true;
  }

  draw(now) {
    if (!this.bits.length) return;
    if (now > this.until) return this.stop();
    const { ctx } = this;
    const t = now - this.started;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = Math.min(1, (this.until - now) / 0.6);
    for (const b of this.bits) {
      const x = b.x + b.vx * t + Math.sin(t * 3 + b.spin) * 12;
      const y = b.y + b.vy * t;
      if (y > this.h + 20) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(b.spin * t);
      ctx.scale(1, Math.cos(t * 6 + b.spin)); // tumbling
      ctx.fillStyle = b.colour;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
  }
}
