/* Particle scenes in perspective from behind and above the source, with a launch log on the right.
   'bullets'    : classical balls from a machine gun, two bands behind the slits
   'electrons'  : path unknown, interference fringes build up
   'which-path' : detectors at the slits record the path, two bands
   'twins'      : each photon becomes a twin pair at the slit; the twin reveals the path, two bands
   'delayed'    : same twins, but the twin flies much longer and is detected after its partner hits the screen
   'eraser'     : 50/50 mirrors send the twin to 'path known' (L, R) or 'path erased' (1, 2) detectors;
                  the screen shows two bands until hits are sorted by the twin's detector */
(function () {
  'use strict';

  const W = 1600, H = 900;

  // ---------- world layout: x to the right, y up (floor at 0), z along the beam ----------
  const Z_GUN = 2.8;               // source muzzle
  const Z_BAR = 6;                 // barrier plane
  const Z_SCR = 14;                // screen plane
  const BEAM_Y = 1.4;              // beam height
  const SCR_W = 12, SCR_H = 5.5;   // screen size, centered at x = 0, standing on the floor
  const BAR_W = 8, BAR_H = 2.6, BAR_T = 0.18;
  const SLIT_X = 0.55;             // slit centers at x = +-SLIT_X
  const SLIT_W = 0.16;
  const SLIT_Y0 = 0.45, SLIT_Y1 = 2.25;

  // Camera behind and above the source, shifted sideways without turning,
  // so object sides are visible and screen rows stay horizontal
  const CAM = { x: -3.2, y: 9.5, z: -8 };
  const PITCH_TARGET = { y: 1.2, z: 11 };
  const FOCAL = 1250;
  const FRAME_X = 690;             // screen center on the canvas (room for the log on the right)
  let CX = W / 2;
  const CY = 385;

  // ---------- hit texture: fringes run vertically, the pattern varies along x ----------
  const TW = 960, TH = 480;
  const PX_PER_UNIT = TW / SCR_W;
  const PERIOD = 78;               // interference fringe period, texture px
  const ENV = 4;                   // single-slit envelope first zero, in fringe periods
  const SEP_PX = 115;              // which-path: band centers
  const SINGLE_PX = 165;           // which-path: band half width (first zero)

  // Machine gun: straight lines from the barrel end through a slit to the screen
  const Z_MUZZLE = Z_GUN + 0.9;
  const K_PROJ = (Z_SCR - Z_MUZZLE) / (Z_BAR - Z_MUZZLE);
  const SPREAD = 0.3;              // random spread of bullets on the screen, world units
  const BULLET_Y0 = BEAM_Y + (0.35 - BEAM_Y) / K_PROJ;          // keep hits on the screen
  const BULLET_Y1 = Math.min(SLIT_Y1, BEAM_Y + (SCR_H - 0.35 - BEAM_Y) / K_PROJ);

  // Twin detectors (left of the barrier, on the source side); the delayed scene moves them far away
  const TWIN_DET_NEAR = {
    '-1': { x: -5.0, z: Z_BAR - 0.9 },
    '1': { x: -6.4, z: Z_BAR - 3.2 }
  };
  const TWIN_DET_FAR = {
    '-1': { x: -7.8, z: Z_BAR - 0.5 },
    '1': { x: -7.2, z: Z_BAR - 2.9 }
  };

  // Eraser: each twin hits a 50/50 mirror; reflected -> its own 'path known' detector,
  // transmitted -> a joining mirror that mixes both paths into detectors 1 and 2
  const ER_BS = { '-1': { x: -4.4, z: 5.4 }, '1': { x: -4.4, z: 3.5 } };
  const ER_JOIN = { x: -6.2, z: 4.45 };
  const ER_DET = {
    L: { x: -5.4, z: 6.4 },
    R: { x: -5.4, z: 2.5 },
    D1: { x: -7.6, z: 5.2 },
    D2: { x: -7.6, z: 3.7 }
  };
  const ER_COLOR = { L: '#c9d1de', R: '#c9d1de', D1: '#5aa9ff', D2: '#ff6b6b' };
  const ER_DOT = {
    L: 'rgba(175, 182, 195, 0.85)', R: 'rgba(175, 182, 195, 0.85)',
    D1: 'rgba(110, 175, 255, 0.95)', D2: 'rgba(255, 110, 110, 0.95)'
  };
  const ER_LABEL = { L: 'Л', R: 'П', D1: '1', D2: '2' };

  const SPLIT = 0.45;                    // fraction of a quantum flight spent before the barrier
  const RIPPLE_SPAN = Math.PI * 0.55;    // angular width of ripples behind each slit
  const LOG_ROWS = 15;

  // ---------- projection ----------
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
  CX -= project(0, SCR_H / 2, Z_SCR).x - FRAME_X;

  // ---------- distributions (dx in texture px from the screen center) ----------
  function sinc2(z) {
    if (Math.abs(z) < 1e-9) return 1;
    const s = Math.sin(z) / z;
    return s * s;
  }
  function fringes(dx) {
    const c = Math.cos(Math.PI * dx / PERIOD);
    return c * c * sinc2(Math.PI * dx / (PERIOD * ENV));
  }
  function bandWP(dx, slit) {
    return sinc2(Math.PI * (dx - slit * SEP_PX) / SINGLE_PX);
  }
  const BULLET_C = SLIT_X * K_PROJ * PX_PER_UNIT;
  const BULLET_S = Math.sqrt(Math.pow(SLIT_W * K_PROJ, 2) / 12 + SPREAD * SPREAD) * PX_PER_UNIT;
  function bandBullet(dx, slit) {
    const d = (dx - slit * BULLET_C) / BULLET_S;
    return Math.exp(-0.5 * d * d);
  }
  // Scale a curve so its peak is 1
  function normalized(f) {
    let m = 0;
    for (let dx = -TW / 2; dx <= TW / 2; dx++) m = Math.max(m, f(dx));
    return function (dx) { return f(dx) / m; };
  }
  const CURVES = {
    fringes: fringes,
    twoBands: normalized(function (d) { return bandWP(d, -1) + bandWP(d, 1); }),
    bullets: normalized(function (d) { return bandBullet(d, -1) + bandBullet(d, 1); })
  };

  function rejection(f) {
    for (;;) {
      const d = (Math.random() * 2 - 1) * TW / 2;
      if (Math.random() < f(d)) return d;
    }
  }
  function gauss() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }
  function randomTy() {
    return 10 + Math.random() * (TH - 20);
  }

  // Draw a hit: texture position, slit (-1/+1, or 0 when unknown), and the flight path for bullets
  function sampleHit(kind) {
    if (kind === 'electrons') {
      return { tx: TW / 2 + rejection(fringes), ty: randomTy(), slit: 0 };
    }
    const slit = Math.random() < 0.5 ? -1 : 1;
    if (kind === 'eraser') {
      // Half the twins keep the path (L/R): a band behind that slit
      if (Math.random() < 0.5) {
        return {
          tx: TW / 2 + rejection(function (d) { return bandWP(d, slit); }),
          ty: randomTy(), slit: slit, group: slit < 0 ? 'L' : 'R'
        };
      }
      // Path erased: same two-band envelope overall, split into fringes (1) and shifted fringes (2)
      const dx = rejection(CURVES.twoBands);
      const c = Math.cos(Math.PI * dx / PERIOD);
      return { tx: TW / 2 + dx, ty: randomTy(), slit: slit, group: Math.random() < c * c ? 'D1' : 'D2' };
    }
    // Path known (detectors or twins): a band behind the slit it went through
    if (kind === 'which-path' || kind === 'twins' || kind === 'delayed') {
      return { tx: TW / 2 + rejection(function (d) { return bandWP(d, slit); }), ty: randomTy(), slit: slit };
    }
    // bullets: straight line through a random point of the slit opening
    for (;;) {
      const xs = slit * SLIT_X + (Math.random() - 0.5) * SLIT_W;
      const ys = BULLET_Y0 + Math.random() * (BULLET_Y1 - BULLET_Y0);
      const x = xs * K_PROJ + gauss() * SPREAD;
      const y = BEAM_Y + (ys - BEAM_Y) * K_PROJ + gauss() * SPREAD * 0.5;
      if (Math.abs(x) > SCR_W / 2 - 0.1 || y < 0.1 || y > SCR_H - 0.1) continue;
      return {
        tx: (x / SCR_W + 0.5) * TW,
        ty: (1 - y / SCR_H) * TH,
        slit: slit,
        end: { x: x, y: y, z: Z_SCR }
      };
    }
  }

  // Texture px -> world point on the screen surface
  function texToWorld(tx, ty) {
    return { x: -SCR_W / 2 + tx / PX_PER_UNIT, y: SCR_H * (1 - ty / TH), z: Z_SCR - 0.01 };
  }

  // Per-kind look
  const LOOK = {
    bullets: { dot: 'rgba(205, 210, 220, 0.9)', glow: '#d9dee8', noun: 'шариков', slitHead: 'щель' },
    electrons: { dot: 'rgba(205, 255, 228, 0.9)', glow: '#7fffb0', noun: 'электронов', slitHead: 'щель' },
    'which-path': { dot: 'rgba(205, 255, 228, 0.9)', glow: '#7fffb0', noun: 'электронов', slitHead: 'щель' },
    twins: { dot: 'rgba(255, 228, 160, 0.9)', glow: '#ffd166', noun: 'фотонов', slitHead: 'близнец' }
  };
  LOOK.delayed = LOOK.twins;
  LOOK.eraser = Object.assign({}, LOOK.twins, { slitHead: 'детектор' });
  const TWIN_COLOR = '#ff7ab6';

  // opts: { kind, captions, rates, curveStep, maxHits, lampsOffStep }
  function build(opts) {
    return function (canvas, captionEl) {
      const ctx = canvas.getContext('2d');
      const kind = opts.kind;
      const look = LOOK[kind];
      const quantum = kind !== 'bullets';
      const eraser = kind === 'eraser';
      const twins = kind === 'twins' || kind === 'delayed' || eraser;
      const TWIN_DET = kind === 'delayed' ? TWIN_DET_FAR : TWIN_DET_NEAR;
      const TWIN_DELAY = opts.twinDelay || 1;   // twin flight time relative to its partner's

      const tex = document.createElement('canvas');
      tex.width = TW;
      tex.height = TH;
      const tctx = tex.getContext('2d');

      let step = 0;
      let count = 0;
      let acc = 0;
      let curveT0 = 0;
      let t0 = 0;                 // clock start for the log
      let flights = [];
      let pending = [];           // fast mode: twins still on their way {hit, at}
      let recent = [];            // fresh hits shown with a flash
      let log = [];               // newest first
      const lampT = { '-1': -1e9, '1': -1e9 };    // last time each detector fired
      const crystalT = { '-1': -1e9, '1': -1e9 }; // last time each crystal split a photon
      const tally = { '-1': 0, '1': 0 };
      const erTally = { L: 0, R: 0, D1: 0, D2: 0 };
      let hits = [];              // every hit, so the screen can be recolored by the twin's detector

      function rate() {
        return opts.rates[Math.min(step, opts.rates.length - 1)];
      }

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

      // Axis-aligned box: only faces visible from the camera (sides, top, face toward the camera)
      function box(x0, x1, y0, y1, z0, z1, col) {
        const edge = col.edge || null;
        if (CAM.x < x0) poly([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], col.side, edge);
        if (CAM.x > x1) poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], col.side, edge);
        if (CAM.y > y1) poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], col.top, edge);
        poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], col.front, edge);
      }

      function glowDot(x, y, z, radius, color, alpha) {
        const q = project(x, y, z);
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(2.5, radius * q.s), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Lamp on top of a detector box; flashes (red by default) for a moment after firing
      function lamp(x, y, z, firedAt, now, on, color) {
        const q = project(x, y, z);
        const r = 0.13 * q.s;
        const a = on ? Math.max(0, 1 - (now - firedAt) / 350) : 0;
        ctx.save();
        ctx.fillStyle = on ? '#4a2228' : '#262a33';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        if (a > 0) {
          ctx.globalAlpha = a;
          ctx.fillStyle = color || '#ff5a5a';
          ctx.shadowColor = color || '#ff3b3b';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.ellipse(q.x, q.y, r * 1.2, r * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const SCREEN_COL = { front: '#05080d', top: '#3a4458', side: '#2a3242', edge: '#3a4458' };
      const BAR_COL = { front: '#7d879b', top: '#a9b3c6', side: '#5c6578', edge: 'rgba(0,0,0,0.35)' };
      const GUN_COLS = {
        electron: { front: '#4a5468', top: '#6b778f', side: '#3a4252', edge: 'rgba(0,0,0,0.4)' },
        bullets: { front: '#3c4436', top: '#59624f', side: '#2d3329', edge: 'rgba(0,0,0,0.5)' },
        photon: { front: '#5e4140', top: '#7f5a57', side: '#47302f', edge: 'rgba(0,0,0,0.45)' }
      };
      const DET_COL = { front: '#3d4a63', top: '#56657f', side: '#2e3950', edge: 'rgba(0,0,0,0.45)' };
      const CRYSTAL_COL = {
        front: 'rgba(120, 220, 255, 0.28)', top: 'rgba(170, 235, 255, 0.4)',
        side: 'rgba(90, 180, 220, 0.3)', edge: 'rgba(160, 230, 255, 0.7)'
      };

      function drawFloor() {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(90, 110, 140, 0.18)';
        ctx.beginPath();
        for (let x = -9; x <= 9; x += 1) {
          const a = project(x, 0, -1.5), b = project(x, 0, Z_SCR + 2);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        for (let z = -1; z <= Z_SCR + 2; z += 1) {
          const a = project(-9, 0, z), b = project(9, 0, z);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      function drawScreen() {
        const hw = SCR_W / 2;
        box(-hw - 0.15, hw + 0.15, 0, SCR_H + 0.15, Z_SCR, Z_SCR + 0.25, SCREEN_COL);
        // Map the hit texture row by row (rows stay horizontal: the camera has no yaw)
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
        box(-hw, -SLIT_X - sl, 0, BAR_H, z0, z1, BAR_COL);
        box(SLIT_X + sl, hw, 0, BAR_H, z0, z1, BAR_COL);
        box(-SLIT_X + sl, SLIT_X - sl, 0, BAR_H, z0, z1, BAR_COL);
        [-SLIT_X, SLIT_X].forEach(function (cx) {
          box(cx - sl, cx + sl, 0, SLIT_Y0, z0, z1, BAR_COL);
          box(cx - sl, cx + sl, SLIT_Y1, BAR_H, z0, z1, BAR_COL);
        });
      }

      function drawGun() {
        if (kind === 'bullets') {
          const c = GUN_COLS.bullets;
          // Far to near: long barrel, magazine, stand, body
          box(-0.09, 0.09, BEAM_Y - 0.09, BEAM_Y + 0.09, Z_GUN, Z_MUZZLE, c);
          box(-0.12, 0.12, BEAM_Y - 0.75, BEAM_Y - 0.3, Z_GUN - 0.7, Z_GUN - 0.35, c);
          box(-0.15, 0.15, 0, BEAM_Y - 0.3, Z_GUN - 1.2, Z_GUN - 0.8, c);
          box(-0.32, 0.32, BEAM_Y - 0.3, BEAM_Y + 0.3, Z_GUN - 1.7, Z_GUN, c);
          return;
        }
        const c = twins ? GUN_COLS.photon : GUN_COLS.electron;
        box(-0.15, 0.15, BEAM_Y - 0.15, BEAM_Y + 0.15, Z_GUN, Z_GUN + 0.35, c);
        box(-0.15, 0.15, 0, BEAM_Y - 0.35, Z_GUN - 0.9, Z_GUN - 0.5, c);
        box(-0.4, 0.4, BEAM_Y - 0.35, BEAM_Y + 0.35, Z_GUN - 1.6, Z_GUN, c);
      }

      function drawWhichPathDetectors(now) {
        const on = !(opts.lampsOffStep && step >= opts.lampsOffStep);
        [-1, 1].forEach(function (side) {
          const cx = side * SLIT_X;
          box(cx - 0.24, cx + 0.24, BAR_H, BAR_H + 0.38, Z_BAR - 0.3, Z_BAR + BAR_T, DET_COL);
          lamp(cx, BAR_H + 0.38, Z_BAR - 0.06, lampT[side], now, on);
        });
      }

      function drawCrystals(now) {
        [-1, 1].forEach(function (side) {
          const cx = side * SLIT_X;
          box(cx - 0.2, cx + 0.2, BEAM_Y - 0.5, BEAM_Y + 0.5, Z_BAR - 0.32, Z_BAR - 0.02, CRYSTAL_COL);
          const a = Math.max(0, 1 - (now - crystalT[side]) / 300);
          if (a > 0) glowDot(cx, BEAM_Y, Z_BAR - 0.17, 0.25, '#bff0ff', a);
        });
      }

      function drawTwinDetectors(now) {
        // Dashed guides from each crystal to its twin detector
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 122, 182, 0.35)';
        [-1, 1].forEach(function (side) {
          const a = project(side * SLIT_X, BEAM_Y, Z_BAR - 0.17);
          const d = TWIN_DET[side];
          const b = project(d.x + 0.25, BEAM_Y, d.z);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
        ctx.restore();
        // Far detector (larger z) first
        [-1, 1].forEach(function (side) {
          const d = TWIN_DET[side];
          box(d.x - 0.08, d.x + 0.08, 0, BEAM_Y - 0.3, d.z - 0.08, d.z + 0.08, DET_COL);
          box(d.x - 0.3, d.x + 0.3, BEAM_Y - 0.3, BEAM_Y + 0.3, d.z - 0.3, d.z + 0.3, DET_COL);
          lamp(d.x, BEAM_Y + 0.3, d.z, lampT[side], now, true);
          const q = project(d.x, BEAM_Y + 0.85, d.z);
          drawLabel(ctx, side < 0 ? 'Л' : 'П', q.x, q.y, 'center', '#ffb3d6');
        });
      }

      // Before the barrier: a fuzzy wave packet that spreads until it covers both slits
      function drawPackets(now) {
        ctx.save();
        for (const f of flights) {
          const p = (now - f.born) / (f.dur * SPLIT);
          if (p > 1) continue;
          const z = Z_GUN + 0.35 + (Z_BAR - Z_GUN - 0.4) * p;
          const q = project(0, BEAM_Y, z);
          const halfW = (0.12 + (SLIT_X + 0.35) * p * p) * q.s;
          const halfH = 0.16 * q.s;
          ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
          ctx.translate(q.x, q.y);
          ctx.scale(halfW / halfH, 1);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, halfH);
          g.addColorStop(0, look.glow);
          g.addColorStop(0.45, look.glow + '8c');
          g.addColorStop(1, look.glow + '00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, halfH, 0, Math.PI * 2);
          ctx.fill();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        ctx.restore();
      }

      // Behind the barrier: ripples from both slits, or only from the known one
      function drawRipples(now) {
        ctx.save();
        ctx.lineWidth = 2.5;
        for (const f of flights) {
          const p = ((now - f.born) / f.dur - SPLIT) / (1 - SPLIT);
          if (p < 0 || p > 1) continue;
          const r = 0.15 + p * (Z_SCR - Z_BAR);
          ctx.globalAlpha = 0.6 * (1 - p * 0.7);
          ctx.strokeStyle = look.glow;
          const sources = f.hit.slit ? [f.hit.slit * SLIT_X] : [-SLIT_X, SLIT_X];
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

      // Eraser twin route: crystal -> 50/50 mirror -> own detector, or -> joining mirror -> detector 1/2
      function erRoute(hit) {
        const pts = [{ x: hit.slit * SLIT_X, z: Z_BAR - 0.17 }, ER_BS[hit.slit]];
        if (hit.group === 'D1' || hit.group === 'D2') pts.push(ER_JOIN);
        pts.push(ER_DET[hit.group]);
        return pts;
      }

      function alongRoute(pts, p) {
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        let d = p * total;
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
          if (d <= seg) {
            const k = d / seg;
            return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * k };
          }
          d -= seg;
        }
        return pts[pts.length - 1];
      }

      // Twin photon flying from its crystal to its detector
      function drawTwinPhotons(now) {
        for (const f of flights) {
          const p = ((now - f.born) / f.dur - SPLIT) / ((1 - SPLIT) * TWIN_DELAY);
          if (p < 0 || p > 1) continue;
          if (eraser) {
            const q = alongRoute(erRoute(f.hit), p);
            glowDot(q.x, BEAM_Y, q.z, 0.08, TWIN_COLOR);
            continue;
          }
          const d = TWIN_DET[f.hit.slit];
          const x0 = f.hit.slit * SLIT_X, z0 = Z_BAR - 0.17;
          glowDot(x0 + (d.x + 0.25 - x0) * p, BEAM_Y, z0 + (d.z - z0) * p, 0.08, TWIN_COLOR);
        }
      }

      // Bullets fly straight; the part beyond the barrier is drawn before it, the near part after
      function drawBullets(now, far) {
        for (const f of flights) {
          const u = (now - f.born) / f.dur;
          if (u < 0 || u > 1) continue;
          const e = f.hit.end;
          const z = Z_MUZZLE + (Z_SCR - Z_MUZZLE) * u;
          if ((z > Z_BAR) !== far) continue;
          const k = (z - Z_MUZZLE) / (Z_SCR - Z_MUZZLE);
          glowDot(e.x * k, BEAM_Y + (e.y - BEAM_Y) * k, z, 0.07, look.glow);
        }
      }

      function drawRecent(now) {
        ctx.save();
        ctx.lineWidth = 3;
        for (const r of recent) {
          const a = 1 - (now - r.born) / 700;
          const w = texToWorld(r.tx, r.ty);
          const q = project(w.x, w.y, w.z);
          ctx.globalAlpha = a;
          ctx.strokeStyle = look.glow;
          ctx.beginPath();
          ctx.arc(q.x, q.y, (0.08 + (1 - a) * 0.3) * q.s, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      function dashedRoute(pts, color) {
        ctx.save();
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();
        pts.forEach(function (pt, i) {
          const q = project(pt.x, BEAM_Y, pt.z);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Half-silvered mirror: a thin glass slab standing at 45 degrees
      function drawMirror(m) {
        const a = 0.3, y0 = BEAM_Y - 0.4, y1 = BEAM_Y + 0.4;
        poly([[m.x - a, y0, m.z - a], [m.x + a, y0, m.z + a], [m.x + a, y1, m.z + a], [m.x - a, y1, m.z - a]],
          'rgba(170, 220, 255, 0.35)', 'rgba(200, 235, 255, 0.85)');
      }

      function drawEraserDetector(g, now) {
        const d = ER_DET[g];
        box(d.x - 0.08, d.x + 0.08, 0, BEAM_Y - 0.3, d.z - 0.08, d.z + 0.08, DET_COL);
        box(d.x - 0.3, d.x + 0.3, BEAM_Y - 0.3, BEAM_Y + 0.3, d.z - 0.3, d.z + 0.3, DET_COL);
        lamp(d.x, BEAM_Y + 0.3, d.z, lampT[g] || -1e9, now, true, ER_COLOR[g]);
        const q = project(d.x, BEAM_Y + 0.85, d.z);
        drawLabel(ctx, ER_LABEL[g], q.x, q.y, 'center', ER_COLOR[g]);
      }

      function drawEraserOptics(now) {
        const guide = 'rgba(255, 122, 182, 0.35)';
        [-1, 1].forEach(function (side) {
          const c = { x: side * SLIT_X, z: Z_BAR - 0.17 };
          dashedRoute([c, ER_BS[side], ER_DET[side < 0 ? 'L' : 'R']], guide);
          dashedRoute([ER_BS[side], ER_JOIN], guide);
        });
        dashedRoute([ER_JOIN, ER_DET.D1], guide);
        dashedRoute([ER_JOIN, ER_DET.D2], guide);
        // Mirrors and detectors from far to near
        const items = [
          { z: ER_BS['-1'].z, draw: function () { drawMirror(ER_BS['-1']); } },
          { z: ER_BS['1'].z, draw: function () { drawMirror(ER_BS['1']); } },
          { z: ER_JOIN.z, draw: function () { drawMirror(ER_JOIN); } }
        ];
        Object.keys(ER_DET).forEach(function (g) {
          items.push({ z: ER_DET[g].z, draw: function () { drawEraserDetector(g, now); } });
        });
        items.sort(function (a, b) { return b.z - a.z; });
        items.forEach(function (it) { it.draw(); });
      }

      // Which hits are shown on the screen, and in what color, at the current step
      function dotStyle(hit) {
        if (!eraser || step < 3) return look.dot;
        const g = hit.group;
        const known = g === 'L' || g === 'R';
        if (step === 3) return ER_DOT[g];
        if (step === 4) return known ? ER_DOT[g] : null;
        if (step === 5) return g === 'D1' ? ER_DOT[g] : null;
        if (step === 6) return g === 'D2' ? ER_DOT[g] : null;
        return known ? null : ER_DOT[g];
      }

      function drawDot(hit) {
        const c = dotStyle(hit);
        if (!c) return;
        tctx.fillStyle = c;
        tctx.beginPath();
        tctx.arc(hit.tx, hit.ty, 2.4, 0, Math.PI * 2);
        tctx.fill();
      }

      function redrawTexture() {
        tctx.clearRect(0, 0, TW, TH);
        hits.forEach(drawDot);
      }

      // Eraser curves: envelope for known paths, fringes and shifted fringes for erased ones
      const blueFringe = function (dx) {
        const c = Math.cos(Math.PI * dx / PERIOD);
        return CURVES.twoBands(dx) * c * c;
      };
      const redFringe = function (dx) {
        const c = Math.sin(Math.PI * dx / PERIOD);
        return CURVES.twoBands(dx) * c * c;
      };

      function strokeCurve(fn, p, color, width) {
        curvePath(fn, p);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.lineWidth = width + 4;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      }

      function drawEraserCurves(now) {
        const p = Math.min(1, (now - curveT0) / 1500);
        ctx.save();
        if (step === 4) strokeCurve(CURVES.twoBands, p, ER_COLOR.L, 4);
        if (step === 5 || step >= 7) strokeCurve(blueFringe, p, ER_COLOR.D1, 4);
        if (step === 6 || step >= 7) strokeCurve(redFringe, p, ER_COLOR.D2, 4);
        if (step >= 7) strokeCurve(CURVES.twoBands, p, 'rgba(255, 213, 74, 0.95)', 4);
        ctx.restore();
      }

      function curvePath(fn, p) {
        ctx.beginPath();
        for (let tx = 0; tx <= TW; tx += 3) {
          const x = -SCR_W / 2 + tx / PX_PER_UNIT;
          const y = 0.1 + fn(tx - TW / 2) * SCR_H * 0.85 * p;
          const q = project(x, y, Z_SCR - 0.05);
          if (tx === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
      }

      function drawCurve(now) {
        const p = Math.min(1, (now - curveT0) / 1500);
        ctx.save();
        if (opts.ghost) {
          // Dashed interference curve for comparison, on a dark backing so it reads over dots
          curvePath(fringes, p);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.setLineDash([12, 9]);
          ctx.strokeStyle = '#8ec5ff';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.setLineDash([]);
        }
        curvePath(CURVES[opts.curve], p);
        ctx.strokeStyle = 'rgba(255, 213, 74, 0.95)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();
      }

      // ---------- launch log table ----------
      const LOG_X = 1100, LOG_Y = 56, LOG_W = 476, ROW_H = 29;
      const COLS = [
        { head: '№', x: 14 },
        { head: 'пуск, с', x: 72 },
        { head: 'удар, с', x: 160 },
        { head: 'x, мм', x: 248 },
        { head: 'y, мм', x: 320 },
        { head: look.slitHead, x: 392 }
      ];

      function slitText(row) {
        if (kind === 'electrons') return '?';
        if (eraser) return row.hit.twinSeen ? ER_LABEL[row.hit.group] : '…';
        if (twins && !row.hit.twinSeen) return '…';
        return row.hit.slit < 0 ? 'Л' : 'П';
      }

      function drawLog(now) {
        const hRows = LOG_ROWS * ROW_H;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 14, 22, 0.92)';
        ctx.strokeStyle = '#2a3242';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(LOG_X, LOG_Y, LOG_W, 108 + hRows, 12);
        ctx.fill();
        ctx.stroke();

        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e8eef8';
        ctx.font = '600 26px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillText('Журнал', LOG_X + 14, LOG_Y + 26);
        ctx.font = '500 21px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#cfe9da';
        ctx.fillText(look.noun + ': ' + count, LOG_X + LOG_W - 14, LOG_Y + 26);
        ctx.textAlign = 'left';
        if (eraser) {
          ctx.fillStyle = '#ffb3d6';
          ctx.fillText('близнецы:  Л ' + erTally.L + '  П ' + erTally.R + '   1: ' + erTally.D1 + '  2: ' + erTally.D2,
            LOG_X + 14, LOG_Y + 56);
        } else if (kind !== 'electrons') {
          ctx.fillStyle = twins ? '#ffb3d6' : '#ffb3b3';
          const who = twins ? 'близнецы' : (kind === 'bullets' ? 'через щель' : 'датчики');
          ctx.fillText(who + ':  Л ' + tally['-1'] + '   П ' + tally['1'], LOG_X + 14, LOG_Y + 56);
        } else {
          ctx.fillStyle = '#8a96ab';
          ctx.fillText('через какую щель — неизвестно', LOG_X + 14, LOG_Y + 56);
        }

        const hy = LOG_Y + 88;
        ctx.font = '600 17px "Segoe UI", Roboto, Arial, sans-serif';
        ctx.fillStyle = '#8a96ab';
        COLS.forEach(function (c) { ctx.fillText(c.head, LOG_X + c.x, hy); });
        ctx.strokeStyle = '#2a3242';
        ctx.beginPath();
        ctx.moveTo(LOG_X + 10, hy + 14);
        ctx.lineTo(LOG_X + LOG_W - 10, hy + 14);
        ctx.stroke();

        ctx.font = '18px Consolas, Menlo, "DejaVu Sans Mono", monospace';
        for (let i = 0; i < log.length; i++) {
          const r = log[i];
          const y = hy + 14 + ROW_H * (i + 0.5);
          const fresh = Math.max(0, 1 - (now - r.born) / 600);
          if (fresh > 0) {
            ctx.fillStyle = 'rgba(127, 255, 176,' + (0.18 * fresh).toFixed(3) + ')';
            ctx.fillRect(LOG_X + 6, y - ROW_H / 2 + 2, LOG_W - 12, ROW_H - 4);
          }
          ctx.fillStyle = i === 0 ? '#ffffff' : 'rgba(210, 220, 235,' + (1 - i / (LOG_ROWS + 4)).toFixed(3) + ')';
          const vals = [String(r.n), r.tL.toFixed(3), r.tH.toFixed(3), r.x.toFixed(1), r.y.toFixed(1)];
          vals.forEach(function (v, k) { ctx.fillText(v, LOG_X + COLS[k].x, y); });
          const st = slitText(r);
          ctx.fillStyle = st === '?' ? '#ffd54a' : (st === '…' ? '#8a96ab' :
            (eraser ? ER_COLOR[r.hit.group] : (twins ? '#ffb3d6' : '#ffb3b3')));
          ctx.fillText(st, LOG_X + COLS[5].x + 28, y);
        }
        ctx.restore();
      }

      function draw(now) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        // Painter's order: far to near
        drawFloor();
        drawScreen();
        drawRecent(now);
        if (eraser) {
          if (step >= 4) drawEraserCurves(now);
        } else if (step >= opts.curveStep) {
          drawCurve(now);
        }
        if (quantum) drawRipples(now);
        else drawBullets(now, true);
        drawBarrier();
        if (kind === 'which-path') drawWhichPathDetectors(now);
        if (twins) {
          drawCrystals(now);
          drawTwinPhotons(now);
          if (eraser) drawEraserOptics(now);
          else drawTwinDetectors(now);
        }
        if (quantum) drawPackets(now);
        else drawBullets(now, false);
        drawGun();
        drawLog(now);
      }

      // ---------- simulation ----------

      function clearAll() {
        tctx.clearRect(0, 0, TW, TH);
        count = 0;
        acc = 0;
        flights = [];
        pending = [];
        recent = [];
        log = [];
        hits = [];
        tally['-1'] = tally['1'] = 0;
        erTally.L = erTally.R = erTally.D1 = erTally.D2 = 0;
      }

      // Path information becomes known (detector, twin, or the bullet's own slit)
      function reveal(hit, now) {
        if (hit.revealed) return;
        if (hit.group) {
          hit.revealed = true;
          hit.twinSeen = true;
          erTally[hit.group]++;
          lampT[hit.group] = now;
          return;
        }
        if (!hit.slit) return;
        hit.revealed = true;
        hit.twinSeen = true;
        tally[hit.slit]++;
        lampT[hit.slit] = now;
      }

      function addHit(now, hit, flash, launchedAt) {
        hits.push(hit);
        drawDot(hit);
        count++;
        if (flash) recent.push({ tx: hit.tx, ty: hit.ty, born: now });
        const tH = (now - t0) / 1000;
        log.unshift({
          n: count,
          tL: launchedAt === undefined ? Math.max(0, tH - 0.6) : (launchedAt - t0) / 1000,
          tH: tH,
          x: (hit.tx / TW - 0.5) * SCR_W * 10,
          y: (1 - hit.ty / TH) * SCR_H * 10,
          hit: hit,
          born: now
        });
        if (log.length > LOG_ROWS) log.length = LOG_ROWS;
      }

      // Instant hit without a visible flight (fast mode and prefill)
      function instantHit(now, flash, noDelay) {
        const hit = sampleHit(kind);
        if (hit.slit) crystalT[hit.slit] = now;
        if (TWIN_DELAY > 1 && !noDelay) pending.push({ hit: hit, at: now + 300 + Math.random() * 700 });
        else reveal(hit, now);
        addHit(now, hit, flash);
      }

      function prefill(total) {
        const now = performance.now();
        while (count < total) instantHit(now, false, true);
      }

      function inFlight() {
        let n = 0;
        for (const f of flights) if (!f.landed) n++;
        return n;
      }

      function spawn(now) {
        if (count + inFlight() >= opts.maxHits) return false;
        const r = rate();
        if (!quantum) {
          flights.push({ born: now, dur: r < 5 ? 900 : 500, hit: sampleHit(kind), passed: false });
          if (r < 5) Sfx.shot(0.6);
        } else if (r < 50) {
          flights.push({ born: now, dur: r < 5 ? 1300 : 600, hit: sampleHit(kind), passed: false });
        } else {
          instantHit(now, false);
        }
        return true;
      }

      function update(dt, now) {
        acc += dt * rate();
        let spawned = 0;
        while (acc >= 1) {
          acc -= 1;
          if (spawn(now)) spawned++;
        }
        // Many hits per second: a rustle of quiet clicks instead of one per hit
        const busy = rate() >= 50 || (!quantum && rate() >= 5);
        if (busy && spawned > 0 && Math.random() < 0.7) {
          if (quantum) Sfx.click(0.06 + Math.random() * 0.1);
          else Sfx.shot(0.15 + Math.random() * 0.1);
        }

        const still = [];
        for (const f of flights) {
          // Reaching the slits: detectors fire, crystals split the photon, bullets pass a slit
          if (!f.passed && now - f.born >= f.dur * (quantum ? SPLIT : 0.25)) {
            f.passed = true;
            if (kind === 'which-path' || kind === 'bullets') reveal(f.hit, now);
            if (twins) crystalT[f.hit.slit] = now;
          }
          // The partner reaches the screen
          if (!f.landed && now - f.born >= f.dur) {
            f.landed = true;
            addHit(now, f.hit, rate() < 5, f.born);
            if (!busy) Sfx.click(quantum ? 0.7 : 0.3);
          }
          // The twin reaches its detector (later than the screen hit when delayed)
          const twinDone = !twins || now - f.born >= f.dur * (SPLIT + (1 - SPLIT) * TWIN_DELAY);
          if (twins && twinDone) reveal(f.hit, now);
          if (!(f.landed && twinDone)) still.push(f);
        }
        flights = still;
        pending = pending.filter(function (p) {
          if (now < p.at) return true;
          reveal(p.hit, now);
          return false;
        });
        recent = recent.filter(function (r) { return now - r.born < 700; });
      }

      const loop = makeLoop(function (dt, now) {
        update(dt, now);
        draw(now);
      });

      function setStep(s) {
        if (s === step) return;
        const now = performance.now();
        if (s === 0) clearAll();
        if (step === 0 && s > 0) t0 = now;
        // Entering mid-sequence (e.g. navigating back): show an accumulated pattern
        const fast = opts.rates[Math.min(s, opts.rates.length - 1)] >= 20 || (opts.prefillFrom && s >= opts.prefillFrom);
        if (step === 0 && s > 0 && fast) prefill(opts.maxHits);
        if (s >= opts.curveStep && step < opts.curveStep) curveT0 = now;
        if (eraser && s >= 4) curveT0 = now;
        step = s;
        if (eraser) redrawTexture();
        captionEl.textContent = opts.captions[Math.min(s, opts.captions.length - 1)];
      }

      captionEl.textContent = opts.captions[0];
      draw(performance.now());

      return { start: loop.start, stop: loop.stop, setStep: setStep };
    };
  }

  Scenes.register('bullets', build({
    kind: 'bullets',
    captions: [
      'Сначала обычный пулемёт: стреляем шариками по двум щелям',
      'Каждый шарик пролетает через одну щель',
      'Очередь!',
      'Ожидание: две полосы — напротив каждой щели'
    ],
    rates: [0, 1.5, 120, 120],
    curveStep: 3,
    curve: 'bullets',
    maxHits: 2500
  }));

  Scenes.register('electrons', build({
    kind: 'electrons',
    captions: [
      'Теперь электроны. Тоже по одному',
      'Один электрон — одна точка',
      'Пока похоже на случайный разброс…',
      'Из хаоса проступают полосы',
      'Та же картина, что у волн: интерференция'
    ],
    rates: [0, 0.9, 12, 700, 700],
    curveStep: 4,
    curve: 'fringes',
    maxHits: 6000
  }));

  Scenes.register('which-path', build({
    kind: 'which-path',
    captions: [
      'Ставим у каждой щели датчик: он замечает, где прошёл электрон',
      'Датчик всякий раз срабатывает только у одной щели',
      'Копим тысячи электронов…',
      'Полосы исчезли: две полосы, как от шариков',
      'Никто не смотрит, датчики только пишут в журнал — полос всё равно нет'
    ],
    rates: [0, 0.9, 700, 700, 700],
    curveStep: 3,
    curve: 'twoBands',
    ghost: true,
    lampsOffStep: 4,
    maxHits: 6000
  }));

  Scenes.register('eraser', build({
    kind: 'eraser',
    captions: [
      'Квантовый ластик: на пути близнецов — полупрозрачные зеркала',
      'Л и П — путь известен.  1 и 2 — путь стёрт',
      'На общем экране по-прежнему две полосы',
      'Раскрасим каждую точку по детектору её близнеца',
      'Серые — путь известен: полос нет',
      'Синие — путь стёрт (детектор 1): полосы!',
      'Красные — детектор 2: тоже полосы, но сдвинутые',
      'Синие + красные вместе — снова без полос'
    ],
    rates: [0, 0.6, 700, 0, 0, 0, 0, 0],
    prefillFrom: 2,
    curveStep: 99,
    twinDelay: 2.6,
    maxHits: 6000
  }));

  Scenes.register('delayed', build({
    kind: 'delayed',
    captions: [
      'Отложенный выбор: детекторы близнецов унесли далеко',
      'Фотон уже на экране, а его близнец ещё летит',
      'Щель становится известна позже удара…',
      '…но на экране всё равно две полосы'
    ],
    rates: [0, 0.6, 700, 700],
    curveStep: 3,
    curve: 'twoBands',
    ghost: true,
    twinDelay: 3.2,
    maxHits: 6000
  }));

  Scenes.register('twins', build({
    kind: 'twins',
    captions: [
      'У щелей кристаллы: фотон превращается в пару близнецов',
      'Один близнец летит на экран, второй — в детектор Л или П',
      'По второму близнецу всегда можно узнать щель…',
      '…и на экране две полосы: интерференции нет'
    ],
    rates: [0, 0.9, 700, 700],
    curveStep: 3,
    curve: 'twoBands',
    ghost: true,
    maxHits: 6000
  }));
})();
