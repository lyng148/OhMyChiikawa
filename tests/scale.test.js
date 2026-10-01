'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// 1. Verify src/main.js SCALES definition
const mainJs = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
const mainScalesMatch = mainJs.match(/const\s+SCALES\s*=\s*(\{[^}]+\});/);
assert(mainScalesMatch, 'main.js should define SCALES');
const mainScales = eval('(' + mainScalesMatch[1] + ')');

assert.strictEqual(mainScales.small, 150, 'small scale should be 150');
assert.strictEqual(mainScales.tiny, 75, 'tiny scale should be 75');
assert.strictEqual(mainScales.tiny, mainScales.small * 0.5, 'tiny should be 50% smaller than small');
assert.deepStrictEqual(Object.keys(mainScales), ['tiny', 'small', 'medium', 'large']);

// 2. Verify src/renderer.js SCALES definition
const rendererJs = fs.readFileSync(path.join(ROOT, 'src', 'renderer.js'), 'utf8');
const rendererScalesMatch = rendererJs.match(/var\s+SCALES\s*=\s*(\{[^}]+\});/);
assert(rendererScalesMatch, 'renderer.js should define SCALES');
const rendererScales = eval('(' + rendererScalesMatch[1] + ')');
assert.deepStrictEqual(rendererScales, mainScales, 'renderer SCALES should match main SCALES');

// 3. Verify chiikawa.js CLI options
const chiikawaJs = fs.readFileSync(path.join(ROOT, 'chiikawa.js'), 'utf8');
const sizesMatch = chiikawaJs.match(/const\s+SIZES\s*=\s*(\[[^\]]+\]);/);
assert(sizesMatch, 'chiikawa.js should define SIZES');
const sizes = eval(sizesMatch[1]);
assert.deepStrictEqual(sizes, ['tiny', 'small', 'medium', 'large'], 'chiikawa.js SIZES should include tiny');

console.log('scale options ok');
