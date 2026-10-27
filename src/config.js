// Every tunable number for the game lives here.

export const ROUND_SECONDS = 30;

// The napkin speeds up in a straight line from START to END over the round.
export const TIMING = {
  start: { up: 1.2, gapMin: 0.4, gapMax: 1.5 },
  end: { up: 0.5, gapMin: 0.2, gapMax: 0.8 },
};

// About 1 in 5 pop-ups is a decoy instead of the napkin. Clicking one costs
// a point; leaving it alone is fine. Each decoy is equally likely.
export const DECOY_CHANCE = 0.2;
export const DECOYS = ["fork", "phone"];

// The 3-2-1 before each round, in seconds.
export const COUNTDOWN = 3;

// Wait this long after the round starts before the first napkin.
export const FIRST_GAP = 0.8;

// Extra pixels around the napkin that still count as a grab, so it's
// fair on touch screens. In scene pixels (the scene is 960 x 540).
export const HIT_PADDING = 14;

// How long the red "-1" stays up after a miss or a decoy click, in seconds.
export const MISS_FLASH = 0.6;

// Scene layout written by tools/make_characters.py.
export const ANCHORS_URL = "assets/characters/seated/anchors.json";

export const IMAGES = {
  bryan: "assets/characters/seated/bryan_game.png",
  table: "assets/characters/seated/table.png",
  jane: "assets/characters/seated/jane_game.png",
  napkin: "assets/characters/seated/napkin.png",
  fork: "assets/characters/seated/fork.png",
  phone: "assets/characters/seated/phone.png",
};

// Leaderboard, saved in this browser's localStorage.
export const LEADERBOARD_SIZE = 10;
export const NAME_MAX = 12;
export const STORAGE_KEYS = {
  scores: "grabthenapkin.scores",
  lastName: "grabthenapkin.lastName",
};
