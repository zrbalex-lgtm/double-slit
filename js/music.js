/* Ambient background music, generated live with Web Audio (no audio files needed).
   Slow pad chords through a filter and a long reverb, a soft sub drone, and rare bell sparkles.
   Starts on the first key press or click (browser rule). M toggles it; ?music=0 keeps it off. */
const Music = (function () {
  'use strict';

  const VOLUME = 0.16;
  const CHORD_LEN = 11;      // seconds per chord
  // A minor dreamy loop: Am9, Fmaj7, Cmaj7, G6 (frequencies in Hz)
  const N = function (semi) { return 440 * Math.pow(2, semi / 12); };
  const CHORDS = [
    [N(-24), N(-17), N(-14), N(-10), N(-9)],    // A2 E3 G3 B3 C4
    [N(-28), N(-21), N(-17), N(-12)],           // F2 C3 E3 A3
    [N(-21), N(-14), N(-10), N(-5)],            // C3 G3 B3 E4
    [N(-26), N(-19), N(-17), N(-10)]            // G2 D3 E3 B3
  ];
  const SPARKLE = [N(3), N(5), N(7), N(10), N(12), N(15), N(17), N(19)];   // C E... pentatonic-ish, octave 5-6

  let ctx = null, master = null, padBus = null, filter = null, wet = null, verbNode = null;
  let timer = null, nextChordAt = 0, chordI = 0, nextSparkle = 0;
  let on = new URLSearchParams(location.search).get('music') !== '0';
  let started = false;

  function impulse(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const verb = ctx.createConvolver();
    verb.buffer = impulse(5.5);
    wet = ctx.createGain();
    wet.gain.value = 0.75;
    verb.connect(wet).connect(master);
    const dry = ctx.createGain();
    dry.gain.value = 0.45;
    dry.connect(master);

    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.7;
    filter.connect(dry);
    filter.connect(verb);

    // Slow sweep of the filter: the pad "breathes"
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.035;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 550;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    padBus = ctx.createGain();
    padBus.gain.value = 0.22;
    padBus.connect(filter);

    // Sparkles go mostly into the reverb
    verbNode = verb;
    return true;
  }

  function padNote(freq, t0, len) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 3.5);
    g.gain.setValueAtTime(0.18, t0 + len - 1);
    g.gain.linearRampToValueAtTime(0, t0 + len + 3.5);
    g.connect(padBus);
    [[-7, 'sawtooth', 0.35], [7, 'triangle', 1]].forEach(function (v) {
      const o = ctx.createOscillator();
      o.type = v[1];
      o.frequency.value = freq;
      o.detune.value = v[0];
      const og = ctx.createGain();
      og.gain.value = v[2];
      o.connect(og).connect(g);
      o.start(t0);
      o.stop(t0 + len + 4);
    });
  }

  function drone(freq, t0, len) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq / 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.32, t0 + 4);
    g.gain.setValueAtTime(0.32, t0 + len - 1);
    g.gain.linearRampToValueAtTime(0, t0 + len + 4);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + len + 5);
  }

  function sparkle(t0) {
    const f = SPARKLE[Math.floor(Math.random() * SPARKLE.length)];
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3);
    o.connect(g);
    g.connect(verbNode);
    o.start(t0);
    o.stop(t0 + 3.1);
  }

  // Schedule a little ahead of time
  function tick() {
    const now = ctx.currentTime;
    while (nextChordAt < now + 2) {
      const chord = CHORDS[chordI % CHORDS.length];
      chord.forEach(function (f) { padNote(f, nextChordAt, CHORD_LEN); });
      drone(chord[0], nextChordAt, CHORD_LEN);
      nextChordAt += CHORD_LEN;
      chordI++;
    }
    while (nextSparkle < now + 2) {
      sparkle(nextSparkle);
      nextSparkle += 2.5 + Math.random() * 4;
    }
  }

  function fadeTo(v, seconds) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(v, t + seconds);
  }

  function start() {
    if (started) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    if (!build()) return;
    started = true;
    nextChordAt = ctx.currentTime + 0.1;
    nextSparkle = ctx.currentTime + 3;
    tick();
    timer = setInterval(tick, 500);
    fadeTo(on ? VOLUME : 0, 6);
  }

  function toggle() {
    if (!started) {
      on = true;
      start();
      return;
    }
    on = !on;
    fadeTo(on ? VOLUME : 0, 1.5);
  }

  function gesture(e) {
    if (e.key === 'm' || e.key === 'M') return;   // handled by toggle
    if (on) start();
  }
  ['keydown', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, gesture, { capture: true });
  });
  // Try to start right away; if the browser blocks autoplay, the context waits
  // (suspended) and the first key press or click resumes it
  if (on) start();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'm' || e.key === 'M') toggle();
  });

  return { start: start, toggle: toggle };
})();
