/* Scene registry: each canvas scene registers a factory under its data-scene name.
   A factory gets (canvas, captionEl) and returns { start(), stop(), setStep(n) }. */
const Scenes = {
  factories: {},
  register: function (name, factory) {
    this.factories[name] = factory;
  },
  create: function (name, canvas, captionEl) {
    const f = this.factories[name];
    if (!f) {
      console.warn('Unknown scene:', name);
      return null;
    }
    return f(canvas, captionEl);
  }
};

/* Shared helper: requestAnimationFrame loop with start/stop and dt in seconds */
function makeLoop(onFrame) {
  let raf = 0;
  let last = 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    onFrame(dt, now);
  }
  return {
    start: function () {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    stop: function () {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}

/* Shared helper: label text with a dark halo so it stays readable over animations */
function drawLabel(ctx, text, x, y, align, color) {
  ctx.save();
  ctx.font = '600 28px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color || '#a9b8cf';
  ctx.fillText(text, x, y);
  ctx.restore();
}
