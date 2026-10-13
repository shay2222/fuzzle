/* Storybook cutscenes: the intro, each Heart Crystal, Oink's challenge, and the ending. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const W = 640;
  const H = 300;
  const el = {
    root: $('story'), canvas: $('story-canvas'), text: $('story-text'), speaker: $('story-speaker'),
    kicker: $('story-kicker'), next: $('story-next'), skip: $('story-skip'), dots: $('story-dots'),
  };
  const ctx = el.canvas.getContext('2d');
  let panels = [];
  let idx = 0;
  let done = null;
  let raf = 0;
  let t0 = 0;
  let active = false;

  function size() {
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = el.canvas.clientWidth || W;
    el.canvas.width = Math.round(cssW * r);
    el.canvas.height = Math.round(((cssW * H) / W) * r);
  }

  function show(i) {
    idx = i;
    const p = panels[i];
    el.text.textContent = p.text;
    el.speaker.hidden = !p.speaker;
    el.speaker.textContent = p.speaker || '';
    el.kicker.hidden = !p.kicker;
    el.kicker.textContent = p.kicker || '';
    el.next.textContent = i === panels.length - 1 ? p.button || 'Play' : 'Next';
    el.skip.hidden = i === panels.length - 1;
    el.dots.innerHTML = '';
    if (panels.length > 1) {
      panels.forEach((_, k) => {
        const d = document.createElement('i');
        if (k === i) d.className = 'on';
        el.dots.append(d);
      });
    }
    t0 = performance.now();
  }

  function frame(now) {
    if (!active) return;
    const t = (now - t0) / 1000;
    const s = el.canvas.width / W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.clearRect(0, 0, W, H);
    panels[idx].draw(ctx, t + idx * 3);
    raf = requestAnimationFrame(frame);
  }

  function next() {
    if (!active) return;
    if (idx < panels.length - 1) {
      show(idx + 1);
      FZ.sfx.play('page');
    } else finish();
  }

  function finish() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    el.root.hidden = true;
    const d = done;
    done = null;
    if (d) d();
  }

  FZ.story = {
    play(list, onDone) {
      panels = list;
      done = onDone;
      el.root.hidden = false;
      active = true;
      size();
      show(0);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    get active() { return active; },
  };

  el.next.addEventListener('click', next);
  el.skip.addEventListener('click', finish);
  window.addEventListener('keydown', (e) => {
    if (!active || (e.target && e.target.tagName === 'BUTTON')) return;
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); next(); }
    else if (e.code === 'Escape') { e.preventDefault(); finish(); }
  });
  window.addEventListener('resize', () => { if (active) size(); });

  /* ---------------- art helpers ---------------- */
  function sky(g, a, b) {
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }

  function hill(g, color, y, amp, freq, phase) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * freq + phase) * amp);
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  }

  function stars(g, t, n, color) {
    g.fillStyle = color || '#ffffff';
    for (let i = 0; i < n; i++) {
      const x = FZ.hash2(i, 1, 9) * W;
      const y = FZ.hash2(i, 2, 9) * H * 0.6;
      g.globalAlpha = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      g.beginPath();
      g.arc(x, y, 1 + FZ.hash2(i, 3, 9) * 1.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function puff(g, x, y, s, color) {
    g.fillStyle = color || 'rgba(255, 255, 255, 0.9)';
    for (const [dx, dy, r] of [[0, 0, 16], [-16, 5, 11], [16, 5, 12], [-6, -9, 11], [8, -8, 10]]) {
      g.beginPath();
      g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
      g.fill();
    }
  }

  /** A family member (or Fuzzle) standing at (x, y), scaled. */
  function fam(g, id, x, y, s, mood, t, o) {
    o = o || {};
    const pal = id === 'fuzzle' ? FZ.PALETTES.fuzzle : FZ.member(id).pal;
    const ph = o.ph || 0;
    const hop = o.hop !== undefined ? o.hop : Math.abs(Math.sin(t * (o.speed || 3) + ph)) * (o.amp !== undefined ? o.amp : 2);
    const cycle = (t * 0.8 + ph * 0.37) % 3.5;
    g.fillStyle = 'rgba(0, 0, 0, 0.2)';
    g.beginPath();
    g.ellipse(x, y + 1, 16 * s * (pal.size || 1), 4.5 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    FZ.drawFuzzle(g, {
      t: t + ph, sx: 1, sy: 1, hop, fx: o.fx || 0, fy: o.fy !== undefined ? o.fy : 0.6,
      moving: false, step: 0, blink: cycle < 0.12 ? 1 : 0, mood: mood || 'idle', dashing: false, pal,
    });
    g.restore();
  }

  function oink(g, x, y, s, mood, t, facing) {
    g.fillStyle = 'rgba(0, 0, 0, 0.3)';
    g.beginPath();
    g.ellipse(x, y + 2, 44 * s, 11 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(x, y);
    FZ.drawOink(g, { t, mood, facing, scale: s });
    g.restore();
  }

  function cage(g, id, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    FZ.drawCage(g, 0, 0, FZ.member(id), t, false);
    g.restore();
  }

  function lair(g, t) {
    sky(g, '#140a22', '#2c1840');
    g.fillStyle = '#231b36';
    g.fillRect(0, 200, W, 100);
    g.save();
    g.translate(W / 2, 250);
    g.scale(1, 0.3);
    g.strokeStyle = 'rgba(194, 60, 255, 0.45)';
    g.lineWidth = 6;
    for (const r of [210, 170]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
    g.restore();
    for (const x of [40, 600]) {
      g.fillStyle = '#1e1530';
      g.fillRect(x - 5, 110, 10, 26);
      const fl = 1 + Math.sin(t * 12 + x) * 0.08;
      const glow = g.createRadialGradient(x, 100, 2, x, 100, 40);
      glow.addColorStop(0, 'rgba(160, 255, 110, 0.55)');
      glow.addColorStop(1, 'rgba(160, 255, 110, 0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(x, 100, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5fe04a';
      g.beginPath();
      g.moveTo(x, 86 - 6 * fl);
      g.quadraticCurveTo(x + 8, 102, x, 108);
      g.quadraticCurveTo(x - 8, 102, x, 86 - 6 * fl);
      g.fill();
    }
  }

  function medallion(g, x, y, r, area, t) {
    g.save();
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.clip();
    if (area === 0) {
      g.fillStyle = '#7cc46a'; g.fillRect(x - r, y - r, r * 2, r * 2);
      g.fillStyle = '#3e9a4f';
      for (const [dx, dy, rr] of [[-40, -30, 24], [36, -36, 22], [-10, -50, 20], [48, 10, 18], [-52, 14, 16]]) { g.beginPath(); g.arc(x + dx, y + dy, rr, 0, Math.PI * 2); g.fill(); }
    } else if (area === 1) {
      g.fillStyle = '#3a3653'; g.fillRect(x - r, y - r, r * 2, r * 2);
      for (const [dx, c] of [[-44, '#7af0ff'], [-28, '#b48cff'], [40, '#ff8fd8'], [54, '#7af0ff']]) {
        g.fillStyle = c;
        g.beginPath(); g.moveTo(x + dx - 6, y + 10); g.lineTo(x + dx, y - 26); g.lineTo(x + dx + 6, y + 10); g.fill();
      }
    } else {
      g.fillStyle = '#bcd8ff'; g.fillRect(x - r, y - r, r * 2, r * 2);
      puff(g, x - 40, y - 30, 1.1); puff(g, x + 42, y - 22, 0.9); puff(g, x + 10, y + 40, 1.2);
    }
    // Oink's curse
    g.fillStyle = 'rgba(80, 20, 110, 0.35)';
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.strokeStyle = 'rgba(210, 90, 255, 0.6)';
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.arc(x, y, 24 + k * 18, t * (0.6 + k * 0.2) + k, t * (0.6 + k * 0.2) + k + 2.2);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = '#1d0f33';
    g.lineWidth = 7;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#c23cff';
    g.lineWidth = 2;
    g.stroke();
  }

  function caption(g, text, x, y, color) {
    g.font = '600 15px Fredoka, "Trebuchet MS", sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 4;
    g.strokeStyle = '#1d0f33';
    g.strokeText(text, x, y);
    g.fillStyle = color || '#fff8e6';
    g.fillText(text, x, y);
  }

  function arrow(g, x1, y1, x2, y2, color) {
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.setLineDash([2, 10]);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.setLineDash([]);
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath();
    g.moveTo(x2 + Math.cos(a) * 8, y2 + Math.sin(a) * 8);
    g.lineTo(x2 + Math.cos(a + 2.4) * 12, y2 + Math.sin(a + 2.4) * 12);
    g.lineTo(x2 + Math.cos(a - 2.4) * 12, y2 + Math.sin(a - 2.4) * 12);
    g.closePath();
    g.fill();
  }

  function floatingHearts(g, t) {
    g.fillStyle = 'rgba(255, 127, 184, 0.75)';
    for (let i = 0; i < 9; i++) {
      const x = 40 + FZ.hash2(i, 5, 1) * 560;
      const y = H - ((t * (24 + i * 4) + i * 70) % (H + 40));
      const s = 5 + FZ.hash2(i, 6, 1) * 4;
      g.beginPath();
      g.moveTo(x, y + s * 0.9);
      g.bezierCurveTo(x - s * 1.3, y, x - s * 0.8, y - s, x, y - s * 0.4);
      g.bezierCurveTo(x + s * 0.8, y - s, x + s * 1.3, y, x, y + s * 0.9);
      g.fill();
    }
  }

  const AREA_SKIES = [['#bfe6ff', '#d8f5c4'], ['#2a2448', '#4a3f78'], ['#9fc8ff', '#f0f6ff']];
  const NEXT_STOP = ['Next stop: the Crystal Caves.', 'Next stop: the Cloud Tops.', "Only Oink's Tower is left."];

  /* ---------------- the stories ---------------- */
  FZ.STORIES = {
    intro() {
      return [
        {
          text: 'In the soft green hills of Puffhollow lived Fuzzle and the fluffiest family you ever saw.',
          draw(g, t) {
            sky(g, '#9fd8ff', '#fff1d6');
            g.fillStyle = 'rgba(255, 230, 140, 0.9)';
            g.beginPath(); g.arc(545, 64, 32, 0, Math.PI * 2); g.fill();
            puff(g, 120 + ((t * 8) % 700) - 60, 60, 1.1);
            puff(g, 380 + ((t * 5) % 700) - 300, 40, 0.8);
            hill(g, '#9ad67e', 196, 14, 0.012, 0);
            hill(g, '#6fbf5a', 230, 10, 0.02, 1.5);
            g.fillStyle = '#4e8f3f';
            g.beginPath(); g.ellipse(70, 214, 26, 30, 0, Math.PI, 0); g.fill();
            g.fillStyle = '#ffd23f';
            g.beginPath(); g.ellipse(70, 214, 18, 22, 0, Math.PI, 0); g.fill();
            g.fillStyle = '#b97a05';
            g.beginPath(); g.arc(78, 204, 2.5, 0, Math.PI * 2); g.fill();
            const row = [['papa', 150], ['mama', 220], ['ember', 286], ['fuzzle', 344], ['sunny', 402], ['mallow', 458], ['pip', 512]];
            row.forEach(([id, x], i) => fam(g, id, x, 274, 1.5, id === 'fuzzle' ? 'happy' : 'idle', t, { ph: i * 0.7 }));
          },
        },
        {
          text: 'Then one stormy night, the warlock Oink swept into Puffhollow, tusks gleaming and cloak swirling.',
          draw(g, t) {
            sky(g, '#1d0f33', '#4a2a6e');
            stars(g, t, 30);
            if (t % 3.2 < 0.09) { g.fillStyle = 'rgba(255, 255, 255, 0.35)'; g.fillRect(0, 0, W, H); }
            hill(g, '#2a2a4a', 214, 12, 0.012, 0);
            hill(g, '#1f1f38', 244, 8, 0.02, 1.5);
            const swirl = (a) => {
              g.strokeStyle = 'rgba(210, 90, 255, 0.5)';
              g.lineWidth = 3;
              g.beginPath();
              g.arc(470, 170, 70 + a * 20, t * 1.5 + a, t * 1.5 + a + 1.8);
              g.stroke();
            };
            for (let a = 0; a < 3; a++) swirl(a);
            oink(g, 478, 282, 1.5, 'cast', t, -1);
            const row = [['papa', 76], ['mama', 122], ['ember', 166], ['fuzzle', 206], ['sunny', 244], ['mallow', 280], ['pip', 312]];
            row.forEach(([id, x], i) => fam(g, id, x, 274, 1.15, 'scared', t, { ph: i, amp: 0.5, fx: 0.3 }));
          },
        },
        {
          text: "He locked Fuzzle's brother and sisters in cages and hid them in the Mossy Woods, the Crystal Caves, and the Cloud Tops. Mama, Papa, and baby Pip he kept in his tower. Then he cursed the land so it shifts every time someone falls.",
          draw(g, t) {
            sky(g, '#24123d', '#3b1d5e');
            stars(g, t, 20, '#d9b8ff');
            const ids = ['ember', 'sunny', 'mallow'];
            [110, 320, 530].forEach((x, i) => {
              medallion(g, x, 136, 82, i, t);
              cage(g, ids[i], x, 200, 1.4, t + i);
              caption(g, FZ.AREAS[i].name, x, 252);
            });
            caption(g, 'The land shifts every time you fall', 320, 284, '#ffd23f');
          },
        },
        {
          text: 'But the curse could not hide the three Heart Crystals. Gather them, little Fuzzle, free your family, and break Oink’s spell.',
          draw(g, t) {
            sky(g, '#ffd9a8', '#bfe6ff');
            g.save();
            g.translate(320, 150);
            g.rotate(t * 0.15);
            g.fillStyle = 'rgba(255, 255, 255, 0.25)';
            for (let i = 0; i < 12; i++) {
              g.rotate(Math.PI / 6);
              g.beginPath(); g.moveTo(-14, 0); g.lineTo(0, -400); g.lineTo(14, 0); g.fill();
            }
            g.restore();
            hill(g, '#9ad67e', 226, 10, 0.014, 0.5);
            hill(g, '#6fbf5a', 252, 8, 0.02, 2);
            FZ.HEARTS.forEach((h, k) => {
              const a = t * 0.9 + (k * Math.PI * 2) / 3;
              FZ.drawHeartCrystal(g, 320 + Math.cos(a) * 160, 128 + Math.sin(a) * 38, h, t, 20, true);
            });
            fam(g, 'fuzzle', 320, 270, 2.5, 'brave', t, { amp: 3, speed: 2.4 });
          },
        },
      ];
    },

    areaClear(area, member, rescued) {
      const heart = FZ.HEARTS[area];
      const name = FZ.AREAS[area].name;
      return [
        {
          kicker: `Heart Crystal ${area + 1} of 3`,
          text: `The ${heart.name}! Oink's curse on the ${name} breaks, and ${member.name} is free! ${NEXT_STOP[area]}`,
          draw(g, t) {
            const [a, b] = AREA_SKIES[area];
            sky(g, a, b);
            if (area === 1) stars(g, t, 24, '#9ff7ff');
            if (area === 2) { puff(g, 90, 230, 1.6); puff(g, 560, 240, 1.4); puff(g, 330, 260, 1.8); }
            else hill(g, area === 0 ? '#6fbf5a' : '#2a2448', 240, 10, 0.016, 1);
            FZ.drawHeartCrystal(g, 210, 136 + Math.sin(t * 2) * 6, heart, t, 46, true);
            const earlier = (rescued || []).filter((id) => id !== member.id && FZ.member(id).area !== undefined);
            earlier.forEach((id, i) => fam(g, id, 560 - i * 34, 236, 1.1, 'happy', t, { ph: i + 2, amp: 4, speed: 5 }));
            fam(g, 'fuzzle', 400, 272, 1.9, 'happy', t, { amp: 6, speed: 6 });
            fam(g, member.id, 480, 272, 1.9, 'happy', t, { amp: 6, speed: 6, ph: 0.8 });
          },
        },
      ];
    },

    bossIntro(rescued) {
      return [
        {
          kicker: "Oink's Tower",
          speaker: 'Warlock Oink',
          text: '"So the little fluffball came for its family. How adorable. Your shiny pebbles are no match for MY magic!"',
          draw(g, t) {
            lair(g, t);
            cage(g, 'pip', 360, 132, 0.9, t);
            cage(g, 'mama', 440, 124, 0.9, t + 1);
            cage(g, 'papa', 520, 132, 0.9, t + 2);
            oink(g, 470, 288, 1.45, 'cast', t, -1);
            (rescued || []).filter((id) => FZ.member(id).area !== undefined).forEach((id, i) => fam(g, id, 70 + i * 40, 262, 1.2, 'brave', t, { ph: i, amp: 1 }));
            fam(g, 'fuzzle', 190, 280, 1.7, 'brave', t, { amp: 1.5 });
          },
        },
        {
          kicker: 'How to beat Oink',
          text: 'Grab the glowing Heart Crystal, then dash into Oink before its power fades. Each hit frees someone you love. Three hits will break his spell. Dodge his magic orbs and thorn traps!',
          button: 'Fight!',
          draw(g, t) {
            lair(g, t);
            FZ.drawHeartCrystal(g, 120, 150 + Math.sin(t * 3) * 5, FZ.HEARTS[0], t, 22, true);
            arrow(g, 160, 168, 228, 222, '#ffd23f');
            const glow = g.createRadialGradient(300, 230, 4, 300, 230, 60);
            glow.addColorStop(0, 'rgba(123, 224, 106, 0.6)');
            glow.addColorStop(1, 'rgba(123, 224, 106, 0)');
            g.fillStyle = glow;
            g.beginPath(); g.arc(300, 230, 60, 0, Math.PI * 2); g.fill();
            fam(g, 'fuzzle', 300, 268, 1.6, 'brave', t, { amp: 2, fx: 0.4 });
            arrow(g, 352, 236, 410, 236, '#ffd23f');
            oink(g, 500, 288, 1.25, Math.floor(t * 1.2) % 2 ? 'hurt' : 'idle', t, -1);
          },
        },
      ];
    },

    ending() {
      return [
        {
          text: 'With the power of all three Heart Crystals, Fuzzle broke the spell. The great warlock Oink shrank into a very small, very grumpy piglet.',
          draw(g, t) {
            sky(g, '#3a2a5a', '#f6dcff');
            g.fillStyle = '#4a3f66';
            g.fillRect(0, 210, W, 90);
            g.save(); g.translate(320, 262); g.scale(1.8, 1.8); FZ.drawCloakPile(g); g.restore();
            g.save(); g.translate(318, 236); g.scale(2.2, 2.2); FZ.drawPiglet(g, t, false, 1); g.restore();
            g.fillStyle = '#ffffff';
            g.strokeStyle = '#1d0f33';
            g.lineWidth = 2.5;
            g.beginPath(); g.roundRect(352, 150, 70, 32, 14); g.fill(); g.stroke();
            g.beginPath(); g.moveTo(362, 180); g.lineTo(352, 194); g.lineTo(374, 181); g.fill();
            g.fillStyle = '#1d0f33';
            g.font = '700 16px Fredoka, "Trebuchet MS", sans-serif';
            g.textAlign = 'center';
            g.fillText('oink...', 387, 172);
            FZ.HEARTS.forEach((h, k) => {
              const a = t * 1.4 + (k * Math.PI * 2) / 3;
              FZ.drawHeartCrystal(g, 130 + Math.cos(a) * 46, 170 + Math.sin(a) * 16, h, t, 11, false);
            });
            fam(g, 'fuzzle', 130, 272, 1.8, 'brave', t, { amp: 2, fx: 0.4 });
          },
        },
        {
          kicker: 'The end',
          text: 'The curse lifted, the lands bloomed again, and the whole family went home to Puffhollow together.',
          button: 'See your run',
          draw(g, t) {
            sky(g, '#ffb38a', '#ffe7b8');
            g.fillStyle = 'rgba(255, 220, 120, 0.9)';
            g.beginPath(); g.arc(320, 190, 60, 0, Math.PI * 2); g.fill();
            hill(g, '#8fcf6e', 210, 12, 0.012, 0.3);
            hill(g, '#6fbf5a', 242, 8, 0.02, 2);
            floatingHearts(g, t);
            const row = [['papa', 130], ['mama', 202], ['ember', 268], ['fuzzle', 330], ['sunny', 392], ['mallow', 448], ['pip', 504]];
            row.forEach(([id, x], i) => fam(g, id, x, 276, 1.5, 'happy', t, { ph: i * 0.6, amp: 7, speed: 5 }));
          },
        },
      ];
    },
  };
})(window.FZ);
