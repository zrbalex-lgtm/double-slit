/* Background for the "quantum world" overview slide: drifting glowing quanta and faint wave rings */
(function () {
  'use strict';

  const W = 1600, H = 900, TAU = Math.PI * 2;

  Scenes.register('qworld', function (canvas) {
    const ctx = canvas.getContext('2d');
    const dots = [];
    for (let i = 0; i < 90; i++) {
      dots.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.5) * 14,
        r: 1.5 + Math.random() * 2.5,
        c: Math.random() < 0.5 ? '110, 200, 255' : '200, 140, 255'
      });
    }
    let t = 0;

    function draw(dt) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 950);
      g.addColorStop(0, '#0c1534');
      g.addColorStop(1, '#010207');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Expanding rings from two sources, like the slits
      ctx.save();
      ctx.lineWidth = 1.5;
      [[W * 0.5 - 60, H * 0.55], [W * 0.5 + 60, H * 0.55]].forEach(function (src) {
        for (let k = 0; k < 9; k++) {
          const r = (((t * 40 + k * 110) % 990) + 990) % 990;
          if (r < 1) continue;
          ctx.strokeStyle = 'rgba(110, 180, 255,' + (0.09 * (1 - r / 990)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(src[0], src[1], r, 0, TAU);
          ctx.stroke();
        }
      });
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      dots.forEach(function (d) {
        d.x = (d.x + d.vx * dt + W) % W;
        d.y = (d.y + d.vy * dt + H) % H;
        const gr = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 5);
        gr.addColorStop(0, 'rgba(' + d.c + ', 0.6)');
        gr.addColorStop(1, 'rgba(' + d.c + ', 0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * 5, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
    }

    const loop = makeLoop(function (dt) {
      t += dt;
      draw(dt);
    });
    draw(0);
    return { start: loop.start, stop: loop.stop, setStep: function () {} };
  });
})();
