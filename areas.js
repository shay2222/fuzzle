/* Tiles, the three areas, and all the art painted in code for each area. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const TS = 48; // tile size in world pixels
  FZ.TS = TS;

  /** Tile kinds are shared by every area; each area paints them its own way. */
  const T = { FLOOR: 0, DECOR: 1, HAZARD: 2, POOL: 3, WALL: 4, BLOCK: 5, ROCK: 6, SPIKES: 7, CAGE: 8 };
  FZ.TILE = T;
  FZ.SOLID = new Set([T.POOL, T.WALL, T.BLOCK, T.ROCK, T.CAGE]);

  /* ---------------- painting helpers ---------------- */
  function makeCanvas(w, h, res, pad) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * res);
    c.height = Math.ceil(h * res);
    const g = c.getContext('2d');
    g.scale(res, res);
    return { c, g, w, h, pad: pad || 4 };
  }
  FZ.makeCanvas = makeCanvas;

  function blobCluster(g, circles, outline, fills) {
    g.fillStyle = outline;
    for (const [x, y, r] of circles) { g.beginPath(); g.arc(x, y, r + 2.5, 0, Math.PI * 2); g.fill(); }
    for (const f of fills) {
      g.fillStyle = f.color;
      for (const [x, y, r] of circles) { g.beginPath(); g.arc(x + f.dx, y + f.dy, r * f.k, 0, Math.PI * 2); g.fill(); }
    }
  }

  function smoothPoly(g, pts) {
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const n = pts[(i + 1) % pts.length];
      const mx = (x + n[0]) / 2;
      const my = (y + n[1]) / 2;
      if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(x, y, mx, my);
    });
    const [x0, y0] = pts[0];
    const n0 = pts[1];
    g.quadraticCurveTo(x0, y0, (x0 + n0[0]) / 2, (y0 + n0[1]) / 2);
    g.closePath();
  }

  function crystal(g, x, y, w, h, tilt, color, light) {
    g.save();
    g.translate(x, y);
    g.rotate(tilt);
    g.beginPath();
    g.moveTo(-w / 2, 0);
    g.lineTo(-w / 2, -h * 0.72);
    g.lineTo(0, -h);
    g.lineTo(w / 2, -h * 0.72);
    g.lineTo(w / 2, 0);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.strokeStyle = 'rgba(20, 14, 40, 0.85)';
    g.lineWidth = 1.6;
    g.stroke();
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(-w / 2 + 1.5, -1);
    g.lineTo(-w / 2 + 1.5, -h * 0.7);
    g.lineTo(0, -h + 2);
    g.lineTo(-w * 0.05, -2);
    g.closePath();
    g.fill();
    g.restore();
  }

  /* ---------------- Mossy Woods ---------------- */
  function paintTree(res, v) {
    const s = makeCanvas(108, 132, res, 4);
    const g = s.g;
    const cx = 54;
    g.fillStyle = '#4a2f1c';
    g.beginPath(); g.roundRect(cx - 10, 86, 20, 40, 6); g.fill();
    g.fillStyle = '#8a5a34';
    g.beginPath(); g.roundRect(cx - 8, 86, 16, 38, 5); g.fill();
    g.fillStyle = '#6d4426';
    g.fillRect(cx + 1, 88, 7, 34);
    const sets = [
      [[54, 52, 32], [30, 66, 22], [78, 66, 22], [40, 36, 21], [68, 34, 22], [54, 76, 20]],
      [[54, 48, 30], [32, 60, 24], [76, 62, 21], [52, 28, 22], [36, 80, 17], [72, 80, 18]],
      [[50, 54, 33], [76, 50, 22], [28, 50, 20], [58, 30, 20], [54, 78, 19]],
    ];
    blobCluster(g, sets[v % 3], '#1f4a2a', [
      { color: '#2f7a3e', dx: 0, dy: 3, k: 1 },
      { color: '#3e9a4f', dx: -1, dy: 0, k: 0.97 },
      { color: '#5cb85f', dx: -5, dy: -6, k: 0.7 },
      { color: '#86d47a', dx: -8, dy: -10, k: 0.32 },
    ]);
    g.fillStyle = '#b6ec9a';
    for (let i = 0; i < 6; i++) {
      const a = FZ.hash2(v, i, 11) * Math.PI * 2;
      const r = 8 + FZ.hash2(v, i, 12) * 22;
      g.beginPath(); g.ellipse(54 + Math.cos(a) * r - 6, 50 + Math.sin(a) * r * 0.8 - 8, 2.6, 1.6, a, 0, Math.PI * 2); g.fill();
    }
    return s;
  }

  function paintHedge(res, v) {
    const s = makeCanvas(56, 66, res, 5);
    const g = s.g;
    g.fillStyle = '#1f4a2a';
    g.beginPath(); g.roundRect(0, 14, 56, 52, 12); g.fill();
    g.fillStyle = '#2f7a3e';
    g.beginPath(); g.roundRect(2.5, 16, 51, 47, 10); g.fill();
    // leafy top surface
    const bumps = [[12, 22, 11], [28, 18, 12], [44, 22, 11], [20, 30, 10], [38, 30, 10]];
    blobCluster(g, bumps.map(([x, y, r]) => [x, y + (FZ.hash2(v, x, 5) - 0.5) * 3, r]), '#1f4a2a', [
      { color: '#3e9a4f', dx: 0, dy: 0, k: 1 },
      { color: '#5cb85f', dx: -2, dy: -3, k: 0.62 },
    ]);
    g.fillStyle = '#86d47a';
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(8 + FZ.hash2(v, i, 6) * 40, 14 + FZ.hash2(v, i, 7) * 14, 2.4, 1.5, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(20, 50, 28, 0.35)';
    g.fillRect(3, 50, 50, 13);
    return s;
  }

  function paintBush(res, v) {
    const s = makeCanvas(66, 56, res, 6);
    const g = s.g;
    const sets = [
      [[33, 32, 17], [18, 38, 12], [48, 38, 12], [26, 24, 11], [42, 24, 11]],
      [[33, 30, 18], [16, 40, 11], [50, 40, 11], [33, 44, 12]],
      [[30, 32, 16], [46, 34, 14], [20, 40, 10], [38, 22, 11]],
    ];
    blobCluster(g, sets[v % 3], '#1f4a2a', [
      { color: '#3a8f45', dx: 0, dy: 2, k: 1 },
      { color: '#4cad55', dx: -1, dy: -1, k: 0.92 },
      { color: '#79cc6c', dx: -4, dy: -5, k: 0.5 },
    ]);
    for (let i = 0; i < 5; i++) {
      const x = 14 + FZ.hash2(v, i, 21) * 38;
      const y = 22 + FZ.hash2(v, i, 22) * 22;
      g.fillStyle = '#9c1f4a';
      g.beginPath(); g.arc(x, y + 0.6, 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff5c8a';
      g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x - 0.9, y - 0.9, 0.8, 0, Math.PI * 2); g.fill();
    }
    return s;
  }

  function paintRock(res, v, pal) {
    const s = makeCanvas(62, 50, res, 6);
    const g = s.g;
    const shapes = [
      [[8, 40], [6, 26], [16, 12], [34, 8], [50, 14], [56, 30], [52, 42], [30, 46]],
      [[6, 38], [10, 20], [26, 10], [44, 12], [56, 26], [54, 42], [28, 46]],
      [[10, 42], [8, 24], [22, 14], [40, 10], [54, 20], [58, 38], [36, 46]],
    ];
    const pts = shapes[v % 3];
    smoothPoly(g, pts);
    g.lineWidth = 5;
    g.strokeStyle = pal.line;
    g.stroke();
    const grad = g.createLinearGradient(0, 8, 0, 46);
    grad.addColorStop(0, pal.hi);
    grad.addColorStop(0.5, pal.mid);
    grad.addColorStop(1, pal.lo);
    g.fillStyle = grad;
    g.fill();
    g.save();
    smoothPoly(g, pts);
    g.clip();
    g.fillStyle = pal.cap;
    g.beginPath(); g.ellipse(30, 10, 24, 9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = pal.capHi;
    g.beginPath(); g.ellipse(26, 8, 14, 5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.beginPath(); g.ellipse(20, 24, 5, 2.5, -0.5, 0, Math.PI * 2); g.fill();
    return s;
  }

  /* ---------------- Crystal Caves ---------------- */
  function paintStalagmites(res, v) {
    const s = makeCanvas(84, 118, res, 4);
    const g = s.g;
    const cones = [
      [[22, 112, 26, 70], [56, 112, 30, 98], [72, 112, 18, 54]],
      [[28, 112, 34, 92], [62, 112, 28, 76]],
      [[18, 112, 22, 58], [44, 112, 32, 104], [70, 112, 22, 66]],
    ][v % 3];
    for (const [x, y, w, h] of cones) {
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.quadraticCurveTo(x - w * 0.42, y - h * 0.55, x - 3, y - h);
      g.quadraticCurveTo(x, y - h - 4, x + 3, y - h);
      g.quadraticCurveTo(x + w * 0.42, y - h * 0.55, x + w / 2, y);
      g.closePath();
      g.lineWidth = 4;
      g.strokeStyle = '#17132a';
      g.stroke();
      const grad = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      grad.addColorStop(0, '#6d64a0');
      grad.addColorStop(0.45, '#4f4778');
      grad.addColorStop(1, '#342e55');
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = 'rgba(190, 180, 255, 0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x - w * 0.22, y - 6);
      g.quadraticCurveTo(x - w * 0.18, y - h * 0.5, x - 2, y - h + 6);
      g.stroke();
    }
    crystal(g, 40, 112, 8, 20, -0.2, '#7af0ff', '#e6fdff');
    crystal(g, 48, 112, 6, 14, 0.25, '#b48cff', '#efe4ff');
    return s;
  }

  function paintRidge(res, v) {
    const s = makeCanvas(56, 64, res, 5);
    const g = s.g;
    g.fillStyle = '#17132a';
    g.beginPath(); g.roundRect(0, 12, 56, 52, 12); g.fill();
    g.fillStyle = '#3b3560';
    g.beginPath(); g.roundRect(2.5, 14, 51, 47, 10); g.fill();
    g.fillStyle = '#5a5288';
    g.beginPath(); g.roundRect(4, 15, 48, 18, 8); g.fill();
    g.fillStyle = '#756cab';
    g.beginPath(); g.ellipse(18, 20, 9, 3, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#241f40';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(10 + FZ.hash2(v, 1, 3) * 20, 36);
    g.lineTo(20 + FZ.hash2(v, 2, 3) * 10, 46);
    g.lineTo(18 + FZ.hash2(v, 3, 3) * 14, 56);
    g.stroke();
    if (v % 2 === 0) crystal(g, 40, 30, 6, 14, 0.2, '#7af0ff', '#e6fdff');
    return s;
  }

  const CAVE_CRYSTALS = [['#7af0ff', '#e6fdff'], ['#b48cff', '#efe4ff'], ['#ff8fd8', '#ffe6f6']];
  const CURSED_CRYSTALS = [['#c23cff', '#f0d6ff'], ['#7a2ad8', '#e0c6ff'], ['#ff4fb8', '#ffd6ef']];

  function paintCrystals(res, v, palettes) {
    palettes = palettes || CAVE_CRYSTALS;
    const s = makeCanvas(60, 62, res, 6);
    const g = s.g;
    const glow = g.createRadialGradient(30, 38, 2, 30, 38, 30);
    glow.addColorStop(0, FZ.rgba(palettes[0][0], 0.45));
    glow.addColorStop(1, FZ.rgba(palettes[0][0], 0));
    g.fillStyle = glow;
    g.beginPath(); g.arc(30, 38, 30, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2448';
    g.beginPath(); g.ellipse(30, 56, 22, 6, 0, 0, Math.PI * 2); g.fill();
    const sets = [
      [[30, 56, 12, 40, 0], [18, 56, 9, 26, -0.35], [42, 56, 9, 30, 0.3]],
      [[26, 56, 13, 44, -0.1], [42, 56, 10, 28, 0.35], [14, 56, 8, 20, -0.5]],
      [[34, 56, 12, 38, 0.1], [20, 56, 10, 30, -0.3], [46, 56, 7, 18, 0.5]],
    ][v % 3];
    sets.forEach(([x, y, w, h, tilt], i) => {
      const [c, l] = palettes[(v + i) % 3];
      crystal(g, x, y, w, h, tilt, c, l);
    });
    return s;
  }

  /* ---------------- Cloud Tops ---------------- */
  function cloudBlob(g, circles) {
    blobCluster(g, circles, '#a3bbe0', [
      { color: '#d6e4f8', dx: 0, dy: 3, k: 1 },
      { color: '#ffffff', dx: -1, dy: -1, k: 0.9 },
      { color: '#ffffff', dx: -3, dy: -4, k: 0.55 },
    ]);
  }

  function paintCloudTower(res, v) {
    const s = makeCanvas(100, 116, res, 6);
    const g = s.g;
    const sets = [
      [[50, 84, 30], [26, 94, 20], [74, 94, 20], [38, 58, 22], [62, 56, 22], [50, 34, 20]],
      [[50, 86, 32], [24, 96, 18], [76, 92, 22], [50, 50, 26], [30, 64, 16]],
      [[46, 88, 30], [72, 90, 22], [28, 96, 18], [56, 58, 24], [40, 40, 18]],
    ];
    cloudBlob(g, sets[v % 3]);
    return s;
  }

  function paintCloudWall(res, v) {
    const s = makeCanvas(58, 62, res, 5);
    const g = s.g;
    cloudBlob(g, [[29, 40, 20], [12, 46, 13], [46, 46, 13], [20, 28 + (v % 2) * 2, 12], [38, 28, 12]]);
    return s;
  }

  function paintPuff(res, v) {
    const s = makeCanvas(58, 52, res, 6);
    const g = s.g;
    cloudBlob(g, [[29, 34, 15], [16, 38, 10], [42, 38, 10], [24, 26, 9], [36, 25, 9]]);
    // a little rainbow tucked in the puff
    const colors = ['#ff8fb1', '#ffd23f', '#7be0a0', '#7ab8ff'];
    g.lineWidth = 2.2;
    colors.forEach((c, i) => {
      g.strokeStyle = c;
      g.beginPath();
      g.arc(29, 40, 15 - i * 2.4, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    });
    return s;
  }

  /* ---------------- Oink's Tower ---------------- */
  function bricks(g, x, y, w, h, v) {
    g.fillStyle = '#3a3150';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#211a33';
    g.lineWidth = 1.5;
    const bh = 10;
    for (let r = 0; r * bh < h; r++) {
      const yy = y + r * bh;
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke();
      const off = (r % 2) * 9;
      for (let bx = x + off; bx < x + w; bx += 18) { g.beginPath(); g.moveTo(bx, yy); g.lineTo(bx, Math.min(yy + bh, y + h)); g.stroke(); }
    }
    g.fillStyle = 'rgba(150, 130, 200, 0.2)';
    for (let i = 0; i < 6; i++) {
      g.fillRect(x + FZ.hash2(v, i, 41) * (w - 14), y + Math.floor(FZ.hash2(v, i, 42) * (h / bh)) * bh + 2, 12, 3);
    }
  }

  function greenFlame(g, x, y, s) {
    const glow = g.createRadialGradient(x, y - 4 * s, 1, x, y - 4 * s, 16 * s);
    glow.addColorStop(0, 'rgba(160, 255, 110, 0.6)');
    glow.addColorStop(1, 'rgba(160, 255, 110, 0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(x, y - 4 * s, 16 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5fe04a';
    g.beginPath();
    g.moveTo(x, y - 12 * s);
    g.quadraticCurveTo(x + 5 * s, y - 3 * s, x, y + 1 * s);
    g.quadraticCurveTo(x - 5 * s, y - 3 * s, x, y - 12 * s);
    g.fill();
    g.fillStyle = '#e6ffcc';
    g.beginPath();
    g.ellipse(x, y - 2.5 * s, 1.8 * s, 3 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  function paintLairWall(res, v) {
    const s = makeCanvas(56, 112, res, 4);
    const g = s.g;
    g.fillStyle = '#120a1a';
    g.beginPath(); g.roundRect(0, 10, 56, 102, 6); g.fill();
    bricks(g, 3, 13, 50, 95, v);
    g.fillStyle = '#120a1a';
    g.fillRect(0, 6, 56, 10);
    for (const cx of [2, 22, 42]) {
      g.fillStyle = '#120a1a';
      g.fillRect(cx - 2, 0, 16, 16);
      g.fillStyle = '#4a4066';
      g.fillRect(cx, 2, 12, 12);
    }
    if (v === 1) {
      g.fillStyle = '#1e1530';
      g.fillRect(24, 52, 8, 12);
      g.fillRect(20, 50, 16, 4);
      greenFlame(g, 28, 48, 1);
    } else if (v === 2) {
      g.strokeStyle = 'rgba(194, 60, 255, 0.7)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(18, 20); g.lineTo(24, 38); g.lineTo(20, 52); g.lineTo(30, 70); g.lineTo(26, 92);
      g.stroke();
    }
    return s;
  }

  function paintLairBlock(res, v) {
    const s = makeCanvas(56, 64, res, 5);
    const g = s.g;
    g.fillStyle = '#120a1a';
    g.beginPath(); g.roundRect(0, 12, 56, 52, 6); g.fill();
    bricks(g, 3, 15, 50, 45, v);
    g.fillStyle = '#4a4066';
    g.fillRect(3, 14, 50, 6);
    return s;
  }

  function paintLairGround(g, w) {
    g.fillStyle = '#231b36';
    g.fillRect(0, 0, w.pxW, w.pxH);
  }
  function lairTileDetail(g, tx, ty) {
    const x = tx * TS;
    const y = ty * TS;
    g.fillStyle = FZ.hash2(tx, ty, 1) < 0.5 ? '#30264a' : '#2c2344';
    g.strokeStyle = '#18122a';
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(x + 2, y + 2, TS - 4, TS - 4, 5); g.fill(); g.stroke();
    if (FZ.hash2(tx, ty, 2) < 0.2) {
      g.strokeStyle = '#1a1428';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x + 10, y + 12); g.lineTo(x + 20, y + 22); g.lineTo(x + 18, y + 32);
      g.stroke();
    }
  }
  function lairDecor(g, tx, ty) {
    const x = tx * TS + TS / 2;
    const y = ty * TS + TS / 2 + 10;
    g.fillStyle = '#1a1428';
    g.beginPath(); g.ellipse(x, y + 2, 8, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e8dcc8';
    g.fillRect(x - 3, y - 12, 6, 14);
    g.fillStyle = '#c9b89a';
    g.fillRect(x + 1, y - 12, 2, 14);
    greenFlame(g, x, y - 13, 0.7);
  }
  /** A magic circle on the tower floor: rings, little crescents, and dots. */
  function lairOverlay(g, w) {
    g.save();
    g.translate(w.pxW / 2, w.pxH / 2 + TS * 0.5);
    g.scale(1, 0.62);
    g.strokeStyle = 'rgba(194, 60, 255, 0.4)';
    g.lineWidth = 4;
    for (const r of [200, 168, 64]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(194, 60, 255, 0.45)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * 184;
      const y = Math.sin(a) * 184;
      if (i % 2 === 0) {
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#231b36';
        g.beginPath(); g.arc(x + 3, y - 2, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(194, 60, 255, 0.45)';
      } else {
        g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill();
      }
    }
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70);
      g.lineTo(Math.cos(a) * 160, Math.sin(a) * 160);
      g.stroke();
    }
    g.restore();
  }

  /* ---------------- per-area ground painting ---------------- */
  function paintWoodsGround(g, w, rnd) {
    g.fillStyle = '#7cc46a';
    g.fillRect(0, 0, w.pxW, w.pxH);
    for (let i = 0; i < w.w * w.h * 0.6; i++) {
      g.fillStyle = rnd.chance(0.55) ? 'rgba(160, 220, 125, 0.22)' : 'rgba(64, 132, 66, 0.14)';
      g.beginPath();
      g.ellipse(rnd() * w.pxW, rnd() * w.pxH, rnd.range(18, 64), rnd.range(12, 40), rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  function woodsTileDetail(g, tx, ty) {
    const x = tx * TS;
    const y = ty * TS;
    g.strokeStyle = 'rgba(70, 140, 62, 0.75)';
    g.lineWidth = 1.6;
    g.lineCap = 'round';
    const n = 2 + Math.floor(FZ.hash2(tx, ty, 1) * 4);
    for (let i = 0; i < n; i++) {
      const bx = x + 6 + FZ.hash2(tx, ty, 10 + i) * (TS - 12);
      const by = y + 8 + FZ.hash2(tx, ty, 20 + i) * (TS - 12);
      g.beginPath();
      g.moveTo(bx - 3, by - 5); g.lineTo(bx, by); g.lineTo(bx + 2, by - 6);
      g.stroke();
    }
  }
  function woodsDecor(g, tx, ty) {
    const colors = ['#ffffff', '#ffb3d1', '#fff27a', '#c9b6ff'];
    for (let i = 0; i < 3; i++) {
      const x = tx * TS + 8 + FZ.hash2(tx, ty, 30 + i) * (TS - 16);
      const y = ty * TS + 8 + FZ.hash2(tx, ty, 40 + i) * (TS - 16);
      g.fillStyle = colors[Math.floor(FZ.hash2(tx, ty, 50 + i) * colors.length)];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.beginPath(); g.arc(x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8, 2.4, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#ffb21a';
      g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
    }
  }

  function paintCavesGround(g, w, rnd) {
    g.fillStyle = '#3a3653';
    g.fillRect(0, 0, w.pxW, w.pxH);
    for (let i = 0; i < w.w * w.h * 0.5; i++) {
      g.fillStyle = rnd.chance(0.5) ? 'rgba(120, 112, 170, 0.16)' : 'rgba(16, 12, 34, 0.2)';
      g.beginPath();
      g.ellipse(rnd() * w.pxW, rnd() * w.pxH, rnd.range(16, 56), rnd.range(10, 32), rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  function cavesTileDetail(g, tx, ty) {
    const x = tx * TS;
    const y = ty * TS;
    g.fillStyle = '#4f4970';
    const n = 1 + Math.floor(FZ.hash2(tx, ty, 1) * 3);
    for (let i = 0; i < n; i++) {
      g.beginPath();
      g.ellipse(x + 6 + FZ.hash2(tx, ty, 10 + i) * 36, y + 6 + FZ.hash2(tx, ty, 20 + i) * 36, 3 + FZ.hash2(tx, ty, 30 + i) * 2, 2, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (FZ.hash2(tx, ty, 2) < 0.18) {
      g.strokeStyle = '#26223c';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x + 8, y + 10); g.lineTo(x + 20, y + 22); g.lineTo(x + 18, y + 34); g.lineTo(x + 30, y + 40);
      g.stroke();
    }
  }
  function cavesDecor(g, tx, ty) {
    // glowing mushrooms
    for (let i = 0; i < 2; i++) {
      const x = tx * TS + 10 + FZ.hash2(tx, ty, 30 + i) * 28;
      const y = ty * TS + 14 + FZ.hash2(tx, ty, 40 + i) * 24;
      const glow = g.createRadialGradient(x, y - 3, 1, x, y - 3, 12);
      glow.addColorStop(0, 'rgba(110, 240, 220, 0.5)');
      glow.addColorStop(1, 'rgba(110, 240, 220, 0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, y - 3, 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#d8d2f0';
      g.fillRect(x - 1.2, y - 3, 2.4, 6);
      g.fillStyle = i ? '#6ef0dc' : '#9fe8ff';
      g.beginPath(); g.ellipse(x, y - 4, 5, 3.2, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x - 1.6, y - 5.4, 0.9, 0, Math.PI * 2); g.fill();
    }
  }

  function paintCloudsGround(g, w, rnd) {
    g.fillStyle = '#e8f1ff';
    g.fillRect(0, 0, w.pxW, w.pxH);
    for (let i = 0; i < w.w * w.h * 0.6; i++) {
      g.fillStyle = rnd.chance(0.6) ? 'rgba(255, 255, 255, 0.7)' : 'rgba(196, 216, 246, 0.45)';
      g.beginPath();
      g.arc(rnd() * w.pxW, rnd() * w.pxH, rnd.range(10, 34), 0, Math.PI * 2);
      g.fill();
    }
  }
  function cloudsTileDetail(g, tx, ty) {
    if (FZ.hash2(tx, ty, 1) < 0.35) {
      g.fillStyle = 'rgba(176, 200, 238, 0.55)';
      g.beginPath();
      g.arc(tx * TS + 8 + FZ.hash2(tx, ty, 2) * 32, ty * TS + 8 + FZ.hash2(tx, ty, 3) * 32, 1.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  function cloudsDecor(g, tx, ty) {
    for (let i = 0; i < 3; i++) {
      const x = tx * TS + 8 + FZ.hash2(tx, ty, 30 + i) * 32;
      const y = ty * TS + 8 + FZ.hash2(tx, ty, 40 + i) * 32;
      g.fillStyle = ['#ffd23f', '#ff8fb1', '#7ab8ff'][i];
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const r = k % 2 === 0 ? 3.4 : 1.2;
        g.lineTo(x + Math.cos((k / 8) * Math.PI * 2) * r, y + Math.sin((k / 8) * Math.PI * 2) * r);
      }
      g.fill();
    }
  }

  /* ---------------- pools (solid water-like tiles) ---------------- */
  function paintPoolTile(g, w, tx, ty, pal) {
    const x = tx * TS;
    const y = ty * TS;
    const same = (dx, dy) => w.tileAt(tx + dx, ty + dy) === T.POOL;
    g.fillStyle = pal.shore;
    g.fillRect(x, y, TS, TS);
    const inset = 5;
    const l = same(-1, 0) ? 0 : inset;
    const r = same(1, 0) ? 0 : inset;
    const t = same(0, -1) ? 0 : inset;
    const b = same(0, 1) ? 0 : inset;
    g.fillStyle = pal.deep;
    g.fillRect(x + l, y + t, TS - l - r, TS - t - b);
    g.fillStyle = pal.water;
    g.fillRect(x + l + (l ? 3 : 0), y + t + (t ? 3 : 0), TS - l - r - (l ? 3 : 0) - (r ? 3 : 0), TS - t - b - (t ? 3 : 0) - (b ? 3 : 0));
    if (pal.pads && FZ.hash2(tx, ty, 80) < 0.3) {
      const px = x + 14 + FZ.hash2(tx, ty, 81) * 20;
      const py = y + 14 + FZ.hash2(tx, ty, 82) * 20;
      g.fillStyle = '#2f8a46';
      g.beginPath(); g.arc(px, py + 1, 7, 0.4, Math.PI * 2); g.lineTo(px, py + 1); g.fill();
      g.fillStyle = '#4fb85e';
      g.beginPath(); g.arc(px, py, 7, 0.4, Math.PI * 2); g.lineTo(px, py); g.fill();
    }
  }

  /* ---------------- static hazards, painted in joined patches ---------------- */
  function paintHazardPatches(g, w, look) {
    const tiles = [];
    for (let ty = 0; ty < w.h; ty++) for (let tx = 0; tx < w.w; tx++) if (w.tileAt(tx, ty) === T.HAZARD) tiles.push([tx, ty]);
    const blobs = (tx, ty, grow) => {
      const cx = tx * TS + TS / 2;
      const cy = ty * TS + TS / 2;
      const out = [[cx, cy, 21 + grow]];
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const diag = dx !== 0 && dy !== 0;
        const ok = diag ? w.tileAt(tx + dx, ty) === T.HAZARD && w.tileAt(tx, ty + dy) === T.HAZARD : true;
        if (w.tileAt(tx + dx, ty + dy) === T.HAZARD && ok) out.push([cx + dx * 24, cy + dy * 24, 18 + grow]);
      }
      return out;
    };
    for (const [color, grow] of look.layers) {
      g.fillStyle = color;
      for (const [tx, ty] of tiles) for (const [x, y, r] of blobs(tx, ty, grow)) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    }
    for (const [tx, ty] of tiles) look.detail(g, tx, ty);
  }

  function brambleDetail(g, tx, ty) {
    const cx = tx * TS + TS / 2;
    const cy = ty * TS + TS / 2;
    g.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a0 = FZ.hash2(tx, ty, 60 + i) * Math.PI * 2;
      const r = 8 + i * 4 + FZ.hash2(tx, ty, 70 + i) * 4;
      const ox = (FZ.hash2(tx, ty, 75 + i) - 0.5) * 12;
      const oy = (FZ.hash2(tx, ty, 76 + i) - 0.5) * 12;
      const span = 2.6 + FZ.hash2(tx, ty, 77 + i) * 1.6;
      g.strokeStyle = '#2a1028';
      g.lineWidth = 5;
      g.beginPath(); g.arc(cx + ox, cy + oy, r, a0, a0 + span); g.stroke();
      g.strokeStyle = '#a2479a';
      g.lineWidth = 2.6;
      g.stroke();
      g.fillStyle = '#ff5c9a';
      for (let k = 0; k < 4; k++) {
        const a = a0 + (span * (k + 0.5)) / 4;
        const px = cx + ox + Math.cos(a) * r;
        const py = cy + oy + Math.sin(a) * r;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        g.beginPath();
        g.moveTo(px - ny * 2.6, py + nx * 2.6);
        g.lineTo(px + nx * 6, py + ny * 6);
        g.lineTo(px + ny * 2.6, py - nx * 2.6);
        g.closePath();
        g.fill();
      }
    }
  }

  function shardDetail(g, tx, ty) {
    for (let i = 0; i < 4; i++) {
      const x = tx * TS + 10 + FZ.hash2(tx, ty, 60 + i) * 28;
      const y = ty * TS + 18 + FZ.hash2(tx, ty, 70 + i) * 24;
      const glow = g.createRadialGradient(x, y - 6, 1, x, y - 6, 14);
      glow.addColorStop(0, 'rgba(255, 111, 208, 0.5)');
      glow.addColorStop(1, 'rgba(255, 111, 208, 0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, y - 6, 14, 0, Math.PI * 2); g.fill();
      crystal(g, x, y, 6 + FZ.hash2(tx, ty, 80 + i) * 4, 12 + FZ.hash2(tx, ty, 90 + i) * 8, (FZ.hash2(tx, ty, 95 + i) - 0.5) * 0.9, '#ff6fd0', '#ffe2f6');
    }
  }

  function gapDetail(g, tx, ty) {
    // little clouds drifting far below
    g.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 2; i++) {
      const x = tx * TS + 10 + FZ.hash2(tx, ty, 60 + i) * 28;
      const y = ty * TS + 12 + FZ.hash2(tx, ty, 70 + i) * 24;
      g.beginPath();
      g.ellipse(x, y, 6, 2.4, 0, 0, Math.PI * 2);
      g.ellipse(x + 4, y - 1.5, 3.5, 2.2, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* ---------------- timed spikes (painted base + animated tips) ---------------- */
  function paintSpikeBase(g, tx, ty, pal) {
    const x = tx * TS;
    const y = ty * TS;
    g.fillStyle = pal.plateLine;
    g.beginPath(); g.roundRect(x + 4, y + 4, TS - 8, TS - 8, 8); g.fill();
    g.fillStyle = pal.plate;
    g.beginPath(); g.roundRect(x + 6, y + 6, TS - 12, TS - 12, 6); g.fill();
    g.fillStyle = pal.hole;
    for (const [hx, hy] of [[15, 16], [33, 16], [15, 33], [33, 33]]) {
      g.beginPath(); g.ellipse(x + hx, y + hy, 5, 3.4, 0, 0, Math.PI * 2); g.fill();
    }
  }

  /** state: 0 down, 0..1 rising warning, 1 up. */
  function drawCrystalSpikes(ctx, x, y, state, t) {
    if (state <= 0) return;
    const up = state >= 1;
    const h = up ? 18 : 5 * state;
    for (const [hx, hy] of [[15, 16], [33, 16], [15, 33], [33, 33]]) {
      const px = x + hx;
      const py = y + hy + 1;
      if (up) {
        const glow = ctx.createRadialGradient(px, py - 8, 1, px, py - 8, 14);
        glow.addColorStop(0, 'rgba(122, 240, 255, 0.55)');
        glow.addColorStop(1, 'rgba(122, 240, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(px, py - 8, 14, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = up ? '#7af0ff' : `rgba(122, 240, 255, ${0.45 + 0.5 * Math.abs(Math.sin(t * 18))})`;
      ctx.strokeStyle = '#17132a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px - 4.5, py);
      ctx.lineTo(px, py - h);
      ctx.lineTo(px + 4.5, py);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (up) {
        ctx.fillStyle = '#e6fdff';
        ctx.beginPath();
        ctx.moveTo(px - 2.6, py - 1);
        ctx.lineTo(px - 0.4, py - h + 3);
        ctx.lineTo(px, py - 1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawZap(ctx, x, y, state, t) {
    if (state <= 0) return;
    const cx = x + TS / 2;
    const cy = y + TS / 2;
    if (state < 1) {
      ctx.fillStyle = `rgba(255, 224, 102, ${0.25 + 0.35 * Math.abs(Math.sin(t * 16))})`;
      ctx.beginPath(); ctx.roundRect(x + 6, y + 6, TS - 12, TS - 12, 6); ctx.fill();
      return;
    }
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 30);
    glow.addColorStop(0, 'rgba(255, 240, 150, 0.8)');
    glow.addColorStop(1, 'rgba(255, 240, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff6c0';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    const pts = [[15, 16], [33, 16], [33, 33], [15, 33]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[(i + (Math.floor(t * 20) % 2) + 1) % 4];
      ctx.beginPath();
      ctx.moveTo(x + ax, y + ay);
      const mx = x + (ax + bx) / 2 + (Math.random() - 0.5) * 10;
      const my = y + (ay + by) / 2 + (Math.random() - 0.5) * 10;
      ctx.lineTo(mx, my);
      ctx.lineTo(x + bx, y + by);
      ctx.stroke();
    }
  }

  function drawThornSpikes(ctx, x, y, state) {
    if (state <= 0) return;
    const h = state >= 1 ? 16 : 5 * state;
    ctx.fillStyle = '#ff5c9a';
    ctx.strokeStyle = '#2a1028';
    ctx.lineWidth = 1.4;
    for (const [hx, hy] of [[15, 16], [33, 16], [15, 33], [33, 33]]) {
      ctx.beginPath();
      ctx.moveTo(x + hx - 4, y + hy + 1);
      ctx.lineTo(x + hx, y + hy + 1 - h);
      ctx.lineTo(x + hx + 4, y + hy + 1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /* ---------------- the three areas ---------------- */
  FZ.AREAS = [
    {
      id: 'woods',
      name: 'Mossy Woods',
      regrow: 'The woods regrew!',
      bg: '#21402b',
      vignette: 'rgba(12, 30, 18, 0.42)',
      darkness: 0,
      critter: 'bee',
      sprites: {
        tall: (res, v) => paintTree(res, v),
        short: (res, v) => paintHedge(res, v),
        block: (res, v) => paintBush(res, v),
        rock: (res, v) => paintRock(res, v, { line: '#3c4658', hi: '#b9c6d8', mid: '#8796ab', lo: '#5f6d82', cap: '#5fae55', capHi: '#86d47a' }),
      },
      paintGround: paintWoodsGround,
      tileDetail: woodsTileDetail,
      decor: woodsDecor,
      pool: { shore: '#d9c38a', deep: '#3b9fd3', water: '#58bde6', pads: true, shimmer: 'rgba(255,255,255,0.55)' },
      hazard: { layers: [['#24101f', 3], ['#4a2346', 0], ['#5e2d58', -7]], detail: brambleDetail },
      spikes: { plate: '#7a5a3a', plateLine: '#3e2a1a', hole: '#2a1a10', draw: drawThornSpikes },
      shadow: 'rgba(28, 64, 34, 0.3)',
    },
    {
      id: 'caves',
      name: 'Crystal Caves',
      regrow: 'The caves shifted!',
      bg: '#120f22',
      vignette: 'rgba(6, 4, 18, 0.5)',
      darkness: 0.8,
      critter: 'bat',
      sprites: {
        tall: (res, v) => paintStalagmites(res, v),
        short: (res, v) => paintRidge(res, v),
        block: (res, v) => paintCrystals(res, v),
        rock: (res, v) => paintRock(res, v, { line: '#17132a', hi: '#8a83b3', mid: '#5d5688', lo: '#3b355e', cap: '#3fb5a8', capHi: '#6ef0dc' }),
      },
      paintGround: paintCavesGround,
      tileDetail: cavesTileDetail,
      decor: cavesDecor,
      pool: { shore: '#26223c', deep: '#123446', water: '#1f5f7a', pads: false, shimmer: 'rgba(122,240,255,0.6)' },
      hazard: { layers: [['#0d0916', 3], ['#1c1430', 0], ['#2a1e44', -7]], detail: shardDetail },
      spikes: { plate: '#4a4468', plateLine: '#17132a', hole: '#120e22', draw: drawCrystalSpikes },
      shadow: 'rgba(8, 6, 20, 0.45)',
    },
    {
      id: 'clouds',
      name: 'Cloud Tops',
      regrow: 'The clouds drifted!',
      bg: '#7fb0ea',
      vignette: 'rgba(60, 100, 170, 0.28)',
      darkness: 0,
      critter: 'storm',
      sprites: {
        tall: (res, v) => paintCloudTower(res, v),
        short: (res, v) => paintCloudWall(res, v),
        block: (res, v) => paintPuff(res, v),
        rock: (res, v) => paintRock(res, v, { line: '#7d6fb0', hi: '#fde8ff', mid: '#e6c9f7', lo: '#b9a0e0', cap: '#ffffff', capHi: '#ffffff' }),
      },
      paintGround: paintCloudsGround,
      tileDetail: cloudsTileDetail,
      decor: cloudsDecor,
      pool: { shore: '#c3d4ef', deep: '#6f7d99', water: '#8b98b2', pads: false, shimmer: 'rgba(255,255,255,0.5)' },
      hazard: { layers: [['#a3bbe0', 3], ['#5e95e0', 0], ['#7fb2f0', -8]], detail: gapDetail },
      spikes: { plate: '#c9d8f0', plateLine: '#7d8fb3', hole: '#8fa3c8', draw: drawZap },
      shadow: 'rgba(80, 110, 170, 0.22)',
    },
    {
      id: 'lair',
      name: "Oink's Tower",
      regrow: 'Oink reshaped the tower!',
      bg: '#140a22',
      vignette: 'rgba(20, 0, 30, 0.55)',
      darkness: 0.5,
      critter: 'bat',
      sprites: {
        tall: (res, v) => paintLairWall(res, v),
        short: (res, v) => paintLairBlock(res, v),
        block: (res, v) => paintCrystals(res, v, CURSED_CRYSTALS),
        rock: (res, v) => paintRock(res, v, { line: '#120a1a', hi: '#7a6a94', mid: '#54476e', lo: '#352b4a', cap: '#7a2ad8', capHi: '#c23cff' }),
      },
      paintGround: paintLairGround,
      tileDetail: lairTileDetail,
      decor: lairDecor,
      paintOverlay: lairOverlay,
      pool: { shore: '#18122a', deep: '#1f4a1a', water: '#3f8a2a', pads: false, shimmer: 'rgba(170,255,120,0.6)' },
      hazard: { layers: [['#120618', 3], ['#3a0f3a', 0], ['#5a1a5a', -7]], detail: shardDetail },
      spikes: { plate: '#3a2a4a', plateLine: '#120a1a', hole: '#0a0610', draw: drawCrystalSpikes },
      shadow: 'rgba(0, 0, 0, 0.4)',
    },
  ];

  FZ.paintSpikeBase = paintSpikeBase;
  FZ.paintPoolTile = paintPoolTile;
  FZ.paintHazardPatches = paintHazardPatches;
})(window.FZ);
