// Mouse input: drag-select own buildings, release on target; spell targeting.
import { OWNER } from './data.js';

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

    canvas.addEventListener('mousedown', e => this.down(e));
    canvas.addEventListener('mousemove', e => this.move(e));
    window.addEventListener('mouseup', e => this.up(e));
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (this.canvas.width / r.width), y: (e.clientY - r.top) * (this.canvas.height / r.height) };
  }

  down(e) {
    const p = this.pos(e);
    this.mouse = p;
    if (e.button !== 0) { this.selected.clear(); this.dragging = false; return; }
    if (this.spellTarget) return; // spell click handled in up()
    const b = this.game.buildingAt(p.x, p.y, 6);
    this.dragging = true;
    this.dragStart = p;
    this.selected.clear();
    if (b && b.owner === OWNER.PLAYER) this.selected.add(b);
  }

  move(e) {
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
    const p = this.pos(e);
    this.mouse = p;
    if (e.button !== 0) return;
    if (this.spellTarget) {
      this.onCast(p.x, p.y);
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    const target = this.game.buildingAt(p.x, p.y, 12);
    if (target && this.selected.size) {
      for (const b of this.selected) {
        if (b !== target) this.game.sendTroops(b, target, OWNER.PLAYER);
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
