// Asset pipeline: preloads the sprites/audio extracted from the original SWF
// and maps logical building/unit names to image elements.

export const IMGS = {};

const BLD_TYPES = ['house1', 'house2', 'house3', 'house4', 'house5', 'tower1', 'tower2', 'tower3', 'shrine1', 'shrine2', 'shrine3'];
// race4 skins exist only on the strongest tiers in the original data
const R4_OK = new Set(['house3', 'tower3', 'shrine3']);
const RACES = ['none', 'race1', 'race2', 'race3', 'race4'];

export function buildingImg(type, raceIdx) {
  let race = RACES[raceIdx] || 'none';
  if (race === 'race4' && !R4_OK.has(type)) race = 'race3';
  const img = IMGS[`b/${type}_${race}.png`];
  if (img) return img;
  return IMGS[`b/${type}_none.png`] || null;
}
export const unitImg = (raceIdx, walk) =>
  IMGS[`u/${RACES[raceIdx] || 'race1'}${walk ? '_w' : ''}.png`] || null;
export const bossImg = (name) => IMGS[`boss/${name}.png`] || null;
export const decorImg = (cid, ext) => IMGS[`d/${cid}.${ext}`] || null;

export const RACE_INDEX = { egypt: 1, rome: 2, china: 3 }; // civ key -> sprite race frame

export function preload(decorCids) {
  const files = [];
  for (const t of BLD_TYPES) for (const r of RACES) {
    if (r === 'race4' && !R4_OK.has(t)) continue;
    files.push(`b/${t}_${r}.png`);
  }
  for (const r of ['race1', 'race2', 'race3', 'race4']) files.push(`u/${r}.png`, `u/${r}_w.png`);
  for (const g of ['golem_none', 'golem_race1', 'golem_race2', 'golem_race3', 'octopus', 'scorpion', 'tentacle'])
    files.push(`boss/${g}.png`);
  for (const [cid, ext] of decorCids) files.push(`d/${cid}.${ext}`);
  let done = 0;
  return Promise.all(files.map((f) => new Promise((res) => {
    const im = new Image();
    im.onload = im.onerror = () => { done++; res(); };
    im.src = `assets/img/${f}`;
    IMGS[f] = im;
  })));
}

// ---- Audio ----
const SND = {
  send1: '279_BuildingExitSound_race1_1.mp3', send2: '278_BuildingExitSound_race2_1.mp3',
  send3: '277_BuildingExitSound_race3_1.mp3', send4: '272_BuildingExitSound_3.mp3',
  towerShoot: '258_TowerShootSound.mp3', fireball: '286_FireBallFlySound.mp3',
  fireHit: '288_FireBallHitSound.mp3', lightning: '270_LightningHitSound.mp3',
  lightningIntro: '271_LightningIntroSound.mp3', quake: '262_QuakeSound.mp3',
  twister: '256_TwisterSound.mp3', swamp: '259_SwampSound.mp3',
  hypnoses: '281_HypnoseSound.mp3', shield: '260_ShieldSound.mp3',
  support: '273_SupportSound.mp3', golem1: '282_GolemSound_race1.mp3',
  golem2: '283_GolemSound_race2.mp3', golem3: '284_GolemSound_race3.mp3',
  monsterShoot: '265_MonsterShootSound1.mp3', monsterHit: '264_MonsterPawHitSound1.mp3',
  win: '291_CheerSound.mp3', lose: '290_DefeatSound.mp3',
  bgMusic: '263_BackgroundSound.mp3', menuMusic: '280_IntroMusic.mp3',
};
const SPELL_SND = { fireball: 'fireball', meteorite: 'fireball', lightning: 'lightning',
  quake: 'quake', twister: 'twister', hypnoses: 'hypnoses', shield: 'shield',
  support: 'support', swamp: 'swamp' };

const cache = {};
export const sfx = {
  enabled: true,
  play(name, vol = 0.55) {
    if (!this.enabled || !SND[name]) return;
    try {
      let a = cache[name];
      if (!a || a.paused) { a = new Audio(`assets/snd/${SND[name]}`); cache[name] = a; }
      else { a = cache[name] = a.cloneNode(); }
      a.volume = vol; a.play().catch(() => {});
    } catch (e) { /* audio blocked */ }
  },
  playForSpell(spell, raceIdx = 1) {
    if (spell === 'golem') { this.play(`golem${raceIdx}`); return; }
    const s = SPELL_SND[spell];
    if (s) this.play(s);
    if (spell === 'fireball' || spell === 'meteorite') setTimeout(() => this.play('fireHit', 0.45), 450);
  },
  music(name) {
    try {
      if (this._m) { this._m.pause(); this._m = null; }
      if (!name || !this.enabled) return;
      const a = new Audio(`assets/snd/${SND[name]}`);
      a.loop = true; a.volume = 0.35; a.play().catch(() => {});
      this._m = a;
    } catch (e) { /* noop */ }
  },
  sendFor(raceIdx) { this.play(`send${Math.min(raceIdx, 4)}`, 0.4); },
};
