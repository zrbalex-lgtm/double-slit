/* Atom scene: planetary picture of an atom, but the electron changes orbits by quantum jumps,
   emitting or absorbing a photon whose color matches the energy gap. Energy ladder on the right. */
(function () {
  'use strict';

  const W = 1600, H = 900, TAU = Math.PI * 2;
  const CX = 640, CY = 470;
  const TILT = -0.26;                      // orbit plane tilt on screen
  const R = [0, 130, 235, 345];            // orbit radii for n = 1..3
  const FLAT = 0.36;                       // vertical squash of the orbit ellipses
  const E = [0, -13.6, -3.4, -1.51];       // hydrogen-like energies, eV
  // Photon colors by transition (upper, lower): Balmer-alpha red, Lyman lines ultraviolet (shown violet)
  const PHOTON = { '3-2': '#ff4a4a', '2-1': '#9b6bff', '3-1': '#7d5cff' };

  Scenes.register('atom', function (canvas) {
    const ctx = canvas.getContext('2d');

    // Static background
    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    (function () {
      const g = bg.getContext('2d');
      const r = g.createRadialGradient(CX, CY, 40, CX, CY, 900);
      r.addColorStop(0, '#0d1838');
      r.addColorStop(0.6, '#050a1a');
      r.addColorStop(1, '#010205');
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 220; i++) {
        g.fillStyle = 'rgba(210, 225, 255,' + (0.15 + Math.random() * 0.5).toFixed(2) + ')';
        const s = Math.random() * 1.5 + 0.3;
        g.fillRect(Math.random() * W, Math.random() * H, s, s);
      }
    })();

    // Nucleus: protons and neutrons packed in a ball
    const nucleons = [];
    for (let i = 0; i < 14; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / 14), th = i * 2.399963;
      const rr = i < 2 ? 0 : 1;
      nucleons.push({ x: Math.sin(phi) * Math.cos(th) * rr, y: Math.cos(phi) * rr, z: Math.sin(phi) * Math.sin(th) * rr, p: i % 2 === 0 });
    }

    function orbitPoint(n, a) {
      const x = Math.cos(a) * R[n], y = Math.sin(a) * R[n] * FLAT;
      return { x: CX + x * Math.cos(TILT) - y * Math.sin(TILT), y: CY + x * Math.sin(TILT) + y * Math.cos(TILT), front: Math.sin(a) > 0 };
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

    function label(t, x, y, size, color) {
      ctx.save();
      ctx.font = 'italic 600 ' + size + 'px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(t, x, y);
      ctx.fillStyle = color;
      ctx.fillText(t, x, y);
      ctx.restore();
    }

    function drawOrbits(highlight) {
      for (let n = 1; n <= 3; n++) {
        ctx.save();
        ctx.translate(CX, CY);
        ctx.rotate(TILT);
        ctx.strokeStyle = n === highlight ? 'rgba(130, 210, 255, 0.85)' : 'rgba(110, 170, 255, 0.32)';
        ctx.lineWidth = n === highlight ? 3 : 2;
        ctx.shadowColor = '#4fb4ff';
        ctx.shadowBlur = n === highlight ? 16 : 6;
        ctx.setLineDash(n === highlight ? [] : [10, 9]);
        ctx.beginPath();
        ctx.ellipse(0, 0, R[n], R[n] * FLAT, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
        const p = orbitPoint(n, -0.15);
        label('n=' + n, p.x + 34, p.y - 6, 22, 'rgba(170, 215, 255, 0.9)');
      }
    }

    function drawNucleus(t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(CX, CY, 90, '255, 120, 90', 0.25);
      ctx.restore();
      const a = t * 0.4, ca = Math.cos(a), sa = Math.sin(a);
      const pts = nucleons.map(function (n) {
        return { x: n.x * ca + n.z * sa, y: n.y, z: -n.x * sa + n.z * ca, p: n.p };
      });
      pts.sort(function (u, v) { return u.z - v.z; });
      pts.forEach(function (n) {
        const x = CX + n.x * 24, y = CY + n.y * 24, r = 15 + n.z * 2;
        if (n.p) sphere(x, y, r, '#ff9a8a', '#a3201c');
        else sphere(x, y, r, '#c8d4e8', '#3e4a63');
      });
    }

    // ---------- electron state and quantum jumps ----------
    let n = 2, ang = 0, nextJump = 2.5, t = 0;
    let flash = null;        // { from, to, t0 } brief flashes at the old and new positions
    let photons = [];        // { x, y, dx, dy, t0, color, emit }
    let pendingUp = null;    // absorption: jump after the incoming photon arrives

    function speed(level) { return 1.6 / level; }

    function jump(to) {
      const from = n;
      const pOld = orbitPoint(from, ang);
      n = to;
      const pNew = orbitPoint(n, ang);
      flash = { a: pOld, b: pNew, t0: t };
      if (to < from) {
        // Emission: a photon leaves outward
        const dx = pNew.x - CX, dy = pNew.y - CY, l = Math.hypot(dx, dy) || 1;
        photons.push({ x: pNew.x, y: pNew.y, dx: dx / l, dy: dy / l, t0: t, color: PHOTON[from + '-' + to], emit: true });
      }
    }

    function scheduleJump() {
      const options = [1, 2, 3].filter(function (k) { return k !== n; });
      const to = options[Math.floor(Math.random() * options.length)];
      if (to > n) {
        // Absorption: a photon comes from outside, then the electron jumps up
        const target = orbitPoint(n, ang + speed(n) * 0.9);
        const dx = target.x - CX, dy = target.y - CY, l = Math.hypot(dx, dy) || 1;
        const d = 520;
        photons.push({ x: target.x + dx / l * d, y: target.y + dy / l * d, dx: -dx / l, dy: -dy / l, t0: t,
          color: PHOTON[to + '-' + n], emit: false, life: 0.9 });
        pendingUp = { to: to, at: t + 0.9 };
      } else {
        jump(to);
      }
      nextJump = t + 2.6 + Math.random() * 1.6;
    }

    function drawPhotons() {
      photons = photons.filter(function (ph) { return t - ph.t0 < (ph.life || 1.6); });
      photons.forEach(function (ph) {
        const age = t - ph.t0;
        const dist = ph.emit ? age * 420 : age * (520 / 0.9);
        const hx = ph.x + ph.dx * dist, hy = ph.y + ph.dy * dist;
        const len = 120;
        const nx = -ph.dy, ny = ph.dx;
        ctx.save();
        ctx.strokeStyle = ph.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = ph.color;
        ctx.shadowBlur = 16;
        ctx.globalAlpha = ph.emit ? Math.max(0, 1 - age / 1.6) : 1;
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const u = i / 60;
          const s = dist - len * (1 - u);
          if (s < 0) continue;
          const w = Math.sin(u * Math.PI) * 12 * Math.sin(u * 9 * Math.PI - age * 30);
          const x = ph.x + ph.dx * s + nx * w, y = ph.y + ph.dy * s + ny * w;
          if (i === 0 || s - 2 < 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        label('γ', hx + nx * 28, hy + ny * 28, 28, ph.color);
      });
    }

    function drawElectron(front) {
      const p = orbitPoint(n, ang);
      if (p.front !== front) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(p.x, p.y, 46, '90, 220, 255', 0.5);
      ctx.restore();
      sphere(p.x, p.y, 11, '#eaffff', '#1aa4d8');
      label('e⁻', p.x + 26, p.y - 24, 24, '#bfefff');
    }

    function drawFlash() {
      if (!flash) return;
      const a = 1 - (t - flash.t0) / 0.45;
      if (a <= 0) { flash = null; return; }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(flash.a.x, flash.a.y, 70 * (1.4 - a), '150, 230, 255', 0.8 * a);
      glow(flash.b.x, flash.b.y, 70 * (1.4 - a), '220, 250, 255', 0.9 * a);
      ctx.restore();
    }

    // Energy ladder: the allowed levels only, nothing in between
    function drawLadder() {
      const x0 = 1180, x1 = 1480, yTop = 170, yBot = 760;
      const ys = [0, yBot, yTop + (yBot - yTop) * (E[2] / E[1]), yTop + (yBot - yTop) * (E[3] / E[1])];
      ctx.save();
      ctx.strokeStyle = 'rgba(160, 200, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 - 30, yTop - 40);
      ctx.lineTo(x0 - 30, yBot + 20);
      ctx.stroke();
      label('E', x0 - 30, yTop - 62, 28, 'rgba(190, 220, 255, 0.9)');
      for (let k = 1; k <= 3; k++) {
        ctx.strokeStyle = k === n ? 'rgba(140, 220, 255, 1)' : 'rgba(140, 190, 255, 0.5)';
        ctx.lineWidth = k === n ? 4 : 3;
        ctx.shadowColor = '#4fb4ff';
        ctx.shadowBlur = k === n ? 14 : 0;
        ctx.beginPath();
        ctx.moveTo(x0, ys[k]);
        ctx.lineTo(x1, ys[k]);
        ctx.stroke();
        label('n=' + k, x1 + 44, ys[k], 22, 'rgba(170, 215, 255, 0.9)');
      }
      ctx.restore();
      const xe = x0 + (x1 - x0) / 2;
      sphere(xe, ys[n] - 14, 10, '#eaffff', '#1aa4d8');
    }

    function draw() {
      ctx.drawImage(bg, 0, 0);
      drawOrbits(n);
      drawElectron(false);
      drawNucleus(t);
      drawElectron(true);
      drawFlash();
      drawPhotons();
      drawLadder();
    }

    const loop = makeLoop(function (dt) {
      t += dt;
      ang += dt * speed(n);
      if (pendingUp && t >= pendingUp.at) {
        jump(pendingUp.to);
        pendingUp = null;
      } else if (!pendingUp && t >= nextJump) {
        scheduleJump();
      }
      draw();
    });

    draw();
    return { start: loop.start, stop: loop.stop, setStep: function () {} };
  });
})();
