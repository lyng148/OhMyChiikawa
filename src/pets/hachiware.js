/*
 * Hachiware (小八) — the cheerful blue-eared cat, front-standing pose. Like
 * chiikawa it ships as a body layer plus two ear layers and CSS eyelids, so it
 * can blink and wiggle each ear on its own. It has no hand-rolling action.
 *
 * Each pointed ear is cut away from the connected blue fringe at its root. The
 * moving layers contain the blue ear and its full outer black outline only;
 * the lower fringe and face stay on the body layer so they never move with it.
 *
 * Artwork is sliced from src/images/hachiware.png (baked light-grey background
 * removed via the enclosing outline, ears cut into their own transparent layers)
 * and ships encrypted in src/assets.pak (rebuild with `chiikawa pack`).
 */
(function () {
  'use strict';
  var PET = {
    id: 'hachiware',
    name: 'Hachiware',
    nameZh: '小八',
    nameJa: 'ハチワレ',
    kind: 'image-layered',
    aspect: 720 / 942,
    natural: { w: 720, h: 942 },
    // Round cat-blob like chiikawa: scale its display height down so it doesn't
    // tower over the tall usagi at the same Size setting.
    renderScale: 0.8,
    articulated: true,
    animateEars: true,
    // A shear bends the pointed ears while keeping their diagonal roots joined
    // to the connected blue fringe (a plain rotation would open a visible gap).
    earMotion: { mode: 'skew', sway: 2.0, perk: 5, walk: 1.2, kick: 12 },
    body: 'images/hachiware/body.png',
    ears: [
      { src: 'images/hachiware/ear-left.png',  side: 'l',
        box: { x: 0.129167, y: 0.012739, w: 0.270833, h: 0.188960 }, origin: { x: 0.497436, y: 0.766854 } },
      { src: 'images/hachiware/ear-right.png', side: 'r',
        box: { x: 0.590278, y: 0.000000, w: 0.262500, h: 0.193206 }, origin: { x: 0.489418, y: 0.791209 } }
    ],
    eyes: [
      { x: 0.21250, y: 0.34926, w: 0.13333, h: 0.10722 },
      { x: 0.50000, y: 0.34820, w: 0.13750, h: 0.10722 }
    ],
    lid: 'rgb(241,241,241)',
    // Random chatter shown on click / idle (overrides the renderer default).
    // Per-language: the renderer picks zh/en/ja based on the current UI language.
    speech: {
      zh: ['完全搞不懂～', '嘿嘿嘿嘿～', '什么什么！', '没问题的！'],
      en: ['I don\'t know~', 'Hehehehe~', 'What?', 'No problem!'],
      ja: ['全然わかんない～', 'へへへへ～', 'なになに！', '大丈夫だよ！']
    },
    walk: { base: 'images/hachiware_run/hachiware_run_', count: 11, pad: 2, ext: '.png', start: 1, fps: 9 },
    actions: {
      hop: { base: 'images/hachiware_jump/hachiware_jump_', count: 4, pad: 2, ext: '.png', start: 1, fps: 8, loops: 4, scale: 1, height: 0.45 }
    },
    sounds: {
      speech: ['sounds/hachiware/wakannai.mp3', 'sounds/hachiware/oi.mp3']
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
