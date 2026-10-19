/* Scene 3: waves from two slits, constructive and destructive points, screen pattern */
(function () {
  'use strict';

  const W = 1600, H = 900;
  const BX = 520;            // barrier x
  const SX = 1430;           // screen left edge
  const SW = 16;             // screen thickness
  const YC = H / 2;
  const D = 160;             // slit separation, px
  const SLIT = 18;           // slit opening drawn in the barrier
  const LAM = 44;            // wavelength, px
  const C = 170;             // wave speed, px/s
  const CELL = 4;            // field grid cell, px
  const K = 2 * Math.PI / LAM;
  const OMEGA = K * C;
  const Y1 = YC - D / 2;
  const Y2 = YC + D / 2;
  const EDGE = 25;           // soft wavefront width, px

  const CAPTIONS = [
    'Волна света подходит к двум щелям',
    'Из каждой щели расходится своя волна',
    'На экране — чередование полос'
  ];

  // Wave amplitude falls off with distance from the slit
  function amp(r) {
    return 1 / Math.sqrt(1 + r / 60);
  }

  Scenes.register('waves', function (canvas, captionEl) {
    const ctx = canvas.getContext('2d');

    // Low-res field buffer, scaled up when drawn
    const gw = Math.ceil(SX / CELL);
    const gh = Math.ceil(H / CELL);
    const n = gw * gh;
    const off = document.createElement('canvas');
    off.width = gw;
    off.height = gh;
    const octx = off.getContext('2d');
    const img = octx.createImageData(gw, gh);
    const px = img.data;

    // Precompute per-cell geometry
    const X = new Float32Array(n);
    const R1 = new Float32Array(n);
    const R2 = new Float32Array(n);
    const A1 = new Float32Array(n);
    const A2 = new Float32Array(n);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const idx = j * gw + i;
        const x = (i + 0.5) * CELL;
        const y = (j + 0.5) * CELL;
        X[idx] = x;
        if (x > BX) {
          R1[idx] = Math.hypot(x - BX, y - Y1);
          R2[idx] = Math.hypot(x - BX, y - Y2);
          A1[idx] = amp(R1[idx]);
          A2[idx] = amp(R2[idx]);
        }
      }
    }

    // Time-averaged intensity on the screen
    const prof = new Float32Array(H);
    let pmax = 0;
    for (let y = 0; y < H; y++) {
      const r1 = Math.hypot(SX - BX, y - Y1);
      const r2 = Math.hypot(SX - BX, y - Y2);
      const a1 = amp(r1), a2 = amp(r2);
      prof[y] = a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(K * (r1 - r2));
      pmax = Math.max(pmax, prof[y]);
    }
    for (let y = 0; y < H; y++) prof[y] /= pmax;

    let step = 0;
    let t = 0;
    let patternT0 = 0;      // sim time when the pattern starts to fade in
    const T_ARRIVE = SX / C; // sim time when the wave reaches the screen

    function renderField() {
      const front = C * t;      // plane-wave front x
      const R = front - BX;     // radius reached past the barrier
      const ph = OMEGA * t;
      for (let idx = 0; idx < n; idx++) {
        const x = X[idx];
        let u = 0;
        let live = true;
        if (x < BX) {
          const e = front - x;
          if (e <= 0) live = false;
          else u = Math.sin(K * x - ph) * Math.min(1, e / EDGE);
        } else {
          let v = 0, norm = 0;
          const r1 = R1[idx], r2 = R2[idx];
          if (r1 < R) {
            v += A1[idx] * Math.min(1, (R - r1) / EDGE) * Math.sin(K * (BX + r1) - ph);
            norm += A1[idx];
          }
          if (r2 < R) {
            v += A2[idx] * Math.min(1, (R - r2) / EDGE) * Math.sin(K * (BX + r2) - ph);
            norm += A2[idx];
          }
          if (norm === 0) live = false;
          else u = v / norm;
        }
        const o = idx * 4;
        if (!live) {
          px[o] = 4; px[o + 1] = 7; px[o + 2] = 14;
        } else if (u >= 0) {
          // Crest: navy -> cyan -> white
          px[o] = 12 + 218 * u * u;
          px[o + 1] = 24 + 226 * u;
          px[o + 2] = 48 + 207 * u;
        } else {
          // Trough: navy -> black
          const q = 1 + u;
          px[o] = 12 * q;
          px[o + 1] = 24 * q;
          px[o + 2] = 48 * q;
        }
        px[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, gw, gh, 0, 0, gw * CELL, gh * CELL);
    }

    function drawPattern() {
      const p = Math.max(0, Math.min(1, (t - patternT0) / 1.5));
      for (let y = 0; y < H; y += 2) {
        ctx.fillStyle = 'rgba(215, 245, 255,' + (prof[y] * p).toFixed(3) + ')';
        ctx.fillRect(SX, y, SW, 2);
      }
      const x0 = SX + SW + 6;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      for (let y = 0; y < H; y += 2) ctx.lineTo(x0 + prof[y] * 130 * p, y);
      ctx.lineTo(x0, H);
      ctx.closePath();
      ctx.fillStyle = 'rgba(79, 195, 247, 0.25)';
      ctx.fill();
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    function drawSetup() {
      // Barrier with two slits
      ctx.fillStyle = '#8d97ab';
      const top1 = Y1 - SLIT / 2, bot1 = Y1 + SLIT / 2;
      const top2 = Y2 - SLIT / 2, bot2 = Y2 + SLIT / 2;
      ctx.fillRect(BX - 5, 0, 10, top1);
      ctx.fillRect(BX - 5, bot1, 10, top2 - bot1);
      ctx.fillRect(BX - 5, bot2, 10, H - bot2);
      // Screen
      ctx.fillStyle = '#2a3040';
      ctx.fillRect(SX, 0, SW, H);
      drawLabel(ctx, 'волна', 70, 40, 'left');
      drawLabel(ctx, 'две щели', BX, 40);
      drawLabel(ctx, 'экран', SX + SW / 2, 40);
    }

    function draw() {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      renderField();
      drawSetup();
      if (step >= 2) drawPattern();
    }

    const loop = makeLoop(function (dt) {
      if (step >= 1) t += dt;
      draw();
    });

    function setStep(s) {
      if (s === step) return;
      if (s === 0 || (s === 1 && step === 0)) t = 0;
      if (s >= 2 && step === 0) {
        // Entering mid-sequence (e.g. navigating back): fully developed field and pattern
        t = T_ARRIVE + 2;
        patternT0 = 0;
      } else if (s >= 2 && step < 2) {
        // Pattern fades in on click, but never before the wave reaches the screen
        patternT0 = Math.max(t, T_ARRIVE);
      }
      step = s;
      captionEl.textContent = CAPTIONS[Math.min(s, CAPTIONS.length - 1)];
    }

    captionEl.textContent = CAPTIONS[0];
    draw();

    return { start: loop.start, stop: loop.stop, setStep: setStep };
  });
})();
