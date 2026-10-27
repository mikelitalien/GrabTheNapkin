// Loads the scene, runs the round, draws everything and handles clicks.

import { ANCHORS_URL, IMAGES, MISS_FLASH } from "./config.js";
import { Round } from "./round.js";

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const playButton = document.getElementById("play");

let anchors;
let images;
let round = null;
let roundStart = 0;
let misses = []; // { x, y, at } red "-1" pops, at = round time

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("couldn't load " + src));
    img.src = src;
  });
}

async function load() {
  anchors = await (await fetch(ANCHORS_URL)).json();
  const entries = await Promise.all(
    Object.entries(IMAGES).map(async ([name, src]) => [name, await loadImage(src)])
  );
  images = Object.fromEntries(entries);
  canvas.width = anchors.scene.w;
  canvas.height = anchors.scene.h;
}

const now = () => performance.now() / 1000;
const roundTime = () => now() - roundStart;

function startRound() {
  round = new Round(anchors.napkin.spots, anchors.napkin);
  roundStart = now();
  misses = [];
  overlay.hidden = true;
  window.game = round; // handy for poking at from the browser console
  requestAnimationFrame(frame);
}

function endRound() {
  const s = round.score;
  overlayTitle.textContent = "Time's up!";
  overlayText.textContent = `You grabbed the napkin ${s} ${s === 1 ? "time" : "times"}` +
    (round.misses ? ` (after ${round.misses} ${round.misses === 1 ? "miss" : "misses"}).` : ".");
  overlayText.dataset.score = s;
  playButton.textContent = "Play again";
  overlay.hidden = false;
  playButton.focus();
}

function frame() {
  const t = roundTime();
  round.update(t);
  draw(t);
  if (round.over) endRound();
  else requestAnimationFrame(frame);
}

// --- drawing -------------------------------------------------------------

// Placeholder bar: a wall, a wainscot rail and a floor. Final art is milestone 3.
function drawBackground() {
  const { w, h } = anchors.scene;
  ctx.fillStyle = "#efe4d4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c9a77c";
  ctx.fillRect(0, 300, w, 170);
  ctx.fillStyle = "#8a5a33";
  ctx.fillRect(0, 292, w, 10);
  ctx.fillStyle = "#6b4a33";
  ctx.fillRect(0, 470, w, h - 470);
  ctx.fillStyle = "#5a3d29";
  ctx.fillRect(0, 466, w, 6);
}

function drawLayer(name) {
  const { x, y } = anchors.layers[name];
  ctx.drawImage(images[name], x, y);
}

function drawHud(t) {
  ctx.save();
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillStyle = "#22181e";
  const score = `Score: ${round ? round.score : 0}`;
  ctx.textAlign = "left";
  ctx.strokeText(score, 24, 20);
  ctx.fillText(score, 24, 20);
  const left = round ? Math.ceil(round.timeLeft(t)) : 30;
  const time = `Time: ${left}`;
  ctx.textAlign = "right";
  if (round && !round.over && left <= 5) ctx.fillStyle = "#c0392b";
  ctx.strokeText(time, anchors.scene.w - 24, 20);
  ctx.fillText(time, anchors.scene.w - 24, 20);
  ctx.restore();
}

function drawMisses(t) {
  misses = misses.filter((m) => t - m.at < MISS_FLASH);
  ctx.save();
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "white";
  for (const m of misses) {
    const k = (t - m.at) / MISS_FLASH;
    ctx.globalAlpha = 1 - k;
    ctx.fillStyle = "#d62c1f";
    const y = m.y - 30 * k;
    ctx.strokeText("-1", m.x, y);
    ctx.fillText("-1", m.x, y);
  }
  ctx.restore();
}

function draw(t) {
  drawBackground();
  drawLayer("bryan");
  drawLayer("table");
  drawLayer("jane");
  const r = round && round.napkinRect();
  if (r) ctx.drawImage(images.napkin, r.x, r.y);
  drawMisses(t);
  drawHud(t);
}

// --- input ---------------------------------------------------------------

// Browser pixels to scene pixels, since the canvas is scaled to fit.
function toScene(e) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - box.left) / box.width) * canvas.width,
    y: ((e.clientY - box.top) / box.height) * canvas.height,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  if (!round || round.over) return;
  e.preventDefault();
  const { x, y } = toScene(e);
  const t = roundTime();
  if (round.click(x, y, t) === "miss") misses.push({ x, y, at: t });
});

playButton.addEventListener("click", startRound);

load().then(
  () => {
    draw(0);
    playButton.disabled = false;
  },
  (err) => {
    overlayTitle.textContent = "Couldn't load the game";
    overlayText.textContent = `${err.message}. Run it with "python3 -m http.server 8000" from the repo folder.`;
    playButton.hidden = true;
  }
);
