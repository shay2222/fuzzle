/* Fuzzle's family: who they are, where Oink hid them, and how they follow Fuzzle once freed. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const P = FZ.PALETTES;

  /**
   * The three siblings are caged at the end of each cursed land. Oink keeps Mama, Papa,
   * and baby Pip in his tower; each crystal-powered hit on Oink frees one of them.
   */
  FZ.FAMILY = [
    { id: 'ember', name: 'Ember', short: 'Ember', pal: P.ember, area: 0 },
    { id: 'sunny', name: 'Sunny', short: 'Sunny', pal: P.sunny, area: 1 },
    { id: 'mallow', name: 'Mallow', short: 'Mallow', pal: P.mallow, area: 2 },
    { id: 'pip', name: 'baby Pip', short: 'Pip', pal: P.pip, bossHit: 1 },
    { id: 'mama', name: 'Mama Plum', short: 'Mama Plum', pal: P.mama, bossHit: 2 },
    { id: 'papa', name: 'Papa Clover', short: 'Papa Clover', pal: P.papa, bossHit: 3 },
  ];
  FZ.member = (id) => FZ.FAMILY.find((m) => m.id === id);
  FZ.memberForArea = (area) => FZ.FAMILY.find((m) => m.area === area);
  FZ.memberForHit = (hit) => FZ.FAMILY.find((m) => m.bossHit === hit);

  /** Draws a family member standing at (f.x, f.y), with a shadow. Used by followers and the boss room. */
  FZ.drawMember = function (ctx, f) {
    const size = (f.m.pal.size || 1) * 0.9;
    const hop = f.moving ? Math.abs(Math.sin(f.step * Math.PI * 2)) * 4 : f.mood === 'happy' ? Math.abs(Math.sin(f.t * 7)) * 5 : 0;
    ctx.fillStyle = 'rgba(10, 30, 20, 0.25)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 11, 14 * size, 4.6 * size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(f.x, f.y + 12);
    ctx.scale(0.9, 0.9);
    FZ.drawFuzzle(ctx, {
      t: f.t, sx: 1, sy: 1, hop, fx: f.fx, fy: f.fy, moving: f.moving, step: f.step,
      blink: f.blink, mood: f.mood, dashing: false, pal: f.m.pal,
    });
    ctx.restore();
  };

  function makeMember(m, x, y) {
    return { m, x, y, fx: 0, fy: 1, step: 0, moving: false, blink: 0, blinkT: 1 + Math.random() * 2, mood: 'idle', moodT: 0, t: Math.random() * 10 };
  }

  function tickFace(f, dt) {
    f.t += dt;
    f.blinkT -= dt;
    if (f.blinkT <= 0) { f.blink = 0.13; f.blinkT = 1.8 + Math.random() * 3; }
    f.blink = Math.max(0, f.blink - dt);
    if (f.moodT > 0) {
      f.moodT -= dt;
      if (f.moodT <= 0) f.mood = 'idle';
    }
  }
  FZ.tickFace = tickFace;
  FZ.makeMember = makeMember;

  /** Freed family hop along behind Fuzzle, retracing the path Fuzzle took. */
  const GAP = 11; // trail samples between followers (a sample every 3px)
  const START_SPOTS = [[-36, 10], [36, 10], [0, 42]];

  class Followers {
    constructor() {
      this.list = [];
      this.trail = [];
    }

    reset(ids, x, y) {
      this.trail = [{ x, y }];
      this.list = ids.map((id, i) => {
        const [ox, oy] = START_SPOTS[i % START_SPOTS.length];
        return makeMember(FZ.member(id), x + ox, y + oy);
      });
    }

    add(member, x, y) {
      if (this.list.some((f) => f.m.id === member.id)) return;
      const f = makeMember(member, x, y);
      f.mood = 'happy';
      f.moodT = 1.2;
      this.list.push(f);
    }

    update(dt, p) {
      const last = this.trail[this.trail.length - 1];
      if (p.alive && (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 3)) this.trail.push({ x: p.x, y: p.y });
      if (this.trail.length > 600) this.trail.splice(0, this.trail.length - 600);
      this.list.forEach((f, i) => {
        tickFace(f, dt);
        const idx = this.trail.length - 1 - (i + 1) * GAP;
        f.moving = false;
        if (idx < 0) return;
        const target = this.trail[idx];
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const d = Math.hypot(dx, dy);
        if (d < 1.5) return;
        const step = Math.min(d, Math.min(d * 9, 420) * dt);
        f.x += (dx / d) * step;
        f.y += (dy / d) * step;
        f.fx = dx / d;
        f.fy = dy / d;
        f.moving = d > 4;
        f.step += step * 0.0105 * (1 / Math.max(0.6, f.m.pal.size || 1));
      });
    }

    cheer() {
      this.list.forEach((f, i) => {
        f.mood = 'happy';
        f.moodT = 0.6 + i * 0.1;
      });
    }

    collect(list) {
      for (const f of this.list) list.push({ y: f.y + 12, draw: (ctx) => FZ.drawMember(ctx, f) });
    }

    lights() {
      return this.list.map((f) => ({ x: f.x, y: f.y - 10, r: 70, s: 0.75 }));
    }
  }

  FZ.Followers = Followers;
})(window.FZ);
