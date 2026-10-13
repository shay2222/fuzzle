/*
 * Level generator and solvability check.
 *
 * Every level is built from a seed: run seed + area + level + attempt. Falling bumps the
 * attempt, so the level regrows into a new layout, but the same run seed always replays
 * the same sequence of layouts.
 *
 * A layout only ships if the checker proves it can be finished: every seed and the portal
 * reachable from the start, a safe start, and every seed approachable from a safe tile.
 * Rejected layouts are counted and shown in the developer panel.
 */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const T = FZ.TILE;
  const CW = 8;      // chamber interior width in tiles
  const CH = 6;      // chamber interior height in tiles
  const BORDER = 3;  // thickness of the outer wall
  // chamber grid per difficulty step (area * 3 + level)
  const GRID = [[2, 2], [3, 2], [3, 2], [3, 2], [3, 3], [3, 3], [3, 3], [4, 3], [4, 3]];

  FZ.LEVELS_PER_AREA = 3;

  function mix(...parts) {
    let h = 2166136261;
    for (const p of parts) {
      h ^= p >>> 0;
      h = Math.imul(h, 16777619);
      h ^= h >>> 13;
    }
    return h >>> 0;
  }
  FZ.levelSeed = (runSeed, area, level, attempt) => mix(runSeed, area + 11, level + 101, attempt + 1001);

  const walkable = (t) => !FZ.SOLID.has(t) && t !== T.HAZARD;
  const safe = (t) => t === T.FLOOR || t === T.DECOR;

  /* ---------------- building one layout ---------------- */
  function build(rnd, area, d) {
    const [cols, rows] = GRID[Math.min(d, GRID.length - 1)];
    const w = BORDER * 2 + cols * CW + (cols - 1);
    const h = BORDER * 2 + rows * CH + (rows - 1);
    const L = {
      w, h, area, d, cols, rows,
      tiles: new Uint8Array(w * h).fill(T.WALL),
      keep: new Uint8Array(w * h),
      phase: new Float32Array(w * h),
      chambers: [], seeds: [], critters: [], cages: [], start: null, portal: null,
    };
    const at = (x, y) => L.tiles[y * w + x];
    const set = (x, y, t) => { L.tiles[y * w + x] = t; };
    const keep = (x, y) => { L.keep[y * w + x] = 1; };
    L.at = at;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = { c, r, x0: BORDER + c * (CW + 1), y0: BORDER + r * (CH + 1), links: [], template: '' };
        for (let y = ch.y0; y < ch.y0 + CH; y++) for (let x = ch.x0; x < ch.x0 + CW; x++) set(x, y, T.FLOOR);
        L.chambers.push(ch);
      }
    }
    const idx = (c, r) => r * cols + c;
    const neighbors = (i) => {
      const { c, r } = L.chambers[i];
      const out = [];
      if (c > 0) out.push(idx(c - 1, r));
      if (c < cols - 1) out.push(idx(c + 1, r));
      if (r > 0) out.push(idx(c, r - 1));
      if (r < rows - 1) out.push(idx(c, r + 1));
      return out;
    };

    function link(i, j) {
      const a = L.chambers[Math.min(i, j)];
      const b = L.chambers[Math.max(i, j)];
      if (a.links.includes(L.chambers.indexOf(b))) return;
      a.links.push(L.chambers.indexOf(b));
      b.links.push(L.chambers.indexOf(a));
      if (a.r === b.r) {
        // b is to the right of a: a two-tile doorway in the wall column between them
        const x = a.x0 + CW;
        const y = a.y0 + rnd.int(0, CH - 2);
        for (const yy of [y, y + 1]) { set(x, yy, T.FLOOR); keep(x, yy); keep(x - 1, yy); keep(x + 1, yy); }
      } else {
        const y = a.y0 + CH;
        const x = a.x0 + rnd.int(0, CW - 2);
        for (const xx of [x, x + 1]) { set(xx, y, T.FLOOR); keep(xx, y); keep(xx, y - 1); keep(xx, y + 1); }
      }
    }

    // a random spanning tree guarantees every chamber connects, then a few extra doors add loops
    const n = L.chambers.length;
    const seen = new Array(n).fill(false);
    const first = rnd.int(0, n - 1);
    const stack = [first];
    seen[first] = true;
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const open = neighbors(cur).filter((i) => !seen[i]);
      if (!open.length) { stack.pop(); continue; }
      const nx = rnd.pick(open);
      link(cur, nx);
      seen[nx] = true;
      stack.push(nx);
    }
    const extras = (n >= 6 ? 1 : 0) + (rnd.chance(0.5) ? 1 : 0);
    for (let k = 0; k < extras; k++) {
      const i = rnd.int(0, n - 1);
      const j = rnd.pick(neighbors(i));
      link(i, j);
    }

    // start in a corner chamber; the portal goes in the chamber farthest away by doorways
    const corners = [idx(0, 0), idx(cols - 1, 0), idx(0, rows - 1), idx(cols - 1, rows - 1)];
    const startCh = rnd.pick(corners);
    const hops = new Array(n).fill(-1);
    hops[startCh] = 0;
    const q = [startCh];
    while (q.length) {
      const i = q.shift();
      for (const j of L.chambers[i].links) if (hops[j] < 0) { hops[j] = hops[i] + 1; q.push(j); }
    }
    const far = Math.max(...hops);
    const portalCh = rnd.pick(hops.map((v, i) => (v === far ? i : -1)).filter((i) => i >= 0));

    // decorate each chamber from a weighted set of templates
    const weights = templateWeights(area, d);
    L.chambers.forEach((ch, i) => {
      if (i === startCh) { ch.template = 'meadow'; TEMPLATES.meadow(L, ch, rnd, d, area); return; }
      ch.template = weightedPick(rnd, weights);
      TEMPLATES[ch.template](L, ch, rnd, d, area);
      if (ch.template !== 'patrol' && rnd.chance(0.06 + d * 0.05)) addPatrol(L, ch, rnd, d);
    });

    // start tile, with a clear 3x3 around it
    const s = L.chambers[startCh];
    L.start = { tx: s.x0 + Math.floor(CW / 2) - 1 + rnd.int(0, 1), ty: s.y0 + Math.floor(CH / 2) - 1 + rnd.int(0, 1) };
    clearAround(L, L.start.tx, L.start.ty, 1);

    const p = L.chambers[portalCh];
    L.portal = { tx: p.x0 + rnd.int(2, CW - 3), ty: p.y0 + rnd.int(2, CH - 3) };
    clearAround(L, L.portal.tx, L.portal.ty, 1);

    // the last level of each land hides a caged sibling right beside the portal
    if (d - area * FZ.LEVELS_PER_AREA === FZ.LEVELS_PER_AREA - 1) {
      const m = FZ.memberForArea ? FZ.memberForArea(area) : null;
      const cage = { tx: L.portal.tx, ty: L.portal.ty - 1, member: m ? m.id : null };
      L.tiles[cage.ty * w + cage.tx] = T.CAGE;
      L.cages.push(cage);
    }

    placeSeeds(L, rnd, d, startCh);
    L.startCh = startCh;
    L.portalCh = portalCh;
    return L;
  }

  function clearAround(L, cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x <= BORDER - 1 || y <= BORDER - 1 || x >= L.w - BORDER || y >= L.h - BORDER) continue;
        const t = L.tiles[y * L.w + x];
        if (t !== T.WALL) L.tiles[y * L.w + x] = T.FLOOR;
        L.keep[y * L.w + x] = 1;
      }
    }
    // critters never patrol through a cleared area
    L.critters = L.critters.filter((c) => !(between(cx, c.ax, c.bx, r) && between(cy, c.ay, c.by, r)));
  }
  const between = (v, a, b, r) => v >= Math.min(a, b) - r && v <= Math.max(a, b) + r;

  function placeSeeds(L, rnd, d, startCh) {
    const others = L.chambers.map((_, i) => i).filter((i) => i !== startCh);
    for (let i = others.length - 1; i > 0; i--) { const j = rnd.int(0, i); [others[i], others[j]] = [others[j], others[i]]; }
    const count = Math.min(others.length + Math.floor(d / 3) + (others.length <= 3 ? 1 : 0), 3 + Math.floor(d * 0.6));
    const used = new Set();
    for (let k = 0; k < count; k++) {
      const ch = L.chambers[k < others.length ? others[k] : rnd.pick(others)];
      const options = [];
      for (let y = ch.y0; y < ch.y0 + CH; y++) {
        for (let x = ch.x0; x < ch.x0 + CW; x++) {
          const key = y * L.w + x;
          if (!safe(L.tiles[key]) || used.has(key)) continue;
          if (L.portal && Math.abs(x - L.portal.tx) <= 1 && Math.abs(y - L.portal.ty) <= 1) continue;
          let safeSides = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (safe(L.tiles[(y + dy) * L.w + x + dx])) safeSides++;
          let near = false;
          for (const u of used) if (Math.abs((u % L.w) - x) + Math.abs(Math.floor(u / L.w) - y) < 3) near = true;
          if (safeSides >= 2 && !near) options.push([x, y]);
        }
      }
      if (!options.length) continue;
      const [x, y] = rnd.pick(options);
      used.add(y * L.w + x);
      L.seeds.push({ tx: x, ty: y });
    }
  }

  /* ---------------- chamber templates ---------------- */
  function cells(ch) {
    const out = [];
    for (let y = ch.y0; y < ch.y0 + CH; y++) for (let x = ch.x0; x < ch.x0 + CW; x++) out.push([x, y]);
    return out;
  }
  function put(L, x, y, t) { if (!L.keep[y * L.w + x]) L.tiles[y * L.w + x] = t; }

  function valueNoise(x, y, salt) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = FZ.hash2(xi, yi, salt);
    const b = FZ.hash2(xi + 1, yi, salt);
    const c = FZ.hash2(xi, yi + 1, salt);
    const e = FZ.hash2(xi + 1, yi + 1, salt);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + e) * sx * sy;
  }

  function addPatrol(L, ch, rnd, d) {
    for (let tries = 0; tries < 10; tries++) {
      const horizontal = rnd.chance(0.6);
      const runs = [];
      if (horizontal) {
        const y = ch.y0 + rnd.int(0, CH - 1);
        let run = [];
        for (let x = ch.x0; x < ch.x0 + CW; x++) {
          if (!FZ.SOLID.has(L.tiles[y * L.w + x])) run.push([x, y]); else { if (run.length) runs.push(run); run = []; }
        }
        if (run.length) runs.push(run);
      } else {
        const x = ch.x0 + rnd.int(0, CW - 1);
        let run = [];
        for (let y = ch.y0; y < ch.y0 + CH; y++) {
          if (!FZ.SOLID.has(L.tiles[y * L.w + x])) run.push([x, y]); else { if (run.length) runs.push(run); run = []; }
        }
        if (run.length) runs.push(run);
      }
      const best = runs.sort((a, b) => b.length - a.length)[0];
      if (!best || best.length < 4) continue;
      const a = best[0];
      const b = best[best.length - 1];
      L.critters.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], speed: 62 + d * 9 + rnd() * 22, phase: rnd() });
      return true;
    }
    return false;
  }

  const TEMPLATES = {
    meadow(L, ch, rnd) {
      const all = cells(ch);
      for (let i = 0; i < rnd.int(5, 9); i++) { const [x, y] = rnd.pick(all); put(L, x, y, T.DECOR); }
      for (let i = 0; i < rnd.int(1, 3); i++) {
        const x = ch.x0 + rnd.int(1, CW - 2);
        const y = ch.y0 + rnd.int(1, CH - 2);
        put(L, x, y, rnd.chance(0.5) ? T.BLOCK : T.ROCK);
      }
    },
    pond(L, ch, rnd) {
      const cx = ch.x0 + CW / 2 + rnd.range(-0.8, 0.8);
      const cy = ch.y0 + CH / 2 + rnd.range(-0.5, 0.5);
      const rx = rnd.range(1.6, CW / 2 - 1.3);
      const ry = rnd.range(1.2, CH / 2 - 1.1);
      for (const [x, y] of cells(ch)) {
        const k = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (k < 1) put(L, x, y, T.POOL);
        else if (k < 2.2 && rnd.chance(0.25)) put(L, x, y, T.DECOR);
      }
    },
    pillars(L, ch, rnd) {
      const ox = rnd.int(0, 1);
      const oy = rnd.int(0, 1);
      for (let y = ch.y0 + 1 + oy; y < ch.y0 + CH - 1; y += 2) {
        for (let x = ch.x0 + 1 + ox; x < ch.x0 + CW - 1; x += 2) {
          if (rnd.chance(0.78)) put(L, x, y, rnd.chance(0.5) ? T.ROCK : T.BLOCK);
        }
      }
    },
    thicket(L, ch, rnd, d) {
      const density = 0.26 + Math.min(d, 8) * 0.024;
      const salt = rnd.int(1, 1e6);
      for (const [x, y] of cells(ch)) {
        const v = valueNoise(x / 2.1, y / 2.1, salt) * 0.75 + rnd() * 0.25;
        if (v > 1 - density) put(L, x, y, T.HAZARD);
        else if (rnd.chance(0.08)) put(L, x, y, T.DECOR);
      }
    },
    lanes(L, ch, rnd, d, area) {
      const vertical = rnd.chance(0.5);
      const timed = area > 0 && rnd.chance(0.55);
      const len = vertical ? CH : CW;
      const lines = vertical ? CW : CH;
      const start = rnd.int(0, 1);
      for (let k = start; k < lines; k += 2) {
        const gapW = d < 3 ? 2 : rnd.chance(0.5) ? 1 : 2;
        const gap = rnd.int(0, len - gapW);
        for (let i = 0; i < len; i++) {
          if (i >= gap && i < gap + gapW) continue;
          const x = vertical ? ch.x0 + k : ch.x0 + i;
          const y = vertical ? ch.y0 + i : ch.y0 + k;
          put(L, x, y, timed ? T.SPIKES : T.HAZARD);
          if (timed) L.phase[y * L.w + x] = i * 0.16 + k * 0.4;
        }
      }
    },
    patrol(L, ch, rnd, d) {
      TEMPLATES.meadow(L, ch, rnd, d);
      addPatrol(L, ch, rnd, d);
      if (d >= 4) addPatrol(L, ch, rnd, d);
    },
    spikes(L, ch, rnd) {
      const pattern = rnd.int(0, 2);
      const x1 = ch.x0 + 1;
      const y1 = ch.y0 + 1;
      for (let y = y1; y < ch.y0 + CH - 1; y++) {
        for (let x = x1; x < ch.x0 + CW - 1; x++) {
          const i = y * L.w + x;
          if (pattern === 0 && (x + y) % 2 === 0) { put(L, x, y, T.SPIKES); L.phase[i] = 0; }
          if (pattern === 0 && (x + y) % 2 === 1) { put(L, x, y, T.SPIKES); L.phase[i] = 1.2; }
          if (pattern === 1 && rnd.chance(0.7)) { put(L, x, y, T.SPIKES); L.phase[i] = (x - x1) * 0.22; }
          if (pattern === 2 && (y - y1) % 2 === 0) { put(L, x, y, T.SPIKES); L.phase[i] = (y - y1) * 0.6 + (x - x1) * 0.1; }
        }
      }
    },
  };

  function templateWeights(area, d) {
    const k = Math.min(d, 8);
    if (area === 0) return { meadow: 2, pond: 2, pillars: 1.5, thicket: 2 + k * 0.5, lanes: 0.8 + k * 0.4, patrol: 0.6 + k * 0.4, spikes: k >= 2 ? 0.8 : 0 };
    if (area === 1) return { meadow: 1, pond: 1.2, pillars: 2, thicket: 2, lanes: 1.5, patrol: 2, spikes: 3 };
    return { meadow: 1, pond: 0.6, pillars: 1.5, thicket: 3, lanes: 2, patrol: 2.5, spikes: 1.5 };
  }

  function weightedPick(rnd, weights) {
    const entries = Object.entries(weights).filter(([, v]) => v > 0);
    let total = entries.reduce((s, [, v]) => s + v, 0);
    let r = rnd() * total;
    for (const [k, v] of entries) { r -= v; if (r <= 0) return k; }
    return entries[entries.length - 1][0];
  }

  /* ---------------- solvability check ---------------- */
  function bfs(L, sx, sy) {
    const dist = new Int32Array(L.w * L.h).fill(-1);
    const from = new Int32Array(L.w * L.h).fill(-1);
    const s = sy * L.w + sx;
    dist[s] = 0;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const x = i % L.w;
      const y = (i - x) / L.w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
        const j = ny * L.w + nx;
        if (dist[j] >= 0 || !walkable(L.tiles[j])) continue;
        dist[j] = dist[i] + 1;
        from[j] = i;
        q.push(j);
      }
    }
    return { dist, from };
  }

  function pathTo(L, from, target) {
    const out = [];
    for (let i = target; i >= 0; i = from[i]) out.push(i);
    return out.reverse();
  }

  FZ.bfs = bfs; // shared with NPC placement and quest items
  FZ.CHAMBER = { CW, CH };

  FZ.checkLevel = function (L) {
    const reasons = [];
    const { tx, ty } = L.start;
    if (!safe(L.tiles[ty * L.w + tx])) reasons.push('start is not on safe ground');
    for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
      const t = L.tiles[y * L.w + x];
      if (t === T.HAZARD || t === T.SPIKES) reasons.push('hazard next to the start');
    }
    const fromStart = bfs(L, tx, ty);
    const targets = L.seeds.map((s) => s.ty * L.w + s.tx);
    const portal = L.portal.ty * L.w + L.portal.tx;
    for (const t of targets) if (fromStart.dist[t] < 0) reasons.push('a seed cannot be reached');
    if (fromStart.dist[portal] < 0) reasons.push('the portal cannot be reached');
    if (!L.seeds.length) reasons.push('no seeds placed');
    if (reasons.length) return { ok: false, reasons };

    // greedy route: nearest seed each time, then the portal. Used for par time and the path overlay.
    let cur = ty * L.w + tx;
    let field = fromStart;
    const left = targets.slice();
    const route = [cur];
    let length = 0;
    while (left.length) {
      left.sort((a, b) => field.dist[a] - field.dist[b]);
      const next = left.shift();
      length += field.dist[next];
      route.push(...pathTo(L, field.from, next).slice(1));
      cur = next;
      field = bfs(L, cur % L.w, Math.floor(cur / L.w));
    }
    length += field.dist[portal];
    route.push(...pathTo(L, field.from, portal).slice(1));
    return { ok: true, reasons, route, length };
  };

  /** Last resort if every retry failed: carve the shortest way from each stranded target. */
  function carvePaths(L) {
    const reach = bfs(L, L.start.tx, L.start.ty);
    const targets = L.seeds.map((s) => [s.tx, s.ty]).concat([[L.portal.tx, L.portal.ty]]);
    for (const [x0, y0] of targets) {
      if (reach.dist[y0 * L.w + x0] >= 0) continue;
      const prev = new Int32Array(L.w * L.h).fill(-2);
      const s = y0 * L.w + x0;
      prev[s] = -1;
      const q = [s];
      let hit = -1;
      for (let qi = 0; qi < q.length && hit < 0; qi++) {
        const i = q[qi];
        const x = i % L.w;
        const y = (i - x) / L.w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < BORDER || ny < BORDER || nx >= L.w - BORDER || ny >= L.h - BORDER) continue;
          const j = ny * L.w + nx;
          if (prev[j] !== -2) continue;
          prev[j] = i;
          if (reach.dist[j] >= 0) { hit = j; break; }
          q.push(j);
        }
      }
      for (let i = hit; i >= 0; i = prev[i]) if (!walkable(L.tiles[i])) L.tiles[i] = T.FLOOR;
    }
  }

  /**
   * Builds a level for this run, area, level number, and attempt. Tries up to 30 layouts
   * from the same seed family and ships the first one the checker accepts.
   */
  FZ.generateLevel = function (runSeed, area, level, attempt) {
    if (area >= FZ.AREAS.length - 1) return FZ.generateBossLevel(runSeed, attempt);
    const seed = FZ.levelSeed(runSeed, area, level, attempt);
    const d = area * FZ.LEVELS_PER_AREA + level;
    const rejectedWhy = [];
    let L = null;
    let check = null;
    let tries = 0;
    for (; tries < 30; tries++) {
      L = build(FZ.rng(seed + tries * 7919), area, d);
      check = FZ.checkLevel(L);
      if (check.ok) break;
      rejectedWhy.push(check.reasons[0]);
    }
    let carved = false;
    if (!check.ok) {
      carvePaths(L);
      check = FZ.checkLevel(L);
      carved = true;
    }
    const maxSpeed = FZ.tuningDefaults ? FZ.tuningDefaults.maxSpeed : 235;
    const par = Math.ceil((check.length * FZ.TS) / (maxSpeed * 0.7) + L.seeds.length * 0.3 + 1.5);
    L.meta = {
      seed, runSeed, area, level, attempt, difficulty: d, rejected: Math.min(tries, 30), rejectedWhy, carved,
      route: check.route || [], routeLength: check.length || 0, par,
      templates: L.chambers.map((c) => c.template),
    };
    return L;
  };
})(window.FZ);
