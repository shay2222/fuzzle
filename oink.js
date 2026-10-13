/* Warlock Oink, the piglet he becomes, and the Heart Crystals: all drawn in code. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const SKIN = '#d98aa9';
  const SKIN_HI = '#f2b8cf';
  const SKIN_LO = '#a85f82';
  const SKIN_LINE = '#4a1530';
  const SNOUT = '#f0a8c4';
  const NOSTRIL = '#5a1f3e';
  const CLOAK_TOP = '#4a2672';
  const CLOAK_DEEP = '#22103a';
  const CLOAK_LINE = '#12081f';
  const LINING = '#8a1f5c';
  const STAFF_CRYSTAL = '#c23cff';

  /** The three Heart Crystals, one hidden in each cursed land. */
  FZ.HEARTS = [
    { name: 'Heart of the Woods', color: '#7be06a', light: '#e2ffd6', deep: '#2f8a3a' },
    { name: 'Heart of the Caves', color: '#62e6ff', light: '#e6fdff', deep: '#1a7f99' },
    { name: 'Heart of the Clouds', color: '#ff8fd8', light: '#ffe6f6', deep: '#b8408f' },
  ];
  FZ.GREY_HEART = { color: '#aab1bf', light: '#e8ebf0', deep: '#6f788c' };

  function heartPath(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.85);
    ctx.bezierCurveTo(-s * 1.25, s * 0.05, -s * 0.78, -s * 1.0, 0, -s * 0.42);
    ctx.bezierCurveTo(s * 0.78, -s * 1.0, s * 1.25, s * 0.05, 0, s * 0.85);
    ctx.closePath();
  }

  /** A faceted heart-shaped gem centered at (x, y). `rays` adds a rotating halo. */
  FZ.drawHeartCrystal = function (ctx, x, y, heart, t, s, rays) {
    ctx.save();
    ctx.translate(x, y);
    if (rays) {
      const glow = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 2.6);
      glow.addColorStop(0, FZ.rgba(heart.color, 0.55));
      glow.addColorStop(1, FZ.rgba(heart.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, s * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.rotate(t * 0.6);
      ctx.fillStyle = FZ.rgba(heart.light, 0.35);
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-s * 0.12, -s * 0.9);
        ctx.lineTo(0, -s * 2.3);
        ctx.lineTo(s * 0.12, -s * 0.9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    heartPath(ctx, s);
    const g = ctx.createLinearGradient(-s, -s, s, s);
    g.addColorStop(0, heart.light);
    g.addColorStop(0.45, heart.color);
    g.addColorStop(1, heart.deep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#1d2240';
    ctx.lineWidth = Math.max(1.2, s * 0.09);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // facets
    ctx.strokeStyle = FZ.rgba(heart.light, 0.75);
    ctx.lineWidth = Math.max(0.8, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.lineTo(0, s * 0.85);
    ctx.moveTo(-s * 0.72, -s * 0.15);
    ctx.lineTo(0, s * 0.18);
    ctx.lineTo(s * 0.72, -s * 0.15);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.45, -s * 0.38, s * 0.16, s * 0.26, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  /**
   * Draws Oink with his hooves at (0, 0). o = { t, mood, facing, scale, flash, grounded }.
   * Moods: idle, cast, charge, hurt, dizzy.
   */
  FZ.drawOink = function (ctx, o) {
    const t = o.t;
    const k = o.scale || 1;
    const mood = o.mood || 'idle';
    const cast = mood === 'cast';
    ctx.save();
    if (o.flash > 0 && Math.floor(t * 24) % 2 === 0) ctx.globalAlpha *= 0.35;
    ctx.scale(k * (o.facing || 1), k);
    ctx.translate(0, o.grounded ? 0 : Math.sin(t * 2.2) * 4 - 10);
    if (mood === 'charge') ctx.rotate(0.14);
    if (mood === 'hurt') ctx.translate(Math.sin(t * 50) * 2, 0);
    const flap = Math.sin(t * 3.2);

    // cloak, with a ragged hem that ripples
    ctx.beginPath();
    ctx.moveTo(-20, -74);
    ctx.bezierCurveTo(-40, -60, -46, -30, -50 - flap * 2, 2);
    const N = 8;
    for (let i = 1; i <= N; i++) {
      const x = -50 + (100 * i) / N + (i === N ? flap * 2 : 0);
      const y = i % 2 === 1 ? -12 + Math.sin(t * 4 + i) * 2 : 2 + Math.sin(t * 3 + i) * 1.5;
      ctx.lineTo(x, y);
    }
    ctx.bezierCurveTo(46, -30, 40, -60, 20, -74);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, -80, 0, 4);
    cg.addColorStop(0, CLOAK_TOP);
    cg.addColorStop(1, CLOAK_DEEP);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = CLOAK_LINE;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // crimson lining and dark robe in the opening
    ctx.beginPath();
    ctx.moveTo(-8, -66);
    ctx.quadraticCurveTo(-20, -30, -22, -2);
    ctx.lineTo(22, -2);
    ctx.quadraticCurveTo(20, -30, 8, -66);
    ctx.closePath();
    ctx.fillStyle = LINING;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, -62);
    ctx.quadraticCurveTo(-12, -30, -13, -2);
    ctx.lineTo(13, -2);
    ctx.quadraticCurveTo(12, -30, 4, -62);
    ctx.closePath();
    ctx.fillStyle = '#2a1446';
    ctx.fill();
    // belt with a crescent-moon buckle
    ctx.fillStyle = '#1a0c2c';
    ctx.fillRect(-15, -41, 30, 6);
    ctx.fillStyle = '#e8c547';
    ctx.beginPath();
    ctx.arc(0, -38, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0c2c';
    ctx.beginPath();
    ctx.arc(1.5, -39, 3.1, 0, Math.PI * 2);
    ctx.fill();
    // hooves
    ctx.fillStyle = '#3a2030';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 7, 0, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // staff with a glowing crystal
    const sx = 32;
    const top = cast ? -126 : -118;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a1608';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(sx + 2, -2);
    ctx.quadraticCurveTo(sx - 4, -60, sx + 1, top + 8);
    ctx.stroke();
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = '#2a1608';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx + 1, top + 8);
    ctx.quadraticCurveTo(sx - 9, top, sx - 4, top - 9);
    ctx.moveTo(sx + 1, top + 8);
    ctx.quadraticCurveTo(sx + 11, top, sx + 6, top - 9);
    ctx.stroke();
    const cy = top - 2;
    const gr = cast ? 32 : 20 + Math.sin(t * 4) * 3;
    const glow = ctx.createRadialGradient(sx + 1, cy, 2, sx + 1, cy, gr);
    glow.addColorStop(0, 'rgba(209, 76, 255, 0.75)');
    glow.addColorStop(1, 'rgba(209, 76, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx + 1, cy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + 1, cy - 12);
    ctx.lineTo(sx + 7, cy);
    ctx.lineTo(sx + 1, cy + 9);
    ctx.lineTo(sx - 5, cy);
    ctx.closePath();
    ctx.fillStyle = STAFF_CRYSTAL;
    ctx.fill();
    ctx.strokeStyle = '#3a0f5a';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#f2c8ff';
    ctx.beginPath();
    ctx.moveTo(sx + 1, cy - 10);
    ctx.lineTo(sx - 3, cy);
    ctx.lineTo(sx + 1, cy - 2);
    ctx.closePath();
    ctx.fill();

    // sleeves and trotter hands
    const sleeve = (pts, hand) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      ctx.lineTo(pts[6], pts[7]);
      ctx.quadraticCurveTo(pts[8], pts[9], pts[10], pts[11]);
      ctx.closePath();
      ctx.fillStyle = CLOAK_TOP;
      ctx.fill();
      ctx.strokeStyle = CLOAK_LINE;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.fillStyle = SKIN;
      ctx.strokeStyle = SKIN_LINE;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(hand[0], hand[1], 5.6, 4.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3a2030';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(hand[0] + 0.5, hand[1] - 3.5);
      ctx.lineTo(hand[0] + 0.5, hand[1] + 1);
      ctx.stroke();
    };
    sleeve([14, -66, 30, -60, 36, -40, 26, -34, 20, -48, 12, -56], [31, -37]);
    if (cast) {
      sleeve([-14, -66, -30, -78, -36, -96, -27, -99, -22, -82, -10, -60], [-32, -101]);
      ctx.fillStyle = '#f2c8ff';
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1;
        ctx.beginPath();
        ctx.arc(-32 + Math.cos(a) * 9, -104 + Math.sin(a) * 9, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      sleeve([-14, -66, -30, -58, -34, -38, -24, -33, -20, -48, -12, -56], [-29, -35]);
    }

    // spiky high collar
    ctx.beginPath();
    ctx.moveTo(-24, -68);
    ctx.lineTo(-37, -106);
    ctx.lineTo(-21, -90);
    ctx.lineTo(-13, -112);
    ctx.lineTo(0, -96);
    ctx.lineTo(13, -112);
    ctx.lineTo(21, -90);
    ctx.lineTo(37, -106);
    ctx.lineTo(24, -68);
    ctx.closePath();
    ctx.fillStyle = '#2a1446';
    ctx.fill();
    ctx.strokeStyle = CLOAK_LINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = '#b8327a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-33, -100);
    ctx.lineTo(-21, -88);
    ctx.lineTo(-14, -106);
    ctx.moveTo(33, -100);
    ctx.lineTo(21, -88);
    ctx.lineTo(14, -106);
    ctx.stroke();

    // head
    const hy = -90;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 9, hy - 15);
      ctx.quadraticCurveTo(s * 22, hy - 30, s * 31, hy - 25);
      ctx.quadraticCurveTo(s * 26, hy - 12, s * 19, hy - 7);
      ctx.closePath();
      ctx.fillStyle = SKIN;
      ctx.fill();
      ctx.strokeStyle = SKIN_LINE;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 13, hy - 15);
      ctx.quadraticCurveTo(s * 22, hy - 25, s * 27, hy - 22);
      ctx.quadraticCurveTo(s * 24, hy - 14, s * 19, hy - 10);
      ctx.closePath();
      ctx.fillStyle = '#9a4f74';
      ctx.fill();
    }
    const hg = ctx.createRadialGradient(-8, hy - 10, 3, 0, hy, 28);
    hg.addColorStop(0, SKIN_HI);
    hg.addColorStop(0.55, SKIN);
    hg.addColorStop(1, SKIN_LO);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, hy, 25, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // eyes
    for (const s of [-1, 1]) {
      const ex = s * 9.5;
      const ey = hy - 5;
      if (mood === 'dizzy') {
        ctx.strokeStyle = SKIN_LINE;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.3) {
          const r = 0.4 + a * 0.4;
          const px = ex + Math.cos(a + t * 8) * r;
          const py = ey + Math.sin(a + t * 8) * r;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }
      if (mood === 'hurt') {
        ctx.strokeStyle = SKIN_LINE;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey - 3); ctx.lineTo(ex + 4, ey + 3);
        ctx.moveTo(ex + 4, ey - 3); ctx.lineTo(ex - 4, ey + 3);
        ctx.stroke();
        continue;
      }
      const eg = ctx.createRadialGradient(ex, ey, 1, ex, ey, 13);
      eg.addColorStop(0, `rgba(198, 255, 77, ${cast ? 0.75 : 0.5})`);
      eg.addColorStop(1, 'rgba(198, 255, 77, 0)');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(ex, ey, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(-s * 0.28);
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 3.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d4ff5a';
      ctx.fill();
      ctx.strokeStyle = SKIN_LINE;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = '#1f3300';
      ctx.beginPath();
      ctx.ellipse(s * -0.6, 0, 1.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // heavy scowling brows
    ctx.strokeStyle = '#4a1530';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (mood === 'dizzy' || mood === 'hurt') { ctx.moveTo(s * 15, hy - 15); ctx.lineTo(s * 4, hy - 13); }
      else { ctx.moveTo(s * 16, hy - 15); ctx.lineTo(s * 4, hy - 9); }
      ctx.stroke();
    }
    // snout
    ctx.beginPath();
    ctx.ellipse(0, hy + 6, 11.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = SNOUT;
    ctx.fill();
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = NOSTRIL;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 4, hy + 6, 2.2, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // frown and tusks
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (mood === 'hurt' || mood === 'dizzy') ctx.ellipse(0, hy + 17, 4, 2.6, 0, 0, Math.PI * 2);
    else { ctx.moveTo(-9, hy + 17); ctx.quadraticCurveTo(0, hy + 13, 9, hy + 17); }
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 6, hy + 16);
      ctx.quadraticCurveTo(s * 13.5, hy + 14.5, s * 13, hy + 4);
      ctx.quadraticCurveTo(s * 10.5, hy + 11, s * 9, hy + 15.5);
      ctx.closePath();
      ctx.fillStyle = '#fff1d0';
      ctx.fill();
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    if (mood === 'dizzy') {
      ctx.fillStyle = '#ffe066';
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        const x = Math.cos(a) * 26;
        const y = hy - 30 + Math.sin(a) * 6;
        ctx.beginPath();
        for (let j = 0; j < 10; j++) {
          const r = j % 2 === 0 ? 5 : 2;
          ctx.lineTo(x + Math.cos((j / 10) * Math.PI * 2 - Math.PI / 2) * r, y + Math.sin((j / 10) * Math.PI * 2 - Math.PI / 2) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  };

  /** What's left of Oink once the spell breaks: a very small, very grumpy piglet. Feet at (0, 0). */
  FZ.drawPiglet = function (ctx, t, running, facing) {
    const hop = running ? Math.abs(Math.sin(t * 14)) * 3 : Math.abs(Math.sin(t * 2.5)) * 0.8;
    ctx.save();
    ctx.scale(facing || 1, 1);
    ctx.translate(0, -hop);
    ctx.fillStyle = SKIN_LO;
    for (const [x, ph] of [[-8, 0], [-3, 1.6], [4, 3.1], [8, 4.7]]) {
      const lift = running ? Math.max(0, Math.sin(t * 20 + ph)) * 2 : 0;
      ctx.fillRect(x - 1.6, -7 - lift, 3.2, 7);
    }
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-15, -15, 3, Math.PI * 0.2, Math.PI * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -13, 13, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(11, -19, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -25);
    ctx.lineTo(7, -31);
    ctx.lineTo(11, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(17.5, -17, 3.6, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = SNOUT;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = NOSTRIL;
    ctx.beginPath();
    ctx.arc(16.6, -17, 0.8, 0, Math.PI * 2);
    ctx.arc(18.6, -17, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f1010';
    ctx.beginPath();
    ctx.arc(12, -21, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = SKIN_LINE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9, -25);
    ctx.lineTo(14, -23.5);
    ctx.stroke();
    ctx.fillStyle = '#fff1d0';
    ctx.beginPath();
    ctx.moveTo(14.5, -14.5);
    ctx.lineTo(15.5, -12);
    ctx.lineTo(16.5, -14.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /** Oink's empty cloak, left in a heap on the floor. */
  FZ.drawCloakPile = function (ctx) {
    ctx.fillStyle = CLOAK_DEEP;
    ctx.strokeStyle = CLOAK_LINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-38, 0);
    ctx.quadraticCurveTo(-30, -18, -10, -16);
    ctx.quadraticCurveTo(4, -26, 16, -14);
    ctx.quadraticCurveTo(34, -14, 40, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = LINING;
    ctx.beginPath();
    ctx.ellipse(-4, -6, 14, 4, 0.1, 0, Math.PI * 2);
    ctx.fill();
  };
})(window.FZ);
