/*
 * Usagi (default) — the front-standing pose: a body layer plus separate ear
 * layers and CSS eyelids, so it can blink and wiggle each ear on its own.
 * Artwork ships encrypted in src/assets.pak (rebuild with `chiikawa pack`).
 *
 * Double-click (or click the paws) plays the hand-rolling action as an overlay;
 * the roll frames share this same 600x910 framing so the rabbit keeps its
 * on-screen size through the switch. The image-sequence variant is internal and
 * only exists to keep the hand-rolling transition seamless.
 */
(function () {
  'use strict';
  var PET = {
    id: 'usagi',
    name: 'Usagi',
    nameZh: '乌萨奇',
    nameJa: 'うさぎ',
    kind: 'image-layered',
    aspect: 600 / 910,
    natural: { w: 600, h: 910 },
    articulated: true,
    body: 'images/usagi/body.png',
    ears: [
      { src: 'images/usagi/ear-left.png',  side: 'l',
        box: { x: 0.30333, y: 0.04945, w: 0.19833, h: 0.25824 }, origin: { x: 0.48319, y: 1.0 } },
      { src: 'images/usagi/ear-right.png', side: 'r',
        box: { x: 0.50167, y: 0.04176, w: 0.21333, h: 0.26593 }, origin: { x: 0.50781, y: 1.0 } }
    ],
    eyes: [
      { x: 0.27667, y: 0.48681, w: 0.10667, h: 0.07143 },
      { x: 0.54500, y: 0.48242, w: 0.11333, h: 0.07143 }
    ],
    lid: 'rgb(254,243,219)',
    // Hand-rolling overlay. The 11 roll frames are re-canvased to this pet's
    // 600x910 framing so the rabbit stays the same on-screen size when switching.
    // 11 frames / 11 fps x 2 loops = 2.0s playback (the hands roll for ~2s).
    actions: {
      roll: { base: 'images/usagi_roll/usagi_roll_', count: 11, pad: 2, ext: '.png', start: 1, fps: 11, loops: 2 }
    },
    // Run cycle played while walking across the screen (6 frames re-canvased to a
    // shared 735x960 framing, background removed). Facing is flipped by the renderer.
    walk: { base: 'images/usagi_run/usagi_run_', count: 6, pad: 2, ext: '.png', start: 1, fps: 9 },
    sounds: {
      speech: ['sounds/usagi/yaha.mp3', 'sounds/usagi/huh.mp3'],
      actions: { roll: 'sounds/usagi/roll.mp3' }
    }
  };
  var api = (typeof window !== 'undefined') ? window : globalThis;
  api.PetRegistry = api.PetRegistry || {
    _pets: {}, register: function (p) { this._pets[p.id] = p; return p; },
    get: function (id) { return this._pets[id]; }, ids: function () { return Object.keys(this._pets); }
  };
  api.PetRegistry.register(PET);
  if (typeof module !== 'undefined' && module.exports) { module.exports = PET; }
})();
