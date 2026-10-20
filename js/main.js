/* Presentation bootstrap: speaker zone, Reveal.js, scene lifecycle tied to click steps */
(function () {
  'use strict';

  // Optional speaker zone from URL: ?zone=22&side=right (% of screen width); full screen by default
  const params = new URLSearchParams(location.search);
  const zone = Math.max(0, Math.min(45, parseFloat(params.get('zone') || '0')));
  document.documentElement.style.setProperty('--zone', zone + 'vw');
  if (params.get('side') === 'left') document.body.classList.add('zone-left');
  if (params.get('captions') === '1') document.body.classList.add('show-captions');

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

  // Fade to black between slides: fade out, switch, fade in. Steps inside a slide are instant.
  const fader = document.createElement('div');
  fader.id = 'fader';
  document.body.appendChild(fader);
  const FADE_MS = 450;
  let fading = false;
  function withFade(go) {
    if (fading) return;
    fading = true;
    fader.classList.add('on');
    setTimeout(function () {
      go();
      requestAnimationFrame(function () {
        fader.classList.remove('on');
        setTimeout(function () { fading = false; }, FADE_MS);
      });
    }, FADE_MS);
  }
  function goNext() {
    if (fading) return;
    if (Reveal.availableFragments().next) Reveal.next();
    else if (!Reveal.isLastSlide()) withFade(function () { Reveal.next(); });
  }
  function goPrev() {
    if (fading) return;
    if (Reveal.availableFragments().prev) Reveal.prev();
    else if (!Reveal.isFirstSlide()) withFade(function () { Reveal.prev(); });
  }

  Reveal.initialize({
    // Clicker and keyboard: right / PageDown / Space / N forward, left / PageUp / P back
    keyboard: { 39: goNext, 34: goNext, 32: goNext, 78: goNext, 40: goNext, 37: goPrev, 33: goPrev, 80: goPrev, 38: goPrev },
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
    transition: 'none',
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
