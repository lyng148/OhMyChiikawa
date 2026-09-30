/*
 * Momonga (莫莫伽) — front-standing pose. Its ears are clipped at the open root:
 * each moving layer keeps the complete outer black outline and ear interior,
 * while the white face and blue tail remain exclusively on the body layer.
 *
 * Double-clicking plays an in-place rolling sequence as a transparent overlay.
 * Every frame shares one canvas so Momonga and the surrounding droplets stay
 * centered without changing the desktop pet window size during playback.
 *
 * Artwork is processed from src/images/momonga.jpeg (yellow background removed,
 * ears cropped into transparent overlay layers) and ships encrypted in
 * src/assets.pak (rebuild with `chiikawa pack`).
 */
(function () {
  'use strict';
  var PET = {
    id: 'momonga',
    name: 'Momonga',
    nameZh: '莫莫伽',
    nameJa: 'モモンガ',
    kind: 'image-layered',
    aspect: 1,
    natural: { w: 1080, h: 1080 },
    renderScale: 0.82,
    articulated: true,
    animateEars: true,
    // Keep both open ear roots seated on the head while the tips wiggle.
    earMotion: { mode: 'skew', sway: 2.0, perk: 5, walk: 1.2, kick: 12 },
    body: 'images/momonga/body.png',
    ears: [
      { src: 'images/momonga/ear-left.png', side: 'l',
        box: { x: 0.175926, y: 0.082407, w: 0.195370, h: 0.230556 }, origin: { x: 0.665877, y: 0.887550 } },
      { src: 'images/momonga/ear-right.png', side: 'r',
        box: { x: 0.563889, y: 0.084259, w: 0.192593, h: 0.232407 }, origin: { x: 0.372596, y: 0.878486 } }
    ],
    eyes: [
      { x: 0.27407, y: 0.42130, w: 0.11667, h: 0.11111 },
      { x: 0.53519, y: 0.42130, w: 0.11667, h: 0.11111 }
    ],
    lid: 'rgb(255,255,255)',
    // Match Usagi's 11 fps, two-loop double-click reaction. The wider source
    // canvas includes the detached droplets; 1.2x fills Momonga's padded window.
    actions: {
      roll: {
        base: 'images/momonga_rolling/momonga_rolling_', count: 11, pad: 2, ext: '.png', start: 1,
        fps: 11, loops: 2, scale: 1.2,
        speech: { zh: '不要！不要！', en: 'No! No!', ja: 'やだ！やだ！' }
      }
    },
    speech: {
      zh: ['哼哼～', '诶嘿嘿', '可爱吧？', '我也要！'],
      en: ['Hehe~', 'Ehehe', 'Cute, right?', 'Me too!'],
      ja: ['ふふん～', 'えへへ', 'かわいいでしょ？', 'ぼくも！']
    },
    sounds: {
      speech: ['sounds/momonga/homero.mp3', 'sounds/momonga/sparkle.mp3'],
      actions: { roll: 'sounds/momonga/yada.mp3' }
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
