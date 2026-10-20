/* Title scene: an animated collage of quantum imagery around the title.
   Every element stands for a concept from GLOSSARY (glossary.js): hovering it with the mouse
   shows a card; when the mouse is idle, a guided tour highlights the elements one by one. */
(function () {
  'use strict';

  const W = 1600, H = 900;
  const TAU = Math.PI * 2;

  const FORMULAS = [
    { id: 'f_schrodinger', t: 'iħ ∂ψ/∂t = Ĥψ', x: 560, y: 120, s: 30 },
    { id: 'f_singlet', t: '|Ψ⟩ = (|↑↓⟩ − |↓↑⟩) / √2', x: 1010, y: 125, s: 28 },
    { id: 'f_heisenberg', t: 'Δx · Δp ≥ ħ/2', x: 120, y: 420, s: 26 },
    { id: 'f_debroglie', t: 'λ = h / p', x: 1380, y: 420, s: 28 },
    { id: 'f_born', t: 'P(x) = |ψ₁ + ψ₂|²', x: 560, y: 795, s: 28 },
    { id: 'f_planck', t: 'E = hν', x: 1005, y: 800, s: 28 },
    { id: 'f_plane', t: 'ψ(x,t) = A·exp[i(kx − ωt)]', x: 95, y: 615, s: 22 },
    { id: 'f_norm', t: '⟨ψ|ψ⟩ = 1', x: 1390, y: 610, s: 24 },
    { id: 'f_energytime', t: 'ΔE · Δt ≥ ħ/2', x: 700, y: 60, s: 20 },
    { id: 'f_qubit', t: '|ψ⟩ = α|0⟩ + β|1⟩', x: 300, y: 70, s: 20 },
    { id: 'f_hamiltonian', t: 'Ĥ = −ħ²/2m ∇² + V', x: 1150, y: 60, s: 20 }
  ];

  Scenes.register('title', function (canvas) {
    const ctx = canvas.getContext('2d');

    // ---------- static background: deep space, nebulae, stars ----------
    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    (function paintBackground() {
      const g = bg.getContext('2d');
      const base = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 950);
      base.addColorStop(0, '#0d1433');
      base.addColorStop(0.55, '#060a1c');
      base.addColorStop(1, '#010207');
      g.fillStyle = base;
      g.fillRect(0, 0, W, H);
      const nebulae = [
        [260, 200, 420, 'rgba(60, 120, 255, 0.16)'],
        [1350, 220, 460, 'rgba(190, 60, 255, 0.14)'],
        [800, 470, 520, 'rgba(0, 220, 255, 0.10)'],
        [300, 780, 380, 'rgba(255, 60, 160, 0.10)'],
        [1300, 760, 420, 'rgba(60, 255, 190, 0.08)']
      ];
      g.globalCompositeOperation = 'lighter';
      nebulae.forEach(function (n) {
        const r = g.createRadialGradient(n[0], n[1], 0, n[0], n[1], n[2]);
        r.addColorStop(0, n[3]);
        r.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = r;
        g.fillRect(0, 0, W, H);
      });
      // Faint hexagonal grid for a sci-fi feel
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = 'rgba(120, 180, 255, 0.045)';
      g.lineWidth = 1;
      const S = 46;
      for (let row = 0; row * S * 0.866 < H + S; row++) {
        for (let col = 0; col * S * 1.5 < W + S; col++) {
          const cx = col * S * 1.5, cy = row * S * 1.732 + (col % 2) * S * 0.866;
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = k * TAU / 6;
            const px = cx + S * 0.5 * Math.cos(a), py = cy + S * 0.5 * Math.sin(a);
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke();
        }
      }
    })();

    const latticeGlow = document.createElement('canvas');
    latticeGlow.width = W;
    latticeGlow.height = H;
    (function () {
      const g = latticeGlow.getContext('2d');
      g.strokeStyle = 'rgba(120, 210, 255, 0.5)';
      g.lineWidth = 1.5;
      const S = 46;
      for (let row = 0; row * S * 0.866 < H + S; row++) {
        for (let col = 0; col * S * 1.5 < W + S; col++) {
          const cx = col * S * 1.5, cy = row * S * 1.732 + (col % 2) * S * 0.866;
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = k * TAU / 6;
            const px = cx + S * 0.5 * Math.cos(a), py = cy + S * 0.5 * Math.sin(a);
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke();
        }
      }
    })();

    const stars = [];
    for (let i = 0; i < 260; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, ph: Math.random() * TAU });
    }
    const motes = [];
    for (let i = 0; i < 70; i++) {
      motes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 12, vy: -4 - Math.random() * 10,
        r: 1 + Math.random() * 2.2, hue: Math.random() < 0.5 ? '120, 220, 255' : '220, 140, 255' });
    }

    // ---------- interference field (low-res, scaled up) ----------
    const FW = 220, FH = 124;
    const field = document.createElement('canvas');
    field.width = FW;
    field.height = FH;
    const fctx = field.getContext('2d');
    const fimg = fctx.createImageData(FW, FH);

    function renderField(t) {
      const d = fimg.data;
      const s1x = FW * 0.5 - 9, s2x = FW * 0.5 + 9, sy = FH * 0.5;
      const k = 0.62, w = 3.2;
      for (let j = 0; j < FH; j++) {
        for (let i = 0; i < FW; i++) {
          const r1 = Math.hypot(i - s1x, j - sy), r2 = Math.hypot(i - s2x, j - sy);
          const u = Math.cos(k * r1 - w * t) / Math.sqrt(1 + r1 * 0.08) + Math.cos(k * r2 - w * t) / Math.sqrt(1 + r2 * 0.08);
          const e = (u * u) / 4;
          const rr = Math.hypot((i - FW / 2) / (FW / 2), (j - FH / 2) / (FH / 2));
          const m = Math.max(0, 1 - rr * rr);
          const v = e * m;
          const o = (j * FW + i) * 4;
          d[o] = 40 + 180 * v;
          d[o + 1] = 120 + 135 * v;
          d[o + 2] = 255;
          d[o + 3] = 255 * Math.min(1, v * 2.8);
        }
      }
      fctx.putImageData(fimg, 0, 0);
    }

    // ---------- orbital cloud: points sampled from a d-orbital-like density ----------
    const orbital = [];
    while (orbital.length < 1800) {
      const x = (Math.random() * 2 - 1) * 9, y = (Math.random() * 2 - 1) * 9, z = (Math.random() * 2 - 1) * 9;
      const r = Math.hypot(x, y, z);
      const ct = r > 0 ? z / r : 0;
      const dens = r * r * Math.pow(3 * ct * ct - 1, 2) * Math.exp(-r / 1.5);
      if (Math.random() * 6 < dens) orbital.push([x, y, z]);
    }

    // ---------- helpers ----------
    function glow(x, y, r, color, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + color + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }

    function hudPanel(x, y, w, h, label) {
      ctx.save();
      ctx.fillStyle = 'rgba(10, 30, 60, 0.35)';
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 14, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - 14);
      ctx.lineTo(x + w - 14, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // grid
      ctx.strokeStyle = 'rgba(120, 200, 255, 0.08)';
      for (let gx = x + 20; gx < x + w; gx += 20) {
        ctx.beginPath(); ctx.moveTo(gx, y + 6); ctx.lineTo(gx, y + h - 6); ctx.stroke();
      }
      for (let gy = y + 20; gy < y + h; gy += 20) {
        ctx.beginPath(); ctx.moveTo(x + 6, gy); ctx.lineTo(x + w - 6, gy); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(160, 220, 255, 0.75)';
      ctx.font = '600 13px "Exo 2", "Segoe UI", sans-serif';
      ctx.fillText(label, x + 12, y + 18);
      ctx.restore();
    }

    function drawStars(t) {
      for (const s of stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.ph));
        ctx.fillStyle = 'rgba(220, 235, 255,' + a.toFixed(3) + ')';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
    }

    function drawMotes(dt) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
        if (m.x < -10) m.x = W + 10;
        if (m.x > W + 10) m.x = -10;
        glow(m.x, m.y, m.r * 4, m.hue, 0.5);
      }
      ctx.restore();
    }

    function drawInterference(t) {
      renderField(t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(field, W / 2 - 520, H / 2 - 293, 1040, 586);
      ctx.restore();
      // the two slits as bright sources
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(W / 2 - 42, H / 2, 40, '170, 240, 255', 0.9);
      glow(W / 2 + 42, H / 2, 40, '170, 240, 255', 0.9);
      ctx.restore();
    }

    // Rotating HUD rings around the center
    function drawRings(t) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.globalCompositeOperation = 'lighter';
      const rings = [
        [300, 0.12, [40, 18], 'rgba(120, 210, 255, 0.35)', 2],
        [326, -0.08, [4, 10], 'rgba(200, 150, 255, 0.45)', 2],
        [356, 0.05, [120, 40, 10, 40], 'rgba(120, 255, 220, 0.25)', 3]
      ];
      rings.forEach(function (r) {
        ctx.save();
        ctx.rotate(t * r[1]);
        ctx.setLineDash(r[2]);
        ctx.strokeStyle = r[3];
        ctx.lineWidth = r[4];
        ctx.beginPath();
        ctx.ellipse(0, 0, r[0] * 1.55, r[0] * 0.78, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      });
      // tick marks
      ctx.strokeStyle = 'rgba(150, 220, 255, 0.35)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 72; k++) {
        const a = k * TAU / 72 + t * 0.03;
        const r0 = k % 6 === 0 ? 0.9 : 0.95;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 340 * 1.55 * r0, Math.sin(a) * 340 * 0.78 * r0);
        ctx.lineTo(Math.cos(a) * 340 * 1.55, Math.sin(a) * 340 * 0.78);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBloch(cx, cy, R, t) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'lighter';
      glow(0, 0, R * 1.3, '70, 140, 255', 0.18);
      ctx.strokeStyle = 'rgba(130, 200, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(130, 200, 255, 0.3)';
      for (let k = -2; k <= 2; k++) {
        const yy = (k / 3) * R, rr = Math.sqrt(R * R - yy * yy);
        ctx.beginPath(); ctx.ellipse(0, yy, rr, rr * 0.3, 0, 0, TAU); ctx.stroke();
      }
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 4 + t * 0.4;
        ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(Math.cos(a)) * R, R, 0, 0, TAU); ctx.stroke();
      }
      // axes
      ctx.strokeStyle = 'rgba(200, 230, 255, 0.5)';
      ctx.beginPath(); ctx.moveTo(0, -R * 1.2); ctx.lineTo(0, R * 1.2); ctx.stroke();
      // state vector precessing
      const th = 0.9 + 0.25 * Math.sin(t * 0.7), ph = t * 1.1;
      const vx = R * Math.sin(th) * Math.cos(ph), vy = -R * Math.cos(th) + R * 0.3 * Math.sin(th) * Math.sin(ph);
      ctx.strokeStyle = 'rgba(255, 210, 120, 0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(vx, vy); ctx.stroke();
      glow(vx, vy, 16, '255, 210, 120', 0.9);
      ctx.fillStyle = 'rgba(210, 235, 255, 0.85)';
      ctx.font = 'italic 20px Georgia, "Times New Roman", serif';
      ctx.fillText('|0⟩', 8, -R * 1.2 + 4);
      ctx.fillText('|1⟩', 8, R * 1.2 + 10);
      ctx.restore();
    }

    function drawOrbital(cx, cy, scale, t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(cx, cy, 150, '190, 80, 255', 0.16);
      const a = t * 0.35, b = 0.5;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      for (const p of orbital) {
        const x1 = p[0] * ca + p[1] * sa, y1 = -p[0] * sa + p[1] * ca, z1 = p[2];
        const y2 = y1 * cb - z1 * sb, z2 = y1 * sb + z1 * cb;
        const depth = 0.55 + 0.45 * (y2 + 9) / 18;
        ctx.fillStyle = 'rgba(' + (180 + 60 * depth | 0) + ',' + (110 + 80 * depth | 0) + ', 255,' + (0.25 + 0.5 * depth).toFixed(2) + ')';
        ctx.fillRect(cx + x1 * scale, cy - z2 * scale, 2, 2);
      }
      glow(cx, cy, 10, '255, 240, 255', 0.9);
      ctx.restore();
    }

    // Entangled pair: two particles joined by a twisting double helix, spins always opposite
    function drawEntangled(x1, x2, y, t) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const N = 160;
      [[0, '90, 220, 255'], [Math.PI, '255, 90, 200']].forEach(function (strand) {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          const x = x1 + (x2 - x1) * u;
          const env = Math.sin(Math.PI * u);
          const yy = y + Math.sin(u * 14 * Math.PI - t * 3 + strand[0]) * 34 * env;
          if (i === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.strokeStyle = 'rgba(' + strand[1] + ', 0.75)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(' + strand[1] + ', 1)';
        ctx.shadowBlur = 14;
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      // rungs
      for (let i = 1; i < 28; i++) {
        const u = i / 28;
        const x = x1 + (x2 - x1) * u;
        const env = Math.sin(Math.PI * u);
        const ph = u * 14 * Math.PI - t * 3;
        ctx.strokeStyle = 'rgba(200, 200, 255,' + (0.18 * env).toFixed(3) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y + Math.sin(ph) * 34 * env);
        ctx.lineTo(x, y + Math.sin(ph + Math.PI) * 34 * env);
        ctx.stroke();
      }
      // particles and their spins
      const spin = t * 1.6;
      [[x1, '90, 220, 255', 1], [x2, '255, 90, 200', -1]].forEach(function (p) {
        glow(p[0], y, 70, p[1], 0.35);
        glow(p[0], y, 22, '255, 255, 255', 0.95);
        const ax = Math.sin(spin) * 10 * p[2], ay = -46 * p[2];
        ctx.strokeStyle = 'rgba(' + p[1] + ', 0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p[0], y);
        ctx.lineTo(p[0] + ax, y + ay);
        ctx.stroke();
        ctx.fillStyle = 'rgba(' + p[1] + ', 0.95)';
        ctx.beginPath();
        ctx.moveTo(p[0] + ax, y + ay - 10 * p[2]);
        ctx.lineTo(p[0] + ax - 8, y + ay + 2 * p[2]);
        ctx.lineTo(p[0] + ax + 8, y + ay + 2 * p[2]);
        ctx.closePath();
        ctx.fill();
        // orbit ring
        ctx.strokeStyle = 'rgba(' + p[1] + ', 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(p[0], y, 40, 12, 0, 0, TAU);
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawFringeGraph(x, y, w, h, t) {
      hudPanel(x, y, w, h, 'INTERFERENCE  P(x)');
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= w - 24; i++) {
        const u = (i / (w - 24) - 0.5) * 2;
        const c = Math.cos(u * 9 + Math.sin(t) * 0.4);
        const env = Math.exp(-u * u * 2.2);
        const v = c * c * env;
        const px = x + 12 + i, py = y + h - 14 - v * (h - 40);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(255, 213, 74, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ffb300';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    }

    function drawPacketGraph(x, y, w, h, t) {
      hudPanel(x, y, w, h, 'WAVE PACKET  Re ψ(x,t)');
      ctx.save();
      const mid = y + h / 2 + 8;
      const c0 = ((t * 0.25) % 1.4) - 0.2;
      ctx.beginPath();
      for (let i = 0; i <= w - 24; i++) {
        const u = i / (w - 24);
        const env = Math.exp(-Math.pow((u - c0) / 0.12, 2));
        const v = Math.cos(u * 60 - t * 6) * env;
        const px = x + 12 + i, py = mid - v * (h / 2 - 20);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(120, 255, 210, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#3cffc0';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    }

    // Feynman diagram: electron-electron scattering via a photon
    function drawFeynman(cx, cy, t) {
      ctx.save();
      ctx.strokeStyle = 'rgba(200, 225, 255, 0.75)';
      ctx.lineWidth = 2;
      const a = { x: cx - 70, y: cy - 30 }, b = { x: cx + 70, y: cy - 30 };
      [[a, -1], [b, 1]].forEach(function (v) {
        ctx.beginPath(); ctx.moveTo(v[0].x - 50 * v[1] * -1, v[0].y - 50); ctx.lineTo(v[0].x, v[0].y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(v[0].x, v[0].y); ctx.lineTo(v[0].x - 50 * v[1] * -1, v[0].y + 50); ctx.stroke();
      });
      // photon: wavy line
      ctx.strokeStyle = 'rgba(255, 210, 120, 0.9)';
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const x = a.x + (b.x - a.x) * u, y = a.y + Math.sin(u * 8 * TAU - t * 6) * 6;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(200, 225, 255, 0.9)';
      ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, TAU); ctx.fill();
      ctx.font = 'italic 18px Georgia, serif';
      ctx.fillText('γ', cx - 5, cy - 46);
      ctx.fillText('e⁻', a.x + 30, a.y - 50);
      ctx.fillText('e⁻', b.x - 46, b.y - 50);
      ctx.restore();
    }

    function drawFormulas(t) {
      ctx.save();
      ctx.textBaseline = 'middle';
      FORMULAS.forEach(function (f, i) {
        const a = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.7));
        const dy = Math.sin(t * 0.5 + i) * 6;
        ctx.font = 'italic ' + f.s + 'px Georgia, "Times New Roman", "DejaVu Serif", serif';
        ctx.fillStyle = 'rgba(190, 225, 255,' + a.toFixed(3) + ')';
        ctx.shadowColor = 'rgba(90, 170, 255, 0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText(f.t, f.x, f.y + dy);
        f.box = { x: f.x - 8, y: f.y + dy - f.s * 0.7, w: ctx.measureText(f.t).width + 16, h: f.s * 1.4 };
      });
      ctx.restore();
    }

    function drawTitle(t) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = H / 2 - 10;
      // dark band behind the title for readability
      const band = ctx.createLinearGradient(0, y - 110, 0, y + 110);
      band.addColorStop(0, 'rgba(2, 4, 12, 0)');
      band.addColorStop(0.5, 'rgba(2, 4, 12, 0.55)');
      band.addColorStop(1, 'rgba(2, 4, 12, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, y - 110, W, 220);

      ctx.font = '900 88px Orbitron, "Exo 2", "Segoe UI", sans-serif';
      const grad = ctx.createLinearGradient(W / 2 - 600, 0, W / 2 + 600, 0);
      const sh = (Math.sin(t * 0.6) + 1) / 2;
      grad.addColorStop(0, '#7fd7ff');
      grad.addColorStop(Math.max(0.01, Math.min(0.99, sh)), '#ffffff');
      grad.addColorStop(1, '#d59bff');
      ctx.shadowColor = 'rgba(80, 180, 255, 0.95)';
      ctx.shadowBlur = 34;
      ctx.fillStyle = grad;
      ctx.fillText('DOUBLE SLIT', W / 2, y - 40);
      ctx.font = '800 58px Orbitron, "Exo 2", "Segoe UI", sans-serif';
      ctx.fillText('EXPERIMENT', W / 2, y + 42);

      ctx.shadowBlur = 10;
      ctx.font = '300 26px "Exo 2", "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(200, 225, 255, 0.85)';
      ctx.fillText('волна  ·  частица  ·  запутанность  ·  квантовый ластик', W / 2, y + 112);
      ctx.restore();
    }

    // ---------- what each element means: regions, hover cards, guided tour ----------
    const RING = { cx: W / 2, cy: H / 2, rx: 340 * 1.55, ry: 340 * 0.78 };
    function ringR(x, y) {
      return Math.hypot((x - RING.cx) / RING.rx, (y - RING.cy) / RING.ry);
    }
    const REGIONS = [
      { id: 'bloch', shape: 'circle', x: 250, y: 225, r: 135 },
      { id: 'orbital', shape: 'circle', x: 1350, y: 230, r: 150 },
      { id: 'fringeGraph', shape: 'rect', x: 70, y: 470, w: 280, h: 120 },
      { id: 'packetGraph', shape: 'rect', x: 1250, y: 470, w: 280, h: 120 },
      { id: 'feynman', shape: 'rect', x: 1270, y: 630, w: 260, h: 150 },
      { id: 'spin', shape: 'circle', x: 330, y: 720, r: 60 },
      { id: 'spin', shape: 'circle', x: 1100, y: 720, r: 60 },
      { id: 'entangled', shape: 'rect', x: 390, y: 672, w: 650, h: 96 },
      { id: 'title', shape: 'rect', x: 480, y: 330, w: 640, h: 220 },
      { id: 'rings', shape: 'ring' },
      { id: 'interference', shape: 'ellipse' }
    ];

    function regionHit(r, x, y) {
      if (r.shape === 'circle') return Math.hypot(x - r.x, y - r.y) < r.r;
      if (r.shape === 'rect') return x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
      if (r.shape === 'ring') { const q = ringR(x, y); return q > 0.86 && q < 1.04; }
      if (r.shape === 'ellipse') return ringR(x, y) <= 0.86;
      return false;
    }

    function hitTest(x, y) {
      for (const f of FORMULAS) {
        const b = f.box;
        if (b && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return { id: f.id, shape: 'rect', x: b.x, y: b.y, w: b.w, h: b.h };
      }
      for (const r of REGIONS) if (regionHit(r, x, y)) return r;
      for (const m of motes) if (Math.hypot(x - m.x, y - m.y) < 18) return { id: 'motes', shape: 'motes' };
      if (ringR(x, y) > 1.12) return { id: 'lattice', shape: 'lattice' };
      return null;
    }

    function regionFor(id) {
      const f = FORMULAS.find(function (q) { return q.id === id; });
      if (f && f.box) return { id: id, shape: 'rect', x: f.box.x, y: f.box.y, w: f.box.w, h: f.box.h };
      const r = REGIONS.find(function (q) { return q.id === id; });
      if (r) return r;
      if (id === 'motes') return { id: id, shape: 'motes' };
      if (id === 'lattice') return { id: id, shape: 'lattice' };
      return null;
    }

    function anchorOf(r) {
      if (r.shape === 'circle') return { x: r.x, y: r.y, rx: r.r, ry: r.r };
      if (r.shape === 'rect') return { x: r.x + r.w / 2, y: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 };
      if (r.shape === 'ring') return { x: RING.cx + RING.rx * 0.7, y: RING.cy - RING.ry * 0.72, rx: 10, ry: 10 };
      if (r.shape === 'ellipse') return { x: RING.cx, y: RING.cy + 170, rx: 200, ry: 60 };
      return { x: W / 2, y: H - 120, rx: 10, ry: 10 };
    }

    function highlight(r, now) {
      const pulse = 0.65 + 0.35 * Math.sin(now / 220);
      ctx.save();
      ctx.strokeStyle = 'rgba(140, 225, 255,' + (0.9 * pulse).toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#5ad0ff';
      ctx.shadowBlur = 22;
      ctx.beginPath();
      if (r.shape === 'circle') ctx.arc(r.x, r.y, r.r, 0, TAU);
      else if (r.shape === 'rect') ctx.roundRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12, 10);
      else if (r.shape === 'ring') {
        ctx.ellipse(RING.cx, RING.cy, RING.rx * 0.86, RING.ry * 0.86, 0, 0, TAU);
        ctx.moveTo(RING.cx + RING.rx * 1.04, RING.cy);
        ctx.ellipse(RING.cx, RING.cy, RING.rx * 1.04, RING.ry * 1.04, 0, 0, TAU);
      } else if (r.shape === 'ellipse') ctx.ellipse(RING.cx, RING.cy, RING.rx * 0.84, RING.ry * 0.84, 0, 0, TAU);
      else if (r.shape === 'motes') motes.slice(0, 8).forEach(function (m) { ctx.moveTo(m.x + 16, m.y); ctx.arc(m.x, m.y, 16, 0, TAU); });
      ctx.stroke();
      if (r.shape === 'lattice') {
        ctx.globalAlpha = 0.6 * pulse;
        ctx.drawImage(latticeGlow, 0, 0);
      }
      ctx.restore();
    }

    function wrap(text, maxW) {
      const words = text.split(' ');
      const lines = [];
      let line = '';
      words.forEach(function (w) {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = w;
        } else line = test;
      });
      if (line) lines.push(line);
      return lines;
    }

    function card(r, now) {
      const g = GLOSSARY[r.id];
      if (!g) return;
      const CW = 470, PAD = 22;
      ctx.save();
      ctx.font = '400 20px "Exo 2", "Segoe UI", sans-serif';
      const lines = wrap(g.text.replace(/<[^>]+>/g, ''), CW - 2 * PAD);
      const CH = 96 + lines.length * 27 + PAD;
      // Place the card beside the element, on the side facing the middle of the screen
      const a = anchorOf(r);
      let x = a.x < W / 2 ? a.x + a.rx + 26 : a.x - a.rx - 26 - CW;
      let y = a.y - CH / 2;
      if (r.shape === 'lattice' || r.shape === 'motes') { x = W / 2 - CW / 2; y = H - CH - 30; }
      x = Math.max(16, Math.min(W - CW - 16, x));
      y = Math.max(16, Math.min(H - CH - 16, y));
      const appear = Math.min(1, (now - cardT0) / 250);
      ctx.globalAlpha = appear;
      ctx.fillStyle = 'rgba(6, 14, 30, 0.92)';
      ctx.strokeStyle = 'rgba(120, 210, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(60, 160, 255, 0.6)';
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.roundRect(x, y, CW, CH, 16);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.textBaseline = 'alphabetic';
      ctx.font = '600 15px "Exo 2", "Segoe UI", sans-serif';
      ctx.fillStyle = '#5ad0ff';
      ctx.fillText(g.tag.toUpperCase(), x + PAD, y + 34);
      ctx.font = '700 30px "Exo 2", "Segoe UI", sans-serif';
      ctx.fillStyle = '#f2f8ff';
      ctx.fillText(g.name, x + PAD, y + 72);
      ctx.font = '400 20px "Exo 2", "Segoe UI", sans-serif';
      ctx.fillStyle = '#c4d2e6';
      lines.forEach(function (ln, i) { ctx.fillText(ln, x + PAD, y + 108 + i * 27); });
      ctx.restore();
    }

    // Mouse hover (canvas is scaled by Reveal, so map client coordinates)
    let mouse = null, mouseT = -1e9, cardT0 = 0, shownId = null;
    canvas.addEventListener('mousemove', function (e) {
      const rc = canvas.getBoundingClientRect();
      mouse = { x: (e.clientX - rc.left) / rc.width * W, y: (e.clientY - rc.top) / rc.height * H };
      mouseT = performance.now();
    });
    canvas.addEventListener('mouseleave', function () { mouse = null; });

    // Guided tour while the mouse is idle; key G pauses / resumes it
    // Tour starts after 10 s without mouse movement, 15 s per element; hover needs 2 s of rest
    const TOUR_IDLE = 10000, TOUR_STEP = 15000, HOVER_DELAY = 2000;
    let tourOn = true, tourI = -1, tourT0 = 0, sceneT0 = performance.now();
    let hoverId = null, hoverSince = 0;
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'g' || e.key === 'G') && canvas.offsetParent !== null) tourOn = !tourOn;
    });

    function activeRegion(now) {
      const lastActivity = Math.max(sceneT0, mouseT);
      if (mouse && now - mouseT < TOUR_IDLE) {
        // Hover: the card appears only after the mouse rests on the same element for a moment
        const r = hitTest(mouse.x, mouse.y);
        const id = r ? r.id : null;
        if (id !== hoverId) { hoverId = id; hoverSince = now; }
        tourI = -1;
        return r && now - hoverSince >= HOVER_DELAY ? r : null;
      }
      hoverId = null;
      if (!tourOn || now - lastActivity < TOUR_IDLE) return null;
      if (tourI < 0 || now - tourT0 > TOUR_STEP) {
        tourI = (tourI + 1) % GLOSSARY_TOUR.length;
        tourT0 = now;
      }
      return regionFor(GLOSSARY_TOUR[tourI]);
    }

    // Dim everything except the element being explained
    function spotlight(r, now) {
      const a = Math.min(1, (now - cardT0) / 600) * 0.62;
      if (r.shape === 'motes') return;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 3, 10,' + a.toFixed(3) + ')';
      ctx.beginPath();
      if (r.shape === 'lattice') {
        // keep the edges (where the lattice shows), dim the busy middle
        ctx.ellipse(RING.cx, RING.cy, RING.rx * 1.08, RING.ry * 1.08, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.rect(0, 0, W, H);
      if (r.shape === 'circle') {
        ctx.moveTo(r.x + r.r + 14, r.y);
        ctx.arc(r.x, r.y, r.r + 14, 0, TAU);
      } else if (r.shape === 'rect') {
        ctx.roundRect(r.x - 14, r.y - 14, r.w + 28, r.h + 28, 14);
      } else {
        const k = r.shape === 'ring' ? 1.1 : 0.88;
        ctx.moveTo(RING.cx + RING.rx * k, RING.cy);
        ctx.ellipse(RING.cx, RING.cy, RING.rx * k, RING.ry * k, 0, 0, TAU);
      }
      ctx.fill('evenodd');
      ctx.restore();
    }

    let t = 0;
    function draw(dt) {
      ctx.drawImage(bg, 0, 0);
      drawStars(t);
      drawInterference(t);
      drawRings(t);
      drawBloch(250, 225, 110, t);
      drawOrbital(1350, 230, 15, t);
      drawFringeGraph(70, 470, 280, 120, t);
      drawPacketGraph(1250, 470, 280, 120, t);
      drawFeynman(1400, 330 + 400, t);
      drawEntangled(330, 1100, 720, t);
      drawFormulas(t);
      drawMotes(dt);
      drawTitle(t);
      const now = performance.now();
      const r = activeRegion(now);
      const id = r ? r.id : null;
      if (id !== shownId) { shownId = id; cardT0 = now; }
      if (r) {
        spotlight(r, now);
        highlight(r, now);
        card(r, now);
      }
    }

    const loop = makeLoop(function (dt) {
      t += dt;
      draw(dt);
    });

    // Redraw once fonts arrive so the first frame is not in a fallback font
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(0); });
    draw(0);

    return {
      start: function () {
        sceneT0 = performance.now();
        tourI = -1;
        loop.start();
      },
      stop: loop.stop,
      setStep: function () {}
    };
  });
})();
