// Loads the scene, runs the screens and the round, draws everything and
// handles clicks.

import { ANCHORS_URL, IMAGES, MISS_FLASH, COUNTDOWN, NAME_MAX } from "./config.js";
import { Round } from "./round.js";
import * as board from "./leaderboard.js";

const $ = (id) => document.getElementById(id);
const canvas = $("scene");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const startScreen = $("start-screen");
const overScreen = $("over-screen");
const playButton = $("play");
const nameForm = $("name-form");
const nameInput = $("name");

let anchors;
let images;
let round = null;
let roundStart = 0; // when play begins; the countdown runs before it
let misses = []; // { x, y, at } red "-1" pops, at = round time
let lastPlace = -1; // where the latest saved score landed, for highlighting

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
const roundTime = () => now() - roundStart; // negative during the countdown

// --- screens -------------------------------------------------------------

function show(screen) {
  overlay.hidden = !screen;
  startScreen.hidden = screen !== startScreen;
  overScreen.hidden = screen !== overScreen;
}

// Fill every leaderboard on the page from what's saved.
function renderBoards() {
  const scores = board.loadScores();
  document.querySelector(".clear").hidden = !scores.length;
  for (const el of document.querySelectorAll(".board")) {
    el.replaceChildren();
    if (!scores.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No scores yet. Be the first!";
      el.append(p);
      continue;
    }
    const table = document.createElement("table");
    scores.forEach((e, i) => {
      const tr = table.insertRow();
      if (i === lastPlace && el.closest("#over-screen")) tr.className = "new";
      for (const [cls, text] of [["rank", `${i + 1}.`], ["name", e.name], ["score", e.score], ["date", e.date]]) {
        const td = tr.insertCell();
        td.className = cls;
        td.textContent = text;
      }
    });
    el.append(table);
  }
}

function showStart() {
  lastPlace = -1;
  hideClearConfirm();
  renderBoards();
  show(startScreen);
  playButton.focus();
}

function showGameOver() {
  const s = round.score;
  const bits = [];
  if (round.misses) bits.push(`${round.misses} ${round.misses === 1 ? "miss" : "misses"}`);
  if (round.decoyClicks) bits.push(`${round.decoyClicks} ${round.decoyClicks === 1 ? "decoy" : "decoys"} grabbed`);
  $("over-text").textContent = `You scored ${s} ${s === 1 ? "point" : "points"}` +
    (bits.length ? ` (${bits.join(", ")}).` : ".");
  $("over-text").dataset.score = s;

  lastPlace = -1;
  const qualifies = board.placeFor(s) !== -1;
  nameForm.hidden = !qualifies;
  $("over-buttons").hidden = qualifies;
  renderBoards();
  show(overScreen);
  if (qualifies) {
    nameInput.value = board.lastName();
    nameInput.focus();
    nameInput.select();
  } else {
    $("again").focus();
  }
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = board.cleanName(nameInput.value);
  if (!name) return;
  board.rememberName(name);
  lastPlace = board.addScore(name, round.score).place;
  nameForm.hidden = true;
  $("over-buttons").hidden = false;
  renderBoards();
  $("again").focus();
});
nameInput.maxLength = NAME_MAX;
$("skip").addEventListener("click", () => {
  nameForm.hidden = true;
  $("over-buttons").hidden = false;
  $("again").focus();
});

function hideClearConfirm() {
  $("clear").hidden = false;
  $("clear-confirm").hidden = true;
}

$("clear").addEventListener("click", () => {
  $("clear").hidden = true;
  $("clear-confirm").hidden = false;
  $("clear-no").focus();
});
$("clear-no").addEventListener("click", hideClearConfirm);
$("clear-yes").addEventListener("click", () => {
  board.clearScores();
  hideClearConfirm();
  renderBoards();
});

// --- the round -------------------------------------------------------------

function startRound() {
  round = new Round(anchors.napkin.spots, anchors.napkin, anchors.decoys);
  roundStart = now() + COUNTDOWN;
  misses = [];
  show(null);
  window.game = round; // handy for poking at from the browser console
  requestAnimationFrame(frame);
}

function frame() {
  const t = roundTime();
  if (t >= 0) round.update(t);
  draw(t);
  if (round.over) showGameOver();
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

function outlinedText(text, x, y) {
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawHud(t) {
  ctx.save();
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillStyle = "#22181e";
  ctx.textAlign = "left";
  outlinedText(`Score: ${round ? round.score : 0}`, 24, 20);
  const left = round ? Math.ceil(round.timeLeft(Math.max(t, 0))) : 30;
  ctx.textAlign = "right";
  if (round && !round.over && left <= 5) ctx.fillStyle = "#c0392b";
  outlinedText(`Time: ${left}`, anchors.scene.w - 24, 20);
  ctx.restore();
}

// Big 3, 2, 1 in the middle of the scene, each one shrinking as it goes.
function drawCountdown(t) {
  if (t >= 0) return;
  const n = Math.ceil(-t);
  const k = n + t; // 1 down to 0 within each number
  ctx.save();
  ctx.fillStyle = "rgba(43, 31, 26, 0.35)";
  ctx.fillRect(0, 0, anchors.scene.w, anchors.scene.h);
  ctx.font = `bold ${Math.round(120 + 80 * k)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#22181e";
  ctx.fillStyle = "white";
  ctx.globalAlpha = 0.4 + 0.6 * k;
  outlinedText(String(n), anchors.scene.w / 2, anchors.scene.h / 2);
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
    outlinedText("-1", m.x, m.y - 30 * k);
  }
  ctx.restore();
}

function draw(t) {
  drawBackground();
  drawLayer("bryan");
  drawLayer("table");
  drawLayer("jane");
  const r = round && round.popupRect();
  if (r) ctx.drawImage(images[r.kind], r.x, r.y);
  drawMisses(t);
  drawHud(t);
  drawCountdown(t);
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
  const t = roundTime();
  if (t < 0) return; // still counting down
  const { x, y } = toScene(e);
  const result = round.click(x, y, t);
  if (result === "miss" || result === "decoy") misses.push({ x, y, at: t });
});

playButton.addEventListener("click", startRound);
$("again").addEventListener("click", startRound);
$("back").addEventListener("click", showStart);

renderBoards();
load().then(
  () => {
    draw(0);
    playButton.disabled = false;
    playButton.focus();
  },
  (err) => {
    startScreen.querySelector("h1").textContent = "Couldn't load the game";
    $("start-text").textContent = `${err.message}. Run it with "python3 -m http.server 8000" from the repo folder.`;
    playButton.hidden = true;
  }
);
