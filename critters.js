/* Patrolling critters: a bee in the woods, a glow bat in the caves, a storm puff in the clouds. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  class Critter {
    constructor(spec, kind) {
      const TS = FZ.TS;
      this.ax = spec.ax * TS + TS / 2;
      this.ay = spec.ay * TS + TS / 2;
      this.bx = spec.bx * TS + TS / 2;
      this.by = spec.by * TS + TS / 2;
      this.len = Math.max(1, Math.hypot(this.bx - this.ax, this.by - this.ay));
      this.speed = spec.speed;
      this.u = spec.phase;
      this.dir = 1;
      this.kind = kind;
      this.t = spec.phase * 10;
      this.vertical = this.ax === this.bx;
      this.place();
    }

    place() {
      this.x = this.ax + (this.bx - this.ax) * this.u;
      this.y = this.ay + (this.by - this.ay) * this.u;
    }

    update(dt) {
      this.t += dt;
      this.u += (this.dir * this.speed * dt) / this.len;
      if (this.u > 1) { this.u = 2 - this.u; this.dir = -1; }
      if (this.u < 0) { this.u = -this.u; this.dir = 1; }
      this.place();
    }

    /** Touching a critter poofs Fuzzle. Judged at ground level with a forgiving radius. */
    hits(p) {
      return Math.hypot(this.x - p.x, this.y - (p.y + 4)) < 19;
    }

    get facing() {
      if (this.vertical) return 1;
      return (this.bx - this.ax) * this.dir >= 0 ? 1 : -1;
    }

    draw(ctx) {
      const bob = Math.sin(this.t * 6) * 2.5;
      ctx.fillStyle = 'rgba(10, 20, 30, 0.22)';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 12, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(this.x, this.y - 12 + bob);
      ctx.scale(this.facing, 1);
      if (this.kind === 'bee') drawBee(ctx, this.t);
      else if (this.kind === 'bat') drawBat(ctx, this.t);
      else drawStorm(ctx, this.t);
      ctx.restore();
    }
  }

  function eyes(ctx, x, y, white, pupil, r) {
    for (const s of [-1, 1]) {
      ctx.fillStyle = white;
      ctx.beginPath(); ctx.arc(x + s * r * 1.15, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pupil;
      ctx.beginPath(); ctx.arc(x + s * r * 1.15 + r * 0.25, y + r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x + s * r * 1.15 + r * 0.05, y - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBee(ctx, t) {
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 38));
    // wings
    ctx.fillStyle = 'rgba(235, 248, 255, 0.85)';
    ctx.strokeStyle = 'rgba(80, 110, 150, 0.7)';
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(-2 + s * 4, -8);
      ctx.scale(1, flap);
      ctx.beginPath(); ctx.ellipse(0, -6, 6, 9, s * 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // stinger
    ctx.fillStyle = '#3a2a10';
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-17, 1.5); ctx.lineTo(-12, 3); ctx.fill();
    // body with stripes
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, 1, 12, 9.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = '#2b2116';
    ctx.fillRect(-7, -12, 4.5, 26);
    ctx.fillRect(0, -12, 4.5, 26);
    ctx.restore();
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 1, 12, 9.5, 0, 0, Math.PI * 2); ctx.stroke();
    // face on the front
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(9, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    eyes(ctx, 10, -1, '#ffffff', '#1a1208', 2.4);
    ctx.strokeStyle = '#3a2a10';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(8, -6); ctx.quadraticCurveTo(8, -12, 4, -13); ctx.moveTo(12, -6); ctx.quadraticCurveTo(13, -12, 16, -13); ctx.stroke();
  }

  function drawBat(ctx, t) {
    const flap = Math.sin(t * 16);
    ctx.fillStyle = '#4b347a';
    ctx.strokeStyle = '#1d1233';
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.scale(s, 1);
      ctx.rotate(flap * 0.45);
      ctx.beginPath();
      ctx.moveTo(4, -2);
      ctx.quadraticCurveTo(14, -14, 24, -6);
      ctx.quadraticCurveTo(20, -2, 21, 3);
      ctx.quadraticCurveTo(16, 0, 14, 4);
      ctx.quadraticCurveTo(10, 1, 5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#6b4fa8';
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, -5); ctx.lineTo(-5, -14); ctx.lineTo(-1, -8);
    ctx.moveTo(7, -5); ctx.lineTo(5, -14); ctx.lineTo(1, -8);
    ctx.fill(); ctx.stroke();
    const glow = ctx.createRadialGradient(0, -1, 1, 0, -1, 14);
    glow.addColorStop(0, 'rgba(255, 230, 102, 0.5)');
    glow.addColorStop(1, 'rgba(255, 230, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, -1, 14, 0, Math.PI * 2); ctx.fill();
    eyes(ctx, 1, -1, '#ffe066', '#3a1f00', 2.6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(-2, 5); ctx.lineTo(-1, 8); ctx.lineTo(0, 5); ctx.moveTo(1.5, 5); ctx.lineTo(2.5, 8); ctx.lineTo(3.5, 5); ctx.fill();
  }

  function drawStorm(ctx, t) {
    const flash = Math.sin(t * 9) > 0.6;
    if (flash) {
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-6, 16); ctx.lineTo(0, 15); ctx.lineTo(-3, 24); ctx.stroke();
    }
    const circles = [[0, 0, 11], [-10, 3, 8], [10, 3, 8], [-5, -7, 7], [6, -7, 8]];
    ctx.fillStyle = '#4a5370';
    for (const [x, y, r] of circles) { ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#8792aa';
    for (const [x, y, r] of circles) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#a9b3c9';
    for (const [x, y, r] of circles) { ctx.beginPath(); ctx.arc(x - 2, y - 2, r * 0.55, 0, Math.PI * 2); ctx.fill(); }
    eyes(ctx, 1, 1, '#ffffff', '#1d2236', 2.6);
    ctx.strokeStyle = '#1d2236';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-5, -4.5); ctx.lineTo(-1, -2.5); ctx.moveTo(7, -4.5); ctx.lineTo(3, -2.5); ctx.stroke();
  }

  FZ.Critter = Critter;
})(window.FZ);
