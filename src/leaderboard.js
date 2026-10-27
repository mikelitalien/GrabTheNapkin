// Load and save the top scores in this browser's localStorage.
// Entries are { name, score, date } with date as YYYY-MM-DD, highest first.
// Ties go to whoever got the score first, so a new score goes below equals.

import { LEADERBOARD_SIZE, NAME_MAX, STORAGE_KEYS } from "./config.js";

// localStorage can be missing or throw (private windows, blocked storage),
// so every read and write is guarded and the game still plays without it.
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function cleanName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
}

export function loadScores() {
  try {
    const list = JSON.parse(read(STORAGE_KEYS.scores));
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && Number.isFinite(e.score) && typeof e.name === "string")
      .slice(0, LEADERBOARD_SIZE);
  } catch {
    return [];
  }
}

// Where a score would land (0-based), or -1 if it doesn't make the board.
// A score of 0 never does.
export function placeFor(score, scores = loadScores()) {
  if (score <= 0) return -1;
  const i = scores.findIndex((e) => score > e.score);
  const at = i === -1 ? scores.length : i;
  return at < LEADERBOARD_SIZE ? at : -1;
}

// Save a score. Returns { place, scores } with place -1 if it didn't make it.
export function addScore(name, score, date = new Date()) {
  const scores = loadScores();
  const place = placeFor(score, scores);
  if (place === -1) return { place, scores };
  const entry = { name: cleanName(name) || "Anonymous", score, date: isoDate(date) };
  scores.splice(place, 0, entry);
  scores.length = Math.min(scores.length, LEADERBOARD_SIZE);
  write(STORAGE_KEYS.scores, JSON.stringify(scores));
  return { place, scores };
}

export function clearScores() {
  write(STORAGE_KEYS.scores, null);
}

export function lastName() {
  return cleanName(read(STORAGE_KEYS.lastName));
}

export function rememberName(name) {
  write(STORAGE_KEYS.lastName, cleanName(name));
}

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
