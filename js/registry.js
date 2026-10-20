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
    // rAF timestamps can be slightly older than performance.now() at start: clamp to [0, 50 ms]
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
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

/* History plaque: when and where an experiment was first done. info = { year, place, who } */
function drawPlaque(ctx, info, x, y, alignRight) {
  if (!info) return;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = '800 34px "Segoe UI", Roboto, Arial, sans-serif';
  const w1 = ctx.measureText(info.year).width;
  ctx.font = '600 20px "Segoe UI", Roboto, Arial, sans-serif';
  const w2 = ctx.measureText(info.place).width;
  ctx.font = '400 18px "Segoe UI", Roboto, Arial, sans-serif';
  const w3 = ctx.measureText(info.who).width;
  const w = Math.max(w1, w2, w3) + 44, h = 108;
  if (alignRight) x -= w;
  ctx.fillStyle = 'rgba(8, 14, 26, 0.82)';
  ctx.strokeStyle = 'rgba(110, 190, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(x, y + 14, 4, h - 28);
  ctx.font = '800 34px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = '#e8f4ff';
  ctx.fillText(info.year, x + 22, y + 40);
  ctx.font = '600 20px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = '#9fd4ff';
  ctx.fillText(info.place, x + 22, y + 68);
  ctx.font = '400 18px "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = '#a9b4c8';
  ctx.fillText(info.who, x + 22, y + 93);
  ctx.restore();
}
