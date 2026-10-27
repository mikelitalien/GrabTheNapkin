// Loads the scene, runs the screens and the round, draws the score and
// countdown, and handles clicks. The scene itself is drawn by scene.js.

import { ANCHORS_URL, IMAGES, COUNTDOWN, NAME_MAX, HIT_PADDING, TOUCH_HIT_PADDING } from "./config.js";
import { Round } from "./round.js";
import { Scene } from "./scene.js";
import { Confetti } from "./confetti.js";
import { sfx, unlock, isMuted, setMuted } from "./sound.js";
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

const muteButton = $("mute");
const confetti = new Confetti($("fx"));

let anchors;
let scene;
let round = null;
let roundStart = 0; // when play begins; the countdown runs before it
let finished = true; // the round is over and the game over screen is up
let lastCount = 0; // the countdown number last shown, for its beep
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
  scene = new Scene(ctx, anchors, Object.fromEntries(entries));
  canvas.width = anchors.scene.w;
  canvas.height = anchors.scene.h;
}

const now = () => performance.now() / 1000;

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
  confetti.stop();
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
  if (round.snatched) bits.push(`Jane snatched ${round.snatched}`);
  $("over-text").textContent = `You scored ${s} ${s === 1 ? "point" : "points"}` +
    (bits.length ? ` (${bits.join(", ")}).` : ".");
  $("over-text").dataset.score = s;

  lastPlace = -1;
  const scores = board.loadScores();
  const qualifies = board.placeFor(s, scores) !== -1;
  // Beat the best score on the board (or set the first one).
  const best = qualifies && s > (scores.length ? scores[0].score : 0);
  $("new-high").hidden = !best;
  if (best) {
    confetti.start(now());
    setTimeout(sfx.fanfare, 700); // after the buzzer
  }
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
  unlock();
  confetti.stop();
  round = new Round(anchors.napkin.spots, anchors.napkin, anchors.decoys);
  roundStart = now() + COUNTDOWN;
  finished = false;
  lastCount = 0;
  scene.reset();
  show(null);
  window.game = round; // handy for poking at from the browser console
}

// Move the round on and turn what happened into animation and sound.
function play(n) {
  const t = n - roundStart;
  if (t < 0) {
    const count = Math.ceil(-t);
    if (count !== lastCount) sfx.tick();
    lastCount = count;
    return;
  }
  if (lastCount) sfx.go();
  lastCount = 0;
  round.update(t);
  for (const e of round.takeEvents()) {
    if (e.type === "show") sfx.pop();
    else if (e.type === "snatch") {
      scene.snatched(e.rect, n);
      sfx.snatch();
    } else if (e.type === "vanish") scene.vanished(e.rect, n);
  }
  if (round.over) {
    finished = true;
    sfx.buzzer();
    showGameOver();
  }
}

// Runs all the time, so Bryan and Jane keep breathing behind the screens.
function frame() {
  const n = now();
  if (round && !finished) play(n);
  scene.draw(n, round, roundStart);
  drawHud(n);
  drawCountdown(n - roundStart);
  confetti.draw(n);
  requestAnimationFrame(frame);
}

// --- drawing -------------------------------------------------------------

function outlinedText(text, x, y) {
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawHud(n) {
  const t = n - roundStart;
  ctx.save();
  ctx.font = "bold 30px system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillStyle = "#22181e";
  ctx.textAlign = "left";
  // The score swells when a grabbed napkin lands on it.
  const pulse = scene.scorePulse(n);
  ctx.save();
  ctx.translate(24, 36);
  ctx.scale(pulse, pulse);
  outlinedText(`Score: ${round ? round.score : 0}`, 0, -16);
  ctx.restore();
  const left = round ? Math.ceil(round.timeLeft(Math.max(t, 0))) : 30;
  ctx.textAlign = "right";
  if (round && !round.over && left <= 5) ctx.fillStyle = "#c0392b";
  outlinedText(`Time: ${left}`, anchors.scene.w - 24, 20);
  ctx.restore();
}

// Big 3, 2, 1 in the middle of the scene, each one shrinking as it goes.
function drawCountdown(t) {
  if (t >= 0 || finished) return;
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
  unlock();
  const n = now();
  const t = n - roundStart;
  if (t < 0) return; // still counting down
  const { x, y } = toScene(e);
  const pad = e.pointerType === "touch" ? TOUCH_HIT_PADDING : HIT_PADDING;
  const result = round.click(x, y, t, pad);
  if (result === "grab") {
    scene.grabbed(round.lastHit, n);
    sfx.grab();
  } else if (result === "decoy" || result === "miss") {
    if (result === "decoy") scene.vanished(round.lastHit, n);
    scene.missed(x, y, n);
    sfx.miss();
  }
});

function renderMute() {
  const on = isMuted();
  muteButton.classList.toggle("muted", on);
  muteButton.setAttribute("aria-pressed", String(on));
  muteButton.title = on ? "Sound off (M)" : "Sound on (M)";
}

function toggleMute() {
  unlock();
  setMuted(!isMuted());
  renderMute();
}

muteButton.addEventListener("click", toggleMute);
document.addEventListener("keydown", (e) => {
  if ((e.key === "m" || e.key === "M") && e.target !== nameInput && !e.repeat) toggleMute();
});
renderMute();

playButton.addEventListener("click", startRound);
$("again").addEventListener("click", startRound);
$("back").addEventListener("click", showStart);

renderBoards();
load().then(
  () => {
    requestAnimationFrame(frame);
    playButton.disabled = false;
    playButton.focus();
  },
  (err) => {
    startScreen.querySelector("h1").textContent = "Couldn't load the game";
    $("start-text").textContent = `${err.message}. Run it with "python3 -m http.server 8000" from the repo folder.`;
    playButton.hidden = true;
  }
);
