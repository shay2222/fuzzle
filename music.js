/*
 * Background music, composed and played entirely in code with Web Audio (no audio files).
 *
 * One original 16-bar theme ("Fuzzle's Tune") is re-arranged for each place:
 *   title   soft music box, gentle swing
 *   woods   bouncy plucks, shaker, walking bass
 *   caves   glassy bells with a long echo, slower
 *   clouds  airy and a little faster, sparkling arpeggios
 *   boss    the same tune in a minor key, driving drums for the fight with Oink
 * The scheduler looks a short way ahead and queues notes on the audio clock, so the beat
 * stays steady even when frames drop.
 */
window.FZ = window.FZ || {};
(function (FZ) {
  'use strict';

  /* ---------------- the tune (written in C major, one token per eighth-note group) ---------------- */
  // "note:eighths", "-:n" is a rest. Every bar adds up to 8 eighths.
  const MELODY = [
    'G4:1 C5:1 E5:2 D5:1 C5:1 E5:2', // 1  C
    'D5:1 G5:1 G5:2 F5:1 E5:1 D5:2', // 2  G
    'C5:1 E5:1 A5:2 G5:1 E5:1 C5:2', // 3  Am
    'F5:1 E5:1 D5:1 C5:1 D5:4', //      4  F
    'G4:1 C5:1 E5:2 D5:1 C5:1 E5:2', // 5  C
    'D5:1 G5:1 B5:2 A5:1 G5:1 F5:2', // 6  G
    'E5:1 C5:1 A4:2 F5:2 E5:1 D5:1', // 7  Am | F
    'D5:2 G4:2 C5:4', //                8  G | C
    'A5:2 G5:1 F5:1 E5:2 F5:2', //      9  F
    'G5:2 F5:1 E5:1 D5:4', //           10 G
    'E5:2 D5:1 C5:1 B4:2 C5:1 D5:1', // 11 Em
    'E5:3 -:1 A4:1 B4:1 C5:1 D5:1', //  12 Am
    'A5:2 G5:1 F5:1 E5:2 F5:2', //      13 F
    'G5:2 A5:1 B5:1 C6:2 B5:1 A5:1', // 14 G
    'A5:1 G5:1 F5:1 E5:1 D5:2 E5:1 F5:1', // 15 F
    'F5:1 E5:1 D5:2 C5:4', //           16 G | C
  ];
  // chords as scale degrees (0 = I). Two entries = the chord changes halfway through the bar.
  const CHORDS = [[0], [4], [5], [3], [0], [4], [5, 3], [4, 0], [3], [4], [2], [5], [3], [4], [3], [4, 0]];
  const BARS = MELODY.length;
  const STEPS = BARS * 8;

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(name) {
    const m = name.match(/^([A-G])([#b]?)(\d)$/);
    return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const EVENTS = new Array(STEPS).fill(null);
  MELODY.forEach((bar, b) => {
    let s = b * 8;
    for (const tok of bar.split(' ')) {
      const [n, len] = tok.split(':');
      if (n !== '-') EVENTS[s] = { midi: midiOf(n), len: Number(len) };
      s += Number(len);
    }
  });

  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const TO_MINOR = { 4: 3, 9: 8, 11: 10 }; // E -> Eb, A -> Ab, B -> Bb
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------------- arrangements ---------------- */
  const ARR = {
    title: { key: 0, bpm: 96, mode: 'major', lead: 'pluck', leadVol: 0.055, bass: 'soft', drums: 'none', pad: 0.014, arp: 'loop', echo: 0.3, swing: 0.1 },
    woods: { key: 0, bpm: 106, mode: 'major', lead: 'pluck', leadVol: 0.055, bass: 'bounce', drums: 'light', pad: 0.011, arp: 'loop', echo: 0.22, swing: 0.14 },
    caves: { key: -3, bpm: 90, mode: 'major', lead: 'bell', leadVol: 0.05, bass: 'long', drums: 'soft', pad: 0.016, arp: 'loop', echo: 0.45, swing: 0 },
    clouds: { key: 2, bpm: 114, mode: 'major', lead: 'pluck', leadVol: 0.05, bass: 'bounce', drums: 'light', pad: 0.01, arp: 'always', echo: 0.3, swing: 0.1 },
    boss: { key: 0, bpm: 132, mode: 'minor', lead: 'square', leadVol: 0.032, bass: 'eighths', drums: 'drive', pad: 0.012, arp: 'loop', echo: 0.18, swing: 0 },
  };

  /* ---------------- instruments ---------------- */
  const noiseBufs = new WeakMap();
  function noiseBuf(ac) {
    let b = noiseBufs.get(ac);
    if (!b) {
      b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseBufs.set(ac, b);
    }
    return b;
  }

  function osc(ac, type, f, t, stop, out, detune) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(out);
    o.start(t);
    o.stop(stop);
    return o;
  }

  // A new gain node is 1 until its first scheduled event, so start every envelope silent.
  // Without this a noise hit that begins a fraction of a sample early comes out as a click.
  function silentGain(ac) {
    const g = ac.createGain();
    g.gain.value = 0.0001;
    return g;
  }

  function env(ac, t, peak, attack, decayTo, decayTime, end) {
    const g = silentGain(ac);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, decayTo), t + attack + decayTime);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    return g;
  }

  const LEAD = {
    // music box: a soft triangle with a quiet octave on top, fast decay
    pluck(tr, t, f, dur, vol) {
      const ac = tr.ac;
      const end = t + dur + 0.35;
      const g = env(ac, t, vol, 0.006, vol * 0.35, 0.14, end);
      g.connect(tr.bus);
      g.connect(tr.echoIn);
      osc(ac, 'triangle', f, t, end + 0.02, g);
      const g2 = ac.createGain();
      g2.gain.value = 0.22;
      g2.connect(g);
      osc(ac, 'sine', f * 2, t, end + 0.02, g2);
    },
    // glassy bell: sine plus a bright, quickly fading overtone
    bell(tr, t, f, dur, vol) {
      const ac = tr.ac;
      const end = t + Math.max(dur, 0.6) + 0.6;
      const g = env(ac, t, vol, 0.004, vol * 0.25, 0.5, end);
      g.connect(tr.bus);
      g.connect(tr.echoIn);
      osc(ac, 'sine', f, t, end + 0.02, g);
      const g2 = env(ac, t, 0.35, 0.003, 0.02, 0.25, t + 0.5);
      g2.connect(g);
      osc(ac, 'sine', f * 2.01, t, t + 0.52, g2);
      const g3 = env(ac, t, 0.12, 0.002, 0.005, 0.12, t + 0.2);
      g3.connect(g);
      osc(ac, 'sine', f * 3.98, t, t + 0.22, g3);
    },
    // soft square through a low-pass filter, for the boss fight
    square(tr, t, f, dur, vol) {
      const ac = tr.ac;
      const end = t + dur * 0.92 + 0.08;
      const g = env(ac, t, vol, 0.01, vol * 0.7, Math.max(0.02, dur * 0.8), end);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(1100, end);
      lp.connect(g);
      g.connect(tr.bus);
      g.connect(tr.echoIn);
      osc(ac, 'square', f, t, end + 0.02, lp);
    },
  };

  function bass(tr, t, f, dur, vol) {
    const ac = tr.ac;
    const end = t + dur;
    const g = silentGain(ac);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.setTargetAtTime(vol * 0.55, t + 0.02, 0.12);
    g.gain.setTargetAtTime(0.0001, end - 0.03, 0.025);
    g.connect(tr.bus);
    osc(ac, 'triangle', f, t, end + 0.2, g);
    const g2 = ac.createGain();
    g2.gain.value = 0.5;
    g2.connect(g);
    osc(ac, 'sine', f, t, end + 0.2, g2);
  }

  function pad(tr, t, freqs, dur, vol) {
    const ac = tr.ac;
    const end = t + dur + 0.5;
    const g = silentGain(ac);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.35, dur * 0.4));
    g.gain.setValueAtTime(vol, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 760;
    lp.connect(g);
    g.connect(tr.bus);
    for (const f of freqs) {
      osc(ac, 'sawtooth', f, t, end + 0.02, lp, -7);
      osc(ac, 'sawtooth', f, t, end + 0.02, lp, 7);
    }
  }

  function arpNote(tr, t, f, vol) {
    const ac = tr.ac;
    const end = t + 0.32;
    const g = env(ac, t, vol, 0.003, vol * 0.2, 0.08, end);
    g.connect(tr.bus);
    g.connect(tr.echoIn);
    osc(ac, 'sine', f, t, end + 0.02, g);
  }

  function hit(tr, t, kind, vol) {
    const ac = tr.ac;
    if (kind === 'kick') {
      const g = env(ac, t, vol, 0.004, 0.0002, 0.2, t + 0.22);
      g.connect(tr.bus);
      const o = osc(ac, 'sine', 130, t, t + 0.24, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = noiseBuf(ac);
    const f = ac.createBiquadFilter();
    const len = kind === 'clap' ? 0.14 : kind === 'hat' ? 0.035 : 0.07;
    f.type = kind === 'clap' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'clap' ? 1500 : kind === 'hat' ? 7500 : 5200;
    const g = env(ac, t, vol, 0.003, vol * 0.3, len * 0.4, t + len);
    src.connect(f).connect(g).connect(tr.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
  }

  /* ---------------- a playing arrangement ---------------- */
  function makeTrack(ac, dest, name, startAt) {
    const arr = ARR[name];
    const bus = silentGain(ac);
    bus.gain.setValueAtTime(0.0001, startAt);
    bus.gain.exponentialRampToValueAtTime(1, startAt + 0.9);
    bus.connect(dest);
    // a gentle echo that the lead and sparkles feed into
    const echoIn = ac.createGain();
    echoIn.gain.value = arr.echo;
    const delay = ac.createDelay(2);
    delay.delayTime.value = (60 / arr.bpm) * 0.75;
    const fb = ac.createGain();
    fb.gain.value = 0.32;
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    echoIn.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(bus);
    return { ac, name, arr, bus, echoIn, nodes: [bus, echoIn, delay, fb, tone], step: 0, next: startAt, stepDur: 60 / arr.bpm / 2 };
  }

  function pitch(tr, midi) {
    let m = midi;
    if (tr.arr.mode === 'minor') {
      const pc = ((m % 12) + 12) % 12;
      if (TO_MINOR[pc] !== undefined) m += TO_MINOR[pc] - pc;
    }
    return m + tr.arr.key;
  }

  function chordTones(tr, degree) {
    const sc = SCALES[tr.arr.mode];
    const out = [];
    for (const k of [0, 2, 4]) {
      const i = degree + k;
      out.push(sc[i % 7] + 12 * Math.floor(i / 7));
    }
    return out; // semitones above the key's C
  }

  function playStep(tr, step, t0) {
    const a = tr.arr;
    const s = step % STEPS;
    const loop = Math.floor(step / STEPS);
    const bar = s >> 3;
    const sb = s & 7;
    const sd = tr.stepDur;
    const t = t0 + (sb & 1 ? a.swing * sd : 0);
    const chords = CHORDS[bar];
    const half = chords.length > 1 && sb >= 4 ? 1 : 0;
    const degree = chords[half];
    const tones = chordTones(tr, degree);
    const root = 36 + a.key + tones[0];
    const bassRoot = root < 38 ? root + 12 : root;
    const fifth = bassRoot + (tones[2] - tones[0]);
    const breather = loop % 3 === 2 && bar < 8; // every third time round, the lead rests for half the tune

    // lead
    const ev = EVENTS[s];
    if (ev && !breather) {
      const lift = loop % 3 === 1 && bar >= 8 && ev.midi < 84 ? 12 : 0; // second time round, the chorus jumps up an octave
      LEAD[a.lead](tr, t, hz(pitch(tr, ev.midi) + lift), ev.len * sd, a.leadVol * (lift ? 0.75 : 1));
    }

    // pad, once per chord
    if (sb === 0 || (chords.length > 1 && sb === 4)) {
      const len = chords.length > 1 ? 4 : 8;
      pad(tr, t0, tones.map((x) => hz(60 + a.key + x)), len * sd, a.pad);
    }

    // bass
    const bv = a.bass === 'eighths' ? 0.05 : 0.07;
    if (a.bass === 'bounce') {
      if (sb === 0 || sb === 4) bass(tr, t, hz(bassRoot), sd * 1.6, bv);
      if (sb === 3 || sb === 7) bass(tr, t, hz(sb === 3 ? fifth : bassRoot + 12), sd * 0.9, bv * 0.7);
    } else if (a.bass === 'long') {
      if (sb === 0) bass(tr, t, hz(bassRoot), sd * 3.8, bv);
      if (sb === 4) bass(tr, t, hz(fifth), sd * 3.8, bv * 0.8);
    } else if (a.bass === 'eighths') {
      bass(tr, t, hz(sb === 4 || sb === 6 ? bassRoot + 12 : bassRoot), sd * 0.85, bv);
    } else if (a.bass === 'soft') {
      if (sb === 0) bass(tr, t, hz(bassRoot), sd * 6, bv * 0.75);
    }

    // sparkle arpeggio
    const arpOn = a.arp === 'always' || (a.arp === 'loop' && (loop % 3 !== 0 || breather));
    if (arpOn) {
      const order = [0, 1, 2, 1];
      const x = tones[order[sb % 4]] + (sb >= 4 ? 12 : 0);
      arpNote(tr, t, hz(84 + a.key + x - (a.mode === 'minor' ? 12 : 0)), 0.016);
    }

    // drums
    if (a.drums === 'light') {
      if (sb === 0 || sb === 4) hit(tr, t, 'kick', 0.09);
      if (sb & 1) hit(tr, t, 'shaker', 0.022);
    } else if (a.drums === 'soft') {
      if (sb === 0) hit(tr, t, 'kick', 0.07);
      if (sb === 2 || sb === 6) hit(tr, t, 'shaker', 0.018);
    } else if (a.drums === 'drive') {
      if (sb === 0 || sb === 3 || sb === 4) hit(tr, t, 'kick', 0.11);
      if (sb === 2 || sb === 6) hit(tr, t, 'clap', 0.05);
      hit(tr, t, 'hat', sb & 1 ? 0.02 : 0.012);
    }
  }

  function scheduleTrack(tr, until) {
    while (tr.next < until) {
      playStep(tr, tr.step, tr.next);
      tr.step++;
      tr.next += tr.stepDur;
    }
  }

  function retire(tr, now) {
    tr.bus.gain.cancelScheduledValues(now);
    tr.bus.gain.setTargetAtTime(0.0001, now, 0.25);
    setTimeout(() => tr.nodes.forEach((n) => { try { n.disconnect(); } catch (e) { /* already gone */ } }), 2500);
  }

  /* ---------------- public controller ---------------- */
  const LOOKAHEAD = 0.18;
  let master = null;
  let cur = null;
  let enabled = FZ.store.get('music', true) !== false;
  let level = 1;

  FZ.music = {
    get on() { return enabled; },
    setOn(v) {
      enabled = !!v;
      FZ.store.set('music', enabled);
    },
    toggle() { this.setOn(!enabled); return enabled; },
    get playing() { return cur ? cur.name : null; },

    /** Call every frame with the track that fits the moment and how loud it should be (0..1). */
    update(want, duck) {
      const ac = FZ.sfx.ctx;
      if (!ac || ac.state !== 'running') return;
      if (!master) {
        master = ac.createGain();
        master.gain.value = 0;
        master.connect(ac.destination);
      }
      const now = ac.currentTime;
      const audible = enabled && !FZ.sfx.muted;
      const target = audible ? 1 * (duck === undefined ? 1 : duck) : 0;
      if (Math.abs(target - level) > 0.001) {
        master.gain.setTargetAtTime(Math.max(0.0001, target), now, 0.12);
        level = target;
      }
      if (!audible) {
        if (cur) { retire(cur, now); cur = null; }
        return;
      }
      if (!cur || cur.name !== want) {
        if (cur) retire(cur, now);
        cur = ARR[want] ? makeTrack(ac, master, want, now + 0.08) : null;
      }
      if (!cur) return;
      if (cur.next < now - 0.25) cur.next = now + 0.05; // the tab slept; pick the beat back up
      scheduleTrack(cur, now + LOOKAHEAD);
    },

    /** Renders a few seconds of a track offline (used by the tests to check levels). */
    async renderOffline(name, seconds, fromStep) {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const ac = new OAC(1, Math.floor(44100 * seconds), 44100);
      const g = ac.createGain();
      g.gain.value = 0.85;
      g.connect(ac.destination);
      const tr = makeTrack(ac, g, name, 0);
      tr.bus.gain.cancelScheduledValues(0);
      tr.bus.gain.setValueAtTime(1, 0);
      tr.step = fromStep || 0;
      scheduleTrack(tr, seconds);
      return ac.startRendering();
    },
    ARR,
  };
})(window.FZ);
