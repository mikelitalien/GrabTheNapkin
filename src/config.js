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

// Extra pixels around the napkin that still count as a grab. In scene
// pixels (the scene is 960 x 540). Fingers get a bit more than a mouse.
export const HIT_PADDING = 14;
export const TOUCH_HIT_PADDING = 22;

// How long the red "-1" stays up after a miss or a decoy click, and the
// green "+1" after a grab, in seconds.
export const MISS_FLASH = 0.6;
export const SCORE_FLASH = 0.7;

// Animation timings, in seconds, and sizes.
export const ANIM = {
  popIn: 0.15, // napkin or decoy springing up onto the lap
  popOut: 0.12, // a decoy shrinking away
  flyAway: 0.6, // a grabbed napkin flying off
  reach: 0.28, // Jane's reach; her hand gets there just as the napkin times out
  pullBack: 0.25, // Jane pulling the napkin back to her face
  gloat: 0.9, // Jane waving it about
  armDown: 0.3, // Jane's arm going back to her lap
  bubble: 1.2, // how long Jane's speech bubble stays up
  flinch: 0.4, // Bryan jumping when you grab his napkin
  breathe: 3.4, // seconds per breath
  breatheDepth: 0.012, // how much the chest rises, as a share of height
  swayPeriod: 5.5, // seconds per sway, side to side and back
  sway: 1.2, // degrees either way
};

// What Jane says when she snatches a napkin. One at random.
export const JANE_LINES = ["Mine!", "Too slow!", "Thank you!", "Ha!", "Snooze, lose!"];

// Confetti for a new high score.
export const CONFETTI = { count: 140, seconds: 3.5 };

// Scene layout written by tools/make_characters.py.
export const ANCHORS_URL = "assets/characters/seated/anchors.json";

// Bodies are split from their stools so they can breathe and sway.
// jane_reach is Jane without the arm she reaches across with.
export const IMAGES = {
  background: "assets/scene/background.png",
  bryan_stool: "assets/characters/seated/bryan_stool.png",
  bryan_upper: "assets/characters/seated/bryan_upper.png",
  table: "assets/characters/seated/table.png",
  jane_stool: "assets/characters/seated/jane_stool.png",
  jane_upper: "assets/characters/seated/jane_upper.png",
  jane_reach: "assets/characters/seated/jane_reach.png",
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
  muted: "grabthenapkin.muted",
};
