// Canvas renderer: terrain, buildings, armies, spells, boss.
import { OWNER, NEUTRAL_COLOR } from './data.js';

const W = 960, H = 600;
let terrain = null;

function buildTerrain() {
  terrain = document.createElement('canvas');
  terrain.width = W; terrain.height = H;
  const c = terrain.getContext('2d');
  // Parchment desert.
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c9b078'); g.addColorStop(0.5, '#d4bc84'); g.addColorStop(1, '#c2a86e');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // Mottled patches.
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = 8 + Math.random() * 40;
    c.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${95 + Math.random() * 45 | 0},50,${0.03 + Math.random() * 0.05})`;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  // Nile-like river squiggle for flavor.
  c.strokeStyle = 'rgba(70,110,140,0.35)';
  c.lineWidth = 22; c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-20, 80);
  for (let x = 0; x <= W + 20; x += 40) c.lineTo(x, 80 + Math.sin(x / 90) * 26);
  c.stroke();
  // Vignette.
  const v = c.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, H);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,0,0.35)');
  c.fillStyle = v; c.fillRect(0, 0, W, H);
}

function ownerColor(owner, civs) {
  return owner < 0 ? NEUTRAL_COLOR : civs[owner].color;
}

function drawBuilding(c, b, civs, sel) {
  const r = b.type.r;
  const col = ownerColor(b.owner, civs);
  // Selection ring.
  if (sel) {
    c.strokeStyle = '#fff'; c.lineWidth = 3;
    c.beginPath(); c.arc(b.x, b.y, r + 7, 0, 7); c.stroke();
  }
  // Base disc.
  c.fillStyle = 'rgba(60,40,15,0.35)';
  c.beginPath(); c.ellipse(b.x, b.y + r * 0.8, r * 1.15, r * 0.45, 0, 0, 7); c.fill();
  c.fillStyle = '#e6d3a0';
  c.strokeStyle = col; c.lineWidth = 4;
  c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.fill(); c.stroke();

  const lv = b.type.level;
  c.fillStyle = col;
  c.strokeStyle = '#4a3010';
  c.lineWidth = 1.5;
  if (b.type.kind === 'house') {
    // Stacked dwelling: base + level boxes.
    const w = r * 1.1;
    for (let i = 0; i < lv; i++) {
      const bw = w * (1 - i * 0.14);
      const by = b.y + r * 0.45 - i * (r * 0.32);
      c.fillStyle = i % 2 ? '#d8c08a' : '#e6d3a0';
      c.fillRect(b.x - bw / 2, by - r * 0.34, bw, r * 0.34);
      c.strokeRect(b.x - bw / 2, by - r * 0.34, bw, r * 0.34);
    }
    c.fillStyle = col;
    c.beginPath(); c.moveTo(b.x - w * 0.4, b.y + r * 0.45 - (lv - 1) * r * 0.32 - r * 0.34);
    c.lineTo(b.x, b.y + r * 0.45 - lv * r * 0.32 - r * 0.44);
    c.lineTo(b.x + w * 0.4, b.y + r * 0.45 - (lv - 1) * r * 0.32 - r * 0.34);
    c.closePath(); c.fill(); c.stroke();
  } else if (b.type.kind === 'shrine') {
    // Obelisk.
    const hgt = r * (1.1 + lv * 0.28);
    c.fillStyle = '#d8c08a';
    c.beginPath();
    c.moveTo(b.x - r * 0.28, b.y + r * 0.55);
    c.lineTo(b.x - r * 0.14, b.y + r * 0.55 - hgt);
    c.lineTo(b.x + r * 0.14, b.y + r * 0.55 - hgt);
    c.lineTo(b.x + r * 0.28, b.y + r * 0.55);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffe066';
    c.beginPath(); c.arc(b.x, b.y + r * 0.55 - hgt, 4 + lv, 0, 7); c.fill();
  } else { // tower
    const hgt = r * (1.0 + lv * 0.3);
    c.fillStyle = '#c9b078';
    c.fillRect(b.x - r * 0.42, b.y + r * 0.55 - hgt, r * 0.84, hgt);
    c.strokeRect(b.x - r * 0.42, b.y + r * 0.55 - hgt, r * 0.84, hgt);
    // Battlements.
    c.fillStyle = col;
    for (let i = -1; i <= 1; i++) {
      c.fillRect(b.x + i * r * 0.32 - r * 0.11, b.y + r * 0.55 - hgt - r * 0.18, r * 0.22, r * 0.2);
    }
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

  // Population number.
  c.font = 'bold 15px Georgia';
  c.textAlign = 'center';
  c.lineWidth = 3; c.strokeStyle = 'rgba(30,18,5,0.8)';
  const txt = String(Math.floor(b.pop));
  c.strokeText(txt, b.x, b.y - r - 8);
  c.fillStyle = '#fff'; c.fillText(txt, b.x, b.y - r - 8);
}

function drawGroup(c, g, civs) {
  const col = civs[g.owner].color;
  const n = Math.min(34, Math.ceil(g.count));
  const spread = 8 + Math.min(16, Math.sqrt(g.count) * 2);
  for (let i = 0; i < n; i++) {
    const a = (i * 2.39996) + g.x; // golden-angle-ish deterministic scatter
    const rr = (i / n) * spread;
    const x = g.x + Math.cos(a) * rr, y = g.y + Math.sin(a) * rr * 0.7;
    c.fillStyle = col;
    c.strokeStyle = 'rgba(20,10,0,0.6)'; c.lineWidth = 1;
    if (g.unitKey === 'cavalry') {
      c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 4, y + 3); c.lineTo(x - 4, y + 3); c.closePath(); c.fill(); c.stroke();
    } else if (g.unitKey === 'heavy') {
      c.fillRect(x - 3.5, y - 3.5, 7, 7); c.strokeRect(x - 3.5, y - 3.5, 7, 7);
    } else {
      c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); c.stroke();
    }
  }
  // Count label.
  c.font = 'bold 12px Georgia'; c.textAlign = 'center';
  c.lineWidth = 3; c.strokeStyle = 'rgba(20,10,0,0.8)';
  c.strokeText(String(Math.ceil(g.count)), g.x, g.y - spread - 6);
  c.fillStyle = '#fff'; c.fillText(String(Math.ceil(g.count)), g.x, g.y - spread - 6);
}

export function render(ctx, game, ui) {
  if (!terrain) buildTerrain();
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(terrain, 0, 0);

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
    drawBuilding(ctx, b, game.civs, ui.selected.has(b));
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

  for (const g of game.groups) drawGroup(ctx, g, game.civs);

  // Arrows.
  for (const a of game.arrows) {
    const p = a.t / a.life;
    const x = a.x + (a.tx - a.x) * p, y = a.y + (a.ty - a.y) * p - Math.sin(p * Math.PI) * 18;
    ctx.strokeStyle = '#3a2a14'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (a.tx - a.x) * 0.02, y + (a.ty - a.y) * 0.02 + 2); ctx.stroke();
  }

  // Golems.
  for (const gl of game.golems) {
    ctx.fillStyle = '#8a7a5e';
    ctx.strokeStyle = game.civs[gl.owner].color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(gl.x, gl.y, 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a4c34';
    ctx.fillRect(gl.x - 5, gl.y - 5, 4, 4); ctx.fillRect(gl.x + 2, gl.y - 5, 4, 4);
  }

  // Boss.
  if (game.boss && game.boss.hp > 0) {
    const b = game.boss;
    ctx.fillStyle = '#4a6b3a';
    ctx.strokeStyle = '#2a4a1a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    // Shell pattern.
    ctx.strokeStyle = 'rgba(30,50,20,0.6)'; ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * i / 3.4, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#ffdf5a';
    ctx.beginPath(); ctx.arc(b.x - 8, b.y - 6, 3, 0, 7); ctx.arc(b.x + 8, b.y - 6, 3, 0, 7); ctx.fill();
    // HP bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(b.x - 40, b.y - b.r - 16, 80, 7);
    ctx.fillStyle = '#7c4'; ctx.fillRect(b.x - 39, b.y - b.r - 15, 78 * Math.max(0, b.hp / b.maxHp), 5);
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
