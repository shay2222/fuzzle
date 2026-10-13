/*
 * NPC dialogue: facts -> generator -> guard -> (repair once) -> authored fallback.
 *
 * The generator proposes a line plus structured data (claims, offers, quests). The guard
 * checks all of it against the game before the player sees anything:
 *   - format:     valid JSON with a line of sensible length
 *   - safety:     nothing unkind or unsafe
 *   - character:  no talk of AI, prompts, phones, or other out-of-world things
 *   - names:      no invented characters or places
 *   - facts:      seed counts, directions, hazards, and family status match the level
 *   - economy:    only items in stock, prices inside the guard's floor and cap
 *   - quests:     only items the level can place, rewards inside bounds
 * Cheap problems are fixed in place (a clamped price, a trimmed line). Anything that would
 * mislead the player gets one repair attempt, then an authored line built from the facts.
 *
 * Step 4 ships an offline generator, so the game works with no network. Step 5 adds a live
 * model behind the same `generate()` contract, and the guard stays exactly the same.
 */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  const TS = FZ.TS;
  const T = FZ.TILE;

  /* ---------------- vocabularies the guard checks against ---------------- */
  FZ.HAZARD_NAMES = {
    woods: { hazard: 'brambles', spikes: 'thorn traps', critter: 'bees', pool: 'ponds' },
    caves: { hazard: 'crystal shards', spikes: 'spike plates', critter: 'bats', pool: 'dark pools' },
    clouds: { hazard: 'cloud holes', spikes: 'zap plates', critter: 'storm clouds', pool: 'rain puddles' },
    lair: { hazard: 'curse goo', spikes: 'rune flames', critter: 'bats', pool: 'goo pits', orb: 'magic orbs', thorns: 'thorn lines', oink: 'Oink himself' },
  };
  const HAZARD_VOCAB = [...new Set(Object.values(FZ.HAZARD_NAMES).flatMap((o) => Object.values(o)))]
    .filter((h) => h !== 'Oink himself')
    .concat(['lava', 'lava pits', 'spiders', 'ghosts', 'quicksand', 'snakes', 'wolves', 'fire pits']);
  const INVENTED_ITEMS = ['golden sword', 'magic wand', 'jetpack', 'diamond crown', 'treasure chest', 'potion of flying'];
  const OUT_OF_WORLD = [
    'ai', 'a.i.', 'artificial intelligence', 'language model', 'llm', 'chatbot', 'chatgpt', 'claude', 'openai', 'anthropic',
    'internet', 'online', 'smartphone', 'phone', 'computer', 'video game', 'npc', 'wifi', 'wi-fi', 'email', 'website', 'app',
  ];
  const META = /\b(json|system prompt|my (instructions|prompt|programming)|as an ai)\b/i;
  const UNSAFE = [/\bkys\b/i, /kill yourself/i, /\bgo die\b/i, /\bstupid\b/i, /\bshut up\b/i, /\bhate you\b/i];
  const INJECTION = [
    /ignore (all |any |the |your )?(previous|prior|above|earlier)/i, /system prompt/i, /\bsystem\s*:/i,
    /you are (now )?(an? |the )?(ai|assistant|language model|llm|chatbot)/i, /\b(developer|debug|god|admin) mode\b/i,
    /(reveal|repeat|print|show) (me )?(your|the) (instructions|prompt|rules)/i, /\bjailbreak\b/i, /what (model|llm|ai) are you/i,
    /\b(chatgpt|openai|anthropic|claude|gpt-?\d)\b/i,
  ];
  const ALLOWED_NAMES = new Set([
    'fuzzle', 'oink', 'puffhollow', 'ember', 'sunny', 'mallow', 'pip', 'mama', 'plum', 'papa', 'clover',
    'mossy', 'woods', 'crystal', 'caves', 'cloud', 'clouds', 'tops', 'heart', 'hearts', 'crystals', 'tower', 'warlock',
    'old', 'hoot', 'croaksworth', 'dot', 'i', 'hoo', 'ribbit', 'oh', 'ooh', 'yay',
  ]);
  const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const NUM_RE = '(\\d+|no|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
  const DIR_RE = /\b(north|south)(?:[- ]?(east|west))?\b|\b(east|west)\b/gi;
  const OPPOSITE = { north: 'south', south: 'north', east: 'west', west: 'east', 'north-east': 'south-west', 'south-west': 'north-east', 'north-west': 'south-east', 'south-east': 'north-west' };

  FZ.LORE = [
    'Oink fears the Heart Crystals. Their light cracks his shield.',
    'Oink keeps Mama Plum, Papa Clover, and baby Pip in cages at the top of his tower.',
    'The curse reshapes the land each time someone falls. Falling is not failing.',
    'Each land hides a Heart Crystal, right where one of your siblings is caged.',
    'Oink was once a small, lonely piglet. Curses grow best in grumpy hearts.',
  ];

  const num = (n) => (n >= 0 && n < NUMBERS.length ? NUMBERS[n] : String(n));
  const toNum = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : NUMBERS.indexOf(s.toLowerCase()));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const seedWord = (n) => (n === 1 ? 'seed' : 'seeds');
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const has = (text, term) => new RegExp(`\\b${esc(term)}\\b`, 'i').test(text);

  function direction8(dx, dy) {
    const a = (Math.atan2(dy, dx) * 180) / Math.PI; // 0 = east, 90 = south
    const names = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    return names[((Math.round(a / 45) % 8) + 8) % 8];
  }
  function distWord(px) {
    const tiles = px / TS;
    return tiles < 6 ? 'just a hop' : tiles < 12 ? 'a short walk' : 'far away';
  }
  function dirsIn(text) {
    const out = [];
    for (const m of text.matchAll(DIR_RE)) out.push(m[3] ? m[3].toLowerCase() : m[2] ? `${m[1]}-${m[2]}`.toLowerCase() : m[1].toLowerCase());
    return out;
  }

  /* ---------------- facts: everything an NPC is allowed to know right now ---------------- */
  FZ.buildFacts = function (game, extra) {
    const w = game.world;
    const p = game.player;
    const areaIdx = game.area;
    const names = FZ.HAZARD_NAMES[w.area.id];
    const left = w.seeds.filter((s) => !s.got);
    const byDist = left.map((s) => ({ s, d: Math.hypot(s.x - p.x, s.y - p.y) })).sort((a, b) => a.d - b.d);
    const nearest = byDist.length ? { dir: direction8(byDist[0].s.x - p.x, byDist[0].s.y - p.y), dist: distWord(byDist[0].d) } : null;
    const hazards = [];
    if (w.tiles.includes(T.HAZARD)) hazards.push(names.hazard);
    if (w.tiles.includes(T.SPIKES)) hazards.push(names.spikes);
    if (w.tiles.includes(T.POOL)) hazards.push(names.pool);
    if (w.critters.length) hazards.push(names.critter);
    const causes = {};
    for (const d of game.deaths) causes[d.cause] = (causes[d.cause] || 0) + 1;
    const topCause = Object.keys(causes).sort((a, b) => causes[b] - causes[a])[0] || null;
    const family = FZ.FAMILY.map((m) => ({
      id: m.id, name: m.name, short: m.short, freed: game.rescued.includes(m.id),
      where: m.area !== undefined ? `at the end of the ${FZ.AREAS[m.area].name}` : "in Oink's tower",
    }));
    const portalDir = direction8(w.portal.x - p.x, w.portal.y - p.y);
    const seedDirs = [...new Set(left.map((s) => direction8(s.x - p.x, s.y - p.y)))];
    const questDir = w.questItem && !w.questItem.got ? direction8(w.questItem.x - p.x, w.questItem.y - p.y) : null;
    return Object.assign({
      areaId: w.area.id, areaName: w.area.name, areaIdx, level: `${areaIdx + 1}-${game.level + 1}`,
      attempt: game.attempt, seedsLeft: left.length, seedsTotal: w.seeds.length, nearest, seedDirs,
      portalDir, portalAwake: w.portal.active, hazards, critters: w.critters.length,
      poofs: game.poofs, poofsHere: game.attempt, poofsArea: game.deaths.filter((d) => d.area === areaIdx).length, causes, topCause,
      family, pouch: game.pouch, purchases: game.purchases, haggles: game.haggles,
      stock: (game.shopStock || []).filter((id) => !(FZ.ITEMS[id].once && game.items[id])).map((id) => Object.assign({ id, name: FZ.ITEMS[id].name, base: FZ.ITEMS[id].base, desc: FZ.ITEMS[id].desc }, FZ.priceBounds(FZ.ITEMS[id]))),
      offers: game.offers || [], generosity: FZ.brain.settings.generosity,
      quest: game.quest, questItems: FZ.QUEST_ITEMS[Math.min(areaIdx, 2)], questDir,
      allDirs: [...new Set(seedDirs.concat([portalDir], questDir ? [questDir] : []))],
      lore: FZ.LORE,
    }, extra || {});
  };

  /* ---------------- the offline generator ---------------- */
  function priceFor(it, f) {
    const g = f.generosity;
    let price = it.base + Math.round((0.5 - g) * 2);
    if (g >= 0.4) price -= Math.min(2, Math.floor(f.poofsArea / 2));
    if (f.purchases >= 2) price -= 1;
    return price;
  }

  function familyStatus(f, m, who) {
    if (m.freed) return who === 'owl' ? `${m.name} is safe and hopping right behind you, hoo!` : `${m.short} is free! I saw them hopping after you!`;
    return who === 'owl' ? `${cap(m.name)} is still caged ${m.where}. Keep going, little one.` : `${cap(m.name)} is still caged ${m.where}. You can do it!`;
  }

  function hintLine(f) {
    if (!f.seedsLeft) {
      return { line: pick([`Hoo! Every seed is yours. The portal is awake to the ${f.portalDir}.`, `Well done, hoo. Hurry to the portal, ${f.portalDir} of here.`]), claims: { seeds: 0, portal: f.portalDir } };
    }
    const n = f.seedsLeft;
    const hz = f.hazards.length ? pick(f.hazards) : null;
    const d = f.nearest;
    let line = pick([
      `Hoo! ${cap(num(n))} ${seedWord(n)} left. The nearest is ${d.dist} to the ${d.dir}.`,
      `The land shifted, little one. I count ${num(n)} ${seedWord(n)}. Try the ${d.dir} first, it's ${d.dist}.`,
      `Hoo, hoo. Look ${d.dir}, ${d.dist}. ${cap(num(n))} ${seedWord(n)} still glow out there.`,
    ]);
    const claims = { seeds: n, nearest: d.dir, hazards: [] };
    if (hz) { line += pick([` Mind the ${hz}.`, ` And watch out for the ${hz}.`]); claims.hazards.push(hz); }
    if (Math.random() < 0.4) { line += ` The portal sleeps to the ${f.portalDir}.`; claims.portal = f.portalDir; }
    return { line, claims };
  }

  function chatIntent(text) {
    const t = text.toLowerCase();
    if (/\b(hi|hello|hey|howdy)\b/.test(t)) return 'hello';
    if (/\bwho are you\b|\byour name\b/.test(t)) return 'who';
    if (/\boink\b|\bwarlock\b|\bcurse\b/.test(t)) return 'oink';
    if (/\b(where|seed|seeds|portal|hint|help|lost|stuck|which way)\b/.test(t)) return 'hint';
    if (/\b(buy|sell|price|cost|charm|tea|magnet|berry|shop|deal)\b/.test(t)) return 'shop';
    return 'other';
  }

  function mentionedMember(text, f) {
    const t = text.toLowerCase();
    return f.family.find((m) => t.includes(m.short.toLowerCase().split(' ')[0]) || (m.id === 'mama' && /\bmom|mother|mum\b/.test(t)) || (m.id === 'papa' && /\bdad|father\b/.test(t)));
  }

  const OFFLINE = {
    owl: {
      greet: (f) => ({ line: f.attempt > 0 ? pick(['The land shifted again, I see. Hoo. Need a hint?', 'Back so soon? Falling is not failing, little one.']) : pick(['Hoo! You made it, little Fuzzle. Need a hint?', `Hoo, hoo. The ${f.areaName} is restless today.`]) }),
      hint: hintLine,
      lore: () => { const i = Math.floor(Math.random() * FZ.LORE.length); return { line: `Hoo. ${FZ.LORE[i]}`, claims: { lore: i } }; },
      chat: (f, input, flags) => {
        if (flags.includes('injection')) return { line: 'Hoo? Those are strange words, little one. Ask me about the land instead.' };
        if (OUT_OF_WORLD.some((w) => has(input, w))) return { line: "Hoo? I don't know that word. Out here we have seeds, portals, and one grumpy warlock." };
        const m = mentionedMember(input, f);
        if (m) return { line: familyStatus(f, m, 'owl') };
        const intent = chatIntent(input);
        if (intent === 'hello') return OFFLINE.owl.greet(f);
        if (intent === 'who') return { line: "I'm Old Hoot. I've watched over these lands for a hundred years, hoo." };
        if (intent === 'oink') return OFFLINE.owl.lore(f);
        if (intent === 'hint') return hintLine(f);
        return { line: pick(['Hoo. Every fall teaches the feet something new.', 'Stay brave, little Fuzzle. Your family is waiting.', 'Hoo. Even the curse cannot hide a Heart Crystal forever.']) };
      },
    },
    frog: {
      greet: (f) => {
        let line;
        const claims = { poofs: f.poofs };
        if (!f.poofs) line = pick(['Ribbit! Not a single poof yet? Fancy. Have a look, dumpling.', 'Ribbit, a fresh customer! Finest charms in the land.']);
        else {
          const c = f.causes[f.topCause];
          claims.cause = f.topCause;
          if (Math.random() < 0.5) line = `Back in one piece? ${cap(num(f.poofs))} ${f.poofs === 1 ? 'poof' : 'poofs'} so far, mostly ${f.topCause}. I've got just the thing.`;
          else { line = `Ribbit. The ${f.topCause} got you ${num(c)} ${c === 1 ? 'time' : 'times'}, eh? Let's fix that, dumpling.`; claims.causeCount = c; }
        }
        if (f.generosity >= 0.4 && f.poofsArea >= 2) line += ' You look frazzled, so prices are kinder today.';
        return { line, claims, offers: f.stock.map((it) => ({ item: it.id, price: priceFor(it, f) })) };
      },
      haggle: (f) => {
        const offers = f.offers.map((o) => Object.assign({}, o));
        if (!offers.length) return { line: 'Ribbit. Nothing left to haggle over, dumpling.', offers };
        // haggle on whatever still has room above the frog's floor
        const floorOf = (o) => (f.stock.find((s) => s.id === o.item) || { floor: 0 }).floor;
        const top = offers.slice().sort((a, b) => (b.price - floorOf(b)) - (a.price - floorOf(a)))[0];
        const room = top.price - floorOf(top);
        if (f.haggles === 0 && room > 0 && Math.random() < 0.35 + f.generosity * 0.6) {
          top.price -= Math.min(room, f.generosity > 0.8 ? 2 : 1);
          return { line: `Ribbit... fine. The ${FZ.ITEMS[top.item].name} for ${num(top.price)} ${seedWord(top.price)}. Don't tell the other frogs.`, offers };
        }
        return { line: pick(['Ribbit. That is my final price, dumpling.', 'Haggling? With prices this low? Ribbit!']), offers };
      },
      thanks: (f) => ({ line: `Pleasure doing business! Enjoy your ${FZ.ITEMS[f.bought].name}, ribbit.` }),
      chat: (f, input, flags) => {
        if (flags.includes('injection')) return { line: 'Ribbit? I only speak the language of seeds, dumpling.' };
        if (OUT_OF_WORLD.some((w) => has(input, w))) return { line: 'Never heard of it. Does it cost seeds?' };
        const m = mentionedMember(input, f);
        if (m) return { line: m.freed ? `${m.short}? Safe and sound, last I saw. Ribbit.` : `Haven't seen ${m.short}, but a frog hears things. Ask Old Hoot, dumpling.` };
        const intent = chatIntent(input);
        if (intent === 'shop' && f.offers.length) {
          const o = pick(f.offers);
          const it = FZ.ITEMS[o.item];
          return { line: `My ${it.name}? ${it.desc} Only ${num(o.price)} ${seedWord(o.price)}.` };
        }
        if (intent === 'oink') return { line: 'Oink? Bad for business. Cursed land, cursed customers. Ribbit.' };
        if (intent === 'hello') return { line: 'Ribbit! Welcome, welcome. Browse all you like.' };
        if (intent === 'who') return { line: 'Croaksworth, traveling merchant. Charms for seeds, no refunds.' };
        return { line: pick(['Ribbit. Buying or browsing, dumpling?', 'Seeds in, charms out. Simple as that.']) };
      },
    },
    bunny: {
      greet: (f) => {
        if (f.quest && !f.quest.done) return { line: `Did you find my ${f.quest.item} yet? It's somewhere in this level!`, quest: { item: f.quest.item, reward: f.quest.reward } };
        if (f.quest && f.quest.done) return { line: 'You found my things! You are the best, Fuzzle!' };
        const item = pick(f.questItems);
        const reward = 2 + Math.floor(Math.random() * 3);
        return {
          line: pick([
            `Fuzzle! The curse blew my ${item} away when the land shifted. Find it in this level and I'll give you ${num(reward)} sparkle seeds!`,
            `Oh, oh! Have you seen my ${item}? It's out there somewhere. Bring it back for ${num(reward)} seeds, promise!`,
          ]),
          quest: { item, reward },
        };
      },
      story: (f) => ({ line: `When Oink cursed the ${f.areaName}, the wind scattered everything in my satchel!` }),
      thanks: (f) => ({ line: `My ${f.quest.item}! Thank you, thank you! Here are your seeds!` }),
      chat: (f, input, flags) => {
        if (flags.includes('injection')) return { line: "Huh? You're talking funny! Let's go find my things!" };
        if (OUT_OF_WORLD.some((w) => has(input, w))) return { line: "I don't know what that is! Is it shiny?" };
        const m = mentionedMember(input, f);
        if (m) return { line: familyStatus(f, m, 'bunny') };
        const intent = chatIntent(input);
        if (intent === 'oink') return { line: 'Oink is a big grumpy meanie. I hid under a mushroom when he flew by!' };
        if (intent === 'hello') return { line: "Hi hi hi! I'm Dot!" };
        if (intent === 'who') return { line: "I'm Dot, a scout from Puffhollow. Fastest ears in the hills!" };
        return { line: pick(["Let's keep going! Your family needs you!", 'Hop hop! The portal will not wait forever!']) };
      },
    },
  };

  /* ---------------- planted mistakes (developer panel) ---------------- */
  function plantMistake(npc, intent, obj, f) {
    const options = [];
    if (npc === 'owl' && intent === 'hint' && obj.claims && f.nearest) {
      options.push(['wrong direction', () => { const d = OPPOSITE[f.nearest.dir]; obj.claims.nearest = d; obj.line += ` Head ${d}, quick!`; }]);
      options.push(['wrong seed count', () => { obj.claims.seeds += 2; obj.line += ` That makes ${num(obj.claims.seeds)} seeds in all.`; }]);
      options.push(['invented hazard', () => { obj.line += ' Beware the lava pits.'; }]);
    }
    if (npc === 'frog' && obj.offers && obj.offers.length) {
      options.push(['price over the cap', () => { obj.offers[0].price = FZ.ITEMS[obj.offers[0].item].base * 3; }]);
      options.push(['item not in stock', () => { obj.offers.push({ item: 'golden_sword', price: 3 }); obj.line += ' Fancy a golden sword?'; }]);
      options.push(['line and price disagree', () => { obj.line += ` The ${FZ.ITEMS[obj.offers[0].item].name} is just one seed today!`; }]);
      if (intent === 'greet') options.push(['wrong memory', () => { obj.claims = Object.assign({}, obj.claims, { poofs: f.poofs + 3 }); obj.line += ` ${cap(num(f.poofs + 3))} poofs, dumpling!`; }]);
    }
    if (npc === 'bunny' && intent === 'greet' && obj.quest) {
      options.push(['reward over the cap', () => { obj.quest.reward = 50; obj.line += ' Fifty seeds, really!'; }]);
      options.push(['item the level cannot place', () => { obj.quest.item = 'diamond crown'; obj.line = 'Find my diamond crown and I will make you rich!'; }]);
    }
    options.push(['breaks character', () => { obj.line = `As an AI language model, ${obj.line.charAt(0).toLowerCase()}${obj.line.slice(1)}`; }]);
    options.push(['out-of-world word', () => { obj.line += ' Look it up on the internet!'; }]);
    options.push(['invented character', () => { obj.line += ' My cousin Grimbeak told me so.'; }]);
    const [name, apply] = pick(options);
    apply();
    return name;
  }

  /* ---------------- the guard ---------------- */
  function v(code, detail, severity) { return { code, detail, severity }; }

  function trimToSentence(line, max) {
    const parts = line.match(/[^.!?]+[.!?]+["']?\s*/g) || [line];
    let out = '';
    for (const p of parts) { if ((out + p).length > max) break; out += p; }
    return out.trim() || line.slice(0, max);
  }

  function unknownNames(line) {
    const bad = [];
    for (const sentence of line.split(/(?<=[.!?])\s+/)) {
      const words = sentence.replace(/[^A-Za-z' -]/g, ' ').split(/\s+/).filter(Boolean);
      words.slice(1).forEach((w) => {
        const clean = w.replace(/'s$/, '').replace(/^'|'$/g, '');
        if (/^[A-Z][a-z]+$/.test(clean) && !ALLOWED_NAMES.has(clean.toLowerCase())) bad.push(clean);
      });
    }
    return bad;
  }

  function checkInput(raw) {
    let text = (raw || '').normalize('NFKC').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
    const flags = [];
    if (!text) return { text, route: 'fallback', flags: ['empty'] };
    if (text.length > 140) { text = text.slice(0, 140); flags.push('truncated'); }
    if (UNSAFE.some((r) => r.test(text))) return { text, route: 'fallback', flags: flags.concat('unkind') };
    if (INJECTION.some((r) => r.test(text))) flags.push('injection');
    return { text, route: 'model', flags };
  }

  /** Checks one draft. Returns the (possibly corrected) reply and every violation found. */
  FZ.guardReply = function (npc, intent, raw, f) {
    let obj;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      obj = JSON.parse(m ? m[0] : raw);
    } catch (e) {
      return { obj: null, violations: [v('format', 'The reply was not valid JSON.', 'repair')] };
    }
    const out = [];
    if (typeof obj.line !== 'string' || !obj.line.trim()) return { obj: null, violations: [v('format', 'The reply had no line to say.', 'repair')] };
    obj.line = obj.line.replace(/\s+/g, ' ').trim();
    const line = obj.line;

    if (UNSAFE.some((r) => r.test(line))) out.push(v('safety', 'Unkind or unsafe words.', 'hard'));
    const oow = OUT_OF_WORLD.find((w) => has(line, w));
    if (oow) out.push(v('character', `Mentioned "${oow}", which doesn't exist in Fuzzle's world.`, 'repair'));
    if (META.test(line)) out.push(v('character', 'Talked about its own instructions or format.', 'repair'));
    const names = unknownNames(line);
    if (names.length) out.push(v('names', `Invented a name: ${names.join(', ')}.`, 'repair'));

    // family status must match the game
    for (const m of f.family) {
      for (const sentence of line.split(/(?<=[.!?])\s+/)) {
        if (!new RegExp(`\\b${esc(m.short.split(' ')[0])}\\b`, 'i').test(sentence)) continue;
        if (m.freed && /\b(caged|cage|locked|trapped|missing)\b/i.test(sentence)) out.push(v('facts', `Said ${m.short} is caged, but ${m.short} is already free.`, 'repair'));
        if (!m.freed && /\b(is free|are free|safe|behind you|rescued)\b/i.test(sentence)) out.push(v('facts', `Said ${m.short} is free, but ${m.short} is still caged.`, 'repair'));
      }
    }

    // directions and hazards in the text must be real
    const badDirs = dirsIn(line).filter((d) => !f.allDirs.includes(d));
    if (badDirs.length) out.push(v('facts', `Pointed ${badDirs[0]}, but nothing Fuzzle needs is that way.`, 'repair'));
    const allowedHazards = f.hazards.concat(Object.keys(f.causes));
    const badHz = HAZARD_VOCAB.find((h) => has(line, h) && !allowedHazards.includes(h) && !allowedHazards.some((a) => a.includes(h)));
    if (badHz) out.push(v('facts', `Warned about ${badHz}, which this level doesn't have.`, 'repair'));
    const fake = INVENTED_ITEMS.find((it) => has(line, it));
    if (fake) out.push(v('economy', `Mentioned a ${fake}, which doesn't exist.`, 'repair'));

    const claims = obj.claims || {};
    if (npc === 'owl') {
      if (claims.seeds !== undefined && claims.seeds !== f.seedsLeft) out.push(v('facts', `Claimed ${claims.seeds} seeds left; there are ${f.seedsLeft}.`, 'repair'));
      if (claims.nearest && (!f.nearest || claims.nearest !== f.nearest.dir)) out.push(v('facts', `Claimed the nearest seed is ${claims.nearest}; it's ${f.nearest ? f.nearest.dir : 'gone'}.`, 'repair'));
      if (claims.portal && claims.portal !== f.portalDir) out.push(v('facts', `Claimed the portal is ${claims.portal}; it's ${f.portalDir}.`, 'repair'));
      for (const h of claims.hazards || []) if (!f.hazards.includes(h)) out.push(v('facts', `Claimed ${h}, which this level doesn't have.`, 'repair'));
      for (const m of line.matchAll(new RegExp(`\\b${NUM_RE}\\s+(?:sparkle\\s+)?seeds?\\b`, 'gi'))) {
        const n = toNum(m[1]);
        if (n !== f.seedsLeft) { out.push(v('facts', `Said "${m[0]}"; there are ${f.seedsLeft} left.`, 'repair')); break; }
      }
      if (claims.lore !== undefined && !(claims.lore >= 0 && claims.lore < FZ.LORE.length)) out.push(v('facts', 'Cited lore that does not exist.', 'repair'));
    }

    if (npc === 'frog') {
      if (claims.poofs !== undefined && claims.poofs !== f.poofs) out.push(v('memory', `Remembered ${claims.poofs} poofs; Fuzzle has ${f.poofs}.`, 'repair'));
      if (claims.cause && !f.causes[claims.cause]) out.push(v('memory', `Blamed ${claims.cause}, which never poofed Fuzzle.`, 'repair'));
      if (claims.causeCount !== undefined && claims.cause && claims.causeCount !== f.causes[claims.cause]) out.push(v('memory', `Said ${claims.cause} got Fuzzle ${claims.causeCount} times; it was ${f.causes[claims.cause]}.`, 'repair'));
      for (const m of line.matchAll(new RegExp(`\\b${NUM_RE}\\s+poofs?\\b`, 'gi'))) {
        if (toNum(m[1]) !== f.poofs) { out.push(v('memory', `Said "${m[0]}"; Fuzzle has ${f.poofs}.`, 'repair')); break; }
      }
      if (obj.offers !== undefined) {
        if (!Array.isArray(obj.offers)) out.push(v('format', 'Offers were not a list.', 'repair'));
        else {
          const stockIds = f.stock.map((s) => s.id);
          const kept = [];
          for (const o of obj.offers) {
            const s = f.stock.find((x) => x.id === o.item);
            if (!s) { out.push(v('economy', `Offered "${o.item}", which isn't in stock.`, 'repair')); continue; }
            let price = Math.round(Number(o.price));
            if (!Number.isFinite(price)) price = s.base;
            if (price < s.floor || price > s.cap) {
              const fixed = Math.min(s.cap, Math.max(s.floor, price));
              out.push(v('economy', `${cap(s.name)} at ${price} is outside ${s.floor}–${s.cap}; set to ${fixed}.`, 'fixed'));
              price = fixed;
            }
            if (!kept.some((k) => k.item === s.id)) kept.push({ item: s.id, price });
          }
          for (const id of stockIds) if (!kept.some((k) => k.item === id)) {
            const s = f.stock.find((x) => x.id === id);
            kept.push({ item: id, price: Math.min(s.cap, Math.max(s.floor, s.base)) });
          }
          obj.offers = kept;
          const prices = kept.map((k) => k.price);
          for (const m of line.matchAll(new RegExp(`\\b${NUM_RE}\\s+(?:sparkle\\s+)?seeds?\\b`, 'gi'))) {
            if (!prices.includes(toNum(m[1]))) { out.push(v('economy', `The line says "${m[0]}", but no price on the board matches.`, 'repair')); break; }
          }
        }
      }
      if (obj.offers === undefined && f.offers.length) {
        const prices = f.offers.map((o) => o.price);
        for (const m of line.matchAll(new RegExp(`\\b${NUM_RE}\\s+(?:sparkle\\s+)?seeds?\\b`, 'gi'))) {
          if (!prices.includes(toNum(m[1]))) { out.push(v('economy', `The line says "${m[0]}", but no price on the board matches.`, 'repair')); break; }
        }
      }
      for (const it of Object.values(FZ.ITEMS)) {
        if (has(line, it.name) && !f.stock.some((s) => s.id === it.id) && f.bought !== it.id) out.push(v('economy', `Talked up the ${it.name}, which isn't for sale here.`, 'repair'));
      }
    }

    if (npc === 'bunny' && obj.quest) {
      const q = obj.quest;
      if (!f.questItems.includes(q.item)) out.push(v('quest', `Asked for a "${q.item}", which this land can't place.`, 'repair'));
      let reward = Math.round(Number(q.reward));
      if (!Number.isFinite(reward)) reward = FZ.QUEST_REWARD.min;
      if (reward < FZ.QUEST_REWARD.min || reward > FZ.QUEST_REWARD.max) {
        const fixed = Math.min(FZ.QUEST_REWARD.max, Math.max(FZ.QUEST_REWARD.min, reward));
        out.push(v('quest', `Reward ${reward} is outside ${FZ.QUEST_REWARD.min}–${FZ.QUEST_REWARD.max}; set to ${fixed}.`, 'fixed'));
        reward = fixed;
      }
      q.reward = reward;
      for (const m of line.matchAll(new RegExp(`\\b${NUM_RE}\\s+(?:sparkle\\s+)?seeds?\\b`, 'gi'))) {
        if (toNum(m[1]) !== reward) { out.push(v('quest', `The line promises "${m[0]}", but the reward is ${reward}.`, 'repair')); break; }
      }
      if (f.questItems.includes(q.item) && !has(line, q.item)) out.push(v('quest', "The line doesn't say what to look for.", 'repair'));
    }

    if (obj.line.length > 220) {
      obj.line = trimToSentence(obj.line, 220);
      out.push(v('length', 'Trimmed a long line at a sentence break.', 'fixed'));
    }
    return { obj, violations: out };
  };

  /* ---------------- authored fallbacks, built straight from the facts ---------------- */
  function fallback(npc, intent, f, why) {
    if (npc === 'owl') {
      if (intent === 'hint' || (intent === 'chat' && why !== 'input')) {
        if (intent === 'hint' && f.seedsLeft && f.nearest) return { line: `Hoo. ${cap(num(f.seedsLeft))} ${seedWord(f.seedsLeft)} left. The nearest one is ${f.nearest.dist} to the ${f.nearest.dir}.` };
        if (intent === 'hint') return { line: `Hoo! The portal is awake to the ${f.portalDir}.` };
        return { line: "Hoo? Let's talk about the land, little one." };
      }
      if (intent === 'lore') return { line: `Hoo. ${FZ.LORE[0]}` };
      if (why === 'input') return { line: 'Hoo. Kind words only, little one.' };
      return { line: 'Hoo, hello, little Fuzzle. Ask me for a hint any time.' };
    }
    if (npc === 'frog') {
      const offers = f.stock.map((s) => ({ item: s.id, price: Math.min(s.cap, Math.max(s.floor, s.base)) }));
      if (intent === 'greet') return { line: 'Ribbit. Prices are on the board, dumpling.', offers };
      if (intent === 'haggle') return { line: 'Ribbit. My prices stay put today.', offers: f.offers.length ? f.offers : offers };
      if (intent === 'thanks') return { line: 'Pleasure doing business, ribbit.' };
      if (why === 'input') return { line: 'Ribbit! Manners, dumpling.' };
      return { line: 'Ribbit? Buying or browsing, dumpling?' };
    }
    if (intent === 'greet') {
      if (f.quest && !f.quest.done) return { line: `My ${f.quest.item} is somewhere in this level. Please find it!`, quest: { item: f.quest.item, reward: f.quest.reward } };
      const item = f.questItems[f.attempt % f.questItems.length];
      return { line: `I lost my ${item} somewhere in this level. Find it and I'll give you three seeds!`, quest: { item, reward: 3 } };
    }
    if (intent === 'thanks') return { line: 'You found it! Thank you, Fuzzle!' };
    if (intent === 'story') return { line: 'The curse scattered my things everywhere!' };
    if (why === 'input') return { line: "Hey! That's not nice!" };
    return { line: "Hmm? Let's keep looking for my things!" };
  }

  /* ---------------- the pipeline ---------------- */
  const offlineGenerator = {
    name: 'Built-in (offline)',
    async generate(req) {
      await new Promise((r) => setTimeout(r, 180 + Math.random() * 260)); // feels like thinking
      const fn = OFFLINE[req.npc][req.intent] || OFFLINE[req.npc].chat;
      return JSON.stringify(fn(req.facts, req.input || '', req.flags || []));
    },
  };

  const brain = {
    settings: { plant: false, plantRate: 0.5, generosity: 0.5 },
    generator: offlineGenerator,
    log: [],
    stats: { turns: 0, firstTry: 0, adjusted: 0, repaired: 0, fallback: 0 },
    listeners: [],
    onLog(fn) { this.listeners.push(fn); },

    /** Asks an NPC for a line. Resolves to { line, data, source, violations }. */
    async ask(npc, intent, facts, input) {
      const t0 = performance.now();
      const entry = { npc, intent, input: input || '', planted: null, attempts: [], source: '', line: '', ms: 0, generator: this.generator.name };
      let result = null;
      const inCheck = intent === 'chat' ? checkInput(input) : { text: '', route: 'model', flags: [] };
      entry.inputFlags = inCheck.flags;

      if (inCheck.route === 'fallback') {
        result = Object.assign(fallback(npc, intent, facts, 'input'), { source: 'fallback' });
      } else {
        let feedback = null;
        for (let attempt = 0; attempt < 2 && !result; attempt++) {
          let raw;
          try {
            raw = await this.generator.generate({ npc, intent, facts, input: inCheck.text, flags: inCheck.flags, feedback, npcDef: FZ.NPCS[npc] });
          } catch (err) {
            entry.attempts.push({ raw: '', violations: [v('generator', `No reply: ${err.message || err}`, 'hard')] });
            break;
          }
          if (attempt === 0 && this.settings.plant && Math.random() < this.settings.plantRate) {
            try {
              const obj = JSON.parse(raw);
              entry.planted = plantMistake(npc, intent, obj, facts);
              raw = JSON.stringify(obj);
            } catch (e) { /* leave malformed drafts alone */ }
          }
          const { obj, violations } = FZ.guardReply(npc, intent, raw, facts);
          entry.attempts.push({ raw, violations });
          const blocking = violations.filter((x) => x.severity !== 'fixed');
          if (obj && !blocking.length) {
            const adjusted = violations.length > 0;
            result = Object.assign(obj, { source: attempt === 0 ? (adjusted ? 'adjusted' : 'model') : 'repaired' });
            break;
          }
          if (violations.some((x) => x.severity === 'hard')) break;
          feedback = blocking.map((x) => x.detail);
        }
        if (!result) result = Object.assign(fallback(npc, intent, facts, 'guard'), { source: 'fallback' });
      }

      entry.source = result.source;
      entry.line = result.line;
      entry.ms = Math.round(performance.now() - t0);
      this.stats.turns++;
      if (result.source === 'model') this.stats.firstTry++;
      else if (result.source === 'adjusted') this.stats.adjusted++;
      else if (result.source === 'repaired') this.stats.repaired++;
      else this.stats.fallback++;
      this.log.unshift(entry);
      if (this.log.length > 30) this.log.length = 30;
      this.listeners.forEach((fn) => fn(entry));
      return { line: result.line, data: result, source: result.source, violations: entry.attempts.flatMap((a) => a.violations) };
    },
  };

  FZ.brain = brain;
  FZ.dialogueTools = { checkInput, direction8, OUT_OF_WORLD, HAZARD_VOCAB };
})(window.FZ);
