/* Waves from two slits and the screen pattern; on the last click the setup shrinks to the
   bottom-left and a side panel shows how two waves add up: crest + crest, crest + trough */
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
    'На экране — чередование полос',
    'Почему так: волны складываются'
  ];
  const SHRINK = 0.72;       // scale of the setup while the explanation is shown

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

    // Screen points for the explanation: central bright fringe and the first dark one
    const Y_BRIGHT = YC;
    let Y_DARK = YC;
    for (let y = YC; y < YC + 120; y++) if (prof[y] < prof[Y_DARK]) Y_DARK = y;

    let step = 0;
    let t = 0;
    let explainT0 = -1e9;     // real time of the explanation click
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
    }

    function ease(x) {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    }

    // One strip with a traveling sine wave; returns its displacement at the marker x
    function waveStrip(x, y, w, h, amp, phase, color, markerX) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = 0; i <= w; i += 2) {
        const v = amp * Math.sin(i / w * 4 * Math.PI * 2 / 2 - phase);
        if (i === 0) ctx.moveTo(x + i, y - v * h / 2);
        else ctx.lineTo(x + i, y - v * h / 2);
      }
      ctx.stroke();
      ctx.restore();
      const vm = amp * Math.sin((markerX - x) / w * 4 * Math.PI - phase);
      return vm;
    }

    function arrow(x, y0, y1, color) {
      if (Math.abs(y1 - y0) < 6) return;
      const dir = y1 < y0 ? -1 : 1;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1 - dir * 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x - 10, y1 - dir * 14);
      ctx.lineTo(x + 10, y1 - dir * 14);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function bigText(txt, x, y, size, color, align) {
      ctx.save();
      ctx.font = '700 ' + size + 'px "Segoe UI", Roboto, Arial, sans-serif';
      ctx.textAlign = align || 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(txt, x, y);
      ctx.fillStyle = color;
      ctx.fillText(txt, x, y);
      ctx.restore();
    }

    // One case of the explanation: wave 1 + wave 2 = result
    function drawCase(x, y, title, shift, resultLabel, glowColor, now) {
      const w = 270, h = 64, gap = 92;
      const phase = now / 1000 * 2.2;
      const mx = x + w * 0.375;   // marker sits on a crest of wave 1 at phase 0
      bigText(title, x + w / 2 + 30, y, 26, glowColor);
      const ya = y + 70, yb = ya + gap, yr = yb + gap + 18;
      const va = waveStrip(x, ya, w, h, 1, phase, '#a8c86a', mx);
      bigText('+', x - 34, (ya + yb) / 2, 40, '#ffffff');
      const vb = waveStrip(x, yb, w, h, 1, phase + shift, '#4fb3d9', mx);
      bigText('=', x - 34, (yb + yr) / 2 + 6, 40, '#ffffff');
      waveStrip(x, yr, w, h, shift === 0 ? 2 : 0, phase, '#ffffff', mx);
      // marker and arrows showing the displacement of each wave at the marker
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, ya - h / 2 - 10);
      ctx.lineTo(mx, yr + h + 6);
      ctx.stroke();
      ctx.restore();
      arrow(mx, ya, ya - va * h / 2, '#ffe14d');
      arrow(mx, yb, yb - vb * h / 2, '#ffe14d');
      arrow(mx, yr, yr - (va + vb) * h / 2, '#ffe14d');
      bigText(resultLabel, x + w + 22, yr, 34, glowColor, 'left');
    }

    function drawExplanation(e, now, k, oy) {
      ctx.save();
      ctx.globalAlpha = e;
      // Heading above the setup
      bigText('Как складываются две волны', 590, 110, 46, '#e8eef8');
      bigText('у экрана встречаются волны из левой и правой щели', 590, 168, 26, '#a9b8cf');
      // Panel
      const px = 1170, pw = 410;
      ctx.fillStyle = 'rgba(10, 16, 28, 0.85)';
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, 30, pw, 830, 16);
      ctx.fill();
      ctx.stroke();
      drawCase(px + 64, 75, 'светлая полоса', 0, '2', '#fff3a0', now);
      drawCase(px + 64, 485, 'тёмная полоса', Math.PI, '0', '#7f8da8', now);
      // Links from fringes on the screen to the two cases
      const sx = (SX + SW / 2) * k, sb = oy + Y_BRIGHT * k, sd = oy + Y_DARK * k;
      [[sb, 150, '#fff3a0'], [sd, 560, '#9aa8c4']].forEach(function (l) {
        ctx.save();
        ctx.strokeStyle = l[2];
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(sx + 10, l[0]);
        ctx.lineTo(px - 6, l[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowColor = l[2];
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(sx, l[0], 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();
    }

    function draw() {
      const now = performance.now();
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const e = step >= 3 ? ease((now - explainT0) / 900) : 0;
      const k = 1 - (1 - SHRINK) * e;
      const oy = H * (1 - k);    // anchored to the bottom-left corner
      ctx.save();
      ctx.translate(0, oy);
      ctx.scale(k, k);
      renderField();
      drawSetup();
      if (step >= 2) drawPattern();
      ctx.restore();
      if (e > 0) drawExplanation(e, now, k, oy);
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
      if (s >= 3 && step < 3) explainT0 = step === 0 ? -1e9 : performance.now();
      step = s;
      captionEl.textContent = CAPTIONS[Math.min(s, CAPTIONS.length - 1)];
    }

    captionEl.textContent = CAPTIONS[0];
    draw();

    return { start: loop.start, stop: loop.stop, setStep: setStep };
  });
})();
