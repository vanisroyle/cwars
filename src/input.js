// Pointer input (mouse + touch): drag-select own buildings, release on target; spell targeting.
import { OWNER } from './data.js';
import { TUT } from './tutorial.js';

export class Input {
  constructor(canvas, game, onCast) {
    this.canvas = canvas;
    this.game = game;
    this.onCast = onCast; // (x,y) => handled? called when a spell is armed & clicked
    this.mouse = { x: 0, y: 0 };
    this.dragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.selected = new Set();
    this.hoverBuilding = null;
    this.spellTarget = null; // {r} radius preview while spell armed

    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', () => { this.dragging = false; this.selected.clear(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (this.canvas.width / r.width), y: (e.clientY - r.top) * (this.canvas.height / r.height) };
  }

  down(e) {
    if (!e.isPrimary) return;
    const p = this.pos(e);
    this.mouse = p;
    if (TUT.active) {
      const hit = TUT.hit(p.x, p.y);
      if (hit === 'next') { TUT.next(); if (!TUT.active) this.onTutEnd && this.onTutEnd(); return; }
      if (hit === 'skip') { TUT.finish(); this.onTutEnd && this.onTutEnd(); return; }
      // otherwise fall through: steps 1-2 need real gameplay input
    }
    if (e.button !== 0) { this.selected.clear(); this.dragging = false; return; }
    if (this.spellTarget) return; // spell click handled in up()
    const b = this.game.buildingAt(p.x, p.y, 6);
    this.dragging = true;
    this.dragStart = p;
    this.selected.clear();
    if (b && b.owner === OWNER.PLAYER) this.selected.add(b);
  }

  move(e) {
    if (!e.isPrimary) return;
    const p = this.pos(e);
    this.mouse = p;
    this.hoverBuilding = this.game.buildingAt(p.x, p.y, 0);
    if (this.dragging) {
      // Sweep over own buildings to add them.
      for (const b of this.game.buildings) {
        if (b.owner === OWNER.PLAYER && !this.selected.has(b)) {
          // Point near segment from dragStart to current mouse.
          if (distToSegment(b.x, b.y, this.dragStart, p) < b.type.r + 4 || Math.hypot(b.x - p.x, b.y - p.y) < b.type.r + 6) {
            this.selected.add(b);
          }
        }
      }
    }
  }

  up(e) {
    if (!e.isPrimary) return;
    const p = this.pos(e);
    this.mouse = p;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (this.spellTarget) {
      // Only casts land on the canvas; clicks on the spell bar cancel via its own handler.
      if (e.target === this.canvas) this.onCast(p.x, p.y);
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    const boss = this.game.boss;
    const target = this.game.buildingAt(p.x, p.y, 12)
      || (boss && boss.hp > 0 && Math.hypot(p.x - boss.x, p.y - boss.y) <= boss.r + 14 ? boss : null);
    if (target && this.selected.size) {
      let sent = 0;
      for (const b of this.selected) {
        if (b !== target && this.game.sendTroops(b, target, OWNER.PLAYER)) sent++;
      }
      if (sent > 0) {
        const tutWasActive = TUT.active;
        TUT.notifySend();
        if (tutWasActive && !TUT.active) this.onTutEnd && this.onTutEnd();
      }
    }
    this.selected.clear();
  }

  armSpell(radius) { this.spellTarget = { r: radius }; this.selected.clear(); this.dragging = false; }
  disarmSpell() { this.spellTarget = null; }
}

function distToSegment(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(x - a.x, y - a.y);
  let t = ((x - a.x) * dx + (y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}
