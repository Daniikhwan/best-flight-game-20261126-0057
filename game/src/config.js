// Sky Ranger — tuning, colours and mission data.
// One file, one job: every number the game balances lives here.

export const VIEW = {
  width: 1280,
  height: 720,
  horizonY: 300, // screen y of the horizon line
  focal: 640, // perspective focal length in pixels (wide field of view)
  farDistance: 900, // how far ahead the world is drawn
  groundStep: 14, // world units between terrain strips
};

export const PLANE = {
  minSpeed: 28,
  maxSpeed: 132,
  cruiseSpeed: 78,
  accel: 26, // speed units gained per second at full throttle
  drag: 0.55, // how fast speed bleeds toward its target
  climbRate: 26, // altitude units per second at full pitch
  sinkRate: 18,
  bankRate: 2.4, // radians per second of banking
  maxBank: 0.9,
  lateralSpeed: 58, // world x units per second at full bank
  lateralLimit: 55, // valley half-width in world units
  stallSpeed: 46, // below this the nose drops
  fuelCapacity: 100,
  fuelBurnIdle: 0.35, // per second
  fuelBurnFull: 1.5, // per second at full throttle
  fuelPerRing: 9,
  maxDamage: 100,
  terrainHitDamage: 26,
  obstacleHitDamage: 32,
  ringRadius: 7.5,
  passWindow: 6, // world units of z tolerance for a ring pass
};

export const COLOURS = {
  skyDayTop: '#2f6fd0',
  skyDayMid: '#7fb2e8',
  skyDayHorizon: '#cfe6f7',
  skyDuskTop: '#3a2b5c',
  skyDuskMid: '#b35a6e',
  skyDuskHorizon: '#f2a35e',
  skyStormTop: '#232838',
  skyStormMid: '#4a5468',
  skyStormHorizon: '#8a7f74',
  sun: '#ffd94d',
  groundFieldA: '#5d9b4a',
  groundFieldB: '#6fae56',
  groundFieldC: '#87a94b',
  groundDry: '#b5a05e',
  river: '#3f8fd2',
  runway: '#5a5f66',
  runwayLine: '#f4f4f4',
  ringOuter: '#ffcf3d',
  ringInner: '#ff8c1a',
  ringGlow: 'rgba(255, 190, 40, 0.55)',
  hudGreen: '#7dff9a',
  hudAmber: '#ffc93d',
  hudRed: '#ff5a4e',
  hudPanel: 'rgba(8, 18, 32, 0.62)',
};

// Missions: three sorties, each a different valley with its own mood.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'MISSION 1 — RING RUN',
    subtitle: 'Green valleys · learn the sky',
    seed: 101,
    rings: 10,
    ringSpacing: 150,
    firstRingAt: 220,
    sky: 'day',
    wind: 0,
    obstacles: 0,
    fuelStart: 100,
    briefing:
      'Fly through all 10 golden rings. Green rings refill your tanks — watch the fuel gauge.',
  },
  {
    id: 'canyon-dash',
    name: 'MISSION 2 — CANYON DASH',
    subtitle: 'Rock walls · mind the peaks',
    seed: 207,
    rings: 12,
    ringSpacing: 135,
    firstRingAt: 200,
    sky: 'day',
    wind: 0.4,
    obstacles: 9,
    fuelStart: 100,
    briefing:
      'The canyon narrows and stone peaks guard the rings. Thread them — a scrape costs 32 damage.',
  },
  {
    id: 'storm-night',
    name: 'MISSION 3 — STORM NIGHT',
    subtitle: 'Dusk storm · fly by instruments',
    seed: 313,
    rings: 14,
    ringSpacing: 125,
    firstRingAt: 190,
    sky: 'storm',
    wind: 1.1,
    obstacles: 12,
    fuelStart: 100,
    briefing:
      'Lightning, gusts and a dying light. Trust your instruments, keep the throttle honest.',
  },
];

export const SCORE = {
  ringBase: 100,
  comboStep: 0.25,
  landingBonus: 500,
  levelTimeBonusPerSecond: 12,
  parTimeSeconds: 150,
};
