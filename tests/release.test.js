const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { unzipSync } = require('fflate');
const { validateReleaseAssets, zipDirectory } = require('../tools/build-release');

test('release assets require reviewed provenance and platform scope', () => {
  assert.doesNotThrow(() => validateReleaseAssets({ assets: [] }));
  assert.throws(() => validateReleaseAssets({ assets: [{ id: 'portrait-a', status: 'reviewed' }] }), /not release-ready/);
  assert.throws(() => validateReleaseAssets({ assets: [{ id: 'portrait-a', status: 'release-ready', source: 'source.png', sha256: 'a'.repeat(64), attribution: 'credit' }] }), /no target platform/);
  assert.throws(() => validateReleaseAssets({ assets: [{ id: 'portrait-a', status: 'release-ready', source: 'source.png', sha256: 'a'.repeat(64), attribution: 'credit', platforms: ['android'] }] }), /unsupported/);
  assert.doesNotThrow(() => validateReleaseAssets({ assets: [{ id: 'portrait-a', status: 'release-ready', source: 'source.png', sha256: 'a'.repeat(64), attribution: 'credit', platforms: ['web'] }] }));
});

test('platform ZIP output is stable and contains only package files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qidu-release-test-'));
  try {
    fs.mkdirSync(path.join(root, 'nested'));
    fs.writeFileSync(path.join(root, 'nested', 'app.js'), 'main();');
    fs.writeFileSync(path.join(root, 'index.html'), '<main></main>');
    const first = zipDirectory(root, 1761955200);
    const second = zipDirectory(root, 1761955200);
    assert.deepEqual(first, second);
    const files = unzipSync(first);
    assert.deepEqual(Object.keys(files).sort(), ['index.html', 'nested/app.js']);
    assert.equal(new TextDecoder().decode(files['nested/app.js']), 'main();');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
