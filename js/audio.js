/* Tiny Web Audio helper: a short "detector click" sound */
const Sfx = (function () {
  'use strict';
  let ctx = null;
  let buf = null;

  // Browsers allow audio only after a user gesture; the clicker key press counts as one
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      // 25 ms of noise with a sharp exponential decay baked in
      const len = Math.floor(ctx.sampleRate * 0.025);
      buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function click(vol) {
    if (!ctx || ctx.state !== 'running') return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1500 + Math.random() * 1500;
    const g = ctx.createGain();
    g.gain.value = vol === undefined ? 0.5 : vol;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  ['keydown', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, ensure, { capture: true });
  });

  return { click: click, ensure: ensure };
})();
