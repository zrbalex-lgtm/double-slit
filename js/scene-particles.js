/* Particle scenes in perspective from behind and above the source, with a launch log on the right.
   'bullets'    : machine gun swinging on a tripod; most bullets hit the wall, the rest make two bands
   'beam'       : a dense stream of electrons: some hit the wall, the rest build fringes on the screen
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
  const FRAME_X = 600;             // screen center on the canvas (room for the log on the right)
  let CX = W / 2;
  const CY = 385;

  // ---------- hit texture: fringes run vertically, the pattern varies along x ----------
  const TW = 960, TH = 480;
  const PX_PER_UNIT = TW / SCR_W;
  const PERIOD = 78;               // interference fringe period, texture px
  const ENV = 4;                   // single-slit envelope first zero, in fringe periods
  const SEP_PX = 115;              // which-path: band centers
  const SINGLE_PX = 165;           // which-path: band half width (first zero)

  // Machine gun on a tripod: the gun swings left-right around a vertical axis behind the barrel.
  // Bullets fly along the barrel line through the pivot; most of them hit the wall.
  const GUN_PIVOT = { x: 0, z: 2.0 };
  const BARREL_L = 2.2;                                   // pivot to muzzle
  const YAW_AMP = Math.atan(1.05 / (Z_BAR - GUN_PIVOT.z)); // sweep reaches +-1.05 at the wall
  const YAW_SIGMA = 0.05;          // random scatter around the barrel direction, radians
  const PITCH_T0 = (0.6 - BEAM_Y) / (Z_SCR - GUN_PIVOT.z); // vertical scatter (tangent range)
  const PITCH_T1 = (4.3 - BEAM_Y) / (Z_SCR - GUN_PIVOT.z);

  function gauss() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  }

  // Random bullet direction around the current barrel yaw: Gaussian scatter, so the wall
  // gets a ragged cloud of holes instead of a neat rectangle
  const PITCH_MID = (PITCH_T0 + PITCH_T1) / 2;
  const PITCH_SIGMA = (PITCH_T1 - PITCH_T0) / 3.2;
  const PITCH_MAX = (BAR_H - 0.08 - BEAM_Y) / (Z_BAR - GUN_PIVOT.z);   // never over the wall
  function scatter(barrelYaw) {
    let tp;
    do { tp = PITCH_MID + gauss() * PITCH_SIGMA; } while (tp > PITCH_MAX || tp < PITCH_T0 - 0.05);
    // Occasional wild shot
    const wide = Math.random() < 0.12 ? 3 : 1;
    return { yaw: barrelYaw + gauss() * YAW_SIGMA * wide, tp: tp };
  }

  // Trajectory of one bullet for barrel yaw `yaw` (radians) and pitch tangent `tp`
  function bulletShot(yaw, tp) {
    const ty = Math.tan(yaw);
    const zm = GUN_PIVOT.z + BARREL_L * Math.cos(yaw);
    const at = function (z) {
      return { x: GUN_PIVOT.x + (z - GUN_PIVOT.z) * ty, y: BEAM_Y + (z - GUN_PIVOT.z) * tp, z: z };
    };
    const start = at(zm);
    const b = at(Z_BAR);
    let slit = 0;
    [-1, 1].forEach(function (sd) {
      if (Math.abs(b.x - sd * SLIT_X) < SLIT_W / 2 - 0.01 && b.y > SLIT_Y0 && b.y < SLIT_Y1) slit = sd;
    });
    if (!slit) return { start: start, end: b, wall: true, slit: 0 };
    const e = at(Z_SCR);
    return {
      start: start, end: e, wall: false, slit: slit,
      tx: (e.x / SCR_W + 0.5) * TW,
      ty: (1 - e.y / SCR_H) * TH
    };
  }

  // Twin detectors (left of the barrier, on the source side); the delayed scene moves them far away
  const TWIN_DET_NEAR = {
    '-1': { x: -4.6, z: Z_BAR - 0.9 },
    '1': { x: -5.6, z: Z_BAR - 3.2 }
  };
  const TWIN_DET_FAR = {
    '-1': { x: -6.6, z: Z_BAR - 0.4 },
    '1': { x: -6.4, z: Z_BAR - 2.8 }
  };

  // Eraser: each twin hits a 50/50 mirror; reflected -> its own 'path known' detector,
  // transmitted -> a joining mirror that mixes both paths into detectors 1 and 2
  const ER_BS = { '-1': { x: -4.2, z: 5.4 }, '1': { x: -4.2, z: 3.5 } };
  const ER_JOIN = { x: -5.6, z: 4.45 };
  const ER_DET = {
    L: { x: -5.0, z: 6.5 },
    R: { x: -5.0, z: 2.4 },
    D1: { x: -6.7, z: 5.25 },
    D2: { x: -6.7, z: 3.65 }
  };
  // Path colors: left slit green, right slit red; erased paths blue (1) and yellow (2)
  const SIDE_COLOR = { '-1': '#3ee07a', '1': '#ff4d4d' };
  const ER_COLOR = { L: SIDE_COLOR['-1'], R: SIDE_COLOR['1'], D1: '#4f9dff', D2: '#ffd23f' };
  const ER_DOT = {
    L: 'rgba(62, 224, 122, 0.85)', R: 'rgba(255, 77, 77, 0.85)',
    D1: 'rgba(90, 160, 255, 0.95)', D2: 'rgba(255, 215, 70, 0.95)'
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
  // Bullet pattern on the screen, measured by simulating many shots (then smoothed)
  const bulletProfile = (function () {
    const hist = new Float32Array(TW);
    for (let i = 0; i < 400000; i++) {
      const d = scatter((Math.random() * 2 - 1) * YAW_AMP);
      const h = bulletShot(d.yaw, d.tp);
      if (!h.wall) {
        const k = Math.round(h.tx);
        if (k >= 0 && k < TW) hist[k]++;
      }
    }
    const out = new Float32Array(TW);
    const R = 8;
    for (let k = 0; k < TW; k++) {
      let s = 0, w = 0;
      for (let j = -3 * R; j <= 3 * R; j++) {
        const g = Math.exp(-0.5 * (j / R) * (j / R));
        const m = k + j;
        if (m >= 0 && m < TW) s += hist[m] * g;
        w += g;
      }
      out[k] = s / w;
    }
    return out;
  })();
  function bulletCurve(dx) {
    const k = Math.round(dx + TW / 2);
    return k >= 0 && k < TW ? bulletProfile[k] : 0;
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
    bullets: normalized(bulletCurve)
  };

  function rejection(f) {
    for (;;) {
      const d = (Math.random() * 2 - 1) * TW / 2;
      if (Math.random() < f(d)) return d;
    }
  }
  function randomTy() {
    return 10 + Math.random() * (TH - 20);
  }

  // Where a flying electron meets the barrier; inside the slit zone it goes on, otherwise it hits the wall
  function aimAtBarrier(sigmaX, sigmaY) {
    const x = gauss() * sigmaX;
    const y = Math.max(0.25, Math.min(BAR_H - 0.12, BEAM_Y + gauss() * (sigmaY || 0.42)));
    const pass = Math.abs(x) < SLIT_X + 0.25 && y > SLIT_Y0 && y < SLIT_Y1;
    return { x: x, y: y, pass: pass };
  }

  // Draw a hit: texture position, slit (-1/+1, or 0 when unknown), and the flight path for bullets
  function sampleHit(kind) {
    if (kind === 'electrons' || kind === 'beam') {
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
    return null;
  }

  // Texture px -> world point on the screen surface
  function texToWorld(tx, ty) {
    return { x: -SCR_W / 2 + tx / PX_PER_UNIT, y: SCR_H * (1 - ty / TH), z: Z_SCR - 0.01 };
  }

  // Per-kind look
  const LOOK = {
    bullets: { dot: 'rgba(205, 210, 220, 0.9)', glow: '#ffd27a', noun: 'выстрелов', slitHead: 'куда' },
    beam: { dot: 'rgba(205, 255, 228, 0.9)', glow: '#7fffb0', noun: '', slitHead: '' },
    electrons: { dot: 'rgba(205, 255, 228, 0.9)', glow: '#7fffb0', noun: 'электронов', slitHead: 'щель' },
    'which-path': { dot: 'rgba(205, 255, 228, 0.9)', glow: '#7fffb0', noun: 'электронов', slitHead: 'щель' },
    twins: { dot: 'rgba(255, 228, 160, 0.9)', glow: '#ffd166', noun: 'фотонов', slitHead: 'близнец' }
  };
  LOOK.delayed = LOOK.twins;
  LOOK.eraser = Object.assign({}, LOOK.twins, { slitHead: 'дет.' });
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
      const beam = kind === 'beam';
      const particleKind = kind === 'electrons' || kind === 'which-path';   // electrons fly as particles
      const shiftX = opts.noLog ? W / 2 - FRAME_X : 0;   // center the setup when there is no log
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

      // Machine gun state
      let gunPhase = 0;           // sweep phase, turns
      let gunYaw = 0;
      let flashT = -1e9;          // last muzzle flash
      let shots = 0;
      let wallCount = 0;
      let sparks = [];            // fresh wall impacts
      const WTW = 640, WTH = 208; // wall texture (bullet marks), maps onto the barrier front
      const wallTex = document.createElement('canvas');
      wallTex.width = WTW;
      wallTex.height = WTH;
      const wctx = wallTex.getContext('2d');


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

      // Box in gun-local coordinates rotated by `yaw` around a vertical axis through `pv`.
      // Local +z points along the barrel, +x to the gun's right, y is world height.
      function rbox(lx0, lx1, y0, y1, lz0, lz1, col, yaw, pv) {
        const c = Math.cos(yaw), sn = Math.sin(yaw);
        const W3 = function (lx, y, lz) { return [pv.x + lx * c + lz * sn, y, pv.z - lx * sn + lz * c]; };
        const faces = [
          { n: [c, 0, -sn], pts: [W3(lx1, y0, lz0), W3(lx1, y1, lz0), W3(lx1, y1, lz1), W3(lx1, y0, lz1)], f: col.side },
          { n: [-c, 0, sn], pts: [W3(lx0, y0, lz0), W3(lx0, y1, lz0), W3(lx0, y1, lz1), W3(lx0, y0, lz1)], f: col.side },
          { n: [0, 1, 0], pts: [W3(lx0, y1, lz0), W3(lx1, y1, lz0), W3(lx1, y1, lz1), W3(lx0, y1, lz1)], f: col.top },
          { n: [sn, 0, c], pts: [W3(lx0, y0, lz1), W3(lx1, y0, lz1), W3(lx1, y1, lz1), W3(lx0, y1, lz1)], f: col.front },
          { n: [-sn, 0, -c], pts: [W3(lx0, y0, lz0), W3(lx1, y0, lz0), W3(lx1, y1, lz0), W3(lx0, y1, lz0)], f: col.front }
        ];
        faces.forEach(function (fc) {
          let cx = 0, cy = 0, cz = 0;
          fc.pts.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; cz += p[2] / 4; });
          const v = fc.n[0] * (CAM.x - cx) + fc.n[1] * (CAM.y - cy) + fc.n[2] * (CAM.z - cz);
          if (v > 0) poly(fc.pts, fc.f, col.edge || null);
        });
      }

      const MG = {
        metal: { front: '#3a3f47', top: '#5d6470', side: '#2b2f35', edge: 'rgba(0,0,0,0.55)' },
        jacket: { front: '#474d57', top: '#6c7480', side: '#353a42', edge: 'rgba(0,0,0,0.55)' },
        ring: { front: '#2a2e34', top: '#4a505a', side: '#22262b', edge: 'rgba(0,0,0,0.6)' },
        ammo: { front: '#4b5233', top: '#69724a', side: '#3a4027', edge: 'rgba(0,0,0,0.5)' },
        wood: { front: '#5a3f2a', top: '#7a573b', side: '#47311f', edge: 'rgba(0,0,0,0.5)' }
      };

      function drawMachineGun(now) {
        const pv = GUN_PIVOT;
        const head = BEAM_Y - 0.28;
        // Tripod legs (static)
        ctx.save();
        ctx.strokeStyle = '#2b2f35';
        ctx.lineCap = 'round';
        [[-1.0, -0.7], [1.0, -0.7], [0, 1.0]].forEach(function (f) {
          const a = project(pv.x, head, pv.z);
          const b = project(pv.x + f[0], 0, pv.z + f[1]);
          ctx.lineWidth = Math.max(4, 0.09 * (a.s + b.s) / 2);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
        ctx.restore();
        box(pv.x - 0.12, pv.x + 0.12, head - 0.1, head + 0.08, pv.z - 0.12, pv.z + 0.12, MG.metal);

        // Rotating parts, painted far to near
        const yaw = gunYaw, y = BEAM_Y;
        const parts = [
          { lz: 1.95, d: function () { rbox(-0.05, 0.05, y - 0.05, y + 0.05, 1.7, BARREL_L, MG.metal, yaw, pv); } },
          { lz: 1.05, d: function () { rbox(-0.13, 0.13, y - 0.13, y + 0.13, 0.35, 1.72, MG.jacket, yaw, pv); } },
          { lz: 1.62, d: function () { rbox(-0.11, 0.11, y + 0.13, y + 0.24, 1.6, 1.66, MG.metal, yaw, pv); } },
          { lz: 0.5, d: function () { rbox(-0.15, 0.15, y - 0.15, y + 0.15, 0.48, 0.56, MG.ring, yaw, pv); } },
          { lz: 1.1, d: function () { rbox(-0.15, 0.15, y - 0.15, y + 0.15, 1.08, 1.16, MG.ring, yaw, pv); } },
          { lz: 1.6, d: function () { rbox(-0.15, 0.15, y - 0.15, y + 0.15, 1.52, 1.6, MG.ring, yaw, pv); } },
          { lz: -0.25, d: function () { rbox(-0.22, 0.22, y - 0.22, y + 0.2, -0.9, 0.38, MG.metal, yaw, pv); } },
          { lz: 0.12, d: function () { rbox(-0.05, 0.05, y + 0.2, y + 0.32, 0.08, 0.18, MG.metal, yaw, pv); } },
          { lz: -0.15, d: function () { rbox(-0.6, -0.24, y - 0.38, y + 0.02, -0.45, 0.15, MG.ammo, yaw, pv); } },
          { lz: -1.0, d: function () { rbox(-0.2, -0.12, y - 0.18, y + 0.06, -1.15, -0.9, MG.wood, yaw, pv); } },
          { lz: -1.0, d: function () { rbox(0.12, 0.2, y - 0.18, y + 0.06, -1.15, -0.9, MG.wood, yaw, pv); } }
        ];
        parts.sort(function (a, b) { return b.lz - a.lz; });
        parts.forEach(function (p) { p.d(); });

        // Muzzle flash
        const a = Math.max(0, 1 - (now - flashT) / 70);
        if (a > 0) {
          const m = { x: pv.x + (BARREL_L + 0.1) * Math.sin(yaw), z: pv.z + (BARREL_L + 0.1) * Math.cos(yaw) };
          const q = project(m.x, y, m.z);
          ctx.save();
          ctx.globalAlpha = a;
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.45 * q.s);
          g.addColorStop(0, 'rgba(255, 250, 210, 1)');
          g.addColorStop(0.35, 'rgba(255, 190, 80, 0.85)');
          g.addColorStop(1, 'rgba(255, 120, 30, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 0.45 * q.s, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Bullet marks on the wall, mapped onto the barrier front face row by row
      function drawWallMarks() {
        const hw = BAR_W / 2, ROW = 2;
        for (let j = 0; j < WTH; j += ROW) {
          const ya = BAR_H * (1 - j / WTH), yb = BAR_H * (1 - (j + ROW) / WTH);
          const pl = project(-hw, ya, Z_BAR - 0.005);
          const pr = project(hw, ya, Z_BAR - 0.005);
          const pb = project(-hw, yb, Z_BAR - 0.005);
          ctx.drawImage(wallTex, 0, j, WTW, ROW, pl.x, pl.y, pr.x - pl.x, pb.y - pl.y + 0.7);
        }
      }

      function drawSparks(now) {
        ctx.save();
        for (const sp of sparks) {
          const a = 1 - (now - sp.born) / 260;
          const q = project(sp.x, sp.y, Z_BAR - 0.02);
          ctx.globalAlpha = Math.max(0, a);
          ctx.fillStyle = sp.c || '#ffd27a';
          ctx.beginPath();
          ctx.arc(q.x, q.y, (0.04 + (1 - a) * 0.12) * q.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
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

      // Lamp on top of a detector box: dim glass of its own color, flashes after firing;
      // `steady` (0..1) keeps it lit, used to highlight a detector
      function lamp(x, y, z, firedAt, now, on, color, steady) {
        color = color || '#ff5a5a';
        const q = project(x, y, z);
        const r = 0.13 * q.s;
        const a = on ? Math.max(steady || 0, 1 - (now - firedAt) / 350) : 0;
        ctx.save();
        ctx.fillStyle = '#1c2027';
        ctx.beginPath();
        ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        if (on) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = color;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (a > 0) {
          ctx.globalAlpha = a;
          ctx.fillStyle = color;
          ctx.shadowColor = color;
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

      // ---------- backdrop: a dim server-room aisle with a lit floor ----------
      // Static parts are rendered once into a cache; only rack LEDs are animated.
      const RACK_ROWS = [
        { x0: -13.2, x1: -11.8 },   // left row, aisle face at x1
        { x0: 10.6, x1: 12.0 }      // right row, aisle face at x0
      ];
      const RACK_Z0 = -2, RACK_LEN = 1.3, RACK_N = 15, RACK_H = 5.2;
      const RACK_COL = { front: '#0b1018', top: '#141b27', side: '#0e1520', edge: 'rgba(60, 90, 130, 0.35)' };
      const leds = [];
      for (let r = 0; r < RACK_ROWS.length; r++) {
        const row = RACK_ROWS[r];
        const fx = r === 0 ? row.x1 + 0.01 : row.x0 - 0.01;
        for (let k = 0; k < RACK_N; k++) {
          const z0 = RACK_Z0 + k * RACK_LEN;
          for (let u = 0; u < 14; u++) {
            if (Math.random() < 0.35) continue;
            leds.push({
              x: fx, y: 0.5 + u * 0.32, z: z0 + 0.2 + Math.random() * (RACK_LEN - 0.4),
              c: Math.random() < 0.7 ? '90, 200, 255' : (Math.random() < 0.6 ? '80, 255, 160' : '255, 180, 70'),
              f: 0.3 + Math.random() * 2.5, ph: Math.random() * 6.28
            });
          }
        }
      }

      function floorPool(x, z, rx, color, a) {
        const q = project(x, 0, z);
        const r = rx * q.s;
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.scale(1, 0.42);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, 'rgba(' + color + ',' + a + ')');
        g.addColorStop(1, 'rgba(' + color + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawBackdropStatic() {
        // Back wall with soft vertical light strips
        poly([[-45, 0, 19], [45, 0, 19], [45, 30, 19], [-45, 30, 19]], '#070b13', null);
        // Side walls behind the rack rows, so no empty sky shows above them
        poly([[-13.3, 0, -6], [-13.3, 0, 19], [-13.3, 30, 19], [-13.3, 30, -6]], '#060a12', null);
        poly([[12.1, 0, -6], [12.1, 0, 19], [12.1, 30, 19], [12.1, 30, -6]], '#060a12', null);
        for (let x = -18.9; x <= 18; x += 2.3) {
          const a = project(x, 0.3, 18.98), b = project(x, 14, 18.98);
          const g = ctx.createLinearGradient(0, a.y, 0, b.y);
          g.addColorStop(0, 'rgba(80, 160, 255, 0.0)');
          g.addColorStop(0.5, 'rgba(80, 160, 255, 0.22)');
          g.addColorStop(1, 'rgba(80, 160, 255, 0.0)');
          ctx.fillStyle = g;
          ctx.fillRect(a.x - 2, b.y, 4, a.y - b.y);
        }
        // Floor
        poly([[-22, 0, -4], [20, 0, -4], [20, 0, 19], [-22, 0, 19]], '#05080f', null);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        floorPool(0, 13.5, 10, '60, 150, 255', 0.16);
        floorPool(0, 6, 7, '60, 150, 255', 0.12);
        floorPool(0, 1.5, 5, '90, 120, 255', 0.08);
        floorPool(-12.4, 6, 4, '60, 200, 255', 0.06);
        ctx.restore();
        // Grid: brighter near the middle of the room
        ctx.save();
        ctx.lineWidth = 1;
        for (let x = -11; x <= 10; x += 1) {
          const a = project(x, 0, -3), b = project(x, 0, 18.5);
          ctx.strokeStyle = 'rgba(100, 150, 210,' + (0.28 - Math.abs(x) * 0.016).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        for (let z = -3; z <= 18; z += 1) {
          const a = project(-11.8, 0, z), b = project(10.6, 0, z);
          const g = ctx.createLinearGradient(a.x, 0, b.x, 0);
          g.addColorStop(0, 'rgba(100, 150, 210, 0.05)');
          g.addColorStop(0.5, 'rgba(100, 150, 210, 0.28)');
          g.addColorStop(1, 'rgba(100, 150, 210, 0.05)');
          ctx.strokeStyle = g;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
        // Rack rows, far to near
        for (let k = RACK_N - 1; k >= 0; k--) {
          const z0 = RACK_Z0 + k * RACK_LEN;
          RACK_ROWS.forEach(function (row) {
            box(row.x0, row.x1, 0, RACK_H, z0 + 0.04, z0 + RACK_LEN - 0.04, RACK_COL);
          });
        }
        // Dim LED sockets
        for (const l of leds) {
          const q = project(l.x, l.y, l.z);
          ctx.fillStyle = 'rgba(' + l.c + ', 0.12)';
          ctx.fillRect(q.x - 1, q.y - 1, 2.5, 2.5);
        }
        // Light strip along the floor at the foot of each rack row
        RACK_ROWS.forEach(function (row, r) {
          const fx = r === 0 ? row.x1 + 0.05 : row.x0 - 0.05;
          const a = project(fx, 0.02, RACK_Z0), b = project(fx, 0.02, RACK_Z0 + RACK_N * RACK_LEN);
          ctx.save();
          ctx.strokeStyle = 'rgba(80, 180, 255, 0.55)';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#4fb4ff';
          ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.restore();
        });
      }

      // Render the static backdrop once into a cache (with the same horizontal shift as the scene)
      const envCache = document.createElement('canvas');
      envCache.width = W;
      envCache.height = H;
      (function () {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.translate(shiftX, 0);
        drawBackdropStatic();
        ctx.restore();
        envCache.getContext('2d').drawImage(canvas, 0, 0);
      })();

      function drawFloor(now) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(envCache, 0, 0);
        ctx.restore();
        // Blinking rack LEDs
        const t = now / 1000;
        ctx.save();
        for (const l of leds) {
          const v = Math.sin(t * l.f + l.ph);
          if (v < 0.35) continue;
          const q = project(l.x, l.y, l.z);
          ctx.fillStyle = 'rgba(' + l.c + ',' + (0.35 + 0.65 * v).toFixed(2) + ')';
          ctx.fillRect(q.x - 1.2, q.y - 1.2, 3, 3);
        }
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

      function drawGun(now) {
        if (kind === 'bullets') {
          drawMachineGun(now);
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
          lamp(cx, BAR_H + 0.38, Z_BAR - 0.06, lampT[side], now, on, SIDE_COLOR[side]);
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
          lamp(d.x, BEAM_Y + 0.3, d.z, lampT[side], now, true, SIDE_COLOR[side]);
          const q = project(d.x, BEAM_Y + 0.85, d.z);
          drawLabel(ctx, side < 0 ? 'Л' : 'П', q.x, q.y, 'center', SIDE_COLOR[side]);
        });
      }

      const MUZZLE = { x: 0, y: BEAM_Y, z: Z_GUN + 0.35 };

      // Electron as a particle: a bright dot with a short trail, flying to a random point of the barrier
      function drawParticles(now) {
        ctx.save();
        for (const f of flights) {
          const p = (now - f.born) / (f.dur * SPLIT);
          if (p > 1 || !f.aim) continue;
          const fade = f.aim.pass && p > 0.85 ? (1 - p) / 0.15 : 1;
          for (let k = 5; k >= 0; k--) {
            const u = Math.max(0, p - k * 0.035);
            const q = project(MUZZLE.x + (f.aim.x - MUZZLE.x) * u, MUZZLE.y + (f.aim.y - MUZZLE.y) * u,
              MUZZLE.z + (Z_BAR - 0.02 - MUZZLE.z) * u);
            ctx.globalAlpha = fade * (k === 0 ? 1 : 0.35 * (1 - k / 6));
            ctx.fillStyle = k === 0 ? '#eafff2' : look.glow;
            ctx.beginPath();
            ctx.arc(q.x, q.y, Math.max(2.5, (k === 0 ? 0.085 : 0.07) * q.s), 0, Math.PI * 2);
            ctx.fill();
          }
          const q = project(MUZZLE.x + (f.aim.x - MUZZLE.x) * p, MUZZLE.y + (f.aim.y - MUZZLE.y) * p,
            MUZZLE.z + (Z_BAR - 0.02 - MUZZLE.z) * p);
          ctx.globalAlpha = 0.45 * fade;
          const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.3 * q.s);
          g.addColorStop(0, look.glow);
          g.addColorStop(1, look.glow + '00');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 0.3 * q.s, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Beam: many small electrons flying straight; `far` selects the part beyond the barrier
      function drawBeamDots(now, far) {
        ctx.save();
        ctx.fillStyle = '#c9ffe0';
        for (const f of flights) {
          const t = (now - f.born) / 1000;
          let a, b, u;
          if (t < f.t1) {
            if (far) continue;
            a = MUZZLE; b = { x: f.aim.x, y: f.aim.y, z: Z_BAR - 0.02 }; u = t / f.t1;
          } else {
            if (!far || !f.aim.pass) continue;
            a = { x: f.aim.x, y: f.aim.y, z: Z_BAR + BAR_T }; b = f.end; u = Math.min(1, (t - f.t1) / f.t2);
          }
          const q = project(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
          ctx.globalAlpha = 0.85;
          ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3);
        }
        ctx.restore();
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
          if (p < 0 || p > 1 || f.wall) continue;
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
        ctx.save();
        for (const f of flights) {
          const u = (now - f.born) / f.dur;
          if (u < 0 || u > 1) continue;
          const a = f.hit.start, e = f.hit.end;
          const z = a.z + (e.z - a.z) * u;
          if ((z > Z_BAR) !== far) continue;
          const q = project(a.x + (e.x - a.x) * u, a.y + (e.y - a.y) * u, z);
          const r = Math.max(2, (rate() < 5 ? 0.06 : 0.035) * q.s);
          ctx.fillStyle = rate() < 5 ? 'rgba(255, 200, 110, 0.35)' : 'rgba(255, 200, 110, 0.18)';
          ctx.beginPath();
          ctx.arc(q.x, q.y, r * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff1c9';
          ctx.beginPath();
          ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
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

      // Detectors whose hits are shown on the screen right now (sorting steps)
      // Sorting steps: 3 both pairs by pair color, 4 front pair, 5 front pair split,
      // 6 back pair, 7 back pair split, 8 everything in full color
      const PAIR_COLOR = { front: '#f4f6fa', back: '#a77bff' };
      const PAIR_DOT = { front: 'rgba(244, 246, 250, 0.9)', back: 'rgba(167, 123, 255, 0.95)' };
      function isFront(g) { return g === 'L' || g === 'R'; }
      function erHighlighted(g) {
        if (step === 3 || step >= 8) return true;
        if (step === 4 || step === 5) return isFront(g);
        if (step === 6 || step === 7) return !isFront(g);
        return false;
      }
      // Color a detector (and its dots) is shown in at the current step
      function erColor(g) {
        if (step === 3 || step === 4 || step === 6) return PAIR_COLOR[isFront(g) ? 'front' : 'back'];
        return ER_COLOR[g];
      }

      function drawEraserDetector(g, now) {
        const d = ER_DET[g];
        const hl = erHighlighted(g);
        const sorting = step >= 3;
        if (hl) {
          // Halo on the floor around the highlighted detector
          const pulse = 0.75 + 0.25 * Math.sin(now / 260);
          const q0 = project(d.x, 0.02, d.z);
          ctx.save();
          ctx.globalAlpha = 0.55 * pulse;
          ctx.strokeStyle = erColor(g);
          ctx.lineWidth = 4;
          ctx.shadowColor = erColor(g);
          ctx.shadowBlur = 22;
          ctx.beginPath();
          ctx.ellipse(q0.x, q0.y, 0.62 * q0.s, 0.3 * q0.s, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        if (sorting && !hl) ctx.globalAlpha = 0.35;
        box(d.x - 0.08, d.x + 0.08, 0, BEAM_Y - 0.3, d.z - 0.08, d.z + 0.08, DET_COL);
        box(d.x - 0.3, d.x + 0.3, BEAM_Y - 0.3, BEAM_Y + 0.3, d.z - 0.3, d.z + 0.3, DET_COL);
        lamp(d.x, BEAM_Y + 0.3, d.z, lampT[g] || -1e9, now, true, sorting ? erColor(g) : ER_COLOR[g],
          hl ? 0.85 + 0.15 * Math.sin(now / 260) : 0);
        const q = project(d.x, BEAM_Y + 0.85, d.z);
        drawLabel(ctx, ER_LABEL[g], q.x, q.y, 'center', ER_COLOR[g]);
        ctx.restore();
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
        const front = isFront(g);
        const pairDot = PAIR_DOT[front ? 'front' : 'back'];
        if (step === 3) return pairDot;
        if (step === 4) return front ? pairDot : null;
        if (step === 5) return front ? ER_DOT[g] : null;
        if (step === 6) return front ? null : pairDot;
        if (step === 7) return front ? null : ER_DOT[g];
        return ER_DOT[g];
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

      // Split of the two-band curve into the part from each slit
      const leftBand = function (dx) {
        const a = bandWP(dx, -1), b = bandWP(dx, 1);
        return a + b > 0 ? CURVES.twoBands(dx) * a / (a + b) : 0;
      };
      const rightBand = function (dx) {
        const a = bandWP(dx, -1), b = bandWP(dx, 1);
        return a + b > 0 ? CURVES.twoBands(dx) * b / (a + b) : 0;
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
        if (step === 4) strokeCurve(CURVES.twoBands, p, PAIR_COLOR.front, 4);
        if (step === 6) strokeCurve(CURVES.twoBands, p, PAIR_COLOR.back, 4);
        if (step === 5 || step >= 8) {
          strokeCurve(leftBand, p, ER_COLOR.L, step >= 8 ? 3 : 4);
          strokeCurve(rightBand, p, ER_COLOR.R, step >= 8 ? 3 : 4);
        }
        if (step === 7 || step >= 8) {
          strokeCurve(blueFringe, p, ER_COLOR.D1, step >= 8 ? 3 : 4);
          strokeCurve(redFringe, p, ER_COLOR.D2, step >= 8 ? 3 : 4);
        }
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
        { head: look.slitHead, x: 400 }
      ];

      function slitText(row) {
        if (kind === 'bullets' && row.hit.wall) return 'стена';
        if (kind === 'electrons') return '?';
        if (eraser) return row.hit.twinSeen ? ER_LABEL[row.hit.group] : '…';
        if (twins && !row.hit.twinSeen) return '…';
        return row.hit.slit < 0 ? 'Л' : 'П';
      }

      // Log card is drawn offscreen, then shown as a floating panel turned away from the viewer
      const CARD_PAD = 12;
      const CARD_W = LOG_W + 2 * CARD_PAD;
      const CARD_H = 108 + LOG_ROWS * ROW_H + 2 * CARD_PAD;
      const card = document.createElement('canvas');
      card.width = CARD_W;
      card.height = CARD_H;
      const lc = card.getContext('2d');

      // Text made of colored pieces: [[text, color], ...]
      function pieces(list, x, y) {
        list.forEach(function (pc) {
          lc.fillStyle = pc[1];
          lc.fillText(pc[0], x, y);
          x += lc.measureText(pc[0]).width;
        });
      }

      function renderCard(now) {
        const X = CARD_PAD, Y = CARD_PAD;
        const hRows = LOG_ROWS * ROW_H;
        lc.clearRect(0, 0, CARD_W, CARD_H);
        lc.save();
        const bg = lc.createLinearGradient(0, Y, 0, Y + 108 + hRows);
        bg.addColorStop(0, 'rgba(16, 24, 38, 0.94)');
        bg.addColorStop(1, 'rgba(8, 12, 20, 0.94)');
        lc.fillStyle = bg;
        lc.strokeStyle = 'rgba(110, 190, 255, 0.55)';
        lc.lineWidth = 2;
        lc.beginPath();
        lc.roundRect(X, Y, LOG_W, 108 + hRows, 12);
        lc.fill();
        lc.stroke();

        lc.textBaseline = 'middle';
        lc.fillStyle = '#e8eef8';
        lc.font = '600 26px "Segoe UI", Roboto, Arial, sans-serif';
        lc.fillText('Журнал', X + 14, Y + 26);
        lc.font = '500 21px "Segoe UI", Roboto, Arial, sans-serif';
        lc.textAlign = 'right';
        lc.fillStyle = '#cfe9da';
        lc.fillText(look.noun + ': ' + count, X + LOG_W - 14, Y + 26);
        lc.textAlign = 'left';
        const G = SIDE_COLOR['-1'], R = SIDE_COLOR['1'], T = '#c5cfdf';
        if (eraser) {
          pieces([['Л ' + erTally.L + '  ', G], ['П ' + erTally.R + '   ', R],
            ['1: ' + erTally.D1 + '  ', ER_COLOR.D1], ['2: ' + erTally.D2, ER_COLOR.D2]], X + 14, Y + 56);
        } else if (kind !== 'electrons') {
          pieces([[(twins ? 'близнецы' : 'датчики') + ':  ', T], ['Л ' + tally['-1'] + '   ', G], ['П ' + tally['1'], R]],
            X + 14, Y + 56);
        } else {
          lc.fillStyle = '#8a96ab';
          lc.fillText('через какую щель — неизвестно', X + 14, Y + 56);
        }

        const hy = Y + 88;
        lc.font = '600 17px "Segoe UI", Roboto, Arial, sans-serif';
        lc.fillStyle = '#8a96ab';
        COLS.forEach(function (c) { lc.fillText(c.head, X + c.x, hy); });
        lc.strokeStyle = '#2a3242';
        lc.beginPath();
        lc.moveTo(X + 10, hy + 14);
        lc.lineTo(X + LOG_W - 10, hy + 14);
        lc.stroke();

        lc.font = '18px Consolas, Menlo, "DejaVu Sans Mono", monospace';
        for (let i = 0; i < log.length; i++) {
          const r = log[i];
          const y = hy + 14 + ROW_H * (i + 0.5);
          const fresh = Math.max(0, 1 - (now - r.born) / 600);
          if (fresh > 0) {
            lc.fillStyle = 'rgba(127, 255, 176,' + (0.18 * fresh).toFixed(3) + ')';
            lc.fillRect(X + 6, y - ROW_H / 2 + 2, LOG_W - 12, ROW_H - 4);
          }
          lc.fillStyle = i === 0 ? '#ffffff' : 'rgba(210, 220, 235,' + (1 - i / (LOG_ROWS + 4)).toFixed(3) + ')';
          const vals = [String(r.n), r.tL.toFixed(3), r.tH.toFixed(3), r.x.toFixed(1), r.y.toFixed(1)];
          vals.forEach(function (v, k) { lc.fillText(v, X + COLS[k].x, y); });
          const st = slitText(r);
          lc.fillStyle = st === '?' ? '#ffd54a' : (st === '…' ? '#8a96ab' :
            (eraser ? ER_COLOR[r.hit.group] : SIDE_COLOR[r.hit.slit]));
          lc.textAlign = 'center';
          lc.font = '600 19px Consolas, Menlo, "DejaVu Sans Mono", monospace';
          lc.fillText(st, X + 432, y);
          lc.font = '18px Consolas, Menlo, "DejaVu Sans Mono", monospace';
          lc.textAlign = 'left';
        }
        lc.restore();
      }

      // Perspective of a card turned toward the experiment: the left edge is farther away
      const PANEL = { right: 1575, cy: 445, angle: 0.36, focal: 1700 };
      function panelPoint(u) {
        const d = (1 - u) * CARD_W;           // distance from the near (right) edge
        const z = d * Math.sin(PANEL.angle);
        const k = PANEL.focal / (PANEL.focal + z);
        return { x: PANEL.right - d * Math.cos(PANEL.angle) * k, k: k };
      }

      function drawLog(now) {
        renderCard(now);
        const bob = Math.sin(now / 1700) * 5;
        const cy = PANEL.cy + bob;
        // Soft shadow on the floor below the floating card
        const a = panelPoint(0), b = panelPoint(1);
        ctx.save();
        const sh = ctx.createRadialGradient((a.x + b.x) / 2, 860, 10, (a.x + b.x) / 2, 860, 230);
        sh.addColorStop(0, 'rgba(70, 150, 255, 0.16)');
        sh.addColorStop(1, 'rgba(70, 150, 255, 0)');
        ctx.fillStyle = sh;
        ctx.fillRect(a.x - 40, 760, b.x - a.x + 80, 200);
        // The card, in thin vertical strips
        const STRIP = 4;
        for (let sx = 0; sx < CARD_W; sx += STRIP) {
          const p0 = panelPoint(sx / CARD_W), p1 = panelPoint(Math.min(1, (sx + STRIP) / CARD_W));
          const k = (p0.k + p1.k) / 2;
          const h = CARD_H * k;
          ctx.drawImage(card, sx, 0, STRIP, CARD_H, p0.x, cy - h / 2, p1.x - p0.x + 0.6, h);
        }
        // Glowing near edge
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#5ab8ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(b.x - CARD_PAD * b.k, cy - (CARD_H / 2 - CARD_PAD) * b.k);
        ctx.lineTo(b.x - CARD_PAD * b.k, cy + (CARD_H / 2 - CARD_PAD) * b.k);
        ctx.stroke();
        ctx.restore();
      }

      function draw(now) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.translate(shiftX, 0);
        // Painter's order: far to near
        drawFloor(now);
        drawScreen();
        drawRecent(now);
        if (eraser) {
          if (step >= 4) drawEraserCurves(now);
        } else if (step >= opts.curveStep) {
          drawCurve(now);
        }
        if (beam) drawBeamDots(now, true);
        else if (quantum) drawRipples(now);
        else drawBullets(now, true);
        drawBarrier();
        if (kind === 'bullets') drawWallMarks();
        drawSparks(now);
        if (kind === 'which-path') drawWhichPathDetectors(now);
        if (twins) {
          drawCrystals(now);
          drawTwinPhotons(now);
          if (eraser) drawEraserOptics(now);
          else drawTwinDetectors(now);
        }
        if (beam) drawBeamDots(now, false);
        else if (particleKind) drawParticles(now);
        else if (quantum) drawPackets(now);
        else drawBullets(now, false);
        drawGun(now);
        ctx.restore();
        if (!opts.noLog) drawLog(now);
        // Bottom-left when there is no log, otherwise under the log panel
        if (opts.noLog) drawPlaque(ctx, opts.history, 30, 762);
        else drawPlaque(ctx, opts.history, 1570, 770, true);
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
        shots = 0;
        wallCount = 0;
        sparks = [];
        wctx.clearRect(0, 0, WTW, WTH);
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

      function logRow(now, hit, launchedAt, x, y, n) {
        const tH = (now - t0) / 1000;
        log.unshift({ n: n, tL: (launchedAt - t0) / 1000, tH: tH, x: x, y: y, hit: hit, born: now });
        if (log.length > LOG_ROWS) log.length = LOG_ROWS;
      }

      // Machine gun: a bullet lands on the wall or on the screen
      function landBullet(now, f) {
        const h = f.hit;
        if (h.wall) {
          wallCount++;
          const wx = (h.end.x / BAR_W + 0.5) * WTW, wy = (1 - h.end.y / BAR_H) * WTH;
          wctx.fillStyle = 'rgba(25, 28, 35, 0.9)';
          wctx.beginPath();
          wctx.arc(wx, wy, 2.2, 0, Math.PI * 2);
          wctx.fill();
          wctx.fillStyle = 'rgba(200, 205, 215, 0.35)';
          wctx.fillRect(wx - 2.5, wy - 3.2, 3, 1.2);
          sparks.push({ x: h.end.x, y: h.end.y, born: now, c: '#ffd27a' });
          logRow(now, h, f.born, h.end.x * 10, h.end.y * 10, f.n);
          return;
        }
        hits.push(h);
        drawDot(h);
        count++;
        if (rate() < 5) recent.push({ tx: h.tx, ty: h.ty, born: now });
        logRow(now, h, f.born, h.end.x * 10, h.end.y * 10, f.n);
      }

      function fireBullet(now) {
        const d = scatter(gunYaw);
        const h = bulletShot(d.yaw, d.tp);
        const dist = Math.hypot(h.end.x - h.start.x, h.end.y - h.start.y, h.end.z - h.start.z);
        const speed = rate() < 5 ? 13 : 24;
        shots++;
        flashT = now;
        flights.push({ born: now, dur: dist / speed * 1000, hit: h, passed: false, n: shots });
      }

      // Triangle wave sweep of the gun, faster during a burst
      function updateGun(dt) {
        if (step >= 1 && shots < opts.maxShots) gunPhase += dt * (rate() < 5 ? 0.12 : 0.55);
        const t = gunPhase % 1;
        gunYaw = YAW_AMP * (t < 0.5 ? 4 * t - 1 : 3 - 4 * t);
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
        if (kind === 'bullets') {
          while (shots < opts.maxShots) {
            const d = scatter((Math.random() * 2 - 1) * YAW_AMP);
            const h = bulletShot(d.yaw, d.tp);
            shots++;
            const f = { born: now, hit: h, n: shots };
            if (!h.wall) reveal(h, now);
            landBullet(now, f);
          }
          sparks = [];
          return;
        }
        while (count < total) instantHit(now, false, true);
      }

      function inFlight() {
        let n = 0;
        for (const f of flights) if (!f.landed && !f.wall && !(f.hit && f.hit.wall)) n++;
        return n;
      }

      function spawn(now) {
        if (kind === 'bullets' && shots >= opts.maxShots) return false;
        if (kind !== 'bullets' && count + inFlight() >= opts.maxHits) return false;
        const r = rate();
        if (!quantum) {
          fireBullet(now);
          if (r < 5) Sfx.shot(0.6);
        } else if (beam) {
          const aim = aimAtBarrier(0.37, 0.14);   // narrow beam
          const f = { born: now, aim: aim, wall: !aim.pass, hit: sampleHit(kind) };
          const V = 9;
          f.t1 = Math.hypot(aim.x, aim.y - BEAM_Y, Z_BAR - MUZZLE.z) / V;
          if (aim.pass) {
            const w = texToWorld(f.hit.tx, f.hit.ty);
            f.end = { x: w.x, y: w.y, z: Z_SCR - 0.02 };
            f.t2 = Math.hypot(w.x - aim.x, w.y - aim.y, Z_SCR - Z_BAR) / V;
          }
          flights.push(f);
        } else if (r < 50) {
          const f = { born: now, dur: r < 5 ? 1300 : 600, hit: sampleHit(kind), passed: false };
          if (particleKind) {
            f.aim = aimAtBarrier(0.85);
            f.wall = !f.aim.pass;
          }
          flights.push(f);
        } else {
          instantHit(now, false);
        }
        return true;
      }

      function update(dt, now) {
        if (kind === 'bullets') updateGun(dt);
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
          if (beam) {
            const t = (now - f.born) / 1000;
            if (f.wall) {
              if (t >= f.t1) {
                if (Math.random() < 0.25) sparks.push({ x: f.aim.x, y: f.aim.y, born: now, c: look.glow });
              } else still.push(f);
            } else if (t >= f.t1 + f.t2) {
              addHit(now, f.hit, false, f.born);
            } else still.push(f);
            continue;
          }
          // Electron that missed the slits: it stops on the wall
          if (f.wall) {
            if (now - f.born >= f.dur * SPLIT) {
              sparks.push({ x: f.aim.x, y: f.aim.y, born: now, c: look.glow });
              if (!busy) Sfx.click(0.25);
            } else still.push(f);
            continue;
          }
          // Reaching the slits: detectors fire, crystals split the photon, bullets pass a slit
          const atWall = quantum ? SPLIT : (f.hit.wall ? 1 : (Z_BAR - f.hit.start.z) / (f.hit.end.z - f.hit.start.z));
          if (!f.passed && now - f.born >= f.dur * atWall) {
            f.passed = true;
            if (kind === 'which-path' || (kind === 'bullets' && !f.hit.wall)) reveal(f.hit, now);
            if (twins) crystalT[f.hit.slit] = now;
          }
          // The partner reaches the screen
          if (!f.landed && now - f.born >= f.dur) {
            f.landed = true;
            if (kind === 'bullets') landBullet(now, f);
            else addHit(now, f.hit, rate() < 5, f.born);
            if (!busy && quantum) Sfx.click(0.7);
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
        sparks = sparks.filter(function (sp) { return now - sp.born < 260; });
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
        const fast = opts.prefillFrom ? s >= opts.prefillFrom : opts.rates[Math.min(s, opts.rates.length - 1)] >= 20;
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
    history: { year: '1963', place: 'мысленный опыт', who: 'Ричард Фейнман, «Фейнмановские лекции по физике»' },
    captions: [
      'Что будет, если стрелять частицами по стене с двумя щелями?',
      'Почти все пули попадают в стену, но некоторые проскакивают в щель',
      'Очередь!',
      'Результат: две полосы — напротив каждой щели'
    ],
    rates: [0, 2.5, 420, 420],
    curveStep: 3,
    curve: 'bullets',
    noLog: true,
    maxShots: 2500,
    maxHits: 1e9
  }));

  Scenes.register('beam', build({
    kind: 'beam',
    history: { year: '1961', place: 'Германия, Тюбинген', who: 'Клаус Йёнссон — пучок электронов через щели' },
    captions: [
      'Опыт как со светом, только вместо света — пучок электронов',
      'Включаем пучок: летят тысячи электронов…',
      '…и на экране полосы, как у волн! Интерференция'
    ],
    rates: [0, 900, 900],
    prefillFrom: 2,
    curveStep: 2,
    curve: 'fringes',
    noLog: true,
    maxHits: 7000
  }));

  Scenes.register('electrons', build({
    kind: 'electrons',
    history: { year: '1974 · 1989', place: 'Италия, Болонья · Япония, Hitachi', who: 'Мерли, Миссироли, Поцци · Акира Тономура' },
    captions: [
      'А если пускать электроны по одному?',
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
    history: { year: '1998', place: 'Израиль, Институт Вейцмана', who: 'Эяль Букс, Мордехай Хейблум и др. — датчик пути электрона' },
    captions: [
      'Ставим у каждой щели датчик: он замечает, где прошёл электрон',
      'Датчик всякий раз срабатывает только у одной щели',
      'Копим тысячи электронов…',
      'Полосы исчезли: две полосы, как от шариков'
    ],
    rates: [0, 0.9, 700, 700],
    curveStep: 3,
    curve: 'twoBands',
    ghost: true,
    maxHits: 6000
  }));

  Scenes.register('eraser', build({
    kind: 'eraser',
    history: { year: '1999', place: 'США, Мэриленд', who: 'Ким, Ши, Скалли и др. · идея — Скалли и Друль, 1982' },
    captions: [
      'Квантовый ластик: на пути близнецов — полупрозрачные зеркала',
      'Л и П — путь известен.  1 и 2 — путь стёрт',
      'На общем экране по-прежнему две полосы',
      'Разделим точки по парам детекторов: передняя пара — белые, задняя — фиолетовые',
      'Только передняя пара: две полосы',
      'Раскрасим её: зелёная полоса от левой щели, красная от правой',
      'Только задняя пара: тоже две полосы',
      'Раскрасим её: полосы! Синие и жёлтые сдвинуты на полшага',
      'Все цвета вместе'
    ],
    rates: [0, 0.6, 700, 0, 0, 0, 0, 0, 0],
    prefillFrom: 2,
    curveStep: 99,
    twinDelay: 2.6,
    maxHits: 6000
  }));

  Scenes.register('delayed', build({
    kind: 'delayed',
    history: { year: '1999', place: 'США, Мэриленд', who: 'Юн-Хо Ким, Янхуа Ши, Марлан Скалли и др.' },
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
    history: { year: '2002', place: 'Бразилия, Белу-Оризонти', who: 'Стивен Уолборн и др. — запутанные фотоны' },
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
