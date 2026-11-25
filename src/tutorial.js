// Training-grounds tutorial, faithful to the original SWF sequence:
// 5 steps with the original instruction text, NEXT / SKIP TUTORIAL buttons.
export const TUT = {
  active: false,
  step: 0,
  steps: [
    { key: 'step1', title: 'STEP 1 OF 5',
      text: "CLICK AND HOLD YOUR MOUSE OVER YOUR BUILDING TO SELECT IT. WHILE STILL HOLDING, MOVE YOUR MOUSE OVER A BUILDING YOU'D LIKE TO ATTACK AND RELEASE.",
      auto: 'send' },
    { key: 'step2', title: 'STEP 2 OF 5',
      text: "TO SELECT MULTIPLE BUILDINGS, CLICK, HOLD, AND DRAG ACROSS UP TO 15 BUILDINGS AND RELEASE ON A BUILDING YOU'D LIKE TO ATTACK.",
      auto: 'send', next: true },
    { key: 'step3', title: 'STEP 3 OF 5',
      text: "CRYSTALS ON MAP GIVE MORE CRYSTAL ENERGY WHICH IS NEEDED TO USE SPELLS AND INCREASE SPEED OF YOUR TROOPS, BUT THEY DON'T GENERATE PEOPLE. THE MORE PEOPLE INSIDE, THE MORE CRYSTALS YOU'LL GET.",
      next: true },
    { key: 'step4', title: 'STEP 4 OF 5',
      text: "TOWERS ARE DEFENSE STRUCTURES, THEY INCREASE DEFENSE AND ATTACK OF YOUR TROOPS, BUT THEY DON'T GENERATE PEOPLE. THE MORE PEOPLE INSIDE, THE FASTER IT SHOOTS.",
      next: true },
    { key: 'step5', title: 'FINAL STEP',
      text: 'TO USE SPELLS, YOU FIRST SHOULD LEARN THEM IN SKILLS MENU, AND YOU MUST HAVE ENOUGH CRYSTAL ENERGY ON STAGE. THEN CLICK ON IT AND CLICK WHERE YOU WANT TO USE IT.',
      next: true },
  ],
  start() { this.active = true; this.step = 0; },
  finish() { this.active = false; },
  next() { this.step++; if (this.step >= this.steps.length) this.finish(); },
  notifySend() { if (this.active && this.steps[this.step].auto === 'send') this.next(); },
  // Button rects in canvas coords.
  rects() {
    return {
      next: { x: 668, y: 552, w: 96, h: 34 },
      skip: { x: 790, y: 552, w: 150, h: 34 },
    };
  },
  hit(x, y) {
    if (!this.active) return null;
    const r = this.rects();
    if (x >= r.skip.x && x <= r.skip.x + r.skip.w && y >= r.skip.y && y <= r.skip.y + r.skip.h) return 'skip';
    if (this.steps[this.step].next && x >= r.next.x && x <= r.next.x + r.next.w && y >= r.next.y && y <= r.next.y + r.next.h) return 'next';
    return null; // gameplay stays interactive — steps 1-2 require it
  },
  draw(c) {
    if (!this.active) return;
    const st = this.steps[this.step];
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(0, 0, 960, 600);
    // Speech bubble.
    const bx = 130, by = 392, bw = 560, bh = 176;
    c.fillStyle = '#fff';
    c.strokeStyle = '#1a120b'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#1a120b';
    c.textAlign = 'center';
    c.font = 'bold 15px Georgia';
    c.fillText(st.title, bx + bw / 2, by + 40);
    c.font = 'bold 14px Georgia';
    c.fillStyle = '#c22222';
    // Word-wrap the text.
    const words = st.text.split(' ');
    let line = '', yy = by + 68;
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (c.measureText(t).width > bw - 90) {
        c.fillText(line, bx + bw / 2, yy); yy += 20; line = w;
      } else line = t;
    }
    if (line) c.fillText(line, bx + bw / 2, yy);
    // Buttons.
    const r = this.rects();
    const btn = (rr, label) => {
      c.fillStyle = '#e8d9a8'; c.strokeStyle = '#5a4426'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(rr.x, rr.y, rr.w, rr.h, 5); c.fill(); c.stroke();
      c.fillStyle = '#3a2a12'; c.font = 'bold 15px Georgia'; c.textAlign = 'center';
      c.fillText(label, rr.x + rr.w / 2, rr.y + 22);
    };
    if (st.next) btn(r.next, 'NEXT');
    btn(r.skip, 'SKIP TUTORIAL');
    c.restore();
  },
};
