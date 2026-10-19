/* Electron scenes in perspective from behind and above the gun.
   Scene 5 ('electrons'): hits build up an interference pattern.
   Scene 6 ('which-path'): detectors at the slits record the path, the pattern becomes two bands. */
(function () {
  'use strict';

  const W = 1600, H = 900;

  // World layout: x to the right, y up (floor at 0), z along the beam
  const Z_GUN = 2.8;               // gun muzzle
  const Z_BAR = 6;                 // barrier plane
  const Z_SCR = 14;                // screen plane
  const BEAM_Y = 1.4;              // beam height
  const SCR_W = 12, SCR_H = 5.5;     // screen size, centered at x = 0, standing on the floor
  const BAR_W = 8, BAR_H = 2.6, BAR_T = 0.18;
  const SLIT_X = 0.55;             // slit centers at x = +-SLIT_X
  const SLIT_W = 0.16;
  const SLIT_Y0 = 0.45, SLIT_Y1 = 2.25;

  // Camera behind and above the gun, looking down the beam
  // Camera is shifted sideways without turning, so sides of objects show and screen rows stay horizontal
  const CAM = { x: -3.2, y: 9.5, z: -8 };
  const PITCH_TARGET = { y: 1.2, z: 11 };
  const FOCAL = 1250;
  let CX = W / 2, CY = 385;

  // Hit texture mapped onto the screen; fringes run vertically, pattern varies along x
  const TW = 960, TH = 480;
  const PERIOD = 78;               // fringe period in texture px
  const ENV = 4;                   // single-slit envelope first zero, in fringe periods
  const SEP_PX = 115;              // which-path mode: band centers at +-SEP_PX
  const SINGLE_PX = 165;           // which-path mode: single-slit band half width (first zero)
  const MAX_HITS = 14000;
  const SLOW_RATE = 5;             // below this rate each electron is shown in flight

  // Camera basis (no yaw): right = +x, forward and up tilted by the pitch
  const fwd = (function () {
    const dy = PITCH_TARGET.y - CAM.y, dz = PITCH_TARGET.z - CAM.z;
    const l = Math.hypot(dy, dz);
    return { x: 0, y: dy / l, z: dz / l };
  })();
  const up = { x: 0, y: fwd.z, z: -fwd.y };

  function project(x, y, z) {
    const dx = x - CAM.x, dy = y - CAM.y, dz = z - CAM.z;
    const zc = dx * fwd.x + dy * fwd.y + dz * fwd.z;
    const yc = dy * up.y + dz * up.z;
    const s = FOCAL / zc;
    return { x: CX + dx * s, y: CY - yc * s, s: s };
  }

  // Lens shift: put the screen center in the middle of the frame
  CX -= project(0, SCR_H / 2, Z_SCR).x - W / 2;

  // Two-slit pattern with single-slit envelope, dx measured from the center in texture px
  function intensity(dx) {
    const c = Math.cos(Math.PI * dx / PERIOD);
    const z = Math.PI * dx / (PERIOD * ENV);
    const s = z === 0 ? 1 : Math.sin(z) / z;
    return c * c * s * s;
  }

  // One slit open (path known): a single band behind that slit
  function single(dx) {
    const z = Math.PI * dx / SINGLE_PX;
    const s = z === 0 ? 1 : Math.sin(z) / z;
    return s * s;
  }

  // Path known: two bands, normalized to peak 1
  const BANDS_MAX = (function () {
    let m = 0;
    for (let dx = -TW / 2; dx <= TW / 2; dx++) m = Math.max(m, single(dx - SEP_PX) + single(dx + SEP_PX));
    return m;
  })();
  function bands(dx) {
    return (single(dx - SEP_PX) + single(dx + SEP_PX)) / BANDS_MAX;
  }

  // Rejection sampling of the hit position; slit is -1/+1 when the path is known, 0 otherwise
  function sampleHit(detectors) {
    if (!detectors) {
      for (;;) {
        const dx = (Math.random() * 2 - 1) * TW / 2;
        if (Math.random() < intensity(dx)) return { dx: dx, slit: 0 };
      }
    }
    const slit = Math.random() < 0.5 ? -1 : 1;
    for (;;) {
      const d = (Math.random() * 2 - 1) * TW / 2;
      if (Math.random() < single(d)) return { dx: slit * SEP_PX + d, slit: slit };
    }
  }

  // Texture px -> world point on the screen surface
  function texToWorld(tx, ty) {
    return {
      x: -SCR_W / 2 + SCR_W * tx / TW,
      y: SCR_H * (1 - ty / TH),
      z: Z_SCR - 0.01
    };
  }

  // opts: { captions, rates (per step), curveStep, detectors, lampsOffStep }
  function build(opts) {
    return function (canvas, captionEl) {
    const ctx = canvas.getContext('2d');
    const CAPTIONS = opts.captions;
    const RATES = opts.rates;

    const tex = document.createElement('canvas');
    tex.width = TW;
    tex.height = TH;
    const tctx = tex.getContext('2d');

    let step = 0;
    let count = 0;
    let acc = 0;
    let curveT0 = 0;
    let flights = [];   // electrons in flight (slow steps)
    let recent = [];    // fresh hits shown with a flash
    const lampT = { '-1': -1e9, '1': -1e9 };   // last time each detector fired
    const tally = { '-1': 0, '1': 0 };         // detector log: left / right counts

    // ---------- drawing helpers ----------

    function poly(pts, fill, stroke) {
      ctx.beginPath();
      pts.forEach(function (p, i) {
        const q = project(p[0], p[1], p[2]);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Axis-aligned box: draws only faces visible from the camera (sides, top, back face toward camera)
    function box(x0, x1, y0, y1, z0, z1, col) {
      const edge = col.edge || null;
      if (CAM.x < x0) poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], col.side, edge);
      if (CAM.x > x1) poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], col.side, edge);
      if (CAM.y > y1) poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], col.top, edge);
      poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], col.front, edge);
    }

    function drawFloor() {
      ctx.save();
      ctx.lineWidth = 1;
      for (let x = -9; x <= 9; x += 1) {
        const a = project(x, 0, -1.5), b = project(x, 0, Z_SCR + 2);
        ctx.strokeStyle = 'rgba(90, 110, 140, 0.18)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (let z = -1; z <= Z_SCR + 2; z += 1) {
        const a = project(-9, 0, z), b = project(9, 0, z);
        ctx.strokeStyle = 'rgba(90, 110, 140, 0.18)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    const SCREEN_COL = { front: '#05080d', top: '#3a4458', side: '#2a3242', edge: '#3a4458' };
    const BAR_COL = { front: '#7d879b', top: '#a9b3c6', side: '#5c6578', edge: 'rgba(0,0,0,0.35)' };
    const GUN_COL = { front: '#4a5468', top: '#6b778f', side: '#3a4252', edge: 'rgba(0,0,0,0.4)' };

    function drawScreen() {
      const hw = SCR_W / 2;
      box(-hw - 0.15, hw + 0.15, 0, SCR_H + 0.15, Z_SCR, Z_SCR + 0.25, SCREEN_COL);
      // Map the hit texture onto the screen row by row (rows stay horizontal: camera has no yaw)
      const ROW = 3;
      for (let j = 0; j < TH; j += ROW) {
        const a = texToWorld(0, j), b = texToWorld(0, j + ROW);
        const pl = project(-hw, a.y, Z_SCR);
        const pr = project(hw, a.y, Z_SCR);
        const pb = project(-hw, b.y, Z_SCR);
        ctx.drawImage(tex, 0, j, TW, ROW, pl.x, pl.y, pr.x - pl.x, pb.y - pl.y + 0.7);
      }
    }

    function drawBarrier() {
      const hw = BAR_W / 2;
      const z0 = Z_BAR, z1 = Z_BAR + BAR_T;
      const sl = SLIT_W / 2;
      // Draw outer blocks first so inner side faces overlap correctly
      box(-hw, -SLIT_X - sl, 0, BAR_H, z0, z1, BAR_COL);
      box(SLIT_X + sl, hw, 0, BAR_H, z0, z1, BAR_COL);
      box(-SLIT_X + sl, SLIT_X - sl, 0, BAR_H, z0, z1, BAR_COL);
      // Bridges below and above each slit
      [-SLIT_X, SLIT_X].forEach(function (cx) {
        box(cx - sl, cx + sl, 0, SLIT_Y0, z0, z1, BAR_COL);
        box(cx - sl, cx + sl, SLIT_Y1, BAR_H, z0, z1, BAR_COL);
      });
    }

    function drawGun() {
      // Far to near: nozzle, stand, body
      box(-0.15, 0.15, BEAM_Y - 0.15, BEAM_Y + 0.15, Z_GUN, Z_GUN + 0.35, GUN_COL);
      box(-0.15, 0.15, 0, BEAM_Y - 0.35, Z_GUN - 0.9, Z_GUN - 0.5, GUN_COL);
      box(-0.4, 0.4, BEAM_Y - 0.35, BEAM_Y + 0.35, Z_GUN - 1.6, Z_GUN, GUN_COL);
    }

    const SPLIT = 0.45;            // fraction of the flight spent before the barrier
    const RIPPLE_SPAN = Math.PI * 0.55;   // angular width of ripples behind each slit

    // Before the barrier: a fuzzy wave packet that spreads until it covers both slits
    function drawPackets(now) {
      ctx.save();
      for (const f of flights) {
        const p = (now - f.born) / (f.dur * SPLIT);
        if (p > 1) continue;
        const z = Z_GUN + 0.35 + (Z_BAR - Z_GUN - 0.4) * p;
        const q = project(0, BEAM_Y, z);
        const halfW = (0.12 + (SLIT_X + 0.35) * p * p) * q.s;   // grows to cover both slits
        const halfH = 0.16 * q.s;
        const a = p > 0.85 ? (1 - p) / 0.15 : 1;
        ctx.globalAlpha = a;
        ctx.translate(q.x, q.y);
        ctx.scale(halfW / halfH, 1);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfH);
        g.addColorStop(0, 'rgba(160, 255, 200, 0.95)');
        g.addColorStop(0.45, 'rgba(127, 255, 176, 0.55)');
        g.addColorStop(1, 'rgba(127, 255, 176, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, halfH, 0, Math.PI * 2);
        ctx.fill();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      ctx.restore();
    }

    // Behind the barrier: circular ripples spreading from both slits toward the screen
    function drawRipples(now) {
      ctx.save();
      ctx.lineWidth = 2.5;
      for (const f of flights) {
        const p = ((now - f.born) / f.dur - SPLIT) / (1 - SPLIT);
        if (p < 0 || p > 1) continue;
        const r = 0.15 + p * (Z_SCR - Z_BAR);
        const a = 0.6 * (1 - p * 0.7);
        ctx.strokeStyle = 'rgba(127, 255, 176,' + a.toFixed(3) + ')';
        const sources = f.slit ? [f.slit * SLIT_X] : [-SLIT_X, SLIT_X];
        sources.forEach(function (cx) {
          ctx.beginPath();
          for (let k = 0; k <= 40; k++) {
            const ang = (k / 40 - 0.5) * RIPPLE_SPAN;
            const x = cx + r * Math.sin(ang);
            const z = Z_BAR + BAR_T + r * Math.cos(ang);
            if (z > Z_SCR || Math.abs(x) > SCR_W / 2) continue;
            const q = project(x, BEAM_Y, z);
            if (k === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          }
          ctx.stroke();
        });
      }
      ctx.restore();
    }

    function drawRecent(now) {
      ctx.save();
      ctx.lineWidth = 3;
      for (const r of recent) {
        const a = 1 - (now - r.born) / 700;
        const w = texToWorld(r.tx, r.ty);
        const q = project(w.x, w.y, w.z);
        ctx.strokeStyle = 'rgba(127, 255, 176,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(q.x, q.y, (0.08 + (1 - a) * 0.3) * q.s, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function curvePath(fn, p) {
      ctx.beginPath();
      for (let tx = 0; tx <= TW; tx += 3) {
        const x = -SCR_W / 2 + SCR_W * tx / TW;
        const y = 0.1 + fn(tx - TW / 2) * SCR_H * 0.85 * p;
        const q = project(x, y, Z_SCR - 0.05);
        if (tx === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
    }

    function drawCurve(now) {
      const p = Math.min(1, (now - curveT0) / 1500);
      ctx.save();
      if (opts.detectors) {
        // Ghost of the interference curve for comparison
        curvePath(intensity, p);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';   // dark backing so the dashes read over dots
        ctx.lineWidth = 7;
        ctx.stroke();
        ctx.setLineDash([12, 9]);
        ctx.strokeStyle = '#8ec5ff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      curvePath(opts.detectors ? bands : intensity, p);
      ctx.strokeStyle = 'rgba(255, 213, 74, 0.95)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
    }

    // Detector boxes sitting on the barrier above each slit, with a lamp that flashes on detection
    const DET_COL = { front: '#3d4a63', top: '#56657f', side: '#2e3950', edge: 'rgba(0,0,0,0.45)' };
    function drawDetectors(now) {
      const lampsOn = !(opts.lampsOffStep && step >= opts.lampsOffStep);
      [-1, 1].forEach(function (side) {
        const cx = side * SLIT_X;
        box(cx - 0.24, cx + 0.24, BAR_H, BAR_H + 0.38, Z_BAR - 0.3, Z_BAR + BAR_T, DET_COL);
        const q = project(cx, BAR_H + 0.38, Z_BAR - 0.06);
        const r = 0.13 * q.s;
        const a = lampsOn ? Math.max(0, 1 - (now - lampT[side]) / 350) : 0;
        ctx.save();
        ctx.fillStyle = lampsOn ? '#4a2228' : '#262a33';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        if (a > 0) {
          ctx.globalAlpha = a;
          ctx.fillStyle = '#ff5a5a';
          ctx.shadowColor = '#ff3b3b';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, r * 1.2, r * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      const t = project(BAR_W / 2, BAR_H + 0.5, Z_BAR);
      const log = 'Л ' + tally['-1'] + '  ·  П ' + tally['1'];
      drawLabel(ctx, (lampsOn ? 'датчики: ' : 'журнал: ') + log, t.x, t.y, 'right', '#ffb3b3');
    }

    function drawLabels() {
      const g = project(-0.6, BEAM_Y, Z_GUN - 0.8);
      drawLabel(ctx, 'пушка', g.x, g.y, 'right');
      const b = project(-BAR_W / 2, BAR_H + 0.5, Z_BAR);
      drawLabel(ctx, 'две щели', b.x, b.y, 'left');
      const s = project(-SCR_W / 2, SCR_H + 0.55, Z_SCR);
      drawLabel(ctx, 'экран', s.x, s.y, 'left');
      if (count > 0) {
        const c = project(SCR_W / 2, SCR_H + 0.55, Z_SCR);
        drawLabel(ctx, 'электронов: ' + count, c.x, c.y, 'right', '#cfe9da');
      }
    }

    function draw(now) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      // Painter's order: far to near
      drawFloor();
      drawScreen();
      drawRecent(now);
      if (step >= opts.curveStep) drawCurve(now);
      drawRipples(now);
      drawBarrier();
      if (opts.detectors) drawDetectors(now);
      drawPackets(now);
      drawGun();
      drawLabels();
    }

    // ---------- simulation ----------

    function clearAll() {
      tctx.clearRect(0, 0, TW, TH);
      count = 0;
      acc = 0;
      flights = [];
      recent = [];
      tally['-1'] = tally['1'] = 0;
    }

    // Record which slit the detectors saw
    function detect(slit, now) {
      if (!slit) return;
      tally[slit]++;
      lampT[slit] = now;
    }

    function addHit(now, flash, hit) {
      const h = hit || sampleHit(opts.detectors);
      if (!hit) detect(h.slit, now);
      const tx = TW / 2 + h.dx;
      const ty = 10 + Math.random() * (TH - 20);
      tctx.fillStyle = 'rgba(205, 255, 228, 0.9)';
      tctx.beginPath();
      tctx.arc(tx, ty, 2.4, 0, Math.PI * 2);
      tctx.fill();
      count++;
      if (flash) recent.push({ tx: tx, ty: ty, born: now });
    }

    function prefill(total) {
      while (count < total) addHit(0, false);
    }

    function spawn(now) {
      if (count + flights.length >= MAX_HITS) return false;
      const rate = RATES[Math.min(step, RATES.length - 1)];
      if (rate < SLOW_RATE) {
        flights.push({ born: now, dur: 1300, hit: sampleHit(opts.detectors), passed: false });
      } else if (rate < 50) {
        flights.push({ born: now, dur: 600, hit: sampleHit(opts.detectors), passed: false });
      } else {
        addHit(now, false);
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
      if (RATES[Math.min(step, RATES.length - 1)] >= 50 && spawned > 0 && Math.random() < 0.7) {
        Sfx.click(0.06 + Math.random() * 0.1);
      }

      // Land electrons that finished their flight
      const still = [];
      for (const f of flights) {
        // Detector fires when the packet reaches the slits
        if (!f.passed && now - f.born >= f.dur * SPLIT) {
          f.passed = true;
          detect(f.hit.slit, now);
        }
        if (now - f.born >= f.dur) {
          addHit(now, true, f.hit);
          Sfx.click(f.dur > 1000 ? 0.7 : 0.35);
        } else {
          still.push(f);
        }
      }
      flights = still;
      recent = recent.filter(function (r) { return now - r.born < 700; });
    }

    const loop = makeLoop(function (dt, now) {
      update(dt, now);
      draw(now);
    });

    function setStep(s) {
      if (s === step) return;
      if (s === 0) clearAll();
      // Entering mid-sequence (e.g. navigating back): show an accumulated pattern
      if (step === 0 && s > 0 && RATES[Math.min(s, RATES.length - 1)] >= 50) prefill(10000);
      if (s >= opts.curveStep && step < opts.curveStep) curveT0 = performance.now();
      step = s;
      captionEl.textContent = CAPTIONS[Math.min(s, CAPTIONS.length - 1)];
    }

    captionEl.textContent = CAPTIONS[0];
    draw(performance.now());

    return { start: loop.start, stop: loop.stop, setStep: setStep };
    };
  }

  Scenes.register('electrons', build({
    captions: [
      'Стреляем электронами по одному',
      'Один электрон — одна точка',
      'Пока похоже на случайный разброс…',
      'Из хаоса проступают полосы',
      'Та же картина, что у волн: интерференция'
    ],
    rates: [0, 0.9, 12, 700, 700],
    curveStep: 4,
    detectors: false
  }));

  Scenes.register('which-path', build({
    captions: [
      'Ставим у каждой щели датчик: он замечает, где прошёл электрон',
      'Датчик всякий раз срабатывает только у одной щели',
      'Копим тысячи электронов…',
      'Полосы исчезли: просто две полосы, как от шариков',
      'Никто не смотрит, датчики только пишут в журнал — полос всё равно нет'
    ],
    rates: [0, 0.9, 700, 700, 700],
    curveStep: 3,
    detectors: true,
    lampsOffStep: 4
  }));
})();
