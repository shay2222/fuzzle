/* Particles, screen shake, and sound effects made in code (no audio files). */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const parts = [];
  let shake = 0;

  function add(p) {
    parts.push(Object.assign({ vx: 0, vy: 0, drag: 2, grav: 0, r: 3, life: 0.6, age: 0, color: '#fff', kind: 'dot', spin: 0, rot: 0 }, p));
  }

  FZ.fx = {
    /** Soft tufts of fur, used for dashing and for Fuzzle's poof. */
    fluff(x, y, n, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (o.speed || 90) * (0.4 + Math.random() * 0.8);
        add({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 8,
          vx: Math.cos(a) * s + (o.vx || 0),
          vy: Math.sin(a) * s * 0.7 + (o.vy || 0) - (o.lift || 0),
          r: (o.size || 4) * (0.6 + Math.random() * 0.8),
          life: (o.life || 0.55) * (0.7 + Math.random() * 0.6),
          color: Math.random() < (o.yellow || 0.25) ? '#ffd23f' : Math.random() < 0.5 ? '#6cbcf7' : '#bfeaff',
          drag: 3,
          grav: o.grav || -10,
          kind: 'fluff',
        });
      }
    },
    /** Twinkling stars for pickups. */
    sparkle(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const s = 70 + Math.random() * 110;
        add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: 3 + Math.random() * 3, life: 0.5 + Math.random() * 0.4, color: color || '#ffe066', kind: 'star', drag: 4, grav: 60, spin: (Math.random() - 0.5) * 12 });
      }
    },
    ring(x, y, color, size) {
      add({ x, y, r: size || 30, life: 0.45, color: color || '#ffffff', kind: 'ring', drag: 0 });
    },
    rise(x, y, color) {
      add({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 8, vy: -40 - Math.random() * 40, r: 1.5 + Math.random() * 2, life: 0.9 + Math.random() * 0.6, color: color || '#c9fbff', kind: 'dot', drag: 0.5 });
    },
    shake(amount) { shake = Math.max(shake, amount); },
    takeShake(dt) {
      const s = shake;
      shake = Math.max(0, shake - dt * 40);
      return s;
    },
    clear() { parts.length = 0; },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { parts.splice(i, 1); continue; }
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy = p.vy * d + p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
      }
    },
    draw(ctx) {
      for (const p of parts) {
        const k = 1 - p.age / p.life;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        if (p.kind === 'star') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const r = p.r * (0.6 + k * 0.6);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const rr = i % 2 === 0 ? r : r * 0.38;
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (p.kind === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * k;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r * (1.4 - k), p.r * 0.5 * (1.4 - k), 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (p.kind === 'fluff' ? 0.5 + k * 0.6 : 1), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };

  /* ---------------- sound ---------------- */
  let ac = null;
  let muted = false;

  function tone(start, type, f0, f1, dur, vol) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, start);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ac.destination);
    o.start(start);
    o.stop(start + dur + 0.03);
  }

  function noise(start, dur, vol, freq) {
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 1200;
    const g = ac.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(ac.destination);
    src.start(start);
  }

  FZ.sfx = {
    init() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ac = new AC();
      }
      if (ac && ac.state === 'suspended') ac.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    get ctx() { return ac; },
    play(name) {
      if (!ac || muted) return;
      const t = ac.currentTime;
      switch (name) {
        case 'dash':
          noise(t, 0.12, 0.25, 2200);
          tone(t, 'triangle', 380, 760, 0.1, 0.07);
          break;
        case 'seed':
          tone(t, 'sine', 880, 880, 0.08, 0.1);
          tone(t + 0.06, 'sine', 1175, 1175, 0.08, 0.1);
          tone(t + 0.12, 'sine', 1568, 1568, 0.14, 0.09);
          break;
        case 'poof':
          noise(t, 0.35, 0.35, 700);
          tone(t, 'square', 420, 110, 0.32, 0.05);
          break;
        case 'portal':
          [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.07, 'triangle', f, f, 0.22, 0.07));
          break;
        case 'clear':
          [784, 988, 1175, 1568, 1319, 1568].forEach((f, i) => tone(t + i * 0.08, 'square', f, f, 0.12, 0.045));
          break;
        case 'bump':
          tone(t, 'sine', 160, 90, 0.08, 0.06);
          break;
        case 'regrow':
          noise(t, 0.5, 0.18, 500);
          [392, 330, 262].forEach((f, i) => tone(t + 0.05 + i * 0.07, 'sine', f, f * 1.5, 0.2, 0.05));
          break;
        case 'level':
          [523, 659, 784].forEach((f, i) => tone(t + i * 0.09, 'triangle', f, f, 0.18, 0.07));
          break;
        case 'win':
          [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.1, 'square', f, f, 0.16, 0.05));
          break;
        case 'zap':
          tone(t, 'sawtooth', 520, 180, 0.12, 0.03);
          break;
        case 'page':
          tone(t, 'sine', 660, 880, 0.08, 0.05);
          break;
        case 'free':
          noise(t, 0.25, 0.12, 3000);
          [659, 784, 988, 1319].forEach((f, i) => tone(t + i * 0.06, 'triangle', f, f, 0.16, 0.07));
          break;
        case 'power':
          [523, 784, 1047, 1568].forEach((f, i) => tone(t + i * 0.05, 'sine', f, f * 1.01, 0.2, 0.07));
          break;
        case 'hit':
          noise(t, 0.3, 0.4, 900);
          tone(t, 'square', 220, 80, 0.35, 0.06);
          [784, 1047].forEach((f, i) => tone(t + 0.14 + i * 0.08, 'triangle', f, f, 0.15, 0.07));
          break;
        case 'oink':
          tone(t, 'square', 300, 520, 0.09, 0.045);
          tone(t + 0.1, 'square', 520, 240, 0.16, 0.045);
          break;
      }
    },
  };
})(window.FZ);
