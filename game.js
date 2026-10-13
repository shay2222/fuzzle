/* Game flow: the story, runs, regrowing levels, rescues, the boss fight, camera, lighting, HUD. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    seeds: $('hud-seeds'), poofs: $('hud-poofs'), time: $('hud-time'), par: $('hud-par'), area: $('hud-area'),
    seedsPill: $('pill-seeds'), parPill: $('pill-par'), bossPill: $('hud-boss'), bossSegs: $('boss-segs'), family: $('hud-family'),
    toast: $('toast'), banner: $('banner'), bannerArea: $('banner-area'), bannerLevel: $('banner-level'),
    title: $('title'), play: $('play-btn'), daily: $('daily-btn'), dailyDate: $('daily-date'), bestRun: $('best-run'), storyBtn: $('story-btn'),
    pause: $('pause'), done: $('done'), doneStats: $('done-stats'), again: $('again-btn'), replay: $('replay-btn'),
    panel: $('panel'), tuneRows: $('tune-rows'), tuneReset: $('tune-reset'), panelBtn: $('panel-btn'), soundBtn: $('sound-btn'), musicBtn: $('music-btn'),
    genInfo: $('gen-info'), regrowBtn: $('regrow-btn'), routeToggle: $('route-toggle'), jump: $('jump-select'),
    pouch: $('hud-pouch'), charmPill: $('pill-charm'), charm: $('hud-charm'), talk: $('talk'),
    aiGen: $('ai-generator'), aiPlant: $('ai-plant'), aiRate: $('ai-rate'), aiRateOut: $('ai-rate-out'),
    aiGenerosity: $('ai-generosity'), aiGenerosityOut: $('ai-generosity-out'), aiStats: $('ai-stats'), aiLog: $('ai-log'), aiClear: $('ai-clear'),
    hero: $('hero'),
  };

  const game = {
    mode: 'title', runSeed: 1, daily: false, area: 0, level: 0, attempt: 0,
    world: null, player: null, followers: new FZ.Followers(), boss: null, bossHp: 3,
    rescued: [], crystals: 0, got: 0, poofs: 0, time: 0, runTime: 0,
    timer: 0, t: 0, cam: { x: 0, y: 0 }, motes: [], trans: null, fade: 0, showRoute: false,
    // economy and memory for the NPCs
    pouch: 0, items: { shield: 0, swift: false, magnet: false, glow: false }, purchases: 0, haggles: 0,
    deaths: [], quest: null, questsDone: 0, shopStock: [], offers: [], nearNpc: null,
  };

  let vw = 0;
  let vh = 0;
  let dpr = 1;
  let zoom = 1;
  let vignette = null;
  let vignetteColor = '';

  /* ---------------- sizing ---------------- */
  function renderRes() { return Math.min(3, Math.max(1, Math.round(dpr * zoom * 2) / 2)); }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    zoom = computeZoom();
    vignetteColor = '';
    if (game.world) game.world.prepare(renderRes());
  }

  /** Levels show about 15 x 9.5 tiles; Oink's Tower zooms out so the whole fight fits on screen. */
  function computeZoom() {
    if (game.world && game.world.isBoss) {
      const fitW = vw / (20.2 * FZ.TS);
      const fitH = (vh - 56) / (15.4 * FZ.TS);
      return FZ.clamp(Math.min(fitW, fitH), 0.45, 1.7);
    }
    return FZ.clamp(Math.min(vw / (15 * FZ.TS), vh / (9.5 * FZ.TS)), 0.62, 1.7);
  }

  function makeVignette(color) {
    vignette = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, color);
    vignetteColor = color;
  }

  /* ---------------- runs and levels ---------------- */
  const isBoss = () => game.area === FZ.BOSS_AREA;

  function todaySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function newRun(seed, daily) {
    game.runSeed = seed >>> 0;
    game.daily = !!daily;
    game.area = 0;
    game.level = 0;
    game.attempt = 0;
    game.poofs = 0;
    game.runTime = 0;
    game.rescued = [];
    game.crystals = 0;
    game.bossHp = 3;
    game.pouch = 0;
    game.items = { shield: 0, swift: false, magnet: false, glow: false };
    game.purchases = 0;
    game.deaths = [];
    game.quest = null;
    game.questsDone = 0;
    loadLevel();
  }

  /** Shop items change how Fuzzle plays; this keeps the hero in sync with what's been bought. */
  function applyItems() {
    const p = game.player;
    p.mods = { dashCd: game.items.swift ? 0.55 : 1, pickup: game.items.magnet ? 1.9 : 1, light: game.items.glow ? 1.45 : 1 };
    p.shield = game.items.shield;
    updateHud();
  }

  /** Builds the current level from (run seed, area, level, attempt). */
  function loadLevel() {
    const L = FZ.generateLevel(game.runSeed, game.area, game.level, game.attempt);
    game.world = new FZ.World(L);
    zoom = computeZoom();
    vignetteColor = '';
    game.world.prepare(renderRes());
    if (!game.player) game.player = new FZ.Fuzzle(0, 0);
    const w = game.world;
    game.player.reset(w.start.x, w.start.y);
    const walkers = game.rescued.filter((id) => FZ.member(id).area !== undefined);
    game.followers.reset(walkers, w.start.x, w.start.y);
    game.boss = null;
    if (L.boss) {
      game.boss = new FZ.Oink(w, game.bossHp);
      game.boss.restoreFreed(game.rescued);
    }
    // NPCs wait in the starting room; the shop restocks and Dot's lost item is re-hidden on each regrow
    const ids = FZ.npcsForLevel(game.area, game.level);
    w.npcs = FZ.placeNpcs(L, w, ids);
    game.nearNpc = null;
    game.haggles = 0;
    game.offers = [];
    if (ids.includes('frog')) {
      const r = FZ.rng(L.meta.seed ^ 0xf20);
      const pool = Object.keys(FZ.ITEMS).filter((id) => !(FZ.ITEMS[id].once && game.items[id]));
      for (let i = pool.length - 1; i > 0; i--) { const j = r.int(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      game.shopStock = pool.slice(0, 3);
    } else game.shopStock = [];
    w.questItem = null;
    const q = game.quest;
    if (q && !q.done && q.area === game.area && q.level === game.level) w.questItem = FZ.placeQuestItem(w, L, q.item);
    applyItems();

    game.cam.x = game.player.x;
    game.cam.y = game.player.y;
    game.got = 0;
    game.time = 0;
    FZ.fx.clear();
    initMotes();
    updateHud();
    updatePanel();
    drawFamilyHud();
  }

  function levelLabel() { return isBoss() ? 'Final' : `${game.area + 1}-${game.level + 1}`; }

  function showBanner() {
    ui.bannerArea.textContent = FZ.AREAS[game.area].name;
    ui.bannerLevel.textContent = isBoss() ? 'Final level' : `Level ${levelLabel()}`;
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
  }

  function playStory(panels, then) {
    game.mode = 'story';
    FZ.story.play(panels, () => {
      FZ.input.takeDash();
      then();
    });
  }

  /** Starts (or resumes into) play on the loaded level. */
  function begin() {
    game.mode = 'play';
    ui.title.hidden = true;
    ui.done.hidden = true;
    FZ.input.takeDash();
    FZ.fx.fluff(game.player.x, game.player.y - 14, 14, { speed: 110, yellow: 0.4 });
    showBanner();
    FZ.sfx.play('level');
    if (isBoss()) setTimeout(() => { if (isBoss() && game.mode === 'play') toast('Find the glowing Heart Crystal!'); }, 2200);
    canvas.focus();
  }

  function startRun(seed, daily) {
    FZ.sfx.init();
    newRun(seed === undefined ? Math.floor(Math.random() * 1e9) : seed, daily);
    ui.title.hidden = true;
    ui.done.hidden = true;
    if (!FZ.store.get('seenIntro', false)) {
      FZ.store.set('seenIntro', true);
      playStory(FZ.STORIES.intro(), begin);
    } else begin();
  }

  /** Fade out, run `then`, fade back in. */
  function transition(then) {
    game.trans = { phase: 'out', t: 0, then };
  }

  function regrow(countAsPoof) {
    transition(() => {
      game.attempt++;
      loadLevel();
      game.mode = 'play';
      toast(FZ.AREAS[game.area].regrow);
      FZ.sfx.play('regrow');
      if (!countAsPoof) updateHud();
    });
  }

  function afterClear() {
    // seeds from a cleared level go into the pouch; a quest for this level ends here
    game.pouch += game.world.seeds.length;
    if (game.quest && game.quest.area === game.area && game.quest.level === game.level) {
      if (!game.quest.done) toast(`Dot's ${game.quest.item} stays lost this time.`);
      game.quest = null;
    }
    updateHud();
    const lastOfArea = game.level === FZ.LEVELS_PER_AREA - 1;
    if (!lastOfArea) {
      transition(() => {
        game.level++;
        game.attempt = 0;
        loadLevel();
        begin();
      });
      return;
    }
    const area = game.area;
    const member = FZ.memberForArea(area);
    if (member && !game.rescued.includes(member.id)) game.rescued.push(member.id);
    game.crystals = Math.max(game.crystals, area + 1);
    drawFamilyHud();
    transition(() => {
      game.area++;
      game.level = 0;
      game.attempt = 0;
      loadLevel();
      let panels = FZ.STORIES.areaClear(area, member, game.rescued);
      if (isBoss()) panels = panels.concat(FZ.STORIES.bossIntro(game.rescued));
      playStory(panels, begin);
    });
  }

  function finishRun() {
    game.mode = 'done';
    const best = FZ.store.get('bestRun', null);
    const fresh = best === null || game.runTime < best;
    if (fresh) FZ.store.set('bestRun', game.runTime);
    ui.doneStats.innerHTML = '';
    const rows = [
      ['Family rescued', `${game.rescued.length} / ${FZ.FAMILY.length}`],
      ['Time', `${fmt(game.runTime)}s`],
      ['Poofs', String(game.poofs)],
      ['Best run', fresh ? `${fmt(game.runTime)}s (new!)` : `${fmt(best)}s`],
      ['Seed', game.daily ? `Daily ${game.runSeed}` : String(game.runSeed)],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      ui.doneStats.append(dt, dd);
    }
    ui.done.hidden = false;
    refreshBestRun();
    FZ.sfx.play('win');
  }

  function refreshBestRun() {
    const best = FZ.store.get('bestRun', null);
    ui.bestRun.textContent = best === null ? 'No rescue yet. Can you bring the whole family home?' : `Your best full rescue: ${fmt(best)}s`;
  }

  /** Developer shortcut: jump to any level with the right family and crystals already found. */
  function jumpTo(code) {
    if (!code) return;
    FZ.sfx.init();
    if (code === 'boss') {
      game.area = FZ.BOSS_AREA;
      game.level = 0;
    } else {
      const [a, l] = code.split('-').map(Number);
      game.area = a - 1;
      game.level = l - 1;
    }
    game.attempt = 0;
    game.bossHp = 3;
    game.crystals = Math.min(game.area, 3);
    game.rescued = FZ.FAMILY.filter((m) => m.area !== undefined && m.area < game.area).map((m) => m.id);
    ui.title.hidden = true;
    ui.done.hidden = true;
    game.trans = null;
    game.fade = 0;
    loadLevel();
    begin();
  }

  /* ---------------- ambient particles ---------------- */
  function initMotes() {
    const rnd = FZ.rng(game.world.meta.seed ^ 99);
    const w = game.world;
    game.motes = [];
    const n = w.area.id === 'caves' ? 28 : 40;
    for (let i = 0; i < n; i++) {
      game.motes.push({ x: rnd() * w.pxW, y: rnd() * w.pxH, ph: rnd() * 6.28, sp: 6 + rnd() * 12, r: 1 + rnd() * 1.6, curse: rnd() < 0.22 });
    }
  }

  function updateMotes(dt) {
    const w = game.world;
    for (const m of game.motes) {
      m.x += Math.sin(game.t * 0.5 + m.ph) * 9 * dt;
      m.y -= m.sp * dt * 0.5;
      if (m.y < -20) { m.y = w.pxH + 10; m.x = Math.random() * w.pxW; }
    }
  }

  const MOTE_COLORS = { woods: '#fff6c8', caves: '#9ff7ff', clouds: '#ffffff', lair: '#c99bff' };
  function drawMotes() {
    const base = MOTE_COLORS[game.world.area.id] || '#ffffff';
    for (const m of game.motes) {
      ctx.fillStyle = m.curse ? '#b06bff' : base; // purple wisps of Oink's curse
      ctx.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(game.t * 2 + m.ph));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.curse ? m.r * 1.6 : m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- update ---------------- */
  /** Something hit Fuzzle. A bubble charm pops instead if there is one; otherwise Fuzzle poofs. */
  function hurt(cause) {
    const p = game.player;
    const name = (FZ.HAZARD_NAMES[game.world.area.id] || {})[cause] || cause;
    if (game.items.shield > 0) {
      game.items.shield--;
      p.invuln = 1.6;
      FZ.fx.ring(p.x, p.y - 14, '#a0e6ff', 34);
      FZ.fx.sparkle(p.x, p.y - 14, 16, '#c9f2ff');
      FZ.fx.shake(5);
      FZ.sfx.play('bump');
      applyItems();
      toast(`Your bubble charm popped! The ${name} missed you.`);
      return;
    }
    game.deaths.push({ area: game.area, level: game.level, cause: name });
    poof();
  }

  function poof() {
    game.player.kill();
    game.mode = 'dead';
    game.timer = 0;
    game.poofs++;
    updateHud();
  }

  function handleBossEvents(events) {
    for (const e of events) {
      if (e.type === 'power') toast(`${e.heart.name}! Now dash into Oink!`);
      else if (e.type === 'fade') toast('The crystal faded. Grab the next one!');
      else if (e.type === 'hit') {
        game.bossHp = e.hp;
        if (!game.rescued.includes(e.member.id)) game.rescued.push(e.member.id);
        toast(e.hp > 0 ? `${e.member.short} is free!` : 'The spell is breaking!');
        game.followers.cheer();
        updateHud();
        drawFamilyHud();
      } else if (e.type === 'won') {
        setTimeout(() => playStory(FZ.STORIES.ending(), finishRun), 200);
        game.mode = 'won';
      }
    }
  }

  function update(dt) {
    if (game.trans) {
      const tr = game.trans;
      tr.t += dt;
      if (tr.phase === 'out') {
        game.fade = Math.min(1, tr.t / 0.28);
        if (tr.t >= 0.28) { tr.phase = 'in'; tr.t = 0; tr.then(); }
      } else {
        game.fade = Math.max(0, 1 - tr.t / 0.34);
        if (tr.t >= 0.34) { game.trans = null; game.fade = 0; }
      }
    }
    if (game.mode === 'paused' || game.mode === 'story') return;
    game.t += dt;
    FZ.fx.update(dt);
    updateMotes(dt);

    const w = game.world;
    const p = game.player;
    FZ.tickNpcs(w.npcs, dt);
    if (game.mode === 'talk') { // the world holds still while Fuzzle chats; he just breathes and blinks
      p.update(dt, w, false);
      game.followers.update(dt, p);
      // frame Fuzzle and the speaker in the space above the conversation box
      const n = game.talkNpc || p;
      const box = (ui.talk.offsetHeight || 0) + 14;
      const halfW = vw / 2 / zoom;
      const halfH = vh / 2 / zoom;
      const screenY = (56 + (vh - box)) / 2;
      let tx = (p.x + n.x) / 2;
      let ty = (p.y + n.y) / 2 - 16 - (screenY - vh / 2) / zoom;
      tx = w.pxW <= halfW * 2 ? w.pxW / 2 : FZ.clamp(tx, halfW, w.pxW - halfW);
      ty = FZ.clamp(ty, Math.min(halfH, w.pxH / 2), Math.max(halfH, w.pxH - halfH) + box / zoom);
      game.cam.x = FZ.damp(game.cam.x, tx, 6, dt);
      game.cam.y = FZ.damp(game.cam.y, ty, 6, dt);
      return;
    }
    w.update(dt);

    if (game.mode === 'title' || game.mode === 'done') {
      p.update(dt, w, false);
      game.followers.update(dt, p);
    } else if ((game.mode === 'play' || game.mode === 'won') && !game.trans) {
      game.time += dt;
      if (game.mode === 'play') game.runTime += dt;
      p.update(dt, w, true);
      game.followers.update(dt, p);

      if (game.boss) handleBossEvents(game.boss.update(dt, p));
      if (game.mode === 'play' && p.alive && p.invuln <= 0) {
        const hit = w.hazardHit(p, game.t) || (game.boss && game.boss.hurts(p));
        if (hit) hurt(hit);
      }

      // who is close enough to talk to
      game.nearNpc = null;
      if (game.mode === 'play' && p.alive) {
        let best = 60;
        for (const n of w.npcs) {
          const d = Math.hypot(n.x - p.x, n.y - 6 - p.y);
          if (d < best) { best = d; game.nearNpc = n; }
        }
      }

      const qi = w.questItem;
      if (qi && !qi.got && p.alive && Math.hypot(qi.x - p.x, qi.y - 4 - p.y) < 28 * p.mods.pickup) {
        qi.got = true;
        game.quest.done = true;
        game.questsDone++;
        game.pouch += game.quest.reward;
        FZ.fx.sparkle(qi.x, qi.y - 8, 16, '#ff9f4a');
        FZ.sfx.play('free');
        p.cheer(0.9);
        toast(`Found Dot's ${qi.name}! +${game.quest.reward} seeds`);
        updateHud();
      }

      for (const s of w.seeds) {
        if (!s.got && p.alive && Math.hypot(s.x - p.x, s.y - 4 - p.y) < 27 * p.mods.pickup) {
          s.got = true;
          game.got++;
          FZ.fx.sparkle(s.x, s.y - 8, 12);
          FZ.fx.ring(s.x, s.y + 4, '#ffe066', 16);
          p.cheer(0.6);
          game.followers.cheer();
          FZ.sfx.play('seed');
          updateHud();
          if (game.got === w.seeds.length) wakePortal();
        }
      }

      if (w.portal.active && p.alive && !game.boss) {
        if (Math.random() < dt * 24) FZ.fx.rise(w.portal.x, w.portal.y - 2);
        if (Math.hypot(w.portal.x - p.x, w.portal.y - p.y) < 24) {
          game.mode = 'clear';
          game.timer = 0;
          p.cheer(2.2);
          game.followers.cheer();
          FZ.fx.sparkle(p.x, p.y - 16, 26, '#a4f1ff');
          FZ.fx.sparkle(p.x, p.y - 16, 14, '#ffe066');
          FZ.sfx.play('clear');
          const par = w.meta.par;
          toast(game.time <= par ? `Under par! ${fmt(game.time)}s` : `Cleared in ${fmt(game.time)}s`);
        }
      }
    } else if (game.mode === 'dead') {
      game.timer += dt;
      p.update(dt, w, false);
      game.followers.update(dt, p);
      if (game.boss) game.boss.update(dt, p);
      if (game.timer > 0.95 && !game.trans) regrow(true);
    } else if (game.mode === 'clear') {
      game.timer += dt;
      p.update(dt, w, false);
      game.followers.update(dt, p);
      p.x = FZ.damp(p.x, w.portal.x, 6, dt);
      p.y = FZ.damp(p.y, w.portal.y, 6, dt);
      if (game.timer > 1.5 && !game.trans) afterClear();
    }

    // camera leads a little in the direction of travel
    const halfW = vw / 2 / zoom;
    const halfH = vh / 2 / zoom;
    let tx = p.x + p.vx * 0.16;
    let ty = p.y + p.vy * 0.12 - 10;
    tx = w.pxW <= halfW * 2 ? w.pxW / 2 : FZ.clamp(tx, halfW, w.pxW - halfW);
    ty = w.pxH <= halfH * 2 ? w.pxH / 2 : FZ.clamp(ty, halfH, w.pxH - halfH);
    if (w.isBoss) {
      // frame the whole fight, from the cages at the top to the bottom wall, below the HUD
      const top = 2.5 * FZ.TS;
      const bottom = w.pxH - 2.9 * FZ.TS;
      const usable = (vh - 56) / zoom;
      if (bottom - top <= usable) ty = (top + bottom) / 2 - 28 / zoom;
    }
    game.cam.x = FZ.damp(game.cam.x, tx, 7, dt);
    game.cam.y = FZ.damp(game.cam.y, ty, 7, dt);
  }

  /** All seeds found: the portal wakes, and on a land's last level the caged sibling is freed. */
  function wakePortal() {
    const w = game.world;
    w.portal.active = true;
    FZ.fx.ring(w.portal.x, w.portal.y, '#a4f1ff', 40);
    FZ.sfx.play('portal');
    const cage = w.cages.find((c) => !c.open);
    if (cage) {
      const m = FZ.member(cage.member);
      w.openCage(cage.member);
      game.followers.add(m, cage.x, cage.y + 20);
      toast(`${m.short} is free! Head for the portal!`);
    } else {
      toast('The portal is awake!');
    }
  }

  /* ---------------- render ---------------- */
  let lastTimeText = '';
  let dark = null;
  let dctx = null;

  /** Which arrangement of the theme fits the moment, and how loud. */
  function musicCue() {
    const m = game.mode;
    let track = 'title';
    if (m !== 'title' && m !== 'done' && m !== 'story') track = isBoss() ? 'boss' : (['woods', 'caves', 'clouds'][game.area] || 'woods');
    const duck = m === 'paused' ? 0.3 : m === 'talk' ? 0.55 : m === 'story' ? 0.8 : 1;
    FZ.music.update(track, duck);
  }

  function render(dt) {
    handleKeys();
    musicCue();
    const w = game.world;
    const p = game.player;
    const t = game.t;
    const area = w.area;
    if (vignetteColor !== area.vignette) makeVignette(area.vignette);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = area.bg;
    ctx.fillRect(0, 0, vw, vh);

    const still = game.mode === 'paused' || game.mode === 'story';
    const sh = still ? 0 : FZ.fx.takeShake(dt);
    const ox = (Math.random() - 0.5) * sh;
    const oy = (Math.random() - 0.5) * sh;
    const halfW = vw / 2 / zoom;
    const halfH = vh / 2 / zoom;
    const view = { x0: game.cam.x - halfW, x1: game.cam.x + halfW, y0: game.cam.y - halfH, y1: game.cam.y + halfH };

    ctx.save();
    ctx.translate(Math.round(vw / 2), Math.round(vh / 2));
    ctx.scale(zoom, zoom);
    ctx.translate(-game.cam.x + ox, -game.cam.y + oy);

    w.drawGround(ctx);
    w.drawAnimatedTiles(ctx, t, view);
    if (game.boss) game.boss.drawGround(ctx, t);
    if (game.showRoute) w.drawRoute(ctx, t);
    const reveal = [p].concat(w.seeds.filter((s) => !s.got), [w.portal], w.cages);
    const list = [];
    w.collectDrawables(list, t, reveal, view);
    FZ.collectNpcs(list, w.npcs, game.mode === 'play' ? game.nearNpc : null, t);
    if (w.questItem && !w.questItem.got) list.push({ y: w.questItem.y, draw: (c) => FZ.drawQuestItem(c, w.questItem, t) });
    game.followers.collect(list);
    if (game.boss) game.boss.collect(list, t);
    list.push({ y: p.y + 12, draw: (c) => p.draw(c) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw(ctx);
    if (game.boss) game.boss.drawOver(ctx, t);
    FZ.fx.draw(ctx);
    drawMotes();
    ctx.restore();

    if (area.darkness > 0) {
      let extra = game.followers.lights().concat(w.npcs.map((n) => ({ x: n.x, y: n.y - 24, r: 80, s: 0.8 })));
      if (w.questItem && !w.questItem.got) extra.push({ x: w.questItem.x, y: w.questItem.y - 6, r: 60, s: 0.85 });
      if (game.boss) extra = extra.concat(game.boss.lights());
      drawDarkness(w, p, t, ox, oy, extra);
    }

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, vw, vh);
    drawPointers();

    if (game.fade > 0) {
      ctx.globalAlpha = game.fade;
      ctx.fillStyle = area.bg;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }

    const tt = fmt(game.time);
    if (tt !== lastTimeText) { ui.time.textContent = tt; lastTimeText = tt; }
    if (!ui.title.hidden) drawHero();
  }

  /** Dark areas: fill the screen with shadow, then cut soft holes for every light source. */
  function drawDarkness(w, p, t, ox, oy, extra) {
    if (!dark || dark.width !== canvas.width || dark.height !== canvas.height) {
      dark = document.createElement('canvas');
      dark.width = canvas.width;
      dark.height = canvas.height;
      dctx = dark.getContext('2d');
    }
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillStyle = `rgba(8, 6, 22, ${w.area.darkness})`;
    dctx.fillRect(0, 0, dark.width, dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    const s = dpr * zoom;
    dctx.setTransform(s, 0, 0, s, dpr * (Math.round(vw / 2) - (game.cam.x - ox) * zoom), dpr * (Math.round(vh / 2) - (game.cam.y - oy) * zoom));
    const halfW = vw / 2 / zoom;
    const halfH = vh / 2 / zoom;
    for (const L of w.lights(p, t).concat(extra)) {
      if (Math.abs(L.x - game.cam.x) > halfW + L.r || Math.abs(L.y - game.cam.y) > halfH + L.r) continue;
      const flicker = L.r > 150 ? 1 + Math.sin(t * 7) * 0.015 : 1;
      const r = L.r * flicker;
      const g = dctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, `rgba(0,0,0,${L.s})`);
      g.addColorStop(0.5, `rgba(0,0,0,${L.s * 0.7})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath();
      dctx.arc(L.x, L.y, r, 0, Math.PI * 2);
      dctx.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dark, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Edge-of-screen arrows toward seeds you haven't found, the awake portal, or a Heart Crystal. */
  function drawPointers() {
    if (game.mode !== 'play') return;
    const w = game.world;
    const targets = w.seeds.filter((s) => !s.got).map((s) => ({ x: s.x, y: s.y - 6, kind: 'seed' }));
    if (w.portal.active && !game.boss) targets.push({ x: w.portal.x, y: w.portal.y, kind: 'portal' });
    if (game.boss && game.boss.crystal) targets.push({ x: game.boss.crystal.x, y: game.boss.crystal.y - 10, kind: 'heart' });
    if (w.questItem && !w.questItem.got) targets.push({ x: w.questItem.x, y: w.questItem.y - 6, kind: 'quest' });
    const top = 64;
    const margin = 30;
    for (const tg of targets) {
      const sx = (tg.x - game.cam.x) * zoom + vw / 2;
      const sy = (tg.y - game.cam.y) * zoom + vh / 2;
      if (sx > 10 && sx < vw - 10 && sy > top && sy < vh - 10) continue;
      const cx = vw / 2;
      const cy = (vh + top) / 2;
      const dx = sx - cx;
      const dy = sy - cy;
      const k = Math.min((vw / 2 - margin) / Math.max(Math.abs(dx), 1e-6), ((vh - top) / 2 - margin) / Math.max(Math.abs(dy), 1e-6));
      const px = cx + dx * k;
      const py = cy + dy * k;
      const a = Math.atan2(dy, dx);
      const pulse = 1 + Math.sin(game.t * 5) * 0.06;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pulse, pulse);
      ctx.save();
      ctx.rotate(a);
      ctx.fillStyle = '#1d3f8a';
      ctx.beginPath();
      ctx.moveTo(23, 0);
      ctx.lineTo(11, -8);
      ctx.lineTo(11, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff8e6';
      ctx.strokeStyle = '#1d3f8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (tg.kind === 'portal') {
        ctx.strokeStyle = '#2a8fd8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tg.kind === 'heart') {
        FZ.drawHeartCrystal(ctx, 0, 1, game.boss.heart, 0, 7, false);
      } else if (tg.kind === 'quest') {
        ctx.fillStyle = '#ff9f4a';
        ctx.strokeStyle = '#b85a10';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffd23f';
        ctx.strokeStyle = '#b97a05';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.quadraticCurveTo(6, -1, 0, 6);
        ctx.quadraticCurveTo(-6, -1, 0, -7);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* the big Fuzzle on the title card */
  const hero = { blink: 0, blinkT: 1, happy: 0 };
  function drawHero() {
    const c = ui.hero;
    const hctx = c.getContext('2d');
    const size = 180;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== size * r) { c.width = size * r; c.height = size * r; }
    hctx.setTransform(r, 0, 0, r, 0, 0);
    hctx.clearRect(0, 0, size, size);
    const t = game.t;
    hero.blinkT -= 1 / 60;
    if (hero.blinkT <= 0) { hero.blink = 0.13; hero.blinkT = 2 + Math.random() * 2.5; }
    hero.blink = Math.max(0, hero.blink - 1 / 60);
    const hop = Math.abs(Math.sin(t * 2.2)) * 3;
    hctx.fillStyle = 'rgba(29, 63, 138, 0.18)';
    hctx.beginPath();
    hctx.ellipse(size / 2, size - 22, 46 - hop, 10, 0, 0, Math.PI * 2);
    hctx.fill();
    hctx.translate(size / 2, size - 24);
    hctx.scale(3, 3);
    const br = Math.sin(t * 2.3) * 0.03;
    FZ.drawFuzzle(hctx, {
      t, sx: 1 + br, sy: 1 - br, hop: hop / 3, fx: Math.sin(t * 0.7) * 0.3, fy: 0.6,
      moving: false, step: 0, blink: hero.blink, mood: hero.happy > 0 ? 'happy' : 'brave', dashing: false,
    });
  }

  /* ---------------- HUD, toast, panels ---------------- */
  function fmt(s) { return s.toFixed(1); }

  function updateHud() {
    const w = game.world;
    const boss = isBoss();
    ui.seedsPill.hidden = boss;
    ui.parPill.hidden = boss;
    ui.bossPill.hidden = !boss;
    ui.seeds.textContent = `${game.got} / ${w.seeds.length}`;
    ui.pouch.textContent = String(game.pouch);
    ui.charmPill.hidden = game.items.shield <= 0;
    ui.charm.textContent = `× ${game.items.shield}`;
    ui.poofs.textContent = String(game.poofs);
    ui.par.textContent = `${w.meta.par}s`;
    ui.area.textContent = `${w.area.name} · ${levelLabel()}`;
    if (boss) {
      const segs = ui.bossSegs.children;
      for (let i = 0; i < segs.length; i++) {
        const broken = i < 3 - game.bossHp;
        segs[i].className = broken ? 'broken' : '';
        segs[i].style.background = broken ? FZ.HEARTS[i].color : '';
      }
    }
  }

  /** Heart Crystals found and family freed, as a tiny row of portraits in the HUD. */
  function drawFamilyHud() {
    const c = ui.family;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const W = 186;
    const H = 28;
    if (c.width !== W * r) { c.width = W * r; c.height = H * r; }
    const g = c.getContext('2d');
    g.setTransform(r, 0, 0, r, 0, 0);
    g.clearRect(0, 0, W, H);
    FZ.HEARTS.forEach((h, i) => {
      const got = i < game.crystals;
      g.globalAlpha = got ? 1 : 0.4;
      FZ.drawHeartCrystal(g, 10 + i * 16, 14, got ? h : FZ.GREY_HEART, 0, 7, false);
    });
    g.globalAlpha = 1;
    g.fillStyle = '#c9d3ea';
    g.fillRect(55, 5, 2, 18);
    FZ.FAMILY.forEach((m, i) => {
      const freed = game.rescued.includes(m.id);
      const pal = freed ? m.pal : Object.assign({}, FZ.PALETTES.locked, { size: m.pal.size, topper: m.pal.topper });
      g.save();
      g.translate(72 + i * 21, 26);
      g.scale(0.42, 0.42);
      g.globalAlpha = freed ? 1 : 0.55;
      FZ.drawFuzzle(g, { t: 0, sx: 1, sy: 1, hop: 0, fx: 0, fy: 0.6, moving: false, step: 0, blink: freed ? 0 : 1, mood: freed ? 'happy' : 'idle', dashing: false, pal });
      g.restore();
    });
    c.setAttribute('aria-label', `${game.crystals} of 3 Heart Crystals, ${game.rescued.length} of ${FZ.FAMILY.length} family freed`);
  }

  function updatePanel() {
    const m = game.world.meta;
    const rows = [
      ['Run seed', game.daily ? `${game.runSeed} (daily)` : String(game.runSeed)],
      ['Level seed', String(m.seed)],
      ['Attempt', `${m.attempt + 1}${m.attempt ? ' (regrown ' + m.attempt + 'x)' : ''}`],
      ['Layouts rejected', m.rejected ? `${m.rejected}: ${m.rejectedWhy[0]}` : '0'],
      ['Chambers', m.templates.join(', ')],
    ];
    if (!m.boss) rows.push(['Guaranteed route', `${m.routeLength} tiles`], ['Par', `${m.par}s`]);
    else rows.push(['Oink', `${game.bossHp} hits left`]);
    if (m.carved) rows.push(['Fallback', 'path carved']);
    ui.genInfo.innerHTML = '';
    for (const [k, v] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      ui.genInfo.append(dt, dd);
    }
  }

  let toastTimer = 0;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.remove('show');
    void ui.toast.offsetWidth;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1900);
  }

  function togglePause() {
    if (!['play', 'dead', 'clear', 'won', 'paused'].includes(game.mode)) return;
    if (game.mode === 'paused') {
      game.mode = game.pausedFrom;
      ui.pause.hidden = true;
    } else {
      game.pausedFrom = game.mode;
      game.mode = 'paused';
      ui.pause.hidden = false;
    }
  }

  function toggleSound() {
    FZ.sfx.init();
    const muted = FZ.sfx.toggleMute();
    ui.soundBtn.textContent = muted ? 'Sound off' : 'Sound on';
    ui.soundBtn.setAttribute('aria-pressed', String(!muted));
  }

  function showMusic() {
    ui.musicBtn.textContent = FZ.music.on ? 'Music on' : 'Music off';
    ui.musicBtn.setAttribute('aria-pressed', String(FZ.music.on));
  }

  function toggleMusic() {
    FZ.sfx.init();
    FZ.music.toggle();
    showMusic();
  }

  function togglePanel() {
    ui.panel.hidden = !ui.panel.hidden;
    ui.panelBtn.setAttribute('aria-expanded', String(!ui.panel.hidden));
  }

  const TUNE = [
    ['maxSpeed', 'Top speed', 120, 420, 5, (v) => `${Math.round(v)} px/s`],
    ['accel', 'Acceleration', 400, 5000, 50, (v) => `${Math.round(v)}`],
    ['friction', 'Stopping power', 400, 6000, 50, (v) => `${Math.round(v)}`],
    ['dashSpeed', 'Dash speed', 300, 1100, 10, (v) => `${Math.round(v)} px/s`],
    ['dashCooldown', 'Dash cooldown', 0.1, 1.2, 0.02, (v) => `${v.toFixed(2)} s`],
  ];

  function buildTuning() {
    for (const [key, label, min, max, step, show] of TUNE) {
      const row = document.createElement('label');
      row.className = 'tune-row';
      row.htmlFor = `tune-${key}`;
      const name = document.createElement('span');
      name.textContent = label;
      const out = document.createElement('output');
      out.id = `tune-${key}-out`;
      out.textContent = show(FZ.tuning[key]);
      const input = document.createElement('input');
      input.type = 'range';
      input.id = `tune-${key}`;
      input.min = min;
      input.max = max;
      input.step = step;
      input.value = FZ.tuning[key];
      input.addEventListener('input', () => {
        FZ.tuning[key] = parseFloat(input.value);
        out.textContent = show(FZ.tuning[key]);
      });
      row.append(name, out, input);
      ui.tuneRows.append(row);
    }
    ui.tuneReset.addEventListener('click', () => {
      Object.assign(FZ.tuning, FZ.tuningDefaults);
      for (const [key, , , , , show] of TUNE) {
        $(`tune-${key}`).value = FZ.tuning[key];
        $(`tune-${key}-out`).textContent = show(FZ.tuning[key]);
      }
      canvas.focus();
    });
  }

  function handleKeys() {
    const I = FZ.input;
    if (game.mode === 'story' || game.mode === 'talk') return;
    if (game.mode === 'play' && game.nearNpc && (I.pressed('KeyE') || I.pressed('Enter'))) {
      openTalk(game.nearNpc);
      return;
    }
    if (game.mode === 'title' && I.pressed('Enter')) startRun();
    if (game.mode === 'done' && I.pressed('Enter')) startRun();
    if (I.pressed('KeyT')) togglePanel();
    if (I.pressed('KeyM')) toggleSound();
    if (I.pressed('KeyP') || I.pressed('Escape')) togglePause();
  }

  /* ---------------- talking to NPCs ---------------- */
  function openTalk(npc) {
    game.mode = 'talk';
    game.talkNpc = npc;
    const p = game.player;
    const dx = npc.x - p.x;
    const dy = npc.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx = 0;
    p.vy = 0;
    p.fx = dx / d; // look at whoever you're talking to
    p.fy = dy / d;
    FZ.sfx.play('page');
    FZ.talk.open(npc);
  }

  FZ.talkHooks = {
    facts: (extra) => FZ.buildFacts(game, extra),
    setOffers: (offers) => { game.offers = offers; },
    buy(itemId, price) {
      const it = FZ.ITEMS[itemId];
      const offer = game.offers.find((o) => o.item === itemId);
      // the game charges the verified price on the board, never a number from the line
      if (!it || !offer || offer.price !== price || game.pouch < price || (it.once && game.items[itemId])) return false;
      game.pouch -= price;
      game.purchases++;
      if (itemId === 'shield') game.items.shield++;
      else game.items[itemId] = true;
      if (it.once) game.offers = game.offers.filter((o) => o.item !== itemId);
      applyItems();
      FZ.sfx.play('seed');
      FZ.fx.sparkle(game.player.x, game.player.y - 16, 14, '#ffe066');
      return true;
    },
    acceptQuest(q) {
      game.quest = { item: q.item, reward: q.reward, area: game.area, level: game.level, done: false };
      game.world.questItem = FZ.placeQuestItem(game.world, game.world.L, q.item);
    },
    close() {
      FZ.input.endFrame(); // the key that closed the chat shouldn't also pause or dash
      FZ.input.takeDash();
      game.mode = 'play';
      updateHud();
      canvas.focus();
    },
    openPanel() {
      if (ui.panel.hidden) togglePanel();
      const ai = $('ai-section');
      if (ai) ai.scrollIntoView({ block: 'start' });
    },
  };

  /* ---------------- developer panel: AI dialogue ---------------- */
  const SOURCE_SHORT = { model: 'passed', adjusted: 'adjusted', repaired: 'repaired', fallback: 'fallback' };

  function renderAiStats() {
    const s = FZ.brain.stats;
    ui.aiStats.textContent = s.turns
      ? `${s.turns} lines · ${s.firstTry} passed · ${s.adjusted} adjusted · ${s.repaired} repaired · ${s.fallback} fell back`
      : 'No lines yet. Talk to an NPC (press E next to one).';
  }

  function renderAiLog() {
    ui.aiLog.innerHTML = '';
    for (const e of FZ.brain.log.slice(0, 8)) {
      const item = document.createElement('details');
      item.className = 'ai-entry';
      const sum = document.createElement('summary');
      const who = document.createElement('b');
      who.textContent = `${FZ.NPCS[e.npc].name} · ${e.intent}`;
      const tag = document.createElement('span');
      tag.className = `tag ${e.source}`;
      tag.textContent = SOURCE_SHORT[e.source] || e.source;
      sum.append(who, tag);
      if (e.planted) {
        const pl = document.createElement('span');
        pl.className = 'tag planted';
        pl.textContent = `planted: ${e.planted}`;
        sum.append(pl);
      }
      item.append(sum);
      const body = document.createElement('div');
      body.className = 'ai-body';
      if (e.input) {
        const p = document.createElement('p');
        p.textContent = `Player: “${e.input}”${e.inputFlags && e.inputFlags.length ? ` (${e.inputFlags.join(', ')})` : ''}`;
        body.append(p);
      }
      e.attempts.forEach((a, i) => {
        const h = document.createElement('p');
        h.className = 'ai-step';
        h.textContent = i === 0 ? 'Draft' : 'Retry';
        const pre = document.createElement('pre');
        pre.textContent = a.raw || '(no reply)';
        body.append(h, pre);
        if (!a.violations.length) {
          const ok = document.createElement('p');
          ok.className = 'ai-ok';
          ok.textContent = 'All checks passed.';
          body.append(ok);
        }
        for (const x of a.violations) {
          const row = document.createElement('p');
          row.className = `ai-v ${x.severity}`;
          row.textContent = `${x.severity} · ${x.code}: ${x.detail}`;
          body.append(row);
        }
      });
      const fin = document.createElement('p');
      fin.className = 'ai-final';
      fin.textContent = `Shown: “${e.line}” (${e.ms} ms)`;
      body.append(fin);
      item.append(body);
      ui.aiLog.append(item);
    }
    renderAiStats();
  }

  function wireAiPanel() {
    const S = FZ.brain.settings;
    ui.aiGen.textContent = FZ.brain.generator.name;
    ui.aiPlant.checked = S.plant;
    ui.aiRate.value = Math.round(S.plantRate * 100);
    ui.aiRateOut.textContent = `${ui.aiRate.value}%`;
    ui.aiGenerosity.value = Math.round(S.generosity * 100);
    ui.aiGenerosityOut.textContent = `${ui.aiGenerosity.value}%`;
    ui.aiPlant.addEventListener('change', () => { S.plant = ui.aiPlant.checked; canvas.focus(); });
    ui.aiRate.addEventListener('input', () => { S.plantRate = ui.aiRate.value / 100; ui.aiRateOut.textContent = `${ui.aiRate.value}%`; });
    ui.aiGenerosity.addEventListener('input', () => { S.generosity = ui.aiGenerosity.value / 100; ui.aiGenerosityOut.textContent = `${ui.aiGenerosity.value}%`; });
    ui.aiClear.addEventListener('click', () => {
      FZ.brain.log.length = 0;
      Object.keys(FZ.brain.stats).forEach((k) => { FZ.brain.stats[k] = 0; });
      renderAiLog();
    });
    FZ.brain.onLog(renderAiLog);
    renderAiLog();
  }

  /* ---------------- boot ---------------- */
  ui.play.addEventListener('click', () => startRun());
  ui.daily.addEventListener('click', () => startRun(todaySeed(), true));
  ui.storyBtn.addEventListener('click', () => {
    FZ.sfx.init();
    FZ.store.set('seenIntro', true);
    playStory(FZ.STORIES.intro(), () => { game.mode = 'title'; });
  });
  ui.play.addEventListener('pointerenter', () => { hero.happy = 1; });
  ui.play.addEventListener('pointerleave', () => { hero.happy = 0; });
  ui.again.addEventListener('click', () => startRun());
  ui.replay.addEventListener('click', () => startRun(game.runSeed, game.daily));
  ui.panelBtn.addEventListener('click', () => { togglePanel(); canvas.focus(); });
  ui.soundBtn.addEventListener('click', () => { toggleSound(); canvas.focus(); });
  ui.musicBtn.addEventListener('click', () => { toggleMusic(); canvas.focus(); });
  // browsers only allow sound after the first click or key press, so wake audio then
  const wakeAudio = () => FZ.sfx.init();
  window.addEventListener('pointerdown', wakeAudio);
  window.addEventListener('keydown', wakeAudio);
  ui.regrowBtn.addEventListener('click', () => {
    if (game.mode === 'play' && !game.trans) regrow(false);
    canvas.focus();
  });
  ui.routeToggle.addEventListener('change', () => { game.showRoute = ui.routeToggle.checked; canvas.focus(); });
  ui.jump.addEventListener('change', () => {
    const v = ui.jump.value;
    ui.jump.value = '';
    jumpTo(v);
  });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'play') togglePause(); });

  const d = new Date();
  ui.dailyDate.textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  buildTuning();
  wireAiPanel();
  showMusic();
  resize();
  newRun(Math.floor(Math.random() * 1e9), false);
  refreshBestRun();
  FZ.startLoop(update, render);
  FZ.game = game; // handy for poking at state from the browser console
  FZ.debug = { jumpTo, wakePortal, openTalk };
})(window.FZ);
