/* The three NPCs, the Frog's shop items, Dot's lost things, and where they all appear. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const TS = FZ.TS;
  const T = FZ.TILE;

  FZ.NPCS = {
    owl: { id: 'owl', name: 'Old Hoot', role: 'a wise old owl who has watched over these lands for a hundred years' },
    frog: { id: 'frog', name: 'Croaksworth', role: 'a traveling frog merchant who sells charms for seeds' },
    bunny: { id: 'bunny', name: 'Dot', role: 'a bouncy bunny scout from Puffhollow whose things were scattered by the curse' },
  };

  /** What Croaksworth sells. The guard keeps every price between floor and cap. */
  FZ.ITEMS = {
    shield: { id: 'shield', name: 'bubble charm', base: 6, desc: 'Pops instead of you, once.' },
    swift: { id: 'swift', name: 'zippy tea', base: 5, desc: 'Your dash comes back much faster.', once: true },
    magnet: { id: 'magnet', name: 'seed magnet', base: 5, desc: 'Grab seeds from farther away.', once: true },
    glow: { id: 'glow', name: 'glow berry', base: 4, desc: 'You glow brighter in dark places.', once: true },
  };
  FZ.priceBounds = (item) => ({ floor: Math.ceil(item.base * 0.6), cap: Math.ceil(item.base * 1.25) });

  /** What Dot lost in each land. A quest may only ask for one of these. */
  FZ.QUEST_ITEMS = [
    ['acorn cap', 'blue feather', 'tiny bell'],
    ['glow pebble', 'little lantern', 'crystal button'],
    ['kite string', 'rainbow ribbon', 'cloud cookie'],
  ];
  FZ.QUEST_REWARD = { min: 2, max: 5 };

  /** Which NPCs wait in the starting room of each level. */
  FZ.npcsForLevel = function (area, level) {
    if (area >= FZ.BOSS_AREA) return [];
    if (level === 0) return ['owl', 'bunny'];
    if (level === 1) return ['owl', 'frog'];
    return ['owl'];
  };

  /** Places NPCs on open ground in the starting room, a couple of tiles from Fuzzle. */
  FZ.placeNpcs = function (L, world, ids) {
    if (!ids.length || L.startCh === undefined) return [];
    const ch = L.chambers[L.startCh];
    const { CW, CH } = FZ.CHAMBER;
    const sx = L.start.tx;
    const sy = L.start.ty;
    const ok = (x, y) => {
      const t = world.tileAt(x, y);
      return t === T.FLOOR || t === T.DECOR;
    };
    const spots = [];
    for (let y = ch.y0; y < ch.y0 + CH; y++) {
      for (let x = ch.x0; x < ch.x0 + CW; x++) {
        const d = Math.max(Math.abs(x - sx), Math.abs(y - sy));
        if (d < 2 || d > 4 || !ok(x, y)) continue; // NPCs don't block movement; this keeps them off hazards
        spots.push({ x, y, d, k: FZ.hash2(x, y, L.meta.seed & 0xffff) });
      }
    }
    spots.sort((a, b) => a.d - b.d || a.k - b.k);
    const out = [];
    for (const id of ids) {
      const s = spots.find((p) => out.every((o) => Math.abs(o.tx - p.x) + Math.abs(o.ty - p.y) >= 3));
      if (!s) break;
      out.push({ id, def: FZ.NPCS[id], tx: s.x, ty: s.y, x: s.x * TS + TS / 2, y: s.y * TS + TS / 2 + 6, t: Math.random() * 10, blink: 0, blinkT: 2 });
    }
    return out;
  };

  /** Puts Dot's lost item somewhere reachable and well away from the start. */
  FZ.placeQuestItem = function (world, L, itemName) {
    const { dist } = FZ.bfs(world, L.start.tx, L.start.ty);
    let max = 0;
    for (let i = 0; i < dist.length; i++) if (dist[i] > max) max = dist[i];
    const taken = new Set(world.seeds.map((s) => Math.floor(s.y / TS) * world.w + Math.floor(s.x / TS)));
    taken.add(L.portal.ty * world.w + L.portal.tx);
    const options = [];
    for (let i = 0; i < dist.length; i++) {
      const t = world.tiles[i];
      if (dist[i] >= max * 0.45 && (t === T.FLOOR || t === T.DECOR) && !taken.has(i)) options.push(i);
    }
    if (!options.length) return null;
    const i = options[Math.floor(FZ.hash2(L.meta.seed & 0xffff, options.length, 31) * options.length)];
    return { x: (i % world.w) * TS + TS / 2, y: Math.floor(i / world.w) * TS + TS / 2, name: itemName, got: false };
  };

  /* ---------------- drawing ---------------- */
  function eyesBlink(ctx, x, y, r, blink, lid) {
    if (blink > 0) {
      ctx.strokeStyle = lid;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      return true;
    }
    return false;
  }

  /** Old Hoot on his stump. Feet at (0, 0). */
  FZ.drawOwl = function (ctx, t, blink) {
    const tilt = Math.sin(t * 0.8) * 0.06;
    // stump
    ctx.fillStyle = '#6d4426';
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-17, -16);
    ctx.lineTo(-18, 0);
    ctx.quadraticCurveTo(0, 6, 18, 0);
    ctx.lineTo(17, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9965e';
    ctx.beginPath();
    ctx.ellipse(0, -16, 17, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#a0703f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, -16, 10, 3.2, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -18);
    ctx.rotate(tilt);
    // body
    const g = ctx.createRadialGradient(-6, -28, 3, 0, -20, 26);
    g.addColorStop(0, '#c49a6c');
    g.addColorStop(1, '#7d5a38');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -20, 17, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // ear tufts
    ctx.fillStyle = '#7d5a38';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 7, -37);
      ctx.lineTo(s * 15, -47);
      ctx.lineTo(s * 14, -33);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // wings
    ctx.fillStyle = '#6a4a2c';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 15, -16, 6, 12, s * -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // belly with feather scallops
    ctx.fillStyle = '#f3e2c4';
    ctx.beginPath();
    ctx.ellipse(0, -12, 10.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d4b98e';
    ctx.lineWidth = 1.2;
    for (let r = 0; r < 3; r++) {
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.arc(k * 5 + (r % 2) * 2.5, -16 + r * 5, 2.6, 0.1, Math.PI - 0.1);
        ctx.stroke();
      }
    }
    // teal scarf
    ctx.fillStyle = '#3fb5a8';
    ctx.strokeStyle = '#1d6b63';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -25, 12, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6, -24);
    ctx.lineTo(10, -14 + Math.sin(t * 2) * 1.5);
    ctx.lineTo(4, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // eyes behind spectacles
    for (const s of [-1, 1]) {
      const ex = s * 7;
      const ey = -33;
      ctx.fillStyle = '#fff8e6';
      ctx.beginPath();
      ctx.arc(ex, ey, 6.5, 0, Math.PI * 2);
      ctx.fill();
      if (!eyesBlink(ctx, ex, ey, 6.5, blink, '#3a2412')) {
        ctx.fillStyle = '#ffb21a';
        ctx.beginPath();
        ctx.arc(ex, ey, 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1208';
        ctx.beginPath();
        ctx.arc(ex + 0.4, ey + 0.3, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 1.3, ey - 1.5, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#3a2412';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(ex, ey, 7.8, 0, Math.PI * 2);
      ctx.stroke();
      // fluffy white brows
      ctx.strokeStyle = '#fff8e6';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 3, -42);
      ctx.quadraticCurveTo(s * 8, -44.5, s * 13, -41);
      ctx.stroke();
    }
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-1, -33);
    ctx.lineTo(1, -33);
    ctx.stroke();
    // beak
    ctx.fillStyle = '#ff9f2e';
    ctx.strokeStyle = '#a85a10';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-3, -28);
    ctx.lineTo(3, -28);
    ctx.lineTo(0, -22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // feet
    ctx.fillStyle = '#ff9f2e';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 6, -17, 3.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /** Croaksworth in front of his little stall. Feet at (0, 0). */
  FZ.drawFrog = function (ctx, t, blink, noStall) {
    if (!noStall) drawStall(ctx);
    drawFrogBody(ctx, t, blink);
  };

  function drawStall(ctx) {
    // counter, jars, striped awning
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#6d4426';
    ctx.fillRect(-30, -70, 4, 56);
    ctx.fillRect(26, -70, 4, 56);
    ctx.fillStyle = '#a0703f';
    ctx.beginPath();
    ctx.roundRect(-30, -38, 60, 22, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-30, -27); ctx.lineTo(30, -27);
    ctx.stroke();
    for (const [x, c] of [[-21, '#7af0ff'], [-9, '#ff8fd8'], [16, '#ffd23f']]) {
      ctx.fillStyle = c;
      ctx.strokeStyle = '#3a2412';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(x - 4, -47, 8, 9, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c9965e';
      ctx.fillRect(x - 3, -50, 6, 3);
    }
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? '#fff8e6' : '#e8504a';
      ctx.beginPath();
      const x0 = -34 + (68 / stripes) * i;
      const x1 = x0 + 68 / stripes;
      ctx.moveTo(x0, -78);
      ctx.lineTo(x1, -78);
      ctx.lineTo(x1, -66);
      ctx.quadraticCurveTo((x0 + x1) / 2, -60, x0, -66);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 2;
    ctx.strokeRect(-34, -78, 68, 12);
  }

  function drawFrogBody(ctx, t, blink) {
    const bob = Math.abs(Math.sin(t * 2)) * 1.5;
    ctx.save();
    ctx.translate(0, -bob);
    ctx.fillStyle = '#3f8f35';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 11, -2, 7, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-5, -20, 2, 0, -14, 22);
    g.addColorStop(0, '#a6e88a');
    g.addColorStop(1, '#4fa83e');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#1f5a1a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -14, 19, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e6f6c8';
    ctx.beginPath();
    ctx.ellipse(0, -9, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // eye bumps
    for (const s of [-1, 1]) {
      const ex = s * 9;
      const ey = -27;
      ctx.fillStyle = '#6cc35a';
      ctx.strokeStyle = '#1f5a1a';
      ctx.beginPath();
      ctx.arc(ex, ey, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      if (!eyesBlink(ctx, ex, ey, 5, blink, '#1f5a1a')) {
        ctx.fillStyle = '#16210f';
        ctx.beginPath();
        ctx.ellipse(ex + 0.5, ey + 0.5, 3, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 1, ey - 1, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // smile, cheeks, bow tie
    ctx.strokeStyle = '#1f5a1a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -19, 9, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 130, 150, 0.6)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 13, -15, 3.2, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c23c6a';
    ctx.strokeStyle = '#5a1530';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(-6, -7.5); ctx.lineTo(-6, -0.5); ctx.closePath();
    ctx.moveTo(0, -4); ctx.lineTo(6, -7.5); ctx.lineTo(6, -0.5); ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // little flat cap
    ctx.fillStyle = '#8a5a34';
    ctx.strokeStyle = '#3a2412';
    ctx.beginPath();
    ctx.ellipse(0, -33, 10, 4, 0, Math.PI, 0);
    ctx.lineTo(13, -33);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  /** Dot the bunny scout. Feet at (0, 0). */
  FZ.drawBunny = function (ctx, t, blink) {
    const hop = Math.max(0, Math.sin(t * 3.4)) * 5;
    ctx.save();
    ctx.translate(0, -hop);
    // ears (one floppy)
    ctx.strokeStyle = '#5a4a5a';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#fff8f0';
    ctx.save();
    ctx.translate(-5, -34);
    ctx.rotate(-0.15 + Math.sin(t * 3) * 0.05);
    ctx.beginPath(); ctx.ellipse(0, -11, 4.6, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3c8';
    ctx.beginPath(); ctx.ellipse(0, -11, 2.2, 8.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(6, -34);
    ctx.rotate(0.9 + Math.sin(t * 3 + 1) * 0.08);
    ctx.fillStyle = '#fff8f0';
    ctx.beginPath(); ctx.ellipse(0, -10, 4.6, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3c8';
    ctx.beginPath(); ctx.ellipse(0, -10, 2.2, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // body
    ctx.fillStyle = '#fff8f0';
    ctx.strokeStyle = '#5a4a5a';
    ctx.beginPath();
    ctx.ellipse(0, -10, 13, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // satchel strap and bag
    ctx.strokeStyle = '#8a5a34';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-9, -18); ctx.lineTo(8, -3); ctx.stroke();
    ctx.fillStyle = '#b97a45';
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect(5, -8, 9, 8, 2); ctx.fill(); ctx.stroke();
    // head
    ctx.fillStyle = '#fff8f0';
    ctx.strokeStyle = '#5a4a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -27, 12, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // orange scarf
    ctx.fillStyle = '#ff9f4a';
    ctx.strokeStyle = '#b85a10';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(0, -18, 10, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -17); ctx.lineTo(-11, -8 + Math.sin(t * 4) * 1.5); ctx.lineTo(-4, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    // face
    for (const s of [-1, 1]) {
      const ex = s * 5;
      const ey = -28;
      if (!eyesBlink(ctx, ex, ey, 3.6, blink, '#2a1e2a')) {
        ctx.fillStyle = '#2a1e2a';
        ctx.beginPath(); ctx.ellipse(ex, ey, 2.8, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex - 0.8, ey - 1.2, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 140, 170, 0.6)';
      ctx.beginPath(); ctx.ellipse(s * 8.5, -23.5, 2.6, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ff8fb1';
    ctx.beginPath(); ctx.moveTo(-1.8, -24.5); ctx.lineTo(1.8, -24.5); ctx.lineTo(0, -22.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a1e2a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -22.6); ctx.quadraticCurveTo(-1.5, -20.5, -3, -21.5);
    ctx.moveTo(0, -22.6); ctx.quadraticCurveTo(1.5, -20.5, 3, -21.5);
    ctx.stroke();
    // feet
    ctx.fillStyle = '#fff8f0';
    ctx.strokeStyle = '#5a4a5a';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 6, -1, 5, 2.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  };

  FZ.drawNpcBody = function (ctx, id, t, blink) {
    if (id === 'owl') FZ.drawOwl(ctx, t, blink);
    else if (id === 'frog') FZ.drawFrog(ctx, t, blink);
    else FZ.drawBunny(ctx, t, blink);
  };

  /** One of Dot's lost things, drawn small with a sparkle so it reads as a pickup. */
  FZ.drawQuestItem = function (ctx, item, t) {
    const x = item.x;
    const y = item.y - 6 + Math.sin(t * 3) * 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath(); ctx.ellipse(item.x, item.y + 10, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 22);
    glow.addColorStop(0, 'rgba(255, 159, 74, 0.6)');
    glow.addColorStop(1, 'rgba(255, 159, 74, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 1.6;
    switch (item.name) {
      case 'acorn cap':
        ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillRect(-1, -9, 2, 4); break;
      case 'blue feather':
        ctx.fillStyle = '#5aa8f0'; ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 9, 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4, 7); ctx.lineTo(4, -7); ctx.stroke(); break;
      case 'tiny bell':
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(-7, 5); ctx.quadraticCurveTo(-7, -7, 0, -7); ctx.quadraticCurveTo(7, -7, 7, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 6, 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'glow pebble':
        ctx.fillStyle = '#7af0ff'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.5, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'little lantern':
        ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.roundRect(-5, -6, 10, 11, 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -8, 3, Math.PI, 0); ctx.stroke(); break;
      case 'crystal button':
        ctx.fillStyle = '#b48cff'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#3a2412'; for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) { ctx.beginPath(); ctx.arc(a, b, 1, 0, Math.PI * 2); ctx.fill(); } break;
      case 'kite string':
        ctx.fillStyle = '#c9965e'; ctx.beginPath(); ctx.roundRect(-6, -6, 12, 12, 3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; for (let i = -3; i <= 3; i += 2) { ctx.beginPath(); ctx.moveTo(-6, i); ctx.lineTo(6, i); ctx.stroke(); } break;
      case 'rainbow ribbon':
        ['#ff8fb1', '#ffd23f', '#7be0a0', '#7ab8ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 5, 9 - i * 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }); break;
      default:
        ctx.fillStyle = '#fff8e6'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a5a34'; for (const [a, b] of [[-2, -1], [2, 1], [0, 3]]) { ctx.beginPath(); ctx.arc(a, b, 1.1, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  };

  /** Draws every NPC in the level plus an "E Talk" tag over the one Fuzzle is next to. */
  FZ.collectNpcs = function (list, npcs, near, t) {
    for (const n of npcs) {
      list.push({
        y: n.y,
        draw: (ctx) => {
          ctx.fillStyle = 'rgba(10, 20, 20, 0.25)';
          ctx.beginPath();
          ctx.ellipse(n.x, n.y + 2, n.id === 'frog' ? 34 : 18, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.save();
          ctx.translate(n.x, n.y);
          FZ.drawNpcBody(ctx, n.id, n.t, n.blink);
          ctx.restore();
          if (n === near) drawTalkTag(ctx, n);
        },
      });
    }
  };

  function drawTalkTag(ctx, n) {
    const top = n.y - (n.id === 'frog' ? 92 : n.id === 'owl' ? 78 : 66) + Math.sin(n.t * 4) * 2;
    ctx.fillStyle = '#fff8e6';
    ctx.strokeStyle = '#1d3f8a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(n.x - 30, top - 13, 60, 24, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(n.x - 5, top + 11);
    ctx.lineTo(n.x, top + 17);
    ctx.lineTo(n.x + 5, top + 11);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.roundRect(n.x - 25, top - 8, 15, 15, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#16213d';
    ctx.font = '700 12px Fredoka, "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', n.x - 17.5, top);
    ctx.fillText('Talk', n.x + 8, top);
  }

  FZ.tickNpcs = function (npcs, dt) {
    for (const n of npcs) {
      n.t += dt;
      n.blinkT -= dt;
      if (n.blinkT <= 0) { n.blink = 0.14; n.blinkT = 2 + Math.random() * 3; }
      n.blink = Math.max(0, n.blink - dt);
    }
  };
})(window.FZ);
