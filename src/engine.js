// Core simulation: buildings, armies, combat, towers, crystals, spells, AI, boss.
import { sfx } from './assets.js';
import {
  OWNER, UNITS, BUILDING_TYPES, HOUSE_REGEN_SEC, SHRINE_PROFIT, CRYSTAL_FLAT_RATE, SEND_WAVE, SEND_INTERVAL,
  TOWER_DAMAGE_PER_POP, TOWER_MAX_HIT, AI_CIV_TINTS, AI_STATS,
  SPELLS, SPELL_POWER, spellCooldown, rankVal,
} from './data.js';

const W = 960, H = 600;

export function effectiveStats(civBase, statRanks) {
  const s = { ...civBase };
  const STEP = { attack: .08, defense: .08, agility: .10, speed: .07, crystalInit: 30, crystalMax: 70 };
  for (const k in STEP) s[k] += STEP[k] * (statRanks?.[k] || 0);
  return s;
}

export class Game {
  constructor(level, playerCivStats, playerStatRanks, playerSpellRanks, raceOf) {
    this.level = level;
    this.levelIdx = level.index;
    this.raceOf = raceOf || ((o) => Math.min(o + 1, 4));
    this.time = 0;
    this.over = false;
    this.result = null; // 'win' | 'lose'

    // Civ 0 = player. AI civs get generic stats, slightly stronger on later levels.
    this.civs = [];
    this.civs.push({ id: 0, color: playerCivStats.color, stats: effectiveStats(playerCivStats.stats, playerStatRanks), crystals: 0, spellRanks: playerSpellRanks, cooldowns: {}, ai: false });
    const aiCount = Math.max(...level.buildings.map(b => b[3])) || 0;
    const diff = 1 + (level.index || 0) * 0.06;
    const lai = level.ai || { attack: 1.8, defense: 1.8, agility: 1.8, speed: 1.8, crystalInit: 48 };
    for (let i = 1; i <= aiCount; i++) {
      const st = { ...AI_STATS };
      // Original normal mode dampens enemy stats: stat -> int + frac/1.7.
      const damp = v => Math.floor(v) + (v - Math.floor(v)) / 1.7;
      st.attack *= diff * damp(lai.attack) / 1.8; st.defense *= diff * damp(lai.defense) / 1.8;
      st.agility *= diff * damp(lai.agility) / 1.8; st.speed = Math.min(1.3, st.speed * diff * damp(lai.speed) / 1.8);
      st.crystalInit = Math.min(st.crystalMax, Math.max(st.crystalInit, lai.crystalInit));
      this.civs.push({ id: i, color: AI_CIV_TINTS[(i - 1) % AI_CIV_TINTS.length], stats: st, crystals: st.crystalInit, cooldowns: {}, ai: true, aiTimer: 1 + i * 1.3, aiSpells: ['fireball', 'meteorite'] });
    }
    this.civs[0].crystals = this.civs[0].stats.crystalInit;

    this.buildings = level.buildings.map((b, i) => ({
      id: i, x: b[0], y: b[1], type: BUILDING_TYPES[b[2]], typeKey: b[2],
      owner: b[3], pop: b[4] !== undefined ? b[4] : (b[3] === OWNER.NEUTRAL ? BUILDING_TYPES[b[2]].soft * 0.35 : BUILDING_TYPES[b[2]].soft * 0.7),
      cap: b[5] || BUILDING_TYPES[b[2]].soft, hard: Math.floor((b[5] || BUILDING_TYPES[b[2]].soft) * 1.5),
      shieldT: 0, shieldBonus: 0, swampT: 0, fireT: 0, send: null,
    }));

    this.groups = [];      // {owner, unit, count, x, y, tx, ty, target(building|null), slow}
    this.arrows = [];      // tower projectiles
    this.effects = [];     // visual/spell effects {kind,...}
    this.golems = [];      // golem entities
    this.particles = [];

    this.boss = null;
    if (level.boss) {
      this.boss = { x: level.boss.x, y: level.boss.y, hp: level.boss.hp, maxHp: level.boss.hp, speed: level.boss.speed, r: level.boss.radius, dmg: level.boss.dmg, kind: level.boss.kind || 'octopus', tx: W / 2, ty: H / 2, retarget: 0, hitT: 0 };
    }
    this.events = []; // {msg} for renderer flashes
  }

  // ---------- helpers ----------
  buildingAt(x, y, pad = 0) {
    for (const b of this.buildings) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d <= b.type.r + pad) return b;
    }
    return null;
  }

  // Original sends half the garrison as a stream of small squads, not one blob.
  sendTroops(building, target, owner) {
    const total = Math.floor(building.pop / 2);
    if (total < 1) return null;
    building.send = { left: total, target, owner, t: 0 };
    sfx.sendFor(this.raceOf(owner));
    return building.send;
  }

  sendWave(building) {
    const s = building.send;
    const count = Math.min(SEND_WAVE, Math.floor(building.pop), s.left);
    if (count <= 0) { building.send = null; return; }
    s.left -= count;
    building.pop -= count;
    if (s.left <= 0) building.send = null;
    const civ = this.civs[s.owner];
    const unit = UNITS[building.type.unit];
    this.groups.push({
      owner: s.owner, unitKey: building.type.unit, count,
      x: building.x + (Math.random() - .5) * 8, y: building.y + (Math.random() - .5) * 8,
      tx: s.target.x, ty: s.target.y, target: s.target, slow: 1,
      speed: unit.speed * civ.stats.speed,
    });
  }

  defPower(building) {
    const civ = this.civs[building.owner];
    let p = building.type.def * (civ ? civ.stats.defense : 1);
    if (building.shieldT > 0) p *= 1 + building.shieldBonus;
    return p;
  }

  resolveArrival(g) {
    const b = g.target;
    if (!b) return;
    if (b.owner === g.owner) {
      // Friendly: merge, capped at hard cap.
      b.pop = Math.min(b.hard, b.pop + g.count * (g.unitKey === 'heavy' ? UNITS.heavy.worth : 1));
      return;
    }
    const atkCiv = this.civs[g.owner];
    const defCiv = b.owner >= 0 ? this.civs[b.owner] : null;
    const unit = UNITS[g.unitKey];
    const atk = unit.atk * atkCiv.stats.attack;
    const def = this.defPower(b);
    const ratio = atk / def; // defenders killed per attacker
    const attackersNeeded = b.pop / ratio;
    // Original: each enemy killed pays +1 crystal into the attacking player's pool.
    const killed = Math.min(b.pop, g.count * ratio);
    if (g.owner === OWNER.PLAYER && killed >= 1) {
      atkCiv.crystals = Math.min(atkCiv.stats.crystalMax, atkCiv.crystals + Math.floor(killed));
    }
    if (g.count > attackersNeeded) {
      const survivors = g.count - attackersNeeded;
      b.owner = g.owner;
      b.send = null; // pending send order dies with the old owner
      b.pop = Math.min(b.hard, Math.max(1, Math.round(survivors * (g.unitKey === 'heavy' ? UNITS.heavy.worth : 1))));
      b.shieldT = 0; // shield is lost... actually original keeps it; keeping simple: capture clears swamp, keeps shield
      b.swampT = 0;
      this.flash(b.x, b.y, '#fff');
    } else {
      b.pop -= g.count * ratio;
      if (b.pop < 0.5) b.pop = Math.max(b.pop, 0.4); // fireball-style: can't be emptied by troops
      this.flash(b.x, b.y, '#f66');
    }
  }

  flash(x, y, color) { this.particles.push({ kind: 'ring', x, y, t: 0, life: .4, color }); }

  // ---------- spells ----------
  canCast(owner, key) {
    const civ = this.civs[owner];
    const rank = civ.spellRanks?.[key] || 0;
    if (rank < 1) return { ok: false, why: 'locked' };
    if ((civ.cooldowns[key] || 0) > 0) return { ok: false, why: 'cooldown' };
    if (civ.crystals < SPELLS[key].cost) return { ok: false, why: 'crystals' };
    return { ok: true, rank };
  }

  cast(owner, key, x, y) {
    const chk = this.canCast(owner, key);
    if (!chk.ok) return false;
    const civ = this.civs[owner];
    const rank = chk.rank;
    civ.crystals -= SPELLS[key].cost;
    civ.cooldowns[key] = spellCooldown(key, rank);
    sfx.playForSpell(key, this.raceOf(owner));
    const P = SPELL_POWER[key];
    switch (key) {
      case 'fireball': case 'meteorite': {
        const dmg = rankVal(P.dmg[0], P.dmg[1], rank);
        this.aoeDamage(x, y, P.r, dmg, owner, { buildingMin: P.minPop, vsUnits: true });
        this.effects.push({ kind: 'blast', x, y, r: P.r, t: 0, life: .5, color: key === 'fireball' ? '#ff7a2a' : '#c23a2a' });
        break;
      }
      case 'lightning': {
        this.effects.push({ kind: 'storm', x, y, r: P.r, t: 0, owner, dmg: rankVal(P.dmg[0], P.dmg[1], rank), bolts: Math.round(rankVal(P.bolts[0], P.bolts[1], rank)), interval: P.interval, boltT: 0 });
        break;
      }
      case 'twister': {
        this.effects.push({ kind: 'twister', x, y, t: 0, life: P.duration, owner, angle: -Math.PI / 2, pathR: P.pathR, killAcc: 0 });
        break;
      }
      case 'support': {
        const n = Math.round(rankVal(P.units[0], P.units[1], rank));
        const b = this.buildingAt(x, y, 20) || this.nearestBuilding(x, y);
        const edge = this.spawnEdge(b);
        this.groups.push({ owner, unitKey: 'infantry', count: n, x: edge.x, y: edge.y, tx: b.x, ty: b.y, target: b, slow: 1, speed: UNITS.infantry.speed * 1.4 });
        break;
      }
      case 'hypnoses': {
        const r = rankVal(P.r[0], P.r[1], rank);
        for (const g of this.groups) {
          if (g.owner !== owner && Math.hypot(g.x - x, g.y - y) <= r) g.owner = owner;
        }
        this.effects.push({ kind: 'blast', x, y, r, t: 0, life: .6, color: '#b26ae8' });
        break;
      }
      case 'shield': {
        const b = this.buildingAt(x, y, 20);
        if (b) { b.shieldT = P.duration; b.shieldBonus = rankVal(P.bonus[0], P.bonus[1], rank); }
        break;
      }
      case 'swamp': {
        const b = this.buildingAt(x, y, 20);
        if (b) b.swampT = P.duration;
        this.effects.push({ kind: 'swamp', x, y, r: P.r, t: 0, life: P.duration });
        break;
      }
      case 'golem': {
        this.golems.push({ owner, x, y, hp: rankVal(P.hp[0], P.hp[1], rank), dmg: rankVal(P.dmg[0], P.dmg[1], rank), speed: P.speed, attackT: 0, target: null });
        break;
      }
      case 'quake': {
        this.effects.push({ kind: 'quake', x, y, r: P.r, t: 0, life: rankVal(P.duration[0], P.duration[1], rank), owner, dps: P.dps });
        break;
      }
    }
    return true;
  }

  nearestBuilding(x, y) {
    let best = null, bd = 1e9;
    for (const b of this.buildings) { const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } }
    return best;
  }

  spawnEdge(target) {
    // Spawn support troops at nearest screen edge to target.
    const c = [{ x: 0, y: target.y }, { x: W, y: target.y }, { x: target.x, y: 0 }, { x: target.x, y: H }];
    c.sort((a, b2) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b2.x - target.x, b2.y - target.y));
    return c[0];
  }

  aoeDamage(x, y, r, dmg, owner, { buildingMin = 0, vsUnits = true, destroyBuildings = false } = {}) {
    for (const b of this.buildings) {
      if (Math.hypot(b.x - x, b.y - y) <= r + b.type.r) {
        b.pop -= dmg;
        if (b.pop <= 0) {
          if (destroyBuildings) { b.pop = 0; b.owner = OWNER.NEUTRAL; b.shieldT = 0; b.swampT = 0; }
          else b.pop = Math.max(b.pop, buildingMin);
        }
      }
    }
    if (vsUnits) {
      for (const g of this.groups) {
        if (Math.hypot(g.x - x, g.y - y) <= r + 12) g.count -= Math.ceil(dmg / 2);
      }
      this.groups = this.groups.filter(g => g.count > 0);
    }
  }

  // ---------- AI ----------
  aiThink(civ) {
    const mine = this.buildings.filter(b => b.owner === civ.id && b.pop >= 6);
    if (!mine.length) return;

    // Occasionally cast a spell on a player cluster.
    if (civ.crystals > SPELLS.fireball.cost * 1.6 && Math.random() < 0.18) {
      const target = this.buildings.filter(b => b.owner === OWNER.PLAYER).sort((a, b) => b.pop - a.pop)[0];
      if (target) {
        const key = Math.random() < 0.5 ? 'fireball' : 'meteorite';
        if (civ.crystals >= SPELLS[key].cost) {
          civ.crystals -= SPELLS[key].cost;
          const P = SPELL_POWER[key];
          const dmg = rankVal(P.dmg[0], P.dmg[1], 3);
          this.aoeDamage(target.x, target.y, P.r, dmg, civ.id, { buildingMin: 1, vsUnits: true });
          this.effects.push({ kind: 'blast', x: target.x, y: target.y, r: P.r, t: 0, life: .5, color: '#ff7a2a' });
        }
      }
    }

    // Choose targets: weak neutrals first, then weak enemy buildings.
    const enemies = this.buildings.filter(b => b.owner !== civ.id);
    if (!enemies.length) return;
    const aggression = 0.35 + Math.min(0.4, this.time / 300);
    if (Math.random() > aggression) return;

    const scored = enemies.map(b => {
      let s = b.pop + (b.owner === -1 ? -4 : 10);            // prefer weak; slight pull to neutrals
      if (b.type.kind === 'tower') s += 8;
      if (b.type.kind === 'shrine') s -= 3;
      const nearest = Math.min(...mine.map(m => Math.hypot(m.x - b.x, m.y - b.y)));
      s += nearest / 220;
      return { b, s };
    }).sort((a, b) => a.s - b.s);

    const target = scored[0].b;
    // Send from enough buildings to plausibly win: 1-3 nearest senders.
    const senders = mine
      .sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y))
      .slice(0, target.owner === -1 ? 1 : 3)
      .filter(m => m.pop > target.pop * 0.4 || mine.length === 1);
    let force = 0;
    const defRatio = this.civs[civ.id].stats.attack / this.defPower(target);
    const needed = target.pop / Math.max(0.2, defRatio);
    for (const m of senders) {
      if (force >= needed * 1.15) break;
      const g = this.sendTroops(m, target, civ.id);
      if (g) force += g.left;
    }
  }

  // ---------- update ----------
  update(dt) {
    if (this.over) return;
    this.time += dt;

    // Buildings: regen, decay, shield/swamp timers, tower fire.
    for (const b of this.buildings) {
      const civ = b.owner >= 0 ? this.civs[b.owner] : null;
      // Houses regen +1 troop per HOUSE_REGEN_SEC seconds (scaled by agility). No overcap decay.
      if (b.owner >= 0 && b.type.kind === 'house' && b.pop < b.cap) {
        b.pop = Math.min(b.cap, b.pop + (civ.stats.agility / HOUSE_REGEN_SEC[b.typeKey]) * dt);
      }
      // Streaming sends: spawn a wave of up to SEND_WAVE troops per interval.
      if (b.send) {
        b.send.t -= dt;
        if (b.send.t <= 0) {
          b.send.t = SEND_INTERVAL[b.type.kind] || 0.44;
          this.sendWave(b);
        }
      }
      if (b.shieldT > 0) b.shieldT -= dt;
      if (b.swampT > 0) {
        b.swampT -= dt;
        b.pop = Math.max(1, b.pop - SPELL_POWER.swamp.drainPerSec * dt);
      }
      // Crystals from shrines: original pays (profit + garrison) per 2s tick.
      if (b.owner >= 0 && b.type.kind === 'shrine') {
        const c = this.civs[b.owner];
        c.crystals = Math.min(c.stats.crystalMax, c.crystals + (SHRINE_PROFIT[b.typeKey] + b.pop) / 2 * dt);
      }
      // Tower fire.
      if (b.owner >= 0 && b.type.kind === 'tower' && b.pop >= 1) {
        b.fireT -= dt;
        if (b.fireT <= 0) {
          b.fireT = b.type.fireRate;
          const tgt = this.groups.find(g => g.owner !== b.owner && Math.hypot(g.x - b.x, g.y - b.y) <= b.type.range);
          if (tgt) {
            this.arrows.push({ x: b.x, y: b.y - b.type.r, tx: tgt.x, ty: tgt.y, t: 0, life: 0.22, dmg: Math.min(TOWER_MAX_HIT, b.pop * TOWER_DAMAGE_PER_POP * this.civs[b.owner].stats.attack), target: tgt });
            sfx.play('towerShoot', 0.18);
          }
        }
      }
    }

    // Cooldowns + flat crystal income (original pays a base 21 per 2s tick).
    for (const civ of this.civs) {
      civ.crystals = Math.min(civ.stats.crystalMax, civ.crystals + CRYSTAL_FLAT_RATE * dt);
      for (const k in civ.cooldowns) if (civ.cooldowns[k] > 0) civ.cooldowns[k] -= dt;
    }

    // Arrows.
    for (const a of this.arrows) {
      a.t += dt;
      if (a.t >= a.life && a.target) {
        a.target.count -= Math.ceil(a.dmg);
        a.target = null;
      }
    }
    this.arrows = this.arrows.filter(a => a.t < a.life);
    this.groups = this.groups.filter(g => g.count > 0);

    // Move groups. Slow is recomputed every tick so spell slows expire cleanly.
    for (const g of this.groups) {
      const dx = g.tx - g.x, dy = g.ty - g.y;
      const d = Math.hypot(dx, dy);
      let sp = g.speed * g.slow;
      g.slow = 1;
      // Swamp slowdown near swamped buildings.
      for (const b of this.buildings) {
        if (b.swampT > 0 && Math.hypot(g.x - b.x, g.y - b.y) <= SPELL_POWER.swamp.r + b.type.r) sp *= SPELL_POWER.swamp.slow;
      }
      if (d < 6) {
        if (g.target === this.boss) {
          // Troops reaching the boss head chip its health.
          this.boss.hp -= g.count * this.civs[g.owner].stats.attack;
        } else if (g.target) this.resolveArrival(g);
        g.done = true;
      } else {
        g.x += dx / d * sp * dt;
        g.y += dy / d * sp * dt;
      }
    }
    this.groups = this.groups.filter(g => !g.done);

    // Spell effects.
    for (const e of this.effects) {
      e.t += dt;
      if (e.kind === 'storm') {
        e.boltT -= dt;
        if (e.boltT <= 0 && e.bolts > 0) {
          e.boltT = SPELL_POWER.lightning.interval;
          e.bolts--;
          const bx = e.x + (Math.random() - .5) * 2 * e.r, by = e.y + (Math.random() - .5) * 2 * e.r;
          this.aoeDamage(bx, by, 26, e.dmg, e.owner, { vsUnits: true, destroyBuildings: true });
          this.particles.push({ kind: 'bolt', x: bx, y: by, t: 0, life: .18 });
        }
        if (e.bolts <= 0) e.life = e.t;
      } else if (e.kind === 'twister') {
        e.angle += dt * 1.5;
        e.cx = e.x + Math.cos(e.angle) * e.pathR;
        e.cy = e.y + Math.sin(e.angle) * e.pathR;
        for (const g of this.groups) {
          if (Math.hypot(g.x - e.cx, g.y - e.cy) <= 26) g.count -= SPELL_POWER.twister.killsPerSec * dt;
        }
        for (const b of this.buildings) {
          if (Math.hypot(b.x - e.cx, b.y - e.cy) <= 26 + b.type.r) b.pop = Math.max(0, b.pop - 1 * dt);
        }
      } else if (e.kind === 'quake') {
        // Apply ~30 ticks/sec worth.
        e.acc = (e.acc || 0) + dt;
        while (e.acc > 0.1) {
          e.acc -= 0.1;
          for (const b of this.buildings) {
            if (Math.hypot(b.x - e.x, b.y - e.y) <= e.r + b.type.r) {
              b.pop -= e.dps * 0.1;
              if (b.pop <= 0) { b.pop = 0; b.owner = OWNER.NEUTRAL; b.shieldT = 0; b.swampT = 0; }
            }
          }
        }
        for (const g of this.groups) {
          if (Math.hypot(g.x - e.x, g.y - e.y) <= e.r) g.slow = SPELL_POWER.quake.slow;
        }
      }
    }
    this.effects = this.effects.filter(e => e.t < (e.life ?? Infinity));
    this.groups = this.groups.filter(g => g.count > 0);

    // Golems: walk to nearest enemy building, smash things in reach.
    for (const gl of this.golems) {
      if (!gl.target || gl.target.owner === gl.owner || gl.target.pop <= 0) {
        const pool = this.buildings.filter(b => b.owner >= 0 && b.owner !== gl.owner);
        const fallback = this.buildings.filter(b => b.owner === -1 && b.pop > 0);
        gl.target = (pool.length ? pool : fallback)
          .sort((a, b) => Math.hypot(a.x - gl.x, a.y - gl.y) - Math.hypot(b.x - gl.x, b.y - gl.y))[0]
          || null;
      }
      if (!gl.target) continue;
      const d = Math.hypot(gl.target.x - gl.x, gl.target.y - gl.y);
      if (d > gl.target.type.r + 14) {
        gl.x += (gl.target.x - gl.x) / d * gl.speed * dt;
        gl.y += (gl.target.y - gl.y) / d * gl.speed * dt;
      } else {
        gl.attackT -= dt;
        if (gl.attackT <= 0) {
          gl.attackT = 1.5;
          gl.target.pop = Math.max(0, gl.target.pop - gl.dmg);
          this.flash(gl.target.x, gl.target.y - gl.target.type.r, '#a98');
        }
      }
    }
    this.golems = this.golems.filter(g => g.hp > 0);

    // Boss.
    const boss = this.boss;
    if (boss && boss.hp > 0) {
      boss.retarget -= dt;
      if (boss.retarget <= 0) {
        boss.retarget = 4;
        // Wander toward a random building or dense troop cluster.
        const t = this.buildings[Math.floor(Math.random() * this.buildings.length)];
        boss.tx = t.x; boss.ty = t.y;
      }
      const dx = boss.tx - boss.x, dy = boss.ty - boss.y, d = Math.hypot(dx, dy);
      if (d > 8 && boss.speed > 0) { boss.x += dx / d * boss.speed * dt; boss.y += dy / d * boss.speed * dt; }
      boss.hitT -= dt;
      // Crush troops it touches; troops also hurt it.
      for (const g of this.groups) {
        if (Math.hypot(g.x - boss.x, g.y - boss.y) <= boss.r + 14) {
          g.count -= 30 * dt;
          boss.hp -= 14 * dt;
        }
      }
      // Damage buildings underfoot.
      for (const b of this.buildings) {
        if (Math.hypot(b.x - boss.x, b.y - boss.y) <= boss.r + b.type.r * 0.5) {
          b.pop = Math.max(0, b.pop - boss.dmg * dt);
          if (b.pop === 0) b.owner = OWNER.NEUTRAL;
        }
      }
      if (boss.hp <= 0) this.effects.push({ kind: 'blast', x: boss.x, y: boss.y, r: 90, t: 0, life: .8, color: '#8a5' });
    }

    // Particles.
    for (const p of this.particles) p.t += dt;
    this.particles = this.particles.filter(p => p.t < p.life);

    // AI.
    for (const civ of this.civs) {
      if (!civ.ai) continue;
      civ.aiTimer -= dt;
      if (civ.aiTimer <= 0) {
        civ.aiTimer = 1.6 + Math.random() * 1.6;
        this.aiThink(civ);
      }
    }

    // Win/lose: a civ is alive if it owns a building or still has troops marching.
    const alive = new Set();
    for (const b of this.buildings) if (b.owner >= 0) alive.add(b.owner);
    for (const g of this.groups) if (g.owner >= 0) alive.add(g.owner);
    // Golems cannot capture buildings, so they alone do not keep a civ alive.
    const playerAlive = alive.has(OWNER.PLAYER);
    // A living boss keeps the enemy side alive — original requires killing the head.
    const enemiesAlive = [...alive].some(id => id !== OWNER.PLAYER) || (this.boss && this.boss.hp > 0);
    if (!playerAlive) { this.over = true; this.result = 'lose'; }
    else if (!enemiesAlive) { this.over = true; this.result = 'win'; }
  }
}
