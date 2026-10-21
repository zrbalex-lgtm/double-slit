/* Electrons as little pieces of waves: wave packets drift across the screen.
   Each packet is a complex wave inside a Gaussian envelope, drawn as a twisting helix
   (real part bright, imaginary part dim) over a soft glow of |psi|^2. Background only, no clicks. */
(function () {
  'use strict';

  const W = 1600, H = 900, TAU = Math.PI * 2;

  Scenes.register('packets', function (canvas) {
    const ctx = canvas.getContext('2d');

    const bg = document.createElement('canvas');
    bg.width = W;
    bg.height = H;
    (function () {
      const g = bg.getContext('2d');
      const r = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 950);
      r.addColorStop(0, '#0b1634');
      r.addColorStop(0.6, '#050a1a');
      r.addColorStop(1, '#010205');
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 200; i++) {
        g.fillStyle = 'rgba(210, 225, 255,' + (0.1 + Math.random() * 0.4).toFixed(2) + ')';
        const s = Math.random() * 1.4 + 0.3;
        g.fillRect(Math.random() * W, Math.random() * H, s, s);
      }
      // faint horizontal guide lines, like lanes of flight
      g.strokeStyle = 'rgba(90, 150, 230, 0.06)';
      for (let y = 90; y < H; y += 90) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(W, y);
        g.stroke();
      }
    })();

    const LANES = [150, 290, 440, 590, 740];
    let packets = [];
    let t = 0;

    function spawn(lane, x) {
      packets.push({
        x: x === undefined ? -260 - Math.random() * 700 : x,
        y: LANES[lane] + (Math.random() - 0.5) * 30,
        v: 150 + Math.random() * 70,
        sigma: 55 + Math.random() * 20,
        lambda: 26 + Math.random() * 8,
        amp: 46 + Math.random() * 10,
        ph: Math.random() * TAU,
        lane: lane
      });
    }
    LANES.forEach(function (_, i) { spawn(i, Math.random() * W); });

    function drawPacket(p) {
      const k = TAU / p.lambda;
      const w = p.v * k;                      // carrier rotates as the packet moves
      const span = p.sigma * 3.2;
      // |psi|^2 glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, span);
      g.addColorStop(0, 'rgba(90, 220, 255, 0.28)');
      g.addColorStop(1, 'rgba(90, 220, 255, 0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.45);
      ctx.translate(-p.x, -p.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, span, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.restore();

      // Helix: imaginary part (behind, dim), then real part (front, bright)
      [[Math.PI / 2, 'rgba(200, 130, 255, 0.55)', 2, 0], [0, 'rgba(140, 235, 255, 0.95)', 3, 14]].forEach(function (s) {
        ctx.save();
        ctx.strokeStyle = s[1];
        ctx.lineWidth = s[2];
        ctx.shadowColor = s[1];
        ctx.shadowBlur = s[3];
        ctx.beginPath();
        for (let dx = -span; dx <= span; dx += 2) {
          const env = Math.exp(-dx * dx / (2 * p.sigma * p.sigma));
          const v = Math.cos(k * dx - w * t * 0.25 + p.ph + s[0]) * env;
          const y = p.y - v * p.amp;
          if (dx === -span) ctx.moveTo(p.x + dx, y);
          else ctx.lineTo(p.x + dx, y);
        }
        ctx.stroke();
        ctx.restore();
      });
      // axis of flight through the packet
      ctx.save();
      ctx.strokeStyle = 'rgba(140, 200, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - span, p.y);
      ctx.lineTo(p.x + span, p.y);
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      ctx.drawImage(bg, 0, 0);
      packets.forEach(drawPacket);
    }

    const loop = makeLoop(function (dt) {
      t += dt;
      packets.forEach(function (p) {
        p.x += p.v * dt;
        p.sigma += dt * 1.5;        // packets slowly spread out
        p.amp = Math.max(28, p.amp - dt * 0.6);
      });
      const gone = packets.filter(function (p) { return p.x - p.sigma * 3.2 > W; });
      packets = packets.filter(function (p) { return p.x - p.sigma * 3.2 <= W; });
      gone.forEach(function (p) { spawn(p.lane); });
      draw();
      drawPlaque(ctx, { year: '1924 · 1927', place: 'Франция, Париж · США, Нью-Йорк',
        who: 'Луи де Бройль: у частиц есть волна · Дэвиссон и Джермер: дифракция электронов' }, 30, 762);
    });

    draw();
    return { start: loop.start, stop: loop.stop, setStep: function () {} };
  });
})();
