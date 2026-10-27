// Sound effects, made on the fly with the Web Audio API, so there are no
// sound files to load. Muting is remembered in localStorage.

import { STORAGE_KEYS } from "./config.js";

let ac = null; // created on the first click, since browsers block sound before that
let out = null;
let muted = false;
try {
  muted = localStorage.getItem(STORAGE_KEYS.muted) === "1";
} catch {
  // storage blocked: start unmuted and don't remember
}

export const isMuted = () => muted;

export function setMuted(on) {
  muted = on;
  try {
    localStorage.setItem(STORAGE_KEYS.muted, on ? "1" : "0");
  } catch {
    // fine, it just won't be remembered
  }
}

// Call from a click or tap so the browser lets sound play.
export function unlock() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      out = ac.createGain();
      out.gain.value = 0.5;
      out.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
  } catch {
    ac = null; // no Web Audio: play silently
  }
}

const ready = () => ac && !muted && ac.state === "running";

// One note: a pitch slide from `from` to `to` Hz with a quick attack and
// a fade out. `at` is seconds from now.
function tone({ type = "sine", from, to = from, dur, gain = 0.3, at = 0 }) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// A burst of filtered noise sweeping from `from` to `to` Hz: a whoosh.
function whoosh({ from, to, dur, gain = 0.3, at = 0 }) {
  const t = ac.currentTime + at;
  const len = Math.ceil(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(t);
}

export const sfx = {
  // Something pops up on Bryan's lap.
  pop() {
    if (!ready()) return;
    tone({ from: 420, to: 900, dur: 0.08, gain: 0.18 });
  },
  // You grabbed the napkin.
  grab() {
    if (!ready()) return;
    whoosh({ from: 600, to: 3000, dur: 0.22, gain: 0.35 });
    tone({ type: "triangle", from: 988, dur: 0.12, gain: 0.25 });
    tone({ type: "triangle", from: 1319, dur: 0.18, gain: 0.25, at: 0.07 });
  },
  // A click on nothing, or on a fork or phone.
  miss() {
    if (!ready()) return;
    tone({ type: "square", from: 200, to: 110, dur: 0.16, gain: 0.12 });
  },
  // Jane takes it: a swipe and a little "heh heh".
  snatch() {
    if (!ready()) return;
    whoosh({ from: 2500, to: 500, dur: 0.2, gain: 0.25 });
    tone({ type: "triangle", from: 660, to: 600, dur: 0.09, gain: 0.18, at: 0.22 });
    tone({ type: "triangle", from: 560, to: 500, dur: 0.12, gain: 0.18, at: 0.34 });
  },
  // 3, 2, 1 ...
  tick() {
    if (!ready()) return;
    tone({ from: 660, dur: 0.12, gain: 0.2 });
  },
  // ... go!
  go() {
    if (!ready()) return;
    tone({ from: 1320, dur: 0.25, gain: 0.22 });
  },
  // Time's up.
  buzzer() {
    if (!ready()) return;
    tone({ type: "sawtooth", from: 150, to: 140, dur: 0.7, gain: 0.16 });
    tone({ type: "sawtooth", from: 156, to: 146, dur: 0.7, gain: 0.16 });
  },
  // New high score.
  fanfare() {
    if (!ready()) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ type: "triangle", from: f, dur: i === 3 ? 0.5 : 0.14, gain: 0.25, at: i * 0.12 })
    );
  },
};
