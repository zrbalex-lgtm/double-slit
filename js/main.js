/* Presentation bootstrap: speaker zone, Reveal.js, scene lifecycle tied to click steps */
(function () {
  'use strict';

  // Optional speaker zone from URL: ?zone=22&side=right (% of screen width); full screen by default
  const params = new URLSearchParams(location.search);
  const zone = Math.max(0, Math.min(45, parseFloat(params.get('zone') || '0')));
  document.documentElement.style.setProperty('--zone', zone + 'vw');
  if (params.get('side') === 'left') document.body.classList.add('zone-left');

  // Create scene instances for every canvas slide
  const instances = [];
  document.querySelectorAll('section[data-scene]').forEach(function (sec) {
    const inst = Scenes.create(sec.dataset.scene, sec.querySelector('canvas'), sec.querySelector('.caption'));
    if (inst) instances.push({ section: sec, scene: inst });
  });

  // Number of click steps already shown on a slide
  function stepOf(section) {
    return section.querySelectorAll('.fragment.step.visible').length;
  }

  // Run only the scene on the current slide and feed it the current step
  function sync() {
    const cur = Reveal.getCurrentSlide();
    instances.forEach(function (it) {
      if (it.section === cur) {
        it.scene.setStep(stepOf(cur));
        it.scene.start();
      } else {
        it.scene.stop();
      }
    });
  }

  Reveal.initialize({
    width: 1600,
    height: 900,
    margin: 0,
    minScale: 0.1,
    maxScale: 4,
    embedded: true,
    center: false,
    controls: false,
    progress: false,
    hash: true,
    transition: 'fade',
    backgroundTransition: 'none',
    plugins: [RevealNotes]
  });

  ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden'].forEach(function (ev) {
    Reveal.on(ev, sync);
  });

  // Recompute layout when the window or projector resolution changes
  window.addEventListener('resize', function () {
    Reveal.layout();
  });
})();
