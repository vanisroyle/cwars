// App wiring: screens, save data, HUD, game loop.
import { CIVS, LEVELS, SPELLS, SPELL_ORDER, SPELL_POWER, STAT_DEFS, STAT_MAX, SPELL_MAX_RANK, UPGRADE_COST, rankVal } from './data.js';
import { Game, effectiveStats } from './engine.js';
import { render, resetTerrain } from './render.js';
import { Input } from './input.js';
import { preload, sfx, RACE_INDEX } from './assets.js';
import { DECOR } from './decor.js';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d');

// Scale the fixed 960x600 stage to fit any screen (mobile + desktop).
function fit() {
  const s = Math.min(window.innerWidth / 960, window.innerHeight / 600);
  document.getElementById('app').style.setProperty('--scale', Math.min(1, s));
}
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', fit);
fit();

// ---------- Save ----------
const SAVE_KEY = 'cwars_save_v1';
let save = loadSave();
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || freshSave(); }
  catch { return freshSave(); }
}
function freshSave() {
  return { civ: 'egypt', xp: 0, unlocked: 0, stars: {}, stats: {}, spells: {} };
}
function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }

// ---------- Screens ----------
const SCREENS = ['title', 'civ', 'levels', 'upgrades', 'help', 'result', 'pause'];
function show(name) {
  for (const s of SCREENS) $(`screen-${s}`).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', name !== null);
  if (name === null) $('hud').classList.remove('hidden');
}
function inGame() { return SCREENS.every(s => $(`screen-${s}`).classList.contains('hidden')); }

// ---------- Game state ----------
let game = null, input = null, armedSpell = null, lastT = 0, levelIndex = 0;

function playerStats() { return effectiveStats(CIVS[save.civ].stats, save.stats); }

function startLevel(idx) {
  levelIndex = idx;
  const lv = { ...LEVELS[idx], index: idx };
  const playerRace = RACE_INDEX[save.civ] || 1;
  const others = [1, 2, 3].filter(r => r !== playerRace);
  const raceOf = (o) => (o === 0 ? playerRace : (o <= 2 ? others[o - 1] : 4));
  game = new Game(lv, { ...CIVS[save.civ], stats: CIVS[save.civ].stats }, save.stats, save.spells, raceOf);
  window.__game = game; // debug/testing hook
  armedSpell = null;
  resetTerrain();
  sfx.music('bgMusic');
  if (!input) {
    input = new Input(canvas, game, (x, y) => {
      if (!armedSpell || !game) return;
      game.cast(0, armedSpell, x, y);
      disarmSpell();
      $('spell-info').classList.add('hidden');
    });
  } else {
    input.game = game;
    input.disarmSpell();
  }
  buildSpellbar();
  $('hud-level').textContent = LEVELS[idx].name;
  show(null);
}

// ---------- Spell bar ----------
function buildSpellbar() {
  const bar = $('spellbar');
  bar.innerHTML = '';
  for (const key of SPELL_ORDER) {
    const rank = save.spells[key] || 0;
    const s = SPELLS[key];
    const el = document.createElement('div');
    el.className = 'spell-slot' + (rank < 1 ? ' locked' : '');
    el.dataset.spell = key;
    el.innerHTML = `<img class="icon" src="assets/img/ui/${key}.png" draggable="false">`;
    el.title = `${s.name} — ${s.desc} (${s.cost} energy)`;
    el.addEventListener('mouseenter', () => {
      if (rank < 1 || !game) return;
      $('spell-info').textContent = `${s.name.toUpperCase()} (${rank}) ${s.cost}`;
      $('spell-info').classList.remove('hidden');
    });
    el.addEventListener('mouseleave', () => {
      if (armedSpell) return;
      $('spell-info').classList.add('hidden');
    });
    el.addEventListener('click', () => {
      if ((save.spells[key] || 0) < 1 || !game || game.over) return;
      if (armedSpell === key) { disarmSpell(); return; }
      const chk = game.canCast(0, key);
      if (!chk.ok) return;
      armedSpell = key;
      const P = SPELL_POWER[key];
      const r = key === 'hypnoses' ? rankVal(P.r[0], P.r[1], chk.rank) : (P.r || 40);
      input.armSpell(r);
      $('spell-info').textContent = `${s.name.toUpperCase()} (${chk.rank}) ${s.cost}`;
      $('spell-info').classList.remove('hidden');
      refreshSpellbar();
    });
    bar.appendChild(el);
  }
}

function disarmSpell() {
  armedSpell = null;
  input?.disarmSpell();
  $('spell-info').classList.add('hidden');
  refreshSpellbar();
}

function refreshSpellbar() {
  if (!game) return;
  const civ = game.civs[0];
  $('hud-crystals').textContent = `✦ ${Math.floor(civ.crystals)}`;
  if (armedSpell) {
    const s = SPELLS[armedSpell];
    const rank = save.spells[armedSpell] || 0;
    $('spell-info').textContent = `${s.name.toUpperCase()} (${rank}) ${s.cost}`;
  }
  for (const el of document.querySelectorAll('.spell-slot')) {
    const key = el.dataset.spell;
    const rank = save.spells[key] || 0;
    el.classList.toggle('selected', armedSpell === key);
    if (rank < 1) continue;
    const cd = Math.max(0, civ.cooldowns[key] || 0);
    el.classList.toggle('unaffordable', civ.crystals < SPELLS[key].cost || cd > 0);
    let cover = el.querySelector('.cool');
    if (cd > 0) {
      if (!cover) { cover = document.createElement('div'); cover.className = 'cool'; el.appendChild(cover); }
      cover.style.height = `${Math.min(100, cd / 8 * 100)}%`;
    } else if (cover) cover.remove();
  }
}

// ---------- Menus ----------
function showTitle() { show('title'); game = null; sfx.music('menuMusic'); }

function buildCivCards() {
  const wrap = $('civ-cards');
  wrap.innerHTML = '';
  for (const id in CIVS) {
    const c = CIVS[id];
    const st = c.stats;
    const el = document.createElement('div');
    el.className = 'civ-card';
    el.innerHTML = `<h3 style="color:${c.color}">${c.name}</h3><div class="civ-desc">${c.desc}</div>
      <ul>
        <li>Attack ×${st.attack}</li><li>Defense ×${st.defense}</li>
        <li>Speed ×${st.speed}</li><li>Growth ×${st.agility}</li>
        <li>Crystals ${st.crystalInit}/${st.crystalMax}</li>
      </ul>`;
    el.addEventListener('click', () => { save.civ = id; persist(); buildLevels(); show('levels'); });
    wrap.appendChild(el);
  }
}

function buildLevels() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const el = document.createElement('div');
    const locked = i > save.unlocked;
    el.className = 'level-cell' + (locked ? ' locked' : '');
    const stars = save.stars[i] || 0;
    el.innerHTML = `<div class="lv-num">${i + 1}</div><div class="lv-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</div><div class="lv-name">${locked ? 'Locked' : lv.name}</div>`;
    if (!locked) el.addEventListener('click', () => startLevel(i));
    grid.appendChild(el);
  });
  $('levels-title').textContent = `Campaign — ${CIVS[save.civ].name}`;
}

function buildUpgrades() {
  $('xp-balance').textContent = `— ${save.xp} XP`;
  const stats = $('stat-upgrades');
  stats.innerHTML = '';
  for (const def of STAT_DEFS) {
    const rank = save.stats[def.key] || 0;
    const cost = UPGRADE_COST(rank);
    const el = document.createElement('div');
    el.className = 'upg-row';
    el.innerHTML = `<span class="upg-name">${def.name}<span class="upg-tip">${def.tip}</span></span>
      <span class="upg-pips">${'●'.repeat(rank)}${'○'.repeat(STAT_MAX - rank)}</span>`;
    const btn = document.createElement('button');
    btn.textContent = rank >= STAT_MAX ? 'Max' : `+${cost}`;
    btn.disabled = rank >= STAT_MAX || save.xp < cost;
    btn.addEventListener('click', () => {
      save.xp -= cost;
      save.stats[def.key] = rank + 1;
      persist(); buildUpgrades();
    });
    el.appendChild(btn);
    stats.appendChild(el);
  }
  const sp = $('spell-upgrades');
  sp.innerHTML = '';
  for (const key of SPELL_ORDER) {
    const rank = save.spells[key] || 0;
    const cost = UPGRADE_COST(rank);
    const s = SPELLS[key];
    const el = document.createElement('div');
    el.className = 'upg-row';
    el.innerHTML = `<span class="upg-name">${s.icon} ${s.name}<span class="upg-tip">${s.desc} — ${s.cost} energy</span></span>
      <span class="upg-pips">${'●'.repeat(rank)}${'○'.repeat(SPELL_MAX_RANK - rank)}</span>`;
    const btn = document.createElement('button');
    btn.textContent = rank >= SPELL_MAX_RANK ? 'Max' : `+${cost}`;
    btn.disabled = rank >= SPELL_MAX_RANK || save.xp < cost;
    btn.addEventListener('click', () => {
      save.xp -= cost;
      save.spells[key] = rank + 1;
      persist(); buildUpgrades();
    });
    el.appendChild(btn);
    sp.appendChild(el);
  }
}

// ---------- Result ----------
function showResult(win) {
  sfx.play(win ? 'win' : 'lose', 0.7);
  const lv = LEVELS[levelIndex];
  $('result-title').textContent = win ? 'Victory!' : 'Defeat';
  if (win) {
    const timeBonus = Math.max(0, Math.round(120 - game.time));
    const xp = lv.xp + timeBonus;
    const stars = game.time < 90 ? 3 : game.time < 180 ? 2 : 1;
    save.xp += xp;
    save.stars[levelIndex] = Math.max(save.stars[levelIndex] || 0, stars);
    if (levelIndex === save.unlocked) save.unlocked = Math.min(LEVELS.length - 1, save.unlocked + 1);
    persist();
    $('result-detail').textContent = `+${xp} XP (including +${timeBonus} speed bonus). ${'★'.repeat(stars)}`;
    $('btn-result-next').textContent = levelIndex + 1 < LEVELS.length ? 'Next Level' : 'Campaign Complete';
    $('btn-result-next').disabled = false;
  } else {
    $('result-detail').textContent = 'Your civilization has fallen.';
    $('btn-result-next').textContent = 'Retry';
    $('btn-result-next').disabled = false;
  }
  show('result');
}

// ---------- Wire buttons ----------
$('btn-play').addEventListener('click', () => { buildCivCards(); show('civ'); });
$('btn-civ-back').addEventListener('click', showTitle);
$('btn-levels-back').addEventListener('click', showTitle);
$('btn-upgrades').addEventListener('click', () => { buildUpgrades(); show('upgrades'); });
$('btn-upg-back').addEventListener('click', () => { buildLevels(); show('levels'); });
$('btn-help').addEventListener('click', () => show('help'));
$('btn-help-back').addEventListener('click', showTitle);
$('btn-pause').addEventListener('click', () => show('pause'));
$('btn-resume').addEventListener('click', () => show(null));
$('btn-quit').addEventListener('click', () => { game = null; showTitle(); });
$('btn-result-next').addEventListener('click', () => {
  if (game.result === 'win' && levelIndex + 1 < LEVELS.length) startLevel(levelIndex + 1);
  else startLevel(levelIndex);
});
$('btn-result-retry').addEventListener('click', () => startLevel(levelIndex));
$('btn-result-menu').addEventListener('click', () => { game = null; showTitle(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && inGame()) disarmSpell(); });

// ---------- Main loop ----------
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (game && inGame() && !game.over) {
    game.update(dt);
    refreshSpellbar();
    if (game.over) showResult(game.result === 'win');
  }
  if (game) render(ctx, game, input || { mouse: { x: 0, y: 0 }, selected: new Set() });
  else { ctx.fillStyle = '#1a120b'; ctx.fillRect(0, 0, 960, 600); }
}

// Offline play: register the service worker (skipped for file:// previews).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Give the player a couple of starter spells so the mechanic is discoverable.
if (!save.spells.fireball) { save.spells.fireball = 1; save.spells.shield = 1; persist(); }

// Preload extracted sprites, then boot the menus.
const decorFiles = [];
for (const k in DECOR) for (const [cid] of DECOR[k]) decorFiles.push([cid, 'png']);
preload(decorFiles).then(() => { showTitle(); });
requestAnimationFrame(frame);
