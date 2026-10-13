/*
 * The final level: Oink's Tower.
 *
 * Oink is shielded by his curse. A Heart Crystal appears in the arena between attacks;
 * grabbing it fills Fuzzle with its power for a few seconds, and touching Oink while
 * powered lands a hit. Each hit frees one family member. Three hits break the spell.
 * Falling reshapes the tower (new pillar layout), but hits already landed are kept.
 */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const TS = FZ.TS;
  const T = FZ.TILE;
  const IW = 19;
  const IH = 13;
  const B = 3;
  const CX = B + Math.floor(IW / 2);
  FZ.BOSS_AREA = 3;

  // where freed family members wait and cheer
  const CHEER_SPOTS = { pip: [B + 1, B + IH - 2], mama: [B + IW - 2, B + IH - 2], papa: [B + 2, B + IH - 1] };

  FZ.generateBossLevel = function (runSeed, attempt) {
    const seed = FZ.levelSeed(runSeed, FZ.BOSS_AREA, 0, attempt);
    const rnd = FZ.rng(seed);
    const w = IW + B * 2;
    const h = IH + B * 2;
    const tiles = new Uint8Array(w * h).fill(T.WALL);
    const set = (x, y, t) => { tiles[y * w + x] = t; };
    for (let y = B; y < B + IH; y++) for (let x = B; x < B + IW; x++) set(x, y, T.FLOOR);

    // candles along the walls
    for (let x = B + 1; x < B + IW - 1; x += 2) if (Math.abs(x - CX) > 2 && rnd.chance(0.45)) set(x, B + IH - 1, T.DECOR);
    for (let y = B + 2; y < B + IH - 1; y += 2) {
      if (rnd.chance(0.5)) set(B, y, T.DECOR);
      if (rnd.chance(0.5)) set(B + IW - 1, y, T.DECOR);
    }

    const cages = [
      { tx: CX - 5, ty: B, member: 'pip' },
      { tx: CX, ty: B, member: 'mama' },
      { tx: CX + 5, ty: B, member: 'papa' },
    ];
    for (const c of cages) set(c.tx, c.ty, T.CAGE);

    // mirrored pillars that move every attempt, for cover from Oink's magic
    const spots = [];
    for (let y = B + 3; y <= B + IH - 4; y++) for (let x = B + 2; x <= CX - 3; x++) spots.push([x, y]);
    for (let i = spots.length - 1; i > 0; i--) { const j = rnd.int(0, i); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    const chosen = [];
    const want = rnd.int(2, 3);
    for (const s of spots) {
      if (chosen.length >= want) break;
      if (chosen.every((c) => Math.abs(c[0] - s[0]) + Math.abs(c[1] - s[1]) >= 4)) chosen.push(s);
    }
    for (const [x, y] of chosen) {
      const kind = rnd.chance(0.5) ? T.ROCK : T.BLOCK;
      set(x, y, kind);
      set(2 * CX - x, y, kind);
    }
    if (rnd.chance(0.5)) {
      const y = B + IH - 4;
      for (const x of [B + 2, B + 3]) { set(x, y, T.POOL); set(2 * CX - x, y, T.POOL); }
    }

    const L = {
      w, h, area: FZ.BOSS_AREA, d: 9, tiles, keep: new Uint8Array(w * h), phase: new Float32Array(w * h),
      chambers: [], seeds: [], critters: [], cages, boss: true,
      start: { tx: CX, ty: B + IH - 2 }, portal: { tx: CX, ty: B + 2 },
    };
    L.meta = {
      seed, runSeed, area: FZ.BOSS_AREA, level: 0, attempt, difficulty: 9, rejected: 0, rejectedWhy: [], carved: false,
      route: [], routeLength: 0, par: 0, templates: ['boss arena', `${chosen.length * 2} pillars`], boss: true,
    };
    return L;
  };

  class Oink {
    constructor(world, hp) {
      this.world = world;
      this.hp = hp;
      this.x = world.pxW / 2;
      this.y = (B + 4.6) * TS;
      this.t = 0;
      this.st = 0;
      this.state = 'intro';
      this.mood = 'idle';
      this.facing = 1;
      this.flash = 0;
      this.orbs = [];
      this.zones = [];
      this.crystal = null;
      this.crystalCd = 1.6;
      this.cheer = [];
      this.rnd = FZ.rng((world.meta.seed ^ 0x51a7) >>> 0);
      this.minX = (B + 1.6) * TS;
      this.maxX = (B + IW - 1.6) * TS;
      this.minY = (B + 2.6) * TS;
      this.maxY = (B + IH - 0.9) * TS;
      this.dir = { x: 0, y: 1 };
      this.wonSent = false;
    }

    get phase() { return Math.max(0, Math.min(2, 3 - this.hp)); }
    get heart() { return FZ.HEARTS[this.phase]; }
    get vulnerable() { return !['intro', 'hurt', 'defeated', 'gone'].includes(this.state); }
    get beaten() { return this.state === 'defeated' || this.state === 'gone'; }
    bodyY() { return this.y - 46; }

    /** After a poof, family already freed waits in their cheering spots. */
    restoreFreed(rescued) {
      for (const m of FZ.FAMILY) {
        if (m.bossHit && rescued.includes(m.id)) {
          this.world.openCage(m.id, true);
          const [tx, ty] = CHEER_SPOTS[m.id];
          const f = FZ.makeMember(m, tx * TS + TS / 2, ty * TS + TS / 2);
          f.home = { x: f.x, y: f.y };
          this.cheer.push(f);
        }
      }
    }

    enter(s) {
      this.state = s;
      this.st = 0;
      this.shots = 0;
      if (s === 'move') {
        const r = this.rnd;
        this.from = { x: this.x, y: this.y };
        let best = null;
        for (let k = 0; k < 10; k++) {
          const c = { x: r.range(this.minX, this.maxX), y: r.range(this.minY, this.maxY - TS * 2.5) };
          const d = Math.hypot(c.x - this.px, c.y - this.py);
          const score = Math.min(d, 380) + r() * 60;
          if (!best || score > best.score) best = { x: c.x, y: c.y, score };
        }
        this.to = best;
        this.moveTime = 1.1 - this.phase * 0.15;
      } else if (s === 'thorns') {
        this.makeZones();
      } else if (s === 'charge') {
        this.aim();
      }
    }

    aim() {
      const dx = this.px - this.x;
      const dy = this.py - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.dir = { x: dx / d, y: dy / d };
    }

    nextAttack() {
      const pools = [
        ['volley', 'aim', 'volley', 'aim'],
        ['volley', 'spiral', 'thorns', 'aim'],
        ['spiral', 'charge', 'thorns', 'volley', 'charge'],
      ];
      let pick = this.rnd.pick(pools[this.phase]);
      if (pick === this.last) pick = this.rnd.pick(pools[this.phase]);
      this.last = pick;
      this.enter(pick);
    }

    fire(a, sp) {
      this.orbs.push({
        x: this.x + Math.cos(a) * 30 * this.facing, y: this.bodyY() + Math.sin(a) * 26,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, r: 9,
      });
    }

    /** Thorn lines sprout across the room after a warning, each with a gap to slip through. */
    makeZones() {
      const r = this.rnd;
      const rows = r.chance(0.5);
      const lines = [];
      if (rows) {
        const options = [];
        for (let y = B + 2; y <= B + IH - 2; y++) options.push(y);
        while (lines.length < 3 && options.length) {
          const y = options.splice(r.int(0, options.length - 1), 1)[0];
          if (lines.every((l) => Math.abs(l - y) >= 3)) lines.push(y);
        }
        for (const y of lines) {
          const gap = r.int(B + 1, B + IW - 4);
          for (let x = B; x < B + IW; x++) {
            if (x >= gap && x < gap + 3) continue;
            this.addZone(x, y);
          }
        }
      } else {
        const options = [];
        for (let x = B + 2; x <= B + IW - 3; x++) options.push(x);
        while (lines.length < 4 && options.length) {
          const x = options.splice(r.int(0, options.length - 1), 1)[0];
          if (lines.every((l) => Math.abs(l - x) >= 4)) lines.push(x);
        }
        for (const x of lines) {
          const gap = r.int(B + 2, B + IH - 4);
          for (let y = B + 1; y < B + IH; y++) {
            if (y >= gap && y < gap + 3) continue;
            this.addZone(x, y);
          }
        }
      }
    }

    addZone(tx, ty) {
      const t = this.world.tileAt(tx, ty);
      if (t !== T.FLOOR && t !== T.DECOR) return;
      this.zones.push({ tx, ty, t: 0, warn: 0.95, live: 2.3 });
    }

    spawnCrystal() {
      const r = this.rnd;
      for (let k = 0; k < 50; k++) {
        const tx = r.int(B + 1, B + IW - 2);
        const ty = r.int(B + 2, B + IH - 2);
        const t = this.world.tileAt(tx, ty);
        if (t !== T.FLOOR && t !== T.DECOR) continue;
        const x = tx * TS + TS / 2;
        const y = ty * TS + TS / 2;
        if (Math.hypot(x - this.x, y - this.bodyY()) < 170) continue;
        if (Math.hypot(x - this.px, y - this.py) < 120) continue;
        if (this.zones.some((z) => z.tx === tx && z.ty === ty)) continue;
        this.crystal = { x, y, t: 0 };
        FZ.fx.sparkle(x, y - 10, 16, this.heart.color);
        FZ.fx.ring(x, y + 6, this.heart.color, 24);
        return;
      }
    }

    /** One step of the fight. Returns events for the game: power, fade, hit, won. */
    update(dt, p) {
      const events = [];
      this.t += dt;
      this.st += dt;
      this.px = p.x;
      this.py = p.y;
      this.flash = Math.max(0, this.flash - dt);
      if (this.state !== 'charge' && this.state !== 'gone') this.facing = p.x < this.x ? -1 : 1;

      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const o = this.orbs[i];
        o.x += o.vx * dt;
        o.y += o.vy * dt;
        o.age += dt;
        const tile = this.world.tileAt(Math.floor(o.x / TS), Math.floor(o.y / TS));
        const blocked = tile === T.WALL || (o.age > 0.2 && (tile === T.ROCK || tile === T.BLOCK || tile === T.CAGE));
        if (o.age > 7 || blocked) {
          if (blocked) FZ.fx.sparkle(o.x, o.y, 4, '#c23cff');
          this.orbs.splice(i, 1);
        }
      }
      for (const z of this.zones) z.t += dt;
      this.zones = this.zones.filter((z) => z.t < z.warn + z.live);
      for (const f of this.cheer) {
        FZ.tickFace(f, dt);
        f.mood = Math.sin(f.t * 1.3) > 0.2 ? 'happy' : 'idle';
        const dx = f.home.x - f.x;
        const dy = f.home.y - f.y;
        const d = Math.hypot(dx, dy);
        f.moving = d > 3;
        if (f.moving) {
          const step = Math.min(d, 260 * dt);
          f.x += (dx / d) * step;
          f.y += (dy / d) * step;
          f.fx = dx / d;
          f.fy = dy / d;
          f.step += step * 0.0105;
        } else {
          f.fx = (this.x - f.x) > 0 ? 0.3 : -0.3;
          f.fy = 0.4;
        }
      }

      switch (this.state) {
        case 'intro':
          this.mood = this.st < 1 ? 'cast' : 'idle';
          if (this.st > 1.6) this.enter('move');
          break;
        case 'move': {
          this.mood = 'idle';
          const k = Math.min(1, this.st / this.moveTime);
          const e = k * k * (3 - 2 * k);
          this.x = FZ.lerp(this.from.x, this.to.x, e);
          this.y = FZ.lerp(this.from.y, this.to.y, e);
          if (this.st > this.moveTime + 0.25 - this.phase * 0.08) this.nextAttack();
          break;
        }
        case 'volley': {
          this.mood = 'cast';
          const rings = this.phase === 0 ? 1 : 2;
          if (this.shots < rings && this.st >= 0.6 + this.shots * 0.55) {
            const n = 10 + this.phase * 2;
            const off = this.rnd() * Math.PI * 2;
            for (let i = 0; i < n; i++) this.fire(off + (i / n) * Math.PI * 2, 118 + this.phase * 22);
            this.shots++;
            FZ.sfx.play('zap');
          }
          if (this.st > 0.6 + rings * 0.55 + 0.45) this.enter('move');
          break;
        }
        case 'aim': {
          this.mood = 'cast';
          if (this.shots < 3 && this.st >= 0.5 + this.shots * 0.45) {
            const a = Math.atan2(p.y - 6 - this.bodyY(), p.x - this.x);
            for (const da of [-0.24, 0, 0.24]) this.fire(a + da, 160 + this.phase * 20);
            this.shots++;
            FZ.sfx.play('zap');
          }
          if (this.st > 0.5 + 3 * 0.45 + 0.35) this.enter('move');
          break;
        }
        case 'spiral': {
          this.mood = 'cast';
          if (this.st > 0.5 && this.st < 3.0) {
            this.spiralT = (this.spiralT || 0) + dt;
            while (this.spiralT > 0.13) {
              this.spiralT -= 0.13;
              this.spin = (this.spin || 0) + 0.31;
              const arms = this.phase + 1;
              for (let k = 0; k < arms; k++) this.fire(this.spin + (k / arms) * Math.PI * 2, 122);
              if (Math.floor(this.st * 8) % 3 === 0) FZ.sfx.play('zap');
            }
          }
          if (this.st > 3.4) this.enter('move');
          break;
        }
        case 'thorns':
          this.mood = 'cast';
          if (this.st > 0.95 + 2.3 + 0.2) this.enter('move');
          break;
        case 'charge': {
          if (this.st < 0.9) {
            this.mood = 'cast';
            if (this.st < 0.5) this.aim();
            this.facing = this.dir.x < 0 ? -1 : 1;
          } else {
            this.mood = 'charge';
            const sp = 540;
            const nx = this.x + this.dir.x * sp * dt;
            const ny = this.y + this.dir.y * sp * dt;
            if (nx < this.minX || nx > this.maxX || ny < this.minY || ny > this.maxY || this.st > 2.6) {
              this.x = FZ.clamp(nx, this.minX, this.maxX);
              this.y = FZ.clamp(ny, this.minY, this.maxY);
              FZ.fx.shake(8);
              FZ.fx.fluff(this.x, this.y - 10, 10, { speed: 120, yellow: 0 });
              FZ.sfx.play('bump');
              this.enter('dizzy');
            } else {
              this.x = nx;
              this.y = ny;
              if (Math.random() < dt * 40) FZ.fx.rise(this.x, this.y - 20, '#c23cff');
            }
          }
          break;
        }
        case 'dizzy':
          this.mood = 'dizzy';
          if (this.st > 1.6) this.enter('move');
          break;
        case 'hurt': {
          this.mood = 'hurt';
          const fade = Math.max(0, 1 - this.st * 1.6);
          this.x = FZ.clamp(this.x + this.kb.x * dt * fade, this.minX, this.maxX);
          this.y = FZ.clamp(this.y + this.kb.y * dt * fade, this.minY, this.maxY);
          if (this.st > 1.5) this.enter(this.hp > 0 ? 'move' : 'defeated');
          break;
        }
        case 'defeated':
          this.mood = 'hurt';
          this.flash = 1;
          if (Math.random() < dt * 20) FZ.fx.sparkle(this.x + (Math.random() - 0.5) * 60, this.y - 30 - Math.random() * 70, 3, FZ.HEARTS[Math.floor(Math.random() * 3)].color);
          if (this.st > 1.5) {
            FZ.fx.ring(this.x, this.y - 30, '#ffffff', 70);
            FZ.fx.sparkle(this.x, this.y - 50, 40, '#f2c8ff');
            FZ.fx.fluff(this.x, this.y - 40, 20, { speed: 180, yellow: 0 });
            FZ.fx.shake(14);
            FZ.sfx.play('oink');
            this.pile = { x: this.x, y: this.y };
            this.pig = { x: this.x + 6, y: this.y, run: 0.7 };
            this.pigDir = this.x < this.world.pxW / 2 ? -1 : 1;
            this.enter('gone');
          }
          break;
        case 'gone':
          if (this.st > this.pig.run) {
            this.pig.x += this.pigDir * 170 * dt;
            this.pig.y += Math.sin(this.st * 3) * 20 * dt;
          }
          if (this.st > 3.2 && !this.wonSent) {
            this.wonSent = true;
            events.push({ type: 'won' });
          }
          break;
      }

      // Heart Crystals appear between attacks while Fuzzle isn't powered
      if (this.vulnerable && !this.crystal && !p.power && p.alive) {
        this.crystalCd -= dt;
        if (this.crystalCd <= 0) this.spawnCrystal();
      }
      if (this.crystal) {
        this.crystal.t += dt;
        if (p.alive && Math.hypot(this.crystal.x - p.x, this.crystal.y - 4 - p.y) < 28) {
          p.power = { color: this.heart.color, t: 7, max: 7 };
          p.mood = 'brave';
          FZ.fx.sparkle(this.crystal.x, this.crystal.y - 10, 22, this.heart.color);
          FZ.sfx.play('power');
          events.push({ type: 'power', heart: this.heart });
          this.crystal = null;
        }
      }
      if (p.power) {
        p.power.t -= dt;
        if (p.power.t <= 0) {
          p.power = null;
          p.mood = 'idle';
          this.crystalCd = 1.2;
          events.push({ type: 'fade' });
        }
      }

      // a powered Fuzzle breaks through Oink's shield on contact
      if (p.alive && p.power && this.vulnerable && Math.hypot(p.x - this.x, p.y - 10 - (this.y - 40)) < 48) {
        events.push(this.hit(p));
      }
      return events;
    }

    hit(p) {
      const used = this.heart;
      this.hp--;
      p.power = null;
      p.cheer(1.2);
      this.flash = 1.5;
      this.orbs.length = 0;
      this.zones.length = 0;
      this.crystal = null;
      this.crystalCd = 2.4;
      const a = Math.atan2(this.y - p.y, this.x - p.x);
      this.kb = { x: Math.cos(a) * 260, y: Math.sin(a) * 200 };
      FZ.fx.shake(12);
      FZ.fx.sparkle(this.x, this.y - 50, 30, used.color);
      FZ.fx.ring(this.x, this.y - 30, used.color, 60);
      FZ.sfx.play('hit');
      const member = FZ.memberForHit(3 - this.hp);
      const cage = this.world.openCage(member.id);
      if (cage) {
        const f = FZ.makeMember(member, cage.x, cage.y + 30);
        const [tx, ty] = CHEER_SPOTS[member.id];
        f.home = { x: tx * TS + TS / 2, y: ty * TS + TS / 2 };
        f.mood = 'happy';
        this.cheer.push(f);
      }
      this.enter('hurt');
      return { type: 'hit', member, heart: used, hp: this.hp };
    }

    /** What poofs Fuzzle here: orbs, live thorns, a charge, or touching Oink without power. */
    hurts(p) {
      if (this.beaten) return null;
      for (const o of this.orbs) if (Math.hypot(o.x - p.x, o.y - (p.y - 6)) < o.r + 8) return 'orb';
      const tx = Math.floor(p.x / TS);
      const ty = Math.floor((p.y + 4) / TS);
      for (const z of this.zones) if (z.t >= z.warn && z.tx === tx && z.ty === ty) return 'thorns';
      if (!p.power && this.state !== 'hurt' && Math.hypot(p.x - this.x, p.y - 10 - (this.y - 40)) < 30) return 'oink';
      return null;
    }

    /* ---------------- drawing ---------------- */
    drawGround(ctx, t) {
      for (const z of this.zones) {
        const x = z.tx * TS;
        const y = z.ty * TS;
        if (z.t < z.warn) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 14);
          ctx.fillStyle = `rgba(194, 60, 255, ${0.12 + pulse * 0.2})`;
          ctx.strokeStyle = `rgba(255, 120, 220, ${0.5 + pulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x + 5, y + 5, TS - 10, TS - 10, 8);
          ctx.fill();
          ctx.stroke();
          const k = z.t / z.warn;
          ctx.fillStyle = '#ff5c9a';
          for (const [ox, oy] of [[14, 16], [32, 20], [22, 32]]) {
            ctx.beginPath();
            ctx.moveTo(x + ox - 2.5, y + oy + 3);
            ctx.lineTo(x + ox, y + oy + 3 - 6 * k);
            ctx.lineTo(x + ox + 2.5, y + oy + 3);
            ctx.fill();
          }
        } else {
          const left = z.warn + z.live - z.t;
          ctx.globalAlpha = Math.min(1, left / 0.3);
          ctx.fillStyle = '#3a0f3a';
          ctx.beginPath();
          ctx.roundRect(x + 3, y + 3, TS - 6, TS - 6, 12);
          ctx.fill();
          ctx.lineCap = 'round';
          for (let i = 0; i < 2; i++) {
            const a0 = FZ.hash2(z.tx, z.ty, 60 + i) * Math.PI * 2;
            const r = 10 + i * 6;
            ctx.strokeStyle = '#a2479a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x + 24, y + 24, r, a0, a0 + 3.4);
            ctx.stroke();
            ctx.fillStyle = '#ff5c9a';
            for (let k = 0; k < 4; k++) {
              const a = a0 + (3.4 * (k + 0.5)) / 4;
              const px = x + 24 + Math.cos(a) * r;
              const py = y + 24 + Math.sin(a) * r;
              ctx.beginPath();
              ctx.moveTo(px - Math.sin(a) * 2.6, py + Math.cos(a) * 2.6);
              ctx.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6);
              ctx.lineTo(px + Math.sin(a) * 2.6, py - Math.cos(a) * 2.6);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;
        }
      }
      if (this.state === 'charge' && this.st < 0.9) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 92, 154, ${0.35 + 0.35 * Math.abs(Math.sin(t * 16))})`;
        ctx.lineWidth = 10;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 6);
        ctx.lineTo(this.x + this.dir.x * 620, this.y - 6 + this.dir.y * 620);
        ctx.stroke();
        ctx.restore();
      }
    }

    collect(list, t) {
      if (this.crystal) {
        const c = this.crystal;
        const heart = this.heart;
        list.push({
          y: c.y,
          draw: (ctx) => {
            const bob = Math.sin(t * 3) * 4;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(c.x, c.y + 12, 12, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            FZ.drawHeartCrystal(ctx, c.x, c.y - 14 + bob, heart, t, 13, true);
          },
        });
      }
      for (const f of this.cheer) list.push({ y: f.y + 12, draw: (ctx) => FZ.drawMember(ctx, f) });
      if (this.state === 'gone') {
        const pile = this.pile;
        const pig = this.pig;
        list.push({ y: pile.y - 2, draw: (ctx) => { ctx.save(); ctx.translate(pile.x, pile.y); FZ.drawCloakPile(ctx); ctx.restore(); } });
        list.push({
          y: pig.y,
          draw: (ctx) => {
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(pig.x, pig.y + 1, 14, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(pig.x, pig.y);
            ctx.scale(1.3, 1.3);
            FZ.drawPiglet(ctx, this.t, this.st > pig.run, this.pigDir);
            ctx.restore();
          },
        });
        return;
      }
      list.push({ y: this.y, draw: (ctx) => this.drawSelf(ctx, t) });
    }

    drawSelf(ctx, t) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 2, 40, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(this.x, this.y);
      FZ.drawOink(ctx, { t: this.t, mood: this.mood, facing: this.facing, scale: 0.9, flash: this.flash });
      if (this.vulnerable) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        ctx.fillStyle = `rgba(122, 42, 216, ${0.06 + pulse * 0.05})`;
        ctx.strokeStyle = `rgba(194, 60, 255, ${0.3 + pulse * 0.25})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, -56, 54, 68, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(242, 200, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -56, 54, 68, 0, t * 1.5, t * 1.5 + 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawOver(ctx, t) {
      for (const o of this.orbs) {
        const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, 18);
        g.addColorStop(0, 'rgba(209, 76, 255, 0.55)');
        g.addColorStop(1, 'rgba(209, 76, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a0f5a';
        ctx.strokeStyle = '#e08aff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f2c8ff';
        ctx.beginPath();
        ctx.arc(o.x - 2.5, o.y - 2.5, 2.2 + Math.sin(t * 10 + o.x) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    lights() {
      const out = [];
      if (this.state !== 'gone') {
        out.push({ x: this.x + 26 * this.facing, y: this.y - 118, r: 110, s: 0.9 });
        out.push({ x: this.x, y: this.y - 50, r: 100, s: 0.65 });
      } else {
        out.push({ x: this.pig.x, y: this.pig.y - 10, r: 80, s: 0.8 });
      }
      for (const o of this.orbs) out.push({ x: o.x, y: o.y, r: 36, s: 0.85 });
      if (this.crystal) out.push({ x: this.crystal.x, y: this.crystal.y - 12, r: 100, s: 1 });
      for (const z of this.zones) if (z.t >= z.warn) out.push({ x: z.tx * TS + 24, y: z.ty * TS + 24, r: 34, s: 0.55 });
      for (const f of this.cheer) out.push({ x: f.x, y: f.y - 10, r: 70, s: 0.8 });
      return out;
    }
  }

  FZ.Oink = Oink;
})(window.FZ);
