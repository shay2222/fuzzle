/* The world built from one generated level: collision, hazards, critters, and drawing. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const TS = FZ.TS;
  const T = FZ.TILE;
  const SPIKE_PERIOD = 2.4; // seconds per cycle
  const SPIKE_UP = 0.95;    // seconds spent up (deadly)
  const SPIKE_WARN = 0.45;  // seconds of warning before they rise

  class World {
    constructor(L) {
      this.L = L;
      this.meta = L.meta;
      this.area = FZ.AREAS[L.area];
      this.w = L.w;
      this.h = L.h;
      this.tiles = L.tiles;
      this.phase = L.phase;
      this.pxW = this.w * TS;
      this.pxH = this.h * TS;
      const center = (tx, ty) => ({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
      this.start = center(L.start.tx, L.start.ty);
      this.portal = Object.assign(center(L.portal.tx, L.portal.ty), { active: false });
      this.seeds = L.seeds.map((s) => Object.assign(center(s.tx, s.ty), { got: false, phase: FZ.hash2(s.tx, s.ty, 7) * 6.28 }));
      this.critters = L.critters.map((c) => new FZ.Critter(c, this.area.critter));
      this.isBoss = !!L.boss;
      this.cages = (L.cages || []).map((c) => Object.assign(center(c.tx, c.ty), { tx: c.tx, ty: c.ty, member: c.member, open: false }));
      this.props = [];
      this.spikes = [];
      this.pools = [];
      this.glows = []; // light sources for dark areas

      const wallAt = (x, y) => x < 0 || y < 0 || x >= this.w || y >= this.h || this.tiles[y * this.w + x] === T.WALL;
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          const t = this.tiles[ty * this.w + tx];
          const c = center(tx, ty);
          const v = Math.floor(FZ.hash2(tx, ty, 3) * 3);
          if (t === T.WALL) {
            // a tall sprite only where everything it would cover is wall too, so it never hides play
            const tall = wallAt(tx - 1, ty - 1) && wallAt(tx, ty - 1) && wallAt(tx + 1, ty - 1) && wallAt(tx, ty - 2);
            this.props.push({ kind: tall ? 'tall' : 'short', x: c.x, y: (ty + 1) * TS, v });
          } else if (t === T.BLOCK || t === T.ROCK) {
            this.props.push({ kind: t === T.BLOCK ? 'block' : 'rock', x: c.x, y: (ty + 1) * TS, v });
            if (t === T.BLOCK && this.area.id === 'caves') this.glows.push({ x: c.x, y: c.y - 4, r: 74, s: 0.75 });
          } else if (t === T.SPIKES) {
            this.spikes.push({ tx, ty, i: ty * this.w + tx });
          } else if (t === T.POOL) {
            this.pools.push({ tx, ty });
          } else if (t === T.DECOR && (this.area.id === 'caves' || this.area.id === 'lair')) {
            this.glows.push({ x: c.x, y: c.y, r: this.area.id === 'lair' ? 60 : 38, s: 0.6 });
          }
        }
      }
      this.res = 0;
    }

    tileAt(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return T.WALL;
      return this.tiles[ty * this.w + tx];
    }

    isSolid(tx, ty) { return FZ.SOLID.has(this.tileAt(tx, ty)); }

    boxHits(x, y, hb) {
      const x0 = Math.floor((x - hb) / TS);
      const x1 = Math.floor((x + hb - 0.001) / TS);
      const y0 = Math.floor((y - hb) / TS);
      const y1 = Math.floor((y + hb - 0.001) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true;
      return false;
    }

    /**
     * Moves an entity's box one axis at a time, so walls stop one direction without
     * stopping the other. Clipping a corner nudges Fuzzle around it instead of snagging.
     * Returns true if the move hit a wall.
     */
    moveBox(e, dx, dy) {
      let bumped = false;
      const hb = e.hb;
      if (dx) {
        e.x += dx;
        if (this.boxHits(e.x, e.y, hb)) {
          e.x = dx > 0 ? Math.floor((e.x + hb) / TS) * TS - hb - 0.01 : (Math.floor((e.x - hb) / TS) + 1) * TS + hb + 0.01;
          const slid = Math.abs(dy) <= 0.3 && this.nudge(e, 'y', Math.sign(dx));
          if (!slid) { e.vx = 0; bumped = true; }
        }
      }
      if (dy) {
        e.y += dy;
        if (this.boxHits(e.x, e.y, hb)) {
          e.y = dy > 0 ? Math.floor((e.y + hb) / TS) * TS - hb - 0.01 : (Math.floor((e.y - hb) / TS) + 1) * TS + hb + 0.01;
          const slid = Math.abs(dx) <= 0.3 && this.nudge(e, 'x', Math.sign(dy));
          if (!slid) { e.vy = 0; bumped = true; }
        }
      }
      return bumped;
    }

    nudge(e, axis, dir) {
      const hb = e.hb;
      for (let k = 1; k <= 10; k++) {
        for (const s of [-1, 1]) {
          const ox = axis === 'x' ? s * k : dir;
          const oy = axis === 'y' ? s * k : dir;
          if (!this.boxHits(e.x + ox, e.y + oy, hb)) {
            const step = s * Math.min(k, 1.6);
            const nx = axis === 'x' ? e.x + step : e.x;
            const ny = axis === 'y' ? e.y + step : e.y;
            if (!this.boxHits(nx, ny, hb)) { e.x = nx; e.y = ny; return true; }
          }
        }
      }
      return false;
    }

    /** 0 = down and safe, 0..1 = warning, 1 = up and deadly. */
    spikeState(i, t) {
      const local = (((t + this.phase[i]) % SPIKE_PERIOD) + SPIKE_PERIOD) % SPIKE_PERIOD;
      if (local < SPIKE_UP) return 1;
      if (local > SPIKE_PERIOD - SPIKE_WARN) return (local - (SPIKE_PERIOD - SPIKE_WARN)) / SPIKE_WARN;
      return 0;
    }

    /** Returns what poofed Fuzzle, or null. Hazards are judged at the feet with a small box. */
    hazardHit(e, t) {
      const hb = e.hb * 0.55;
      const fy = e.y + 4;
      const x0 = Math.floor((e.x - hb) / TS);
      const x1 = Math.floor((e.x + hb) / TS);
      const y0 = Math.floor((fy - hb) / TS);
      const y1 = Math.floor((fy + hb) / TS);
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const tile = this.tileAt(tx, ty);
          if (tile === T.HAZARD) return 'hazard';
          if (tile === T.SPIKES && this.spikeState(ty * this.w + tx, t) >= 1) return 'spikes';
        }
      }
      for (const c of this.critters) if (c.hits(e)) return 'critter';
      return null;
    }

    update(dt) {
      for (const c of this.critters) c.update(dt);
    }

    resetSeeds() {
      for (const s of this.seeds) s.got = false;
      this.portal.active = false;
    }

    /** Opens the cage holding `memberId`. The cage tile becomes walkable. Returns the cage. */
    openCage(memberId, quiet) {
      const c = this.cages.find((k) => k.member === memberId && !k.open);
      if (!c) return null;
      c.open = true;
      this.tiles[c.ty * this.w + c.tx] = T.FLOOR;
      if (!quiet) {
        FZ.fx.sparkle(c.x, c.y - 20, 18, '#ffe066');
        FZ.fx.fluff(c.x, c.y - 10, 12, { speed: 120, yellow: 0.3 });
        FZ.fx.ring(c.x, c.y + 10, '#ffffff', 30);
        FZ.sfx.play('free');
      }
      return c;
    }

    /* ---------------- painting ---------------- */
    prepare(res) {
      if (res === this.res) return;
      this.res = res;
      const sp = this.area.sprites;
      this.sprites = {};
      for (const kind of ['tall', 'short', 'block', 'rock']) this.sprites[kind] = [0, 1, 2].map((v) => sp[kind](res, v));
      this.ground = this.paintGround(res);
    }

    paintGround(res) {
      const s = FZ.makeCanvas(this.pxW, this.pxH, res);
      const g = s.g;
      const a = this.area;
      a.paintGround(g, this, FZ.rng(this.meta.seed));
      for (let ty = 0; ty < this.h; ty++) {
        for (let tx = 0; tx < this.w; tx++) {
          const t = this.tileAt(tx, ty);
          if (t !== T.POOL && t !== T.HAZARD) a.tileDetail(g, tx, ty);
          if (t === T.DECOR) a.decor(g, tx, ty);
          if (t === T.POOL) FZ.paintPoolTile(g, this, tx, ty, a.pool);
          if (t === T.SPIKES) FZ.paintSpikeBase(g, tx, ty, a.spikes);
          if (t === T.WALL || t === T.BLOCK || t === T.ROCK) {
            g.fillStyle = a.shadow;
            g.beginPath();
            g.ellipse(tx * TS + TS / 2, ty * TS + TS - 6, t === T.WALL ? 28 : 22, 9, 0, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      if (a.paintOverlay) a.paintOverlay(g, this);
      FZ.paintHazardPatches(g, this, a.hazard);
      return s.c;
    }

    drawGround(ctx) {
      ctx.drawImage(this.ground, 0, 0, this.pxW, this.pxH);
    }

    drawAnimatedTiles(ctx, t, view) {
      // pool shimmer
      ctx.strokeStyle = this.area.pool.shimmer;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (const p of this.pools) {
        if (!inView(view, p.tx * TS, p.ty * TS, 60)) continue;
        const ph = FZ.hash2(p.tx, p.ty, 90) * 6.28;
        const x = p.tx * TS + 12 + Math.sin(t * 0.8 + ph) * 6;
        const y = p.ty * TS + 16 + FZ.hash2(p.tx, p.ty, 91) * 16;
        const len = 6 + Math.sin(t * 1.6 + ph) * 3;
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + ph);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len / 2, y - 2, x + len, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // timed spikes
      for (const s of this.spikes) {
        if (!inView(view, s.tx * TS, s.ty * TS, 60)) continue;
        this.area.spikes.draw(ctx, s.tx * TS, s.ty * TS, this.spikeState(s.i, t), t);
      }
    }

    /** The checker's guaranteed route, drawn as a dotted trail (developer panel). */
    drawRoute(ctx, t) {
      const route = this.meta.route;
      if (!route.length) return;
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#1d3f8a';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < route.length; k++) {
        const i = route[k];
        const x = (i % this.w) * TS + TS / 2;
        const y = Math.floor(i / this.w) * TS + TS / 2;
        const pulse = 0.5 + 0.5 * Math.sin(t * 6 - k * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, 3 + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    /**
     * Everything that stands up is sorted by its feet so Fuzzle can walk behind things.
     * A tall sprite turns see-through if it would hide Fuzzle, a seed, or the portal.
     */
    collectDrawables(list, t, reveal, view) {
      const sp = this.sprites;
      for (const p of this.props) {
        if (!inView(view, p.x, p.y, 120)) continue;
        const s = sp[p.kind][p.v];
        const top = p.y - s.h + s.pad;
        let alpha = 1;
        if (p.kind === 'tall') {
          for (const q of reveal) {
            if (q.y < p.y - 8 && q.y > top + 10 && Math.abs(q.x - p.x) < s.w / 2 - 4) { alpha = 0.42; break; }
          }
        }
        list.push({
          y: p.y - 1,
          draw: (ctx) => {
            ctx.globalAlpha = alpha;
            ctx.drawImage(s.c, p.x - s.w / 2, top, s.w, s.h);
            ctx.globalAlpha = 1;
          },
        });
      }
      for (const seed of this.seeds) {
        if (!seed.got && inView(view, seed.x, seed.y, 60)) list.push({ y: seed.y, draw: (ctx) => drawSeed(ctx, seed, t) });
      }
      const p = this.portal;
      if (!this.isBoss || p.active) list.push({ y: p.y - 12, draw: (ctx) => drawPortal(ctx, p, t) });
      for (const c of this.cages) {
        const m = c.member && FZ.member ? FZ.member(c.member) : null;
        list.push({ y: c.y + 16, draw: (ctx) => FZ.drawCage(ctx, c.x, c.y + 16, m, t, c.open) });
      }
      for (const c of this.critters) {
        if (inView(view, c.x, c.y, 60)) list.push({ y: c.y + 12, draw: (ctx) => c.draw(ctx) });
      }
    }

    /** Light sources for dark areas, in world coordinates. */
    lights(player, t) {
      const out = [];
      out.push({ x: player.x, y: player.y - 10, r: 175 * ((player.mods && player.mods.light) || 1), s: 1 });
      for (const s of this.seeds) if (!s.got) out.push({ x: s.x, y: s.y - 6, r: 56, s: 0.85 });
      out.push({ x: this.portal.x, y: this.portal.y - 10, r: this.portal.active ? 130 : 70, s: this.portal.active ? 1 : 0.6 });
      for (const g of this.glows) out.push(g);
      for (const sp of this.spikes) {
        const st = this.spikeState(sp.i, t);
        if (st > 0) out.push({ x: sp.tx * TS + TS / 2, y: sp.ty * TS + TS / 2, r: st >= 1 ? 46 : 26, s: st >= 1 ? 0.9 : 0.5 });
      }
      for (const c of this.critters) out.push({ x: c.x, y: c.y - 12, r: 40, s: 0.7 });
      for (const c of this.cages) if (!c.open) out.push({ x: c.x, y: c.y - 10, r: 64, s: 0.75 });
      return out;
    }
  }

  /** A round iron cage with Oink's padlock. A sad family member waits inside until it opens. */
  FZ.drawCage = function (ctx, x, y, member, t, open) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    const top = -64;
    if (!open) {
      if (member) {
        ctx.save();
        ctx.translate(0, -3);
        ctx.scale(0.8, 0.8);
        const blink = ((t * 0.7 + x * 0.013) % 3.2) < 0.12 ? 1 : 0;
        FZ.drawFuzzle(ctx, {
          t: t + x * 0.01, sx: 1, sy: 1, hop: 0, fx: Math.sin(t * 0.6 + x) * 0.2, fy: 0.6, moving: false, step: 0,
          blink, mood: 'sad', dashing: false, pal: member.pal,
        });
        ctx.restore();
      }
      ctx.lineCap = 'round';
      for (const [color, width] of [['#241634', 3.6], ['#8a7aa8', 1.4]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        for (let i = -3; i <= 3; i++) {
          const bx = i * 8;
          ctx.beginPath();
          ctx.moveTo(bx, -2);
          ctx.lineTo(bx, top + 24 - Math.abs(i) * 1.5);
          ctx.quadraticCurveTo(bx * 0.95, top + 4 + Math.abs(i) * 2.2, 0, top);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.ellipse(0, top + 26, 25, 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#241634';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, top - 5, 5, 0, Math.PI * 2);
      ctx.stroke();
      // padlock stamped with a pig snout
      const glow = 0.5 + 0.5 * Math.sin(t * 3 + x);
      ctx.fillStyle = FZ.rgba('#c23cff', 0.25 + glow * 0.25);
      ctx.beginPath();
      ctx.arc(0, -16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1024';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -22, 4.5, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = '#7a2ad8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-7, -22, 14, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f0a8c4';
      ctx.beginPath();
      ctx.ellipse(0, -16, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a1f3e';
      ctx.beginPath();
      ctx.arc(-1.4, -16, 0.9, 0, Math.PI * 2);
      ctx.arc(1.4, -16, 0.9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#241634';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      for (const [bx, lean] of [[-18, -0.6], [-6, -0.15], [10, 0.4], [20, 0.75]]) {
        ctx.beginPath();
        ctx.moveTo(bx, -2);
        ctx.lineTo(bx + Math.sin(lean) * 16, -2 - Math.cos(lean) * 16);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#3a2a4a';
    ctx.strokeStyle = '#1a1024';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -1, 28, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a4870';
    ctx.beginPath();
    ctx.ellipse(0, -3, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  function inView(view, x, y, pad) {
    return !view || (x > view.x0 - pad && x < view.x1 + pad && y > view.y0 - pad && y < view.y1 + pad);
  }

  function drawSeed(ctx, s, t) {
    const bob = Math.sin(t * 3 + s.phase) * 3;
    ctx.fillStyle = 'rgba(22, 52, 30, 0.25)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 10, 7 - bob * 0.3, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const y = s.y - 6 + bob;
    const glow = ctx.createRadialGradient(s.x, y, 1, s.x, y, 22);
    glow.addColorStop(0, 'rgba(255, 236, 140, 0.8)');
    glow.addColorStop(1, 'rgba(255, 236, 140, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(s.x, y);
    ctx.rotate(Math.sin(t * 2 + s.phase) * 0.25);
    ctx.fillStyle = '#ffe066';
    ctx.strokeStyle = '#c98a06';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.quadraticCurveTo(7, -1, 0, 7);
    ctx.quadraticCurveTo(-7, -1, 0, -8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.ellipse(-1.6, -2, 1.4, 2.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    const tw = (Math.sin(t * 5 + s.phase * 2) + 1) / 2;
    ctx.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`;
    ctx.translate(6, -7);
    ctx.rotate(t);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 3.5 * (0.6 + tw * 0.5) : 1;
      ctx.lineTo(Math.cos((i / 8) * Math.PI * 2) * r, Math.sin((i / 8) * Math.PI * 2) * r);
    }
    ctx.fill();
    ctx.restore();
  }

  function drawPortal(ctx, p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const on = p.active;
    if (on) {
      const beam = ctx.createLinearGradient(0, 0, 0, -86);
      beam.addColorStop(0, 'rgba(170, 245, 255, 0.5)');
      beam.addColorStop(1, 'rgba(170, 245, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.ellipse(0, -40, 18 + Math.sin(t * 3) * 2, 48, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 21, 10, 0, 0, Math.PI * 2);
    if (on) {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
      g.addColorStop(0, '#f2feff');
      g.addColorStop(0.4, '#7ae6f6');
      g.addColorStop(1, '#2a8fd8');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#2f4d3b';
    }
    ctx.fill();
    if (on) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 16 - k * 4.5, 7.5 - k * 2.2, 0, t * 3 + k * 2, t * 3 + k * 2 + 2.4);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = Math.cos(a) * 27;
      const y = Math.sin(a) * 13;
      const h = 7 + (i % 2) * 3;
      ctx.fillStyle = '#3c4658';
      ctx.beginPath(); ctx.roundRect(x - 5, y - h, 10, h + 4, 3); ctx.fill();
      ctx.fillStyle = on ? (i % 2 ? '#a4f1ff' : '#c5d2e2') : '#97a5b8';
      ctx.beginPath(); ctx.roundRect(x - 3.8, y - h + 1.2, 7.6, h + 1.6, 2.5); ctx.fill();
    }
    ctx.restore();
  }

  FZ.World = World;
})(window.FZ);
