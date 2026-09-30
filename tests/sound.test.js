'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pets = [
  require(path.join(ROOT, 'src', 'pets', 'usagi')),
  require(path.join(ROOT, 'src', 'pets', 'chiikawa')),
  require(path.join(ROOT, 'src', 'pets', 'hachiware')),
  require(path.join(ROOT, 'src', 'pets', 'momonga'))
];

for (const pet of pets) {
  assert(pet.sounds, `pet ${pet.id} should have sounds defined`);
  assert(Array.isArray(pet.sounds.speech), `pet ${pet.id} should have speech sounds array`);
  assert(pet.sounds.speech.length > 0, `pet ${pet.id} should have at least 1 speech sound`);

  for (const src of pet.sounds.speech) {
    const fullPath = path.join(ROOT, 'src', src);
    assert(fs.existsSync(fullPath), `sound file ${src} for ${pet.id} should exist`);
    const stat = fs.statSync(fullPath);
    assert(stat.size > 1000, `sound file ${src} should be non-empty (size: ${stat.size})`);
  }

  if (pet.sounds.actions) {
    for (const action in pet.sounds.actions) {
      const src = pet.sounds.actions[action];
      const fullPath = path.join(ROOT, 'src', src);
      assert(fs.existsSync(fullPath), `action sound file ${src} for ${pet.id} should exist`);
      const stat = fs.statSync(fullPath);
      assert(stat.size > 1000, `action sound file ${src} should be non-empty (size: ${stat.size})`);
    }
  }
}

console.log('pet sound assets ok');
