// Canvas renderer: terrain, buildings, armies, spells, boss.
import { OWNER, NEUTRAL_COLOR } from './data.js';
import { DECOR } from './decor.js';
import { IMGS, buildingImg, unitImg, bossImg, decorImg } from './assets.js';

const W = 960, H = 600;
let terrain = null, terrainLevel = -1;

function buildTerrain(levelIdx) {
  terrainLevel = levelIdx;
  terrain = document.createElement('canvas');
  terrain.width = W; terrain.height = H;
  const c = terrain.getContext('2d');
  // Original field backdrop is plain white.
  c.fillStyle = '#fdfcfa';
  c.fillRect(0, 0, W, H);
  // Original stage decor (trees, ruins, grass) at extracted positions.
  for (const [cid, x, y, sx, sy] of (DECOR[levelIdx] || [])) {
    const img = decorImg(cid, IMGS[`d/${cid}.jpg`] ? 'jpg' : 'png');
    if (!img || !img.width) continue;
    const w = img.width * sx * 1.2, h = img.height * sy * 1.2;
    c.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
  const v = c.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, H);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(60,60,60,0.12)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

export function resetTerrain() { terrain = null; terrainLevel = -1; }

function ownerColor(owner, civs) {
  return owner < 0 ? NEUTRAL_COLOR : civs[owner].color;
}

function drawBuilding(c, b, civs, sel, raceOf) {
  const r = b.type.r;
  const col = ownerColor(b.owner, civs);
  if (sel) {
    c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.arc(b.x, b.y, r + 7, 0, 7); c.stroke();
  }
  const raceIdx = b.owner < 0 ? 0 : raceOf(b.owner);
  const img = buildingImg(b.typeKey, raceIdx);
  if (img && img.width) {
    const s = (r * 2.9) / Math.max(img.width, img.height);
    const w = img.width * s, h = img.height * s;
    c.drawImage(img, b.x - w / 2, b.y + r * 0.75 - h, w, h);
  } else {
    c.fillStyle = '#e6d3a0'; c.strokeStyle = col; c.lineWidth = 4;
    c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.fill(); c.stroke();
  }

  // Shield aura.
  if (b.shieldT > 0) {
    c.strokeStyle = 'rgba(120,200,255,0.85)'; c.lineWidth = 3;
    c.beginPath(); c.arc(b.x, b.y, r + 4 + Math.sin(b.shieldT * 6) * 1.5, 0, 7); c.stroke();
  }
  // Swamp overlay.
  if (b.swampT > 0) {
    c.fillStyle = 'rgba(60,110,40,0.45)';
    c.beginPath(); c.arc(b.x, b.y, r + 3, 0, 7); c.fill();
  }
  // Tower range hint on hover handled by input layer.

  // Original-style label: white pill, owner-colored flag, dark pop number.
  const txt = String(Math.floor(b.pop));
  c.font = 'bold 11px Arial';
  const tw = c.measureText(txt).width;
  const pw = tw + 24, ph = 15;
  const lx = b.x - pw / 2, ly = b.y - r - 20;
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1;
  c.beginPath(); c.roundRect(lx, ly, pw, ph, 3); c.fill(); c.stroke();
  // Flag: pole + pennant in owner color.
  const fx = lx + 5, fy = ly + 2;
  c.strokeStyle = '#555'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx, fy + 11); c.stroke();
  c.fillStyle = b.owner < 0 ? '#bbb' : col;
  c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + 9, fy + 3); c.lineTo(fx, fy + 6); c.closePath(); c.fill();
  c.fillStyle = '#222'; c.textAlign = 'left';
  c.fillText(txt, lx + 17, ly + 12);
}

function drawGroup(c, g, civs, raceOf) {
  const col = civs[g.owner].color;
  const n = Math.min(30, Math.ceil(g.count));
  const spread = 8 + Math.min(16, Math.sqrt(g.count) * 2);
  const img = unitImg(raceOf(g.owner), (g.x | 0) % 2 === 0);
  const su = g.unitKey === 'heavy' ? 22 : g.unitKey === 'cavalry' ? 20 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i * 2.39996) + g.x; // deterministic scatter
    const rr = (i / n) * spread;
    const x = g.x + Math.cos(a) * rr, y = g.y + Math.sin(a) * rr * 0.7;
    if (img && img.width) {
      const s = su / img.height, w = img.width * s, h = img.height * s;
      c.drawImage(img, x - w / 2, y - h + 3, w, h);
    } else {
      c.fillStyle = col; c.strokeStyle = 'rgba(20,10,0,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); c.stroke();
    }
  }
  c.font = 'bold 12px Georgia'; c.textAlign = 'center';
  c.lineWidth = 3; c.strokeStyle = 'rgba(20,10,0,0.8)';
  c.strokeText(String(Math.ceil(g.count)), g.x, g.y - spread - 10);
  c.fillStyle = '#fff'; c.fillText(String(Math.ceil(g.count)), g.x, g.y - spread - 10);
}

export function render(ctx, game, ui) {
  if (!terrain || terrainLevel !== game.levelIdx) buildTerrain(game.levelIdx);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(terrain, 0, 0);
  const raceOf = game.raceOf || ((o) => Math.min(o + 1, 4));

  // Hovered tower range.
  if (ui.hoverBuilding && ui.hoverBuilding.type.kind === 'tower' && ui.hoverBuilding.owner >= 0) {
    const b = ui.hoverBuilding;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.type.range, 0, 7); ctx.fill(); ctx.stroke();
  }

  // Spell area preview.
  if (ui.spellTarget) {
    ctx.strokeStyle = 'rgba(255,220,80,0.9)'; ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(ui.mouse.x, ui.mouse.y, ui.spellTarget.r || 50, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const b of game.buildings) {
    drawBuilding(ctx, b, game.civs, ui.selected.has(b), raceOf);
  }

  // Drag-selection line.
  if (ui.dragging && ui.selected.size) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(ui.dragStart.x, ui.dragStart.y); ctx.lineTo(ui.mouse.x, ui.mouse.y); ctx.stroke();
    ctx.setLineDash([]);
    const hov = game.buildingAt(ui.mouse.x, ui.mouse.y, 10);
    if (hov && hov.owner !== OWNER.PLAYER) {
      ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hov.x, hov.y, hov.type.r + 9, 0, 7); ctx.stroke();
    }
  }

  for (const g of game.groups) drawGroup(ctx, g, game.civs, raceOf);

  // Arrows.
  for (const a of game.arrows) {
    const p = a.t / a.life;
    const x = a.x + (a.tx - a.x) * p, y = a.y + (a.ty - a.y) * p - Math.sin(p * Math.PI) * 18;
    ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (a.tx - a.x) * 0.02, y + (a.ty - a.y) * 0.02 + 2); ctx.stroke();
  }

  // Golems.
  for (const gl of game.golems) {
    const img = bossImg(`golem_race${raceOf(gl.owner)}`);
    if (img && img.width) {
      const h = 52, w = img.width * (h / img.height);
      ctx.drawImage(img, gl.x - w / 2, gl.y - h * 0.7, w, h);
    } else {
      ctx.fillStyle = '#8a7a5e'; ctx.strokeStyle = game.civs[gl.owner].color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gl.x, gl.y, 13, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  // Boss.
  if (game.boss && game.boss.hp > 0) {
    const b = game.boss;
    const img = bossImg(b.kind || 'octopus');
    if (img && img.width) {
      const h = b.r * 4.2, w = img.width * (h / img.height);
      ctx.drawImage(img, b.x - w / 2, b.y - h * 0.72, w, h);
    } else {
      ctx.fillStyle = '#4a6b3a'; ctx.strokeStyle = '#2a4a1a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(b.x - 40, b.y - b.r - 20, 80, 7);
    ctx.fillStyle = '#7c4'; ctx.fillRect(b.x - 39, b.y - b.r - 19, 78 * Math.max(0, b.hp / b.maxHp), 5);
  }

  // Effects.
  for (const e of game.effects) {
    const p = e.t / (e.life || 1);
    if (e.kind === 'blast') {
      ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - p;
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + p * 0.9), 0, 7); ctx.stroke();
      ctx.fillStyle = e.color; ctx.globalAlpha = (1 - p) * 0.25;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + p * 0.9), 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.kind === 'storm') {
      ctx.fillStyle = 'rgba(60,60,90,0.4)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y - 30, e.r, e.r * 0.4, 0, 0, 7); ctx.fill();
    } else if (e.kind === 'twister') {
      const cx = e.cx ?? e.x, cy = e.cy ?? e.y;
      ctx.strokeStyle = 'rgba(230,230,230,0.9)'; ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy - i * 8, 5 + i * 5 + Math.sin(e.t * 12 + i) * 3, 0, 7);
        ctx.stroke();
      }
    } else if (e.kind === 'swamp') {
      ctx.fillStyle = 'rgba(60,110,40,0.3)';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + Math.sin(e.t * 3) * 4, 0, 7); ctx.fill();
    } else if (e.kind === 'quake') {
      ctx.strokeStyle = `rgba(120,80,30,${0.8 - p * 0.5})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.9 + Math.sin(e.t * 25) * 0.06), 0, 7); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2 + e.t;
        ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * e.r * 0.4, e.y + Math.sin(a) * e.r * 0.4);
        ctx.lineTo(e.x + Math.cos(a + 0.3) * e.r, e.y + Math.sin(a + 0.3) * e.r); ctx.stroke();
      }
    }
  }

  // Particles.
  for (const pt of game.particles) {
    const p = pt.t / pt.life;
    if (pt.kind === 'ring') {
      ctx.strokeStyle = pt.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 10 + p * 30, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (pt.kind === 'bolt') {
      ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 3; ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.moveTo(pt.x - 4, pt.y - 40); ctx.lineTo(pt.x, pt.y); ctx.lineTo(pt.x + 4, pt.y - 20); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
