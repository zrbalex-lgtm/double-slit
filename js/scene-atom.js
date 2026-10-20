/* Atom scene: a calm background while the presenter talks about the electron as a real particle.
   A nucleus inside faint spherical shells; the electron glides over its shell in 3D (the orbit
   plane slowly turns, so it covers the whole sphere) and now and then jumps to another shell. */
(function () {
  'use strict';

  const W = 1600, H = 900, TAU = Math.PI * 2;
  const CX = 800, CY = 450;
  const SHELL = [0, 150, 245, 340];   // shell radii, px
  const FOCAL = 1400;                 // perspective for the 3D sphere

  Scenes.register('atom', function (canvas) {
    const ctx = canvas.getContext('2d');

    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    (function () {
      const g = bg.getContext('2d');
      const r = g.createRadialGradient(CX, CY, 40, CX, CY, 950);
      r.addColorStop(0, '#0d1838');
      r.addColorStop(0.6, '#050a1a');
      r.addColorStop(1, '#010205');
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 240; i++) {
        g.fillStyle = 'rgba(210, 225, 255,' + (0.15 + Math.random() * 0.5).toFixed(2) + ')';
        const s = Math.random() * 1.5 + 0.3;
        g.fillRect(Math.random() * W, Math.random() * H, s, s);
      }
    })();

    // Nucleus: protons (red) and neutrons (grey)
    const nucleons = [];
    for (let i = 0; i < 14; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / 14), th = i * 2.399963;
      const rr = i < 2 ? 0 : 1;
      nucleons.push({ x: Math.sin(phi) * Math.cos(th) * rr, y: Math.cos(phi) * rr, z: Math.sin(phi) * Math.sin(th) * rr, p: i % 2 === 0 });
    }

    function proj(x, y, z) {
      const k = FOCAL / (FOCAL + z);
      return { x: CX + x * k, y: CY + y * k, k: k, z: z };
    }

    function glow(x, y, r, color, a) {
      if (!(r > 0)) return;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + color + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    function sphere(x, y, r, light, dark) {
      r = Math.max(1, r);
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      g.addColorStop(0, light);
      g.addColorStop(1, dark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    // Faint wireframe shell: a few latitude and longitude circles, slowly rotating
    function drawShell(R, active, t, front) {
      const rot = t * 0.08;
      ctx.save();
      ctx.lineWidth = active ? 1.8 : 1.1;
      const base = active ? 0.42 : 0.14;
      const lines = [];
      for (let k = -2; k <= 2; k++) lines.push({ lat: k * 0.5 });
      for (let k = 0; k < 6; k++) lines.push({ lon: k * Math.PI / 6 });
      lines.forEach(function (ln) {
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 72; i++) {
          const a = i / 72 * TAU;
          let x, y, z;
          if (ln.lat !== undefined) {
            const c = Math.cos(ln.lat), s = Math.sin(ln.lat);
            x = Math.cos(a) * c; y = s; z = Math.sin(a) * c;
          } else {
            x = Math.cos(a) * Math.cos(ln.lon); y = Math.sin(a); z = Math.cos(a) * Math.sin(ln.lon);
          }
          // rotate around y, tilt toward the viewer
          const xr = x * Math.cos(rot) + z * Math.sin(rot), zr = -x * Math.sin(rot) + z * Math.cos(rot);
          const yt = y * Math.cos(0.35) - zr * Math.sin(0.35), zt = y * Math.sin(0.35) + zr * Math.cos(0.35);
          if ((zt < 0) !== front) { started = false; continue; }
          const p = proj(xr * R, yt * R, zt * R);
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(120, 190, 255,' + (front ? base : base * 0.45).toFixed(3) + ')';
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawNucleus(t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(CX, CY, 110, '255, 120, 90', 0.22);
      ctx.restore();
      const a = t * 0.4, ca = Math.cos(a), sa = Math.sin(a);
      const pts = nucleons.map(function (n) {
        return { x: n.x * ca + n.z * sa, y: n.y, z: -n.x * sa + n.z * ca, p: n.p };
      });
      pts.sort(function (u, v) { return v.z - u.z; });
      pts.forEach(function (n) {
        const x = CX + n.x * 26, y = CY + n.y * 26, r = 16 - n.z * 2;
        if (n.p) sphere(x, y, r, '#ff9a8a', '#a3201c');
        else sphere(x, y, r, '#c8d4e8', '#3e4a63');
      });
    }

    // ---------- electron on a sphere ----------
    let shell = 2, t = 0, nextJump = 6;
    let flash = null;
    const trail = [];

    // Position on the current shell: an orbit whose plane precesses, sweeping the whole sphere
    function electronPos(tt, R) {
      const w = 1.1, prec = 0.23;
      const a = tt * w;
      let x = Math.cos(a), y = 0, z = Math.sin(a);
      const inc = 1.1;   // orbit inclination
      const y1 = y * Math.cos(inc) - z * Math.sin(inc), z1 = y * Math.sin(inc) + z * Math.cos(inc);
      const p = tt * prec;
      const x2 = x * Math.cos(p) + z1 * Math.sin(p), z2 = -x * Math.sin(p) + z1 * Math.cos(p);
      // Quantum "jitter": the electron trembles around its path, never quite sitting still
      const wob = 14;
      const wx = Math.sin(tt * 7.3) * 0.6 + Math.sin(tt * 12.9 + 1.7) * 0.4;
      const wy = Math.sin(tt * 8.1 + 0.9) * 0.6 + Math.sin(tt * 15.7 + 2.3) * 0.4;
      const wz = Math.sin(tt * 6.7 + 2.1) * 0.6 + Math.sin(tt * 11.3 + 0.4) * 0.4;
      return proj(x2 * R + wx * wob, y1 * R + wy * wob, z2 * R + wz * wob);
    }

    function drawElectron(behind) {
      const p = electronPos(t, SHELL[shell]);
      if ((p.z > 0) !== behind) return;
      // trail
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      trail.forEach(function (q, i) {
        if ((q.z > 0) !== behind) return;
        glow(q.x, q.y, 10 * q.k, '90, 220, 255', 0.25 * (i / trail.length));
      });
      glow(p.x, p.y, 48 * p.k, '90, 220, 255', 0.5);
      ctx.restore();
      sphere(p.x, p.y, 11 * p.k, '#eaffff', '#1aa4d8');
    }

    function drawFlash() {
      if (!flash) return;
      const a = 1 - (t - flash.t0) / 0.5;
      if (a <= 0) { flash = null; return; }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(flash.a.x, flash.a.y, 80 * (1.4 - a), '150, 230, 255', 0.8 * a);
      glow(flash.b.x, flash.b.y, 80 * (1.4 - a), '220, 250, 255', 0.9 * a);
      ctx.restore();
    }

    function draw() {
      ctx.drawImage(bg, 0, 0);
      for (let k = 3; k >= 1; k--) drawShell(SHELL[k], k === shell, t, false);
      drawElectron(true);
      drawNucleus(t);
      for (let k = 1; k <= 3; k++) drawShell(SHELL[k], k === shell, t, true);
      drawElectron(false);
      drawFlash();
    }

    const loop = makeLoop(function (dt) {
      t += dt;
      const p = electronPos(t, SHELL[shell]);
      trail.push(p);
      if (trail.length > 14) trail.shift();
      if (t >= nextJump) {
        // Quantum jump: the electron is suddenly on another shell, no path in between
        const options = [1, 2, 3].filter(function (k) { return k !== shell; });
        const to = options[Math.floor(Math.random() * options.length)];
        const a = electronPos(t, SHELL[shell]);
        shell = to;
        const b = electronPos(t, SHELL[shell]);
        flash = { a: a, b: b, t0: t };
        trail.length = 0;
        nextJump = t + 5 + Math.random() * 4;
      }
      draw();
    });

    draw();
    return { start: loop.start, stop: loop.stop, setStep: function () {} };
  });
})();
