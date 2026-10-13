/* Fuzzle engine: math helpers, seeded randomness, input, and a fixed-step game loop. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  FZ.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  FZ.lerp = (a, b, t) => a + (b - a) * t;
  FZ.damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

  /** '#rrggbb' plus an alpha, as an rgba() string. */
  FZ.rgba = function (hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  /** Seeded random numbers (mulberry32). The same seed always gives the same sequence. */
  FZ.rng = function (seed) {
    let a = seed >>> 0;
    const next = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
    next.pick = (list) => list[Math.floor(next() * list.length)];
    next.chance = (p) => next() < p;
    return next;
  };

  /** Stable noise per tile, used for decoration so a tile always looks the same. */
  FZ.hash2 = function (x, y, salt) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((salt | 0) + 1, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /** Saved progress lives in this browser only. Storage can be blocked, so every call is guarded. */
  FZ.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('fuzzle:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('fuzzle:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  /* ---------------- input: keyboard + gamepad ---------------- */
  const held = new Set();
  const hits = new Set();
  const NO_SCROLL = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  const DASH_KEYS = ['Space', 'ShiftLeft', 'ShiftRight', 'KeyJ'];
  let dashQueued = false;
  let pad = { x: 0, y: 0, dash: false, dashPrev: false };

  function typingInField(e) {
    const tag = e.target && e.target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  window.addEventListener('keydown', (e) => {
    if (typingInField(e)) return;
    if (NO_SCROLL.has(e.code)) e.preventDefault();
    if (!held.has(e.code)) {
      hits.add(e.code);
      if (DASH_KEYS.includes(e.code)) dashQueued = true;
    }
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  function pollPad() {
    pad.x = 0;
    pad.y = 0;
    pad.dash = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      let x = p.axes[0] || 0;
      let y = p.axes[1] || 0;
      if (Math.hypot(x, y) < 0.22) { x = 0; y = 0; }
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      if (b(14)) x = -1;
      if (b(15)) x = 1;
      if (b(12)) y = -1;
      if (b(13)) y = 1;
      pad.x = x;
      pad.y = y;
      pad.dash = b(0) || b(5) || b(7);
      break;
    }
    if (pad.dash && !pad.dashPrev) dashQueued = true;
    pad.dashPrev = pad.dash;
  }

  FZ.input = {
    poll: pollPad,
    held: (code) => held.has(code),
    pressed: (code) => hits.has(code),
    /** Movement direction, length at most 1. */
    move() {
      let x = 0;
      let y = 0;
      if (held.has('ArrowLeft') || held.has('KeyA')) x -= 1;
      if (held.has('ArrowRight') || held.has('KeyD')) x += 1;
      if (held.has('ArrowUp') || held.has('KeyW')) y -= 1;
      if (held.has('ArrowDown') || held.has('KeyS')) y += 1;
      x += pad.x;
      y += pad.y;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
      return { x, y };
    },
    /** True once per dash press, so a press is never lost between physics steps. */
    takeDash() {
      const d = dashQueued;
      dashQueued = false;
      return d;
    },
    endFrame() { hits.clear(); },
  };

  /** Physics runs at a fixed 120 steps per second; drawing happens every display frame. */
  FZ.startLoop = function (update, render) {
    const STEP = 1 / 120;
    let acc = 0;
    let last = performance.now();
    function frame(now) {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.1) dt = 0.1; // after a tab switch, don't fast-forward the world
      acc += dt;
      FZ.input.poll();
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
      render(dt);
      FZ.input.endFrame();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  };
})(window.FZ);
