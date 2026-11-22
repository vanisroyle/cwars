// Game data: building types, units, civilizations, spells, levels.
// Values follow the original Civilizations Wars (Flash) mechanics.

export const OWNER = { NEUTRAL: -1, PLAYER: 0 };

export const CIV_COLORS = [
  '#e8b428', // 0 player-ish gold
  '#c23a2a', // 1 red
  '#7a3ac2', // 2 purple
  '#2a8ac2', // 3 blue
];
export const NEUTRAL_COLOR = '#8a7a5e';

export const UNITS = {
  infantry: { name: 'Infantry',      atk: 1, speed: 46, radius: 3 },
  cavalry:  { name: 'Cavalry',       atk: 1, speed: 92, radius: 3 },
  heavy:    { name: 'Heavy Infantry',atk: 1, speed: 36, radius: 4, worth: 2 },
};

export const BUILDING_TYPES = {
  house1:  { kind: 'house',  level: 1, unit: 'infantry', def: 1, soft: 20,  hard: 30,  r: 20 },
  house2:  { kind: 'house',  level: 2, unit: 'infantry', def: 1, soft: 40,  hard: 60,  r: 24 },
  house3:  { kind: 'house',  level: 3, unit: 'infantry', def: 1, soft: 60,  hard: 90,  r: 28 },
  house4:  { kind: 'house',  level: 4, unit: 'infantry', def: 1, soft: 80,  hard: 120, r: 32 },
  house5:  { kind: 'house',  level: 5, unit: 'infantry', def: 1, soft: 100, hard: 150, r: 36 },
  shrine1: { kind: 'shrine', level: 1, unit: 'cavalry',  def: 1, soft: 20,  hard: 30,  r: 19 },
  shrine2: { kind: 'shrine', level: 2, unit: 'cavalry',  def: 1, soft: 40,  hard: 60,  r: 23 },
  shrine3: { kind: 'shrine', level: 3, unit: 'cavalry',  def: 1, soft: 60,  hard: 90,  r: 27 },
  tower1:  { kind: 'tower',  level: 1, unit: 'heavy',    def: 2, soft: 10,  hard: 15,  r: 18, range: 105, fireRate: 0.9 },
  tower2:  { kind: 'tower',  level: 2, unit: 'heavy',    def: 2, soft: 25,  hard: 37,  r: 22, range: 125, fireRate: 0.8 },
  tower3:  { kind: 'tower',  level: 3, unit: 'heavy',    def: 2, soft: 40,  hard: 60,  r: 26, range: 145, fireRate: 0.7 },
};

// Per-second population growth for houses: fraction of soft cap, scaled by civ agility.
export const HOUSE_REGEN = 0.028;
// Over-soft-cap decay per second.
export const OVERCAP_DECAY = 0.6;
// Crystals per second per population point in a shrine (scaled by crystal stat).
export const CRYSTAL_RATE = 0.045;
// Tower arrow damage per volley = this * garrison, capped.
export const TOWER_DAMAGE_PER_POP = 0.16;
export const TOWER_MAX_HIT = 12;

export const CIVS = {
  egypt: {
    id: 'egypt', name: 'Egyptians', color: '#e8b428',
    desc: 'Balanced in all things. Strong military, weakest magic.',
    stats: { attack: 1.15, defense: 1.1, agility: 1.0, speed: 1.0, crystalInit: 120, crystalMax: 500 },
  },
  rome: {
    id: 'rome', name: 'Romans', color: '#c23a2a',
    desc: 'Iron defense and a deep crystal pool. Slow to march.',
    stats: { attack: 1.0, defense: 1.3, agility: 0.9, speed: 0.8, crystalInit: 150, crystalMax: 800 },
  },
  china: {
    id: 'china', name: 'Chinese', color: '#2a9a4a',
    desc: 'Overwhelming speed and numbers, lighter on defense.',
    stats: { attack: 0.9, defense: 0.85, agility: 1.3, speed: 1.35, crystalInit: 130, crystalMax: 550 },
  },
};

// AI opponents borrow these palettes/stat tweaks.
export const AI_CIV_TINTS = ['#c23a2a', '#7a3ac2', '#2a8ac2', '#c2722a'];
export const AI_STATS = { attack: 1.0, defense: 1.0, agility: 1.0, speed: 1.0, crystalInit: 80, crystalMax: 700 };

// Spells — rank 1..7 scales power; cost is crystal energy.
export const SPELLS = {
  shield:    { name: 'Shield',    icon: '🛡', cost: 170,  cooldown: [5, 2],    target: 'building', desc: '+Defense on a building for 25s' },
  fireball:  { name: 'Fireball',  icon: '🔥', cost: 230,  cooldown: [6, 2],    target: 'point',    desc: 'Instant area damage' },
  support:   { name: 'Support',   icon: '🚩', cost: 450,  cooldown: [18, 6],   target: 'building', desc: 'Summon reinforcements' },
  lightning: { name: 'Lightning', icon: '⚡', cost: 520,  cooldown: [10, 4.5], target: 'point',    desc: 'Storm of bolts over an area' },
  twister:   { name: 'Twister',   icon: '🌪', cost: 530,  cooldown: [20, 6],   target: 'point',    desc: 'Tornado that sweeps up troops' },
  hypnoses:  { name: 'Hypnoses',  icon: '👁', cost: 550,  cooldown: [20, 7],   target: 'point',    desc: 'Convert enemies in an area' },
  meteorite: { name: 'Meteorite', icon: '☄', cost: 640,  cooldown: [12, 5],   target: 'point',    desc: 'Massive area damage' },
  swamp:     { name: 'Swamp',     icon: '🌿', cost: 670,  cooldown: [18, 7],   target: 'building', desc: 'Erodes a building, slows its troops' },
  golem:     { name: 'Golem',     icon: '🗿', cost: 750,  cooldown: [15, 5],   target: 'point',    desc: 'Summon a fighting golem' },
  quake:     { name: 'Quake',     icon: '🌋', cost: 1250, cooldown: [25, 9],   target: 'point',    desc: 'Devastating earthquake' },
};

export const SPELL_ORDER = ['shield', 'fireball', 'support', 'lightning', 'twister', 'hypnoses', 'meteorite', 'swamp', 'golem', 'quake'];

// Rank interpolation helpers: rank r in 1..7 between r1 and r7 values.
export function rankVal(r1, r7, rank) { return r1 + (r7 - r1) * (rank - 1) / 6; }
export function spellCooldown(key, rank) {
  const s = SPELLS[key];
  return rankVal(s.cooldown[0], s.cooldown[1], rank);
}

export const SPELL_POWER = {
  fireball:  { r: 60,  dmg: [12, 24], minPop: 1 },
  meteorite: { r: 90,  dmg: [15, 90], minPop: 1 },
  lightning: { r: 110, bolts: [28, 51], dmg: [1, 2], interval: 0.18, destroys: true },
  twister:   { r: 10,  pathR: 46, duration: 20, killsPerSec: 40 },
  support:   { units: [30, 120] },
  hypnoses:  { r: [46, 90] },
  shield:    { bonus: [0.10, 0.70], duration: 25 },
  swamp:     { r: 40, duration: 22, drainPerSec: 1.2, slow: 0.45 },
  golem:     { hp: [88, 136], dmg: [2, 3], speed: 40 },
  quake:     { r: 150, duration: [7, 10], dps: 12, slow: 0.4 },
};

// Upgradeable stats (index into civ.stats multipliers).
export const STAT_DEFS = [
  { key: 'attack',      name: 'Attack',          tip: 'Damage dealt by your units' },
  { key: 'defense',     name: 'Defense',         tip: 'Toughness of your buildings' },
  { key: 'agility',     name: 'Agility',         tip: 'Population growth rate' },
  { key: 'speed',       name: 'Speed',           tip: 'Unit march speed' },
  { key: 'crystalInit', name: 'Crystal Init',    tip: 'Crystals at battle start' },
  { key: 'crystalMax',  name: 'Crystals Amount', tip: 'Max crystals and gain rate' },
];
export const STAT_MAX = 7;
export const SPELL_MAX_RANK = 7;
export const UPGRADE_COST = rank => 40 + rank * 30; // cost to go from rank -> rank+1

// Stat bonus per upgrade rank (rank 0 = base civ value).
export const STAT_STEP = {
  attack: 0.08, defense: 0.08, agility: 0.10, speed: 0.07,
  crystalInit: 30, crystalMax: 70,
};

// ---------- Levels ----------
// b: [x, y, typeKey, ownerIndex, popOverride?]  owner -1 neutral, 0 player, 1+ ai
// Optional: boss: {x, y, hp, speed, radius, dmg}
export const LEVELS = [
  {
    name: 'First Steps', xp: 60,
    buildings: [
      [140, 300, 'house2', 0, 20],
      [480, 300, 'house1', -1, 5],
      [820, 300, 'house2', 1, 15],
      [310, 160, 'house1', -1, 5],
      [650, 440, 'house1', -1, 5],
    ],
  },
  {
    name: 'Crystal Dawn', xp: 80,
    buildings: [
      [140, 300, 'house2', 0, 25],
      [830, 300, 'house2', 1, 20],
      [480, 150, 'shrine1', -1, 5],
      [480, 450, 'shrine1', -1, 5],
      [480, 300, 'house1', -1, 5],
      [300, 300, 'house1', -1, 5],
      [660, 300, 'house1', -1, 5],
    ],
  },
  {
    name: 'Watchtowers', xp: 100,
    buildings: [
      [140, 300, 'house3', 0, 30],
      [840, 300, 'house2', 1, 25],
      [480, 300, 'tower1', -1, 10],
      [300, 150, 'house1', -1, 5],
      [660, 450, 'house1', -1, 5],
      [650, 160, 'shrine1', -1, 5],
      [330, 450, 'house2', -1, 10],
    ],
  },
  {
    name: 'Twin Rivers', xp: 120,
    buildings: [
      [130, 180, 'house2', 0, 25],
      [130, 420, 'shrine1', -1, 5],
      [480, 180, 'tower1', -1, 10],
      [480, 420, 'tower1', -1, 10],
      [830, 180, 'house2', 1, 25],
      [830, 420, 'shrine1', -1, 5],
      [480, 300, 'house2', -1, 15],
      [300, 300, 'house1', -1, 5],
      [660, 300, 'house1', -1, 5],
    ],
  },
  {
    name: 'Three Tribes', xp: 150,
    buildings: [
      [130, 480, 'house3', 0, 30],
      [830, 120, 'house2', 1, 25],
      [830, 480, 'house2', 2, 25],
      [480, 300, 'house3', -1, 30],
      [130, 120, 'shrine2', -1, 15],
      [480, 120, 'tower1', -1, 10],
      [480, 480, 'tower1', -1, 10],
      [300, 300, 'house1', -1, 5],
      [660, 300, 'house1', -1, 5],
    ],
  },
  {
    name: 'The Passage', xp: 180,
    buildings: [
      [130, 300, 'house3', 0, 40],
      [830, 300, 'house3', 1, 35],
      [480, 300, 'tower2', -1, 15],
      [480, 150, 'shrine2', -1, 15],
      [480, 450, 'shrine2', -1, 15],
      [300, 180, 'house2', -1, 20],
      [660, 180, 'house2', -1, 20],
      [300, 420, 'house2', -1, 20],
      [660, 420, 'house2', -1, 20],
    ],
  },
  {
    name: 'Desert Cross', xp: 210,
    buildings: [
      [130, 300, 'house4', 0, 45],
      [830, 300, 'house4', 1, 40],
      [480, 120, 'house2', -1, 20],
      [480, 480, 'house2', -1, 20],
      [480, 300, 'house3', -1, 40],
      [300, 300, 'tower1', -1, 10],
      [660, 300, 'tower1', -1, 10],
      [200, 120, 'shrine2', -1, 15],
      [760, 480, 'shrine2', -1, 15],
    ],
  },
  {
    name: 'Four Corners', xp: 250,
    buildings: [
      [130, 130, 'house3', 0, 40],
      [830, 130, 'house3', 1, 35],
      [130, 470, 'house3', 2, 35],
      [830, 470, 'house3', 1, 35],
      [480, 300, 'shrine3', -1, 25],
      [480, 130, 'tower2', -1, 15],
      [480, 470, 'tower2', -1, 15],
      [300, 300, 'house2', -1, 20],
      [660, 300, 'house2', -1, 20],
    ],
  },
  {
    name: 'Sacred Ground', xp: 300,
    buildings: [
      [130, 300, 'house4', 0, 50],
      [830, 300, 'house4', 1, 45],
      [480, 170, 'shrine3', -1, 25],
      [480, 430, 'shrine3', -1, 25],
      [300, 200, 'tower2', -1, 15],
      [660, 400, 'tower2', -1, 15],
      [660, 200, 'house3', -1, 40],
      [300, 400, 'house3', -1, 40],
      [480, 300, 'house2', -1, 20],
    ],
  },
  {
    name: 'Giant Turtle', xp: 400,
    boss: { x: 480, y: 300, hp: 900, speed: 26, radius: 30, dmg: 3 },
    buildings: [
      [130, 300, 'house4', 0, 50],
      [830, 140, 'house4', 1, 45],
      [830, 460, 'house4', 1, 45],
      [480, 150, 'shrine3', -1, 25],
      [480, 450, 'shrine3', -1, 25],
      [300, 200, 'tower2', -1, 15],
      [660, 200, 'tower2', -1, 15],
      [300, 450, 'house3', -1, 40],
      [660, 450, 'house3', -1, 40],
    ],
  },
];
