// App wiring: screens, save data, HUD, game loop.
import { CIVS, LEVELS, SPELLS, SPELL_ORDER, SPELL_POWER, STAT_DEFS, STAT_MAX, SPELL_MAX_RANK, UPGRADE_COST, rankVal } from './data.js';
import { Game, effectiveStats } from './engine.js';
import { render, resetTerrain } from './render.js';
import { Input } from './input.js';
import { preload, sfx, RACE_INDEX } from './assets.js';
import { DECOR } from './decor.js';
import { TUT } from './tutorial.js';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d');

// Scale the fixed 960x600 stage to fit any screen (mobile + desktop).
function fit() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(vw / 960, vh / 600);
  document.getElementById('app').style.setProperty('--scale', Math.min(2, s));
  // Landscape game on a portrait phone: nudge the player to rotate.
  const portrait = vh > vw;
  const hint = $('rotate-hint');
  if (hint) hint.classList.toggle('hidden', !portrait);
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

window.addEventListener('error', (e) => {
  try { localStorage.setItem('cwars_last_error', String(e.message || e.error)); } catch (_) {}
});

function startLevel(idx) {
  levelIndex = idx;
  const lv = { ...LEVELS[idx], index: idx };
  const playerRace = RACE_INDEX[save.civ] || 1;
  const others = [1, 2, 3].filter(r => r !== playerRace);
  const raceOf = (o) => (o === 0 ? playerRace : (o <= 2 ? others[o - 1] : 4));
  game = new Game(lv, { ...CIVS[save.civ], stats: CIVS[save.civ].stats }, save.stats, save.spells, raceOf, save.mode === 'hard');
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
  if (idx === 0 && !save.tutorialDone) TUT.start(); else TUT.finish();
  if (input) input.onTutEnd = () => { save.tutorialDone = 1; persist(); };
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
  const BANNER = { egypt: '#8a8a3a', rome: '#a03028', china: '#5a7a8a' };
  for (const id in CIVS) {
    const c = CIVS[id];
    const st = c.stats;
    const el = document.createElement('div');
    el.className = 'civ-card';
    el.innerHTML = `<div class="civ-banner" style="background:${BANNER[id] || '#888'}"></div>
      <img class="civ-char" src="assets/img/ui/racechar_${id}.png" draggable="false">
      <h3 style="color:${c.color}">${c.name}</h3><div class="civ-desc">${c.desc}</div>
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
  // Original parchment world map: nodes at the exact positions extracted from the SWF Map sprite.
  const POS = {
    1: [520, 1380], 2: [79.5, 430.2], 3: [311.6, 821.8], 4: [98.5, 1128.9], 5: [279.4, 1111.1],
    6: [401.6, 1195.2], 7: [444.9, 360.6], 8: [214.1, 950.6], 9: [571.0, 1284.7], 10: [360.1, 1029.2],
    11: [85.5, 963.6], 12: [503.1, 697.5], 13: [267.1, 640.9], 14: [409.4, 139.1], 15: [593.4, 403.5],
    16: [558.8, 476.7], 17: [289.8, 177.8], 18: [402.6, 578.6], 19: [230.2, 817.7], 20: [153.0, 585.2],
    21: [564.3, 589.4], 22: [543.9, 161.2], 23: [331.7, 425.2], 24: [376.6, 703.1], 25: [467.9, 834.1],
    26: [484.9, 933.1], 27: [284.3, 524.6], 28: [54.5, 825.1], 29: [208.0, 370.6], 30: [160.6, 171.9],
    31: [107.4, 275.4], 32: [199.9, 294.9], 33: [305.9, 294.9],
  };
  const SC = 960 / 850; // map art is 850x1483, displayed at 960 wide
  const inner = $('map-inner');
  inner.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const gameLevel = i; // index 0 = training (uses level-1 node), index N = original level N
    let pos = POS[Math.max(1, gameLevel)] || POS[1];
    if (gameLevel === 0) pos = [pos[0] - 70, pos[1] + 50]; // training node beside level 1
    const el = document.createElement('div');
    const locked = i > save.unlocked;
    el.className = 'level-node' + (locked ? ' locked' : '') + (i === save.unlocked && !locked ? ' next' : '');
    const stars = save.stars[i] || 0;
    el.innerHTML = `<span class="nnum">${i === 0 ? 'T' : gameLevel}</span><span class="nstars">${'★'.repeat(stars)}</span>`;
    el.style.left = `${pos[0] * SC}px`;
    el.style.top = `${pos[1] * SC}px`;
    el.title = locked ? 'Locked' : lv.name;
    if (!locked) el.addEventListener('click', () => startLevel(i));
    inner.appendChild(el);
  });
  $('levels-title').textContent = `Campaign — ${CIVS[save.civ].name}`;
  refreshMode();
  // Scroll so the current level is in view (map is tall; progress runs bottom-up).
  const cur = POS[Math.max(1, save.unlocked)] || POS[1];
  requestAnimationFrame(() => {
    $('map-scroll').scrollTop = Math.max(0, cur[1] * SC - 300);
  });
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
function refreshMode() {
  if (!save.mode) save.mode = 'normal';
  $('btn-mode-normal').classList.toggle('mode-on', save.mode === 'normal');
  $('btn-mode-hard').classList.toggle('mode-on', save.mode === 'hard');
}
$('btn-mode-normal').addEventListener('click', () => { save.mode = 'normal'; persist(); refreshMode(); });
$('btn-mode-hard').addEventListener('click', () => { save.mode = 'hard'; persist(); refreshMode(); });
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
  if (game) { render(ctx, game, input || { mouse: { x: 0, y: 0 }, selected: new Set() }); TUT.draw(ctx); }
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
