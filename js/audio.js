/* Tiny Web Audio helper: a short "detector click" sound */
const Sfx = (function () {
  'use strict';
  let ctx = null;
  let buf = null;       // short sharp click
  let shotBuf = null;   // longer, duller gunshot

  // Noise burst with an exponential decay baked in
  function noise(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
    return b;
  }

  // Browsers allow audio only after a user gesture; the clicker key press counts as one
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      buf = noise(0.025, 0.004);
      shotBuf = noise(0.12, 0.022);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function play(b, type, freq, vol) {
    if (!ctx || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol === undefined ? 0.5 : vol;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  function click(vol) {
    play(buf, 'highpass', 1500 + Math.random() * 1500, vol);
  }

  function shot(vol) {
    play(shotBuf, 'lowpass', 900 + Math.random() * 400, vol);
  }

  ['keydown', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, ensure, { capture: true });
  });
  ensure();   // works at once when the browser allows autoplay

  return { click: click, shot: shot, ensure: ensure };
})();
