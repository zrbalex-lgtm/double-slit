/* Scene 5: electrons one by one, hits accumulate into an interference pattern */
(function () {
  'use strict';

  const W = 1600, H = 900;
  const YC = H / 2;
  const GUN_X = 170;          // gun muzzle x
  const BX = 430;             // barrier x
  const SCR_X = 720;          // side-view screen x
  const D = 120;              // slit separation (side view)
  const SLIT = 14;
  const PX = 800, PY = 70, PW = 760, PH = 760;   // front-view screen panel
  const PERIOD = 86;          // fringe period on the screen, px
  const ENV = 4;              // single-slit envelope first zero, in fringe periods
  const MAX_HITS = 12000;
  const RATES = [0, 0.9, 12, 650, 650];          // electrons per second by step

  const CAPTIONS = [
    'Стреляем электронами по одному',
    'Один электрон — одна точка',
    'Пока похоже на случайный разброс…',
    'Из хаоса проступают полосы',
    'Та же картина, что у волн: интерференция'
  ];

  // Two-slit pattern with single-slit envelope, dy measured from the center
  function intensity(dy) {
    const c = Math.cos(Math.PI * dy / PERIOD);
    const z = Math.PI * dy / (PERIOD * ENV);
    const s = z === 0 ? 1 : Math.sin(z) / z;
    return c * c * s * s;
  }

  // Rejection sampling of the hit position
  function sampleDy() {
    for (;;) {
      const dy = (Math.random() * 2 - 1) * PH / 2;
      if (Math.random() < intensity(dy)) return dy;
    }
  }

  Scenes.register('electrons', function (canvas, captionEl) {
    const ctx = canvas.getContext('2d');

    // Persistent layer with all hits
    const layer = document.createElement('canvas');
    layer.width = PW;
    layer.height = PH;
    const lctx = layer.getContext('2d');

    let step = 0;
    let count = 0;
    let acc = 0;
    let curveT0 = 0;
    let flights = [];   // electrons in flight (steps 1-2)
    let recent = [];    // fresh hits shown with a flash

    function clearAll() {
      lctx.clearRect(0, 0, PW, PH);
      count = 0;
      acc = 0;
      flights = [];
      recent = [];
    }

    function addHit(dy, now, flash) {
      const x = 6 + Math.random() * (PW - 12);
      const y = PH / 2 + dy;
      lctx.fillStyle = 'rgba(205, 255, 228, 0.85)';
      lctx.beginPath();
      lctx.arc(x, y, 2.3, 0, Math.PI * 2);
      lctx.fill();
      count++;
      if (flash) recent.push({ x: x, y: y, dy: dy, born: now });
    }

    function prefill(total) {
      while (count < total) addHit(sampleDy(), 0, false);
    }

    function spawn(now) {
      if (count + flights.length >= MAX_HITS) return false;
      if (step <= 2) {
        flights.push({ born: now, dur: step === 1 ? 700 : 320, dy: sampleDy() });
      } else {
        addHit(sampleDy(), now, false);
      }
      return true;
    }

    function update(dt, now) {
      acc += dt * RATES[Math.min(step, RATES.length - 1)];
      let spawned = 0;
      while (acc >= 1) {
        acc -= 1;
        if (spawn(now)) spawned++;
      }
      // Rustle of many clicks in fast mode
      if (step >= 3 && spawned > 0 && Math.random() < 0.7) Sfx.click(0.06 + Math.random() * 0.1);

      // Land electrons that finished their flight
      const still = [];
      for (const f of flights) {
        if (now - f.born >= f.dur) {
          addHit(f.dy, now, true);
          Sfx.click(step === 1 ? 0.7 : 0.35);
        } else {
          still.push(f);
        }
      }
      flights = still;
      recent = recent.filter(function (r) { return now - r.born < 700; });
    }

    function drawSetup() {
      // Gun
      ctx.fillStyle = '#3a4252';
      ctx.fillRect(60, YC - 32, GUN_X - 70, 64);
      ctx.fillRect(GUN_X - 12, YC - 12, 12, 24);
      drawLabel(ctx, 'пушка', 115, YC + 62);

      // Barrier with two slits
      ctx.fillStyle = '#8d97ab';
      const y1 = YC - D / 2, y2 = YC + D / 2;
      ctx.fillRect(BX - 5, PY, 10, y1 - SLIT / 2 - PY);
      ctx.fillRect(BX - 5, y1 + SLIT / 2, 10, y2 - y1 - SLIT);
      ctx.fillRect(BX - 5, y2 + SLIT / 2, 10, PY + PH - y2 - SLIT / 2);
      drawLabel(ctx, 'две щели', BX, 40);

      // Side-view screen
      ctx.fillStyle = '#2a3040';
      ctx.fillRect(SCR_X, PY, 10, PH);
      drawLabel(ctx, 'экран', SCR_X + 5, 40);

      // Connectors to the front-view panel
      ctx.save();
      ctx.strokeStyle = 'rgba(140, 155, 180, 0.45)';
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SCR_X + 10, PY);
      ctx.lineTo(PX, PY);
      ctx.moveTo(SCR_X + 10, PY + PH);
      ctx.lineTo(PX, PY + PH);
      ctx.stroke();
      ctx.restore();

      // Front-view panel
      ctx.fillStyle = '#05080d';
      ctx.fillRect(PX, PY, PW, PH);
      ctx.strokeStyle = '#2a3040';
      ctx.lineWidth = 2;
      ctx.strokeRect(PX, PY, PW, PH);
      drawLabel(ctx, 'экран — вид спереди', PX + PW / 2, 40);
    }

    function drawFlights(now) {
      ctx.save();
      ctx.fillStyle = '#7fffb0';
      ctx.shadowColor = '#7fffb0';
      ctx.shadowBlur = 16;
      for (const f of flights) {
        // Visible only up to the slits: which way it went is unknown
        const p = (now - f.born) / (f.dur * 0.55);
        if (p > 1) continue;
        ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
        ctx.beginPath();
        ctx.arc(GUN_X + (BX - 12 - GUN_X) * p, YC, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawRecent(now) {
      ctx.save();
      for (const r of recent) {
        const a = 1 - (now - r.born) / 700;
        ctx.strokeStyle = 'rgba(127, 255, 176,' + a.toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(PX + r.x, PY + r.y, 6 + (1 - a) * 18, 0, Math.PI * 2);
        ctx.stroke();
        // Matching flash on the side-view screen
        ctx.fillStyle = 'rgba(127, 255, 176,' + a.toFixed(3) + ')';
        ctx.fillRect(SCR_X - 4, YC + r.dy - 3, 18, 6);
      }
      ctx.restore();
    }

    function drawCurve(now) {
      const p = Math.min(1, (now - curveT0) / 1500);
      ctx.save();
      ctx.beginPath();
      for (let dy = -PH / 2; dy <= PH / 2; dy += 2) {
        const x = PX + 10 + intensity(dy) * PW * 0.55 * p;
        const y = YC + dy;
        if (dy === -PH / 2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(255, 213, 74, 0.95)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    function draw(now) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      drawSetup();
      ctx.drawImage(layer, PX, PY);
      drawFlights(now);
      drawRecent(now);
      if (step >= 4) drawCurve(now);
      if (count > 0) drawLabel(ctx, 'электронов: ' + count, PX + 16, PY + 30, 'left', '#cfe9da');
    }

    const loop = makeLoop(function (dt, now) {
      update(dt, now);
      draw(now);
    });

    function setStep(s) {
      if (s === step) return;
      if (s === 0) clearAll();
      // Entering mid-sequence (e.g. navigating back): show an accumulated pattern
      if (s >= 3 && step === 0) prefill(9000);
      if (s >= 4 && step < 4) curveT0 = performance.now();
      step = s;
      captionEl.textContent = CAPTIONS[Math.min(s, CAPTIONS.length - 1)];
    }

    captionEl.textContent = CAPTIONS[0];
    draw(performance.now());

    return { start: loop.start, stop: loop.stop, setStep: setStep };
  });
})();
