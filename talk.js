/* The conversation box: portrait, typed-out line, choices, free-text input, and a "checked" chip. */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const el = {
    root: $('talk'), portrait: $('talk-portrait'), name: $('talk-name'), source: $('talk-source'), pouch: $('talk-pouch'),
    line: $('talk-line'), options: $('talk-options'), form: $('talk-form'), input: $('talk-input'), close: $('talk-close'),
  };
  const pctx = el.portrait.getContext('2d');
  let state = null;
  let raf = 0;

  const SOURCE_LABEL = {
    model: 'Generated · checked',
    adjusted: 'Generated · adjusted by the guard',
    repaired: 'Generated · fixed on retry',
    fallback: 'Written line · draft blocked',
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function portraitLoop(now) {
    if (!state) return;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const size = 104;
    if (el.portrait.width !== size * r) { el.portrait.width = size * r; el.portrait.height = size * r; }
    pctx.setTransform(r, 0, 0, r, 0, 0);
    pctx.clearRect(0, 0, size, size);
    const t = now / 1000;
    const id = state.npc.id;
    const blinkOn = (t % 3.3) < 0.13 ? 1 : 0;
    pctx.save();
    if (id === 'owl') { pctx.translate(52, 112); pctx.scale(1.55, 1.55); FZ.drawOwl(pctx, t, blinkOn); }
    else if (id === 'frog') { pctx.translate(52, 98); pctx.scale(2, 2); FZ.drawFrog(pctx, t, blinkOn, true); }
    else { pctx.translate(52, 100); pctx.scale(1.7, 1.7); FZ.drawBunny(pctx, t * 0.5, blinkOn); }
    pctx.restore();
    raf = requestAnimationFrame(portraitLoop);
  }

  function typeLine(text) {
    state.full = text;
    state.shown = 0;
    clearInterval(state.typer);
    el.line.textContent = '';
    state.typer = setInterval(() => {
      if (!state) return;
      state.shown = Math.min(text.length, state.shown + 2);
      el.line.textContent = text.slice(0, state.shown);
      if (state.shown >= text.length) clearInterval(state.typer);
    }, 28);
  }

  function finishTyping() {
    if (!state || !state.full) return;
    clearInterval(state.typer);
    el.line.textContent = state.full;
  }

  function setSource(res) {
    if (!res || !SOURCE_LABEL[res.source]) { el.source.hidden = true; return; }
    el.source.hidden = false;
    el.source.textContent = SOURCE_LABEL[res.source];
    el.source.dataset.kind = res.source;
    const notes = res.violations.map((x) => `${x.severity}: ${x.detail}`);
    el.source.title = notes.length ? notes.join('\n') : 'Every check passed on the first draft.';
  }

  function button(label, onClick, opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'talk-opt' + (opts && opts.kind ? ` ${opts.kind}` : '');
    if (opts && opts.sub) {
      const main = document.createElement('span');
      main.textContent = label;
      const sub = document.createElement('small');
      sub.textContent = opts.sub;
      b.append(main, sub);
    } else b.textContent = label;
    b.disabled = state.busy || !!(opts && opts.disabled);
    b.addEventListener('click', () => { if (!state || state.busy) return; onClick(); });
    el.options.append(b);
    return b;
  }

  function renderOptions() {
    if (!state) return;
    const H = FZ.talkHooks;
    const g = FZ.game;
    el.options.innerHTML = '';
    el.pouch.hidden = state.npc.id !== 'frog';
    el.pouch.textContent = `Your pouch: ${g.pouch} ${g.pouch === 1 ? 'seed' : 'seeds'}`;
    const id = state.npc.id;
    if (id === 'owl') {
      button('Any hints?', () => say('hint'));
      button('Tell me about Oink', () => say('lore'));
    } else if (id === 'frog') {
      for (const o of g.offers || []) {
        const it = FZ.ITEMS[o.item];
        const owned = it.once && g.items[o.item];
        const sub = owned ? 'Already yours' : g.pouch < o.price ? `Need ${o.price - g.pouch} more` : it.desc;
        button(`${cap(it.name)} · ${o.price} ${o.price === 1 ? 'seed' : 'seeds'}`, () => {
          if (H.buy(o.item, o.price)) say('thanks', '', { bought: o.item });
        }, { kind: 'shop', sub, disabled: owned || g.pouch < o.price });
      }
      button('Haggle', async () => { await say('haggle'); g.haggles++; renderOptions(); }, { disabled: g.haggles > 0 || !(g.offers || []).length });
    } else {
      if (state.pendingQuest && !g.quest) {
        button("I'll find it!", () => {
          H.acceptQuest(state.pendingQuest);
          state.pendingQuest = null;
          setSource(null);
          typeLine(`Yay! Thank you, Fuzzle! Look for my ${g.quest.item}, it sparkles orange!`);
          renderOptions();
        }, { kind: 'primary' });
      }
      button('What happened?', () => say('story'));
    }
    button('Bye', close, { kind: 'quiet' });
  }

  async function say(intent, input, extra) {
    if (!state) return;
    state.busy = true;
    renderOptions();
    clearInterval(state.typer);
    el.line.innerHTML = '<span class="dots" aria-label="Thinking"><i></i><i></i><i></i></span>';
    el.source.hidden = true;
    const facts = FZ.talkHooks.facts(extra);
    const res = await FZ.brain.ask(state.npc.id, intent, facts, input);
    if (!state) return;
    state.busy = false;
    typeLine(res.line);
    setSource(res);
    const d = res.data || {};
    if (state.npc.id === 'frog' && Array.isArray(d.offers)) FZ.talkHooks.setOffers(d.offers);
    if (state.npc.id === 'bunny' && d.quest && !FZ.game.quest) state.pendingQuest = d.quest;
    renderOptions();
  }

  function open(npc) {
    state = { npc, busy: false, typer: 0, full: '', pendingQuest: null };
    el.root.hidden = false;
    el.name.textContent = npc.def.name;
    el.input.value = '';
    el.input.placeholder = `Say something to ${npc.def.name}…`;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(portraitLoop);
    say('greet');
  }

  function close() {
    if (!state) return;
    clearInterval(state.typer);
    state = null;
    cancelAnimationFrame(raf);
    el.root.hidden = true;
    el.input.blur();
    FZ.talkHooks.close();
  }

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state || state.busy) return;
    const text = el.input.value.trim();
    if (!text) return;
    el.input.value = '';
    say('chat', text);
  });
  el.close.addEventListener('click', close);
  el.line.addEventListener('click', finishTyping);
  el.source.addEventListener('click', () => FZ.talkHooks.openPanel());
  window.addEventListener('keydown', (e) => {
    if (!state) return;
    const typing = e.target === el.input;
    if (e.code === 'Escape') { e.preventDefault(); close(); return; }
    if (typing) return;
    if (/^Digit[1-6]$/.test(e.code)) {
      const b = el.options.querySelectorAll('button')[Number(e.code.slice(5)) - 1];
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    } else if (e.code === 'Enter' || e.code === 'Space') {
      if (e.target && e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      finishTyping();
    }
  });

  FZ.talk = { open, close, get active() { return !!state; } };
})(window.FZ);
