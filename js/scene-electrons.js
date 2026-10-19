/* Scene 5: electrons one by one, seen in perspective from behind and above the gun.
   Hits accumulate on the screen into an interference pattern. */
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
  const MAX_HITS = 14000;
  const RATES = [0, 0.9, 12, 700, 700];   // electrons per second by step

  const CAPTIONS = [
    'Стреляем электронами по одному',
    'Один электрон — одна точка',
    'Пока похоже на случайный разброс…',
    'Из хаоса проступают полосы',
    'Та же картина, что у волн: интерференция'
  ];

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

  // Rejection sampling of the hit position across the screen
  function sampleDx() {
    for (;;) {
      const dx = (Math.random() * 2 - 1) * TW / 2;
      if (Math.random() < intensity(dx)) return dx;
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

  Scenes.register('electrons', function (canvas, captionEl) {
    const ctx = canvas.getContext('2d');

    const tex = document.createElement('canvas');
    tex.width = TW;
    tex.height = TH;
    const tctx = tex.getContext('2d');

    let step = 0;
    let count = 0;
    let acc = 0;
    let curveT0 = 0;
    let flights = [];   // electrons in flight (steps 1-2)
    let recent = [];    // fresh hits shown with a flash

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

    function drawFlights(now) {
      ctx.save();
      ctx.fillStyle = '#7fffb0';
      ctx.shadowColor = '#7fffb0';
      ctx.shadowBlur = 18;
      for (const f of flights) {
        // Visible only up to the slits: which way it went is unknown
        const p = (now - f.born) / (f.dur * 0.55);
        if (p > 1) continue;
        ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
        const q = project(0, BEAM_Y, Z_GUN + 0.35 + (Z_BAR - Z_GUN - 0.5) * p);
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(3, 0.12 * q.s), 0, Math.PI * 2);
        ctx.fill();
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

    function drawCurve(now) {
      const p = Math.min(1, (now - curveT0) / 1500);
      ctx.save();
      ctx.beginPath();
      for (let tx = 0; tx <= TW; tx += 3) {
        const x = -SCR_W / 2 + SCR_W * tx / TW;
        const y = 0.1 + intensity(tx - TW / 2) * SCR_H * 0.85 * p;
        const q = project(x, y, Z_SCR - 0.05);
        if (tx === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = 'rgba(255, 213, 74, 0.95)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();
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
      if (step >= 4) drawCurve(now);
      drawBarrier();
      drawFlights(now);
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
    }

    function addHit(now, flash) {
      const tx = TW / 2 + sampleDx();
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
      if (step <= 2) flights.push({ born: now, dur: step === 1 ? 800 : 360 });
      else addHit(now, false);
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
          addHit(now, true);
          Sfx.click(step === 1 ? 0.7 : 0.35);
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
      if (s >= 3 && step === 0) prefill(10000);
      if (s >= 4 && step < 4) curveT0 = performance.now();
      step = s;
      captionEl.textContent = CAPTIONS[Math.min(s, CAPTIONS.length - 1)];
    }

    captionEl.textContent = CAPTIONS[0];
    draw(performance.now());

    return { start: loop.start, stop: loop.stop, setStep: setStep };
  });
})();
