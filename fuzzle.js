/* Fuzzle and the fluffy family: drawn entirely in code. Movement feel lives in FZ.tuning. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  /** Movement feel. The developer panel (T) edits these live. */
  FZ.tuning = {
    maxSpeed: 235,      // px per second
    accel: 2000,        // how fast Fuzzle reaches top speed
    friction: 2400,     // how fast Fuzzle stops
    dashSpeed: 640,
    dashTime: 0.14,     // seconds
    dashCooldown: 0.42, // seconds
    dashBuffer: 0.12,   // a dash pressed this early still fires when the cooldown ends
  };
  FZ.tuningDefaults = Object.assign({}, FZ.tuning);

  /**
   * Every fuzzle is one body drawn with a different palette: fur colors, an accent color
   * (belly, cheeks, ear tips, tail, feet), a little topper on the head, and a size.
   */
  FZ.PALETTES = {
    fuzzle: {
      line: '#1d3f8a', furHi: '#c4ecff', furLight: '#79c4f8', fur: '#4aa3f0', furDeep: '#2c6fd1', strandHi: '#e2f6ff', strandLo: '#2a66c0',
      accHi: '#fff4b0', acc: '#ffd23f', accDeep: '#f2a913', accLine: '#b97a05', eye: '#16213d', eyeShine: '#6fb8ff', topper: 'curl', size: 1,
    },
    ember: {
      line: '#8a1d2a', furHi: '#ffd0c4', furLight: '#ff8a80', fur: '#f2524a', furDeep: '#c42f3a', strandHi: '#ffe4de', strandLo: '#a8202e',
      accHi: '#fff4b0', acc: '#ffd23f', accDeep: '#f2a913', accLine: '#b97a05', eye: '#2a1018', eyeShine: '#ff9d9d', topper: 'curl', size: 0.94,
    },
    sunny: {
      line: '#9a6a05', furHi: '#fffbe0', furLight: '#ffe680', fur: '#ffd23f', furDeep: '#e8a915', strandHi: '#fffdf0', strandLo: '#c98a06',
      accHi: '#e2f6ff', acc: '#8fd0ff', accDeep: '#4aa3f0', accLine: '#2c6fd1', eye: '#2a1e08', eyeShine: '#8fd0ff', topper: 'twin', size: 0.9,
    },
    mallow: {
      line: '#5b3a8f', furHi: '#ffd6f2', furLight: '#dcbcff', fur: '#b48cff', furDeep: '#8a5fd6', strandHi: '#fbe8ff', strandLo: '#7a4fc2',
      accHi: '#fff0e0', acc: '#ffc39a', accDeep: '#f29a66', accLine: '#c0683a', eye: '#24123d', eyeShine: '#d9b8ff', topper: 'bow', bow: '#ff7fb8', size: 0.88,
    },
    pip: {
      line: '#1a6b63', furHi: '#e6fff9', furLight: '#8ff0dc', fur: '#4fd6c0', furDeep: '#25a894', strandHi: '#f0fffc', strandLo: '#1d8f7e',
      accHi: '#ffe4da', acc: '#ff8f7a', accDeep: '#f2604a', accLine: '#b8402f', eye: '#0f2a26', eyeShine: '#8ff0dc', topper: 'sprout', size: 0.7,
    },
    mama: {
      line: '#9a2a5e', furHi: '#ffe8f2', furLight: '#ffb3d6', fur: '#ff7fb8', furDeep: '#e0558f', strandHi: '#fff2f8', strandLo: '#c43d7a',
      accHi: '#eafff4', acc: '#7be0a8', accDeep: '#3fbf7f', accLine: '#278a58', eye: '#2e0f1e', eyeShine: '#ffb3d6', topper: 'flower', size: 1.08,
    },
    papa: {
      line: '#1f5a2a', furHi: '#e6ffd6', furLight: '#a8e888', fur: '#5cbf4a', furDeep: '#3a9a35', strandHi: '#f2ffea', strandLo: '#2f7f2c',
      accHi: '#fff0d0', acc: '#ffa94d', accDeep: '#f27d1a', accLine: '#b85a10', eye: '#13240f', eyeShine: '#a8e888', topper: 'leaf', size: 1.18,
    },
    locked: {
      line: '#5a6378', furHi: '#e6e9ef', furLight: '#c3c9d6', fur: '#a3abbc', furDeep: '#858ea2', strandHi: '#f0f2f6', strandLo: '#6f788c',
      accHi: '#f2f4f7', acc: '#cfd4de', accDeep: '#aeb5c3', accLine: '#858ea2', eye: '#4a5266', eyeShine: '#cfd4de', topper: 'curl', size: 1,
    },
  };

  /** A circle whose edge is made of soft, slightly swept tufts of fur. */
  function tuftPath(ctx, cx, cy, r, n, depth, t, wobble) {
    const step = (Math.PI * 2) / n;
    const valley = r - depth * 0.35;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i * step - Math.PI / 2;
      const vx = cx + Math.cos(a) * valley;
      const vy = cy + Math.sin(a) * valley;
      if (i === 0) {
        ctx.moveTo(vx, vy);
        continue;
      }
      const a0 = a - step;
      const w = wobble ? Math.sin(t * 2.4 + i * 2.3) * wobble : 0;
      const tipA = a0 + step * 0.6; // tips lean the same way, like brushed fur
      const tipR = r + depth * 1.05 + w;
      const c1A = a0 + step * 0.16;
      const c2A = a0 + step * 0.92;
      const cr = r + depth * 1.0;
      ctx.quadraticCurveTo(cx + Math.cos(c1A) * cr, cy + Math.sin(c1A) * cr, cx + Math.cos(tipA) * tipR, cy + Math.sin(tipA) * tipR);
      ctx.quadraticCurveTo(cx + Math.cos(c2A) * cr, cy + Math.sin(c2A) * cr, vx, vy);
    }
    ctx.closePath();
  }

  function accGradient(ctx, x, y, r, pal) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, pal.accHi);
    g.addColorStop(0.55, pal.acc);
    g.addColorStop(1, pal.accDeep);
    return g;
  }

  function drawTail(ctx, x, y, t, wag, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 9) * 0.25 * wag);
    tuftPath(ctx, 0, 0, 6.5, 9, 2.4, t, 0.4);
    ctx.fillStyle = accGradient(ctx, 0, 0, 7, pal);
    ctx.fill();
    ctx.strokeStyle = pal.accLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawEar(ctx, side, cy, R, t, flop, pal) {
    const base = side < 0 ? -2.15 : -0.99; // radians around the head
    const tipA = base + side * (0.12 + flop * 0.25) + Math.sin(t * 3.1 + side) * 0.04;
    const b1 = { x: Math.cos(base - 0.3) * (R - 3), y: cy + Math.sin(base - 0.3) * (R - 3) };
    const b2 = { x: Math.cos(base + 0.3) * (R - 3), y: cy + Math.sin(base + 0.3) * (R - 3) };
    const tip = { x: Math.cos(tipA) * (R + 10), y: cy + Math.sin(tipA) * (R + 10) };
    const mid = (p, q, k) => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });

    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.quadraticCurveTo(mid(b1, tip, 0.5).x - side * 2, mid(b1, tip, 0.5).y, tip.x, tip.y);
    ctx.quadraticCurveTo(mid(b2, tip, 0.5).x + side * 2, mid(b2, tip, 0.5).y, b2.x, b2.y);
    ctx.closePath();
    ctx.fillStyle = pal.fur;
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2;
    ctx.stroke();

    const k1 = mid(b1, tip, 0.55);
    const k2 = mid(b2, tip, 0.55);
    ctx.beginPath();
    ctx.moveTo(k1.x, k1.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(k2.x, k2.y);
    ctx.quadraticCurveTo((k1.x + k2.x) / 2, (k1.y + k2.y) / 2 + 2, k1.x, k1.y);
    ctx.fillStyle = pal.acc;
    ctx.fill();
  }

  function drawBrows(ctx, ex, ey, spread, kind, pal) {
    ctx.strokeStyle = pal.eye;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const x = ex + s * spread;
      const inner = x - s * 3;
      const outer = x + s * 3.8;
      ctx.beginPath();
      if (kind === 'brave') { ctx.moveTo(outer, ey - 9.6); ctx.lineTo(inner, ey - 7); }
      else { ctx.moveTo(outer, ey - 7.2); ctx.lineTo(inner, ey - 9.8); }
      ctx.stroke();
    }
  }

  function drawEyes(ctx, p, cy, side, pal) {
    const lookX = p.fx * 2.4;
    const lookY = p.fy * 1.4;
    const spread = 7.4 - Math.abs(side) * 1.2;
    const ex = side * 3 + lookX;
    const ey = cy - 3 + lookY;
    const mood = p.mood;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      const x = ex + s * spread;
      const far = side !== 0 && s === -side;
      const sz = far ? 0.86 : 1;
      if (mood === 'dead') {
        ctx.strokeStyle = pal.eye;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x - 3.2, ey - 3.2); ctx.lineTo(x + 3.2, ey + 3.2);
        ctx.moveTo(x + 3.2, ey - 3.2); ctx.lineTo(x - 3.2, ey + 3.2);
        ctx.stroke();
      } else if (mood === 'happy') {
        ctx.strokeStyle = pal.eye;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(x, ey + 1.5, 3.6, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      } else if (mood === 'scared') {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = pal.eye;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse(x, ey, 4.4 * sz, 5.6 * sz, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = pal.eye;
        ctx.beginPath();
        ctx.arc(x + p.fx * 1.2, ey + 0.5, 1.8 * sz, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.blink > 0) {
        ctx.strokeStyle = pal.eye;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(x, ey - 1, 3.8, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      } else {
        const droop = mood === 'sad' ? 0.6 : 0;
        ctx.fillStyle = pal.eye;
        ctx.beginPath();
        ctx.ellipse(x, ey + droop, 4.3 * sz, 5.6 * sz, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.eyeShine;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(x, ey + 0.6 + droop, 3.2 * sz, Math.PI * 0.25, Math.PI * 0.75);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - 1.3 * sz, ey - 2.3 * sz + droop, 1.8 * sz, 0, Math.PI * 2);
        ctx.arc(x + 1.5 * sz, ey + 1.2 * sz + droop, 0.85 * sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (mood === 'sad' || mood === 'scared') drawBrows(ctx, ex, ey, spread, 'worried', pal);
    if (mood === 'brave') drawBrows(ctx, ex, ey, spread, 'brave', pal);

    // cheeks
    ctx.fillStyle = pal.acc;
    ctx.globalAlpha = 0.95;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(ex + s * (spread + 4.6), ey + 6.2, 3.7, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // mouth
    const mx = ex;
    const my = ey + 7.4;
    ctx.strokeStyle = pal.eye;
    ctx.fillStyle = pal.eye;
    ctx.lineWidth = 1.5;
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.moveTo(mx - 3.4, my - 0.6);
      ctx.quadraticCurveTo(mx, my + 5, mx + 3.4, my - 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath();
      ctx.arc(mx, my + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.dashing || mood === 'dead') {
      ctx.beginPath();
      ctx.ellipse(mx, my + 0.8, 1.7, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === 'scared') {
      ctx.beginPath();
      ctx.moveTo(mx - 3.6, my + 1);
      for (let i = 1; i <= 4; i++) ctx.lineTo(mx - 3.6 + i * 1.8, my + (i % 2 ? -0.6 : 1));
      ctx.stroke();
      // sweat drop
      ctx.fillStyle = '#9fdcff';
      ctx.strokeStyle = '#3a7fc0';
      ctx.lineWidth = 1;
      const sx = ex + spread + 9;
      const sy = ey - 7;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.quadraticCurveTo(sx + 3.4, sy + 1, sx, sy + 2.6);
      ctx.quadraticCurveTo(sx - 3.4, sy + 1, sx, sy - 4);
      ctx.fill();
      ctx.stroke();
    } else if (mood === 'sad') {
      ctx.beginPath();
      ctx.arc(mx, my + 3.2, 2.8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (mood === 'brave') {
      ctx.beginPath();
      ctx.arc(mx, my - 1.2, 3, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(mx - 3, my);
      ctx.quadraticCurveTo(mx - 1.5, my + 2.2, mx, my + 0.4);
      ctx.quadraticCurveTo(mx + 1.5, my + 2.2, mx + 3, my);
      ctx.stroke();
    }
  }

  function curl(ctx, ox, hy, bob, pal, dir, k) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ox - 1 * dir * k, hy + 3 * k);
    ctx.quadraticCurveTo(ox + 1 * dir * k, hy - 8 * k + bob, ox + 6 * dir * k, hy - 7 * k + bob);
    ctx.quadraticCurveTo(ox + 9 * dir * k, hy - 4 * k + bob, ox + 5 * dir * k, hy - 3 * k + bob);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 5 * k;
    ctx.stroke();
    ctx.strokeStyle = pal.acc;
    ctx.lineWidth = 2.8 * k;
    ctx.stroke();
  }

  function drawTopper(ctx, pal, hy, bob) {
    const kind = pal.topper || 'curl';
    if (kind === 'curl') curl(ctx, 0, hy, bob, pal, 1, 1);
    else if (kind === 'twin') { curl(ctx, -3, hy + 1, bob, pal, -1, 0.82); curl(ctx, 3, hy + 1, bob, pal, 1, 0.82); }
    else if (kind === 'flower') {
      const fx = 7;
      const fy = hy + 2 + bob * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 3.8, fy + Math.sin(a) * 3.8, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#b97a05';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'leaf') {
      ctx.lineCap = 'round';
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, hy + 4);
      ctx.lineTo(2, hy - 3 + bob);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, hy - 3 + bob);
      ctx.quadraticCurveTo(10, hy - 11 + bob, 14, hy - 3 + bob);
      ctx.quadraticCurveTo(7, hy + 1 + bob, 2, hy - 3 + bob);
      ctx.fillStyle = pal.acc;
      ctx.fill();
      ctx.strokeStyle = pal.accLine;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, hy - 3 + bob);
      ctx.lineTo(11, hy - 4.5 + bob);
      ctx.stroke();
    } else if (kind === 'bow') {
      const bx = 7;
      const by = hy + 3 + bob * 0.4;
      ctx.fillStyle = pal.bow || '#ff7fb8';
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(bx + s * 4.6, by - 0.5, 4.6, 3.2, s * -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(bx, by, 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'sprout') {
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, hy + 4);
      ctx.lineTo(0, hy - 4 + bob);
      ctx.stroke();
      ctx.fillStyle = '#8be07a';
      ctx.lineWidth = 1.2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * 4, hy - 5 + bob, 4, 2.4, s * -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  /**
   * Draws a fuzzle with its feet at (0, 0). `p` is a plain render state, so story panels,
   * the HUD, cages, and followers all use the same drawing code. `p.pal` picks the colors.
   */
  FZ.drawFuzzle = function (ctx, p) {
    const pal = p.pal || FZ.PALETTES.fuzzle;
    const size = pal.size || 1;
    const t = p.t;
    const R = 19;
    const cy = -17;
    const back = p.fy < -0.55 && Math.abs(p.fx) < 0.75;
    const side = Math.abs(p.fx) > 0.35 ? Math.sign(p.fx) : 0;
    const walk = p.moving ? Math.sin(p.step * Math.PI * 2) : 0;

    ctx.save();
    ctx.scale(p.sx * size, p.sy * size);
    ctx.translate(p.mood === 'scared' ? Math.sin(t * 40) * 0.6 : 0, -p.hop);

    // feet
    ctx.fillStyle = pal.acc;
    ctx.strokeStyle = pal.accLine;
    ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 7.5, -3 + s * walk * 1.8, 5.2, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (!back) drawTail(ctx, side !== 0 ? -side * 18 : 16, cy + 11, t, p.moving ? 1 : 0.35, pal);

    drawEar(ctx, -1, cy, R, t, p.moving ? 1 : 0, pal);
    drawEar(ctx, 1, cy, R, t, p.moving ? 1 : 0, pal);

    // body
    tuftPath(ctx, 0, cy, R, 20, 3.2, t, 0.45);
    const g = ctx.createRadialGradient(-6, cy - 9, 2, 0, cy, R + 4);
    g.addColorStop(0, pal.furHi);
    g.addColorStop(0.32, pal.furLight);
    g.addColorStop(0.75, pal.fur);
    g.addColorStop(1, pal.furDeep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 2.1;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // fur strands: light on top, darker underneath
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = pal.strandHi;
    ctx.globalAlpha = 0.75;
    for (let i = 0; i < 6; i++) {
      const a = -2.6 + i * 0.32;
      const r0 = R * (0.55 + (i % 2) * 0.18);
      const x = Math.cos(a) * r0;
      const y = cy + Math.sin(a) * r0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2.5, y - 1.5, x + 4.5 + Math.sin(t * 2 + i) * 0.5, y + 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.strandLo;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 5; i++) {
      const a = 0.35 + i * 0.5;
      const r0 = R * 0.78;
      const x = Math.cos(a) * r0;
      const y = cy + Math.sin(a) * r0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 1.5, y + 2, x - 3.5, y + 2.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (!back) {
      ctx.save();
      ctx.translate(side * 2.5, cy + 9);
      ctx.scale(1.15, 0.86);
      tuftPath(ctx, 0, 0, 8.6, 11, 1.8, t, 0);
      ctx.fillStyle = accGradient(ctx, 0, 0, 9, pal);
      ctx.fill();
      ctx.restore();
      drawEyes(ctx, p, cy, side, pal);
    } else {
      ctx.strokeStyle = pal.strandHi;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, cy + 1, 6, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawTail(ctx, 0, cy + 14, t, p.moving ? 1 : 0.35, pal);
    }

    const hy = cy - R - 1;
    const bob = Math.sin(t * 4) * 0.6 + (p.moving ? walk * 0.8 : 0);
    drawTopper(ctx, pal, hy, bob);

    ctx.restore();
  };

  /* ---------------- the controllable hero ---------------- */
  class Fuzzle {
    constructor(x, y) {
      this.t = 0;
      this.hb = 13; // half-size of the collision box
      this.pal = FZ.PALETTES.fuzzle;
      this.reset(x, y);
    }

    reset(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.fx = 0;
      this.fy = 1;
      this.dashT = 0;
      this.dashCd = 0;
      this.dashBuf = 0;
      this.trailT = 0;
      this.sx = 1;
      this.sy = 1;
      this.svx = 0;
      this.svy = 0;
      this.step = 0;
      this.blink = 0;
      this.blinkT = 1.5;
      this.mood = 'idle';
      this.moodT = 0;
      this.alive = true;
      this.deadT = 0;
      this.poofed = false;
      this.power = null; // a Heart Crystal's power during the boss fight
      this.invuln = 0;   // brief safety after a bubble charm pops
      if (!this.mods) this.mods = { dashCd: 1, pickup: 1, light: 1 };
      if (this.shield === undefined) this.shield = 0;
    }

    get speed() { return Math.hypot(this.vx, this.vy); }

    update(dt, world, controlled) {
      const T = FZ.tuning;
      this.t += dt;
      this.invuln = Math.max(0, this.invuln - dt);

      if (this.alive && controlled) {
        const m = FZ.input.move();
        const moving = m.x !== 0 || m.y !== 0;
        if (moving) {
          const l = Math.hypot(m.x, m.y);
          this.fx = m.x / l;
          this.fy = m.y / l;
        }

        if (FZ.input.takeDash()) this.dashBuf = T.dashBuffer;
        this.dashBuf = Math.max(0, this.dashBuf - dt);
        this.dashCd = Math.max(0, this.dashCd - dt);

        if (this.dashBuf > 0 && this.dashCd === 0 && this.dashT === 0) {
          this.dashBuf = 0;
          this.dashT = T.dashTime;
          this.dashCd = T.dashCooldown * this.mods.dashCd + T.dashTime;
          this.vx = this.fx * T.dashSpeed;
          this.vy = this.fy * T.dashSpeed;
          FZ.fx.fluff(this.x - this.fx * 10, this.y - 6 - this.fy * 6, 9, { speed: 70, vx: -this.vx * 0.15, vy: -this.vy * 0.15 });
          FZ.sfx.play('dash');
          if (Math.abs(this.fx) > Math.abs(this.fy)) { this.sx = 1.35; this.sy = 0.78; } else { this.sx = 0.8; this.sy = 1.3; }
        }

        if (this.dashT > 0) {
          this.dashT = Math.max(0, this.dashT - dt);
          this.trailT -= dt;
          if (this.trailT <= 0) {
            this.trailT = 0.025;
            FZ.fx.fluff(this.x, this.y - 12, 1, { speed: 20, size: 4.5, life: 0.3 });
          }
          if (this.dashT === 0) {
            const sp = this.speed;
            if (sp > T.maxSpeed) { this.vx *= T.maxSpeed / sp; this.vy *= T.maxSpeed / sp; }
            this.sx = 0.86; this.sy = 1.14;
          }
        } else {
          // move velocity toward the target as one vector, so diagonals feel the same as straights
          const tx = m.x * T.maxSpeed;
          const ty = m.y * T.maxSpeed;
          const rate = moving ? T.accel : T.friction;
          const dx = tx - this.vx;
          const dy = ty - this.vy;
          const d = Math.hypot(dx, dy);
          const s = rate * dt;
          if (d <= s) { this.vx = tx; this.vy = ty; } else { this.vx += (dx / d) * s; this.vy += (dy / d) * s; }
        }

        const bumped = world.moveBox(this, this.vx * dt, this.vy * dt);
        if (bumped && this.dashT > 0) {
          this.dashT = 0;
          this.sx = 0.75; this.sy = 1.2;
          FZ.fx.shake(3);
          FZ.sfx.play('bump');
        }
      } else if (this.alive) {
        this.vx *= Math.exp(-10 * dt);
        this.vy *= Math.exp(-10 * dt);
      } else {
        this.deadT += dt;
        if (!this.poofed && this.deadT > 0.42) {
          this.poofed = true;
          FZ.fx.fluff(this.x, this.y - 16, 26, { speed: 160, size: 5.5, life: 0.8, yellow: 0.35, lift: 30 });
          FZ.fx.ring(this.x, this.y - 6, '#ffffff', 26);
        }
      }

      if (this.power && this.alive && Math.random() < dt * 30) FZ.fx.rise(this.x, this.y - 8, this.power.color);

      const sp = this.speed;
      this.step += sp * dt * 0.0105;

      let tx = 1;
      let ty = 1;
      if (!this.alive) { tx = 1.25; ty = 0.7; }
      else if (this.dashT > 0) { tx = this.sx; ty = this.sy; }
      else if (sp > 25) { const b = Math.abs(Math.sin(this.step * Math.PI * 2)); tx = 1 - b * 0.05; ty = 1 + b * 0.07; }
      else { const br = Math.sin(this.t * 2.3) * 0.025; tx = 1 + br; ty = 1 - br; }
      const k = 240;
      const c = 16;
      this.svx = (this.svx + (tx - this.sx) * k * dt) * Math.exp(-c * dt);
      this.svy = (this.svy + (ty - this.sy) * k * dt) * Math.exp(-c * dt);
      this.sx += this.svx * dt;
      this.sy += this.svy * dt;

      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blink = 0.13;
        this.blinkT = 1.6 + Math.random() * 3.4;
      }
      this.blink = Math.max(0, this.blink - dt);
      if (this.moodT > 0) {
        this.moodT -= dt;
        if (this.moodT <= 0 && this.alive) this.mood = this.power ? 'brave' : 'idle';
      }
    }

    kill() {
      if (!this.alive) return;
      this.alive = false;
      this.deadT = 0;
      this.poofed = false;
      this.vx = 0;
      this.vy = 0;
      this.dashT = 0;
      this.power = null;
      this.mood = 'dead';
      this.sx = 1.4; this.sy = 0.6;
      FZ.fx.shake(9);
      FZ.sfx.play('poof');
    }

    cheer(seconds) {
      this.mood = 'happy';
      this.moodT = seconds || 0.7;
      this.sx = 0.82; this.sy = 1.22;
    }

    draw(ctx) {
      if (!this.alive && this.poofed) return;
      const moving = this.alive && this.speed > 25;
      const hop = moving && this.dashT === 0 ? Math.abs(Math.sin(this.step * Math.PI * 2)) * 4.5 : 0;

      ctx.fillStyle = 'rgba(22, 52, 30, 0.28)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 11, 16 - hop * 0.6, 5.5 - hop * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.power) {
        const left = this.power.t;
        const blinkOut = left < 1.6 && Math.floor(left * 8) % 2 === 0;
        const pulse = 0.75 + 0.25 * Math.sin(this.t * 10);
        const g = ctx.createRadialGradient(this.x, this.y - 16, 4, this.x, this.y - 16, 46);
        g.addColorStop(0, FZ.rgba(this.power.color, (blinkOut ? 0.2 : 0.6) * pulse));
        g.addColorStop(1, FZ.rgba(this.power.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 16, 46, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      if (this.invuln > 0 && Math.floor(this.t * 18) % 2 === 0) ctx.globalAlpha = 0.4;
      ctx.translate(this.x, this.y + 12);
      FZ.drawFuzzle(ctx, {
        t: this.t, sx: this.sx, sy: this.sy, hop, fx: this.fx, fy: this.fy, pal: this.pal,
        moving, step: this.step, blink: this.blink, mood: this.mood, dashing: this.dashT > 0,
      });
      ctx.restore();

      if (this.shield > 0 && this.alive) {
        // a bubble charm floats around Fuzzle while it's ready to pop
        const r = 27 + Math.sin(this.t * 3) * 1.5;
        ctx.strokeStyle = 'rgba(160, 230, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 14 - hop, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 190, 240, 0.6)';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 14 - hop, r, this.t * 2, this.t * 2 + 1.2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(this.x - r * 0.5, this.y - 14 - hop - r * 0.55, 4, 2.4, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  FZ.Fuzzle = Fuzzle;
})(window.FZ);
