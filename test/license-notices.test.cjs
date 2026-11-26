const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { notices } = require('../scripts/license-notices');

test('Web notices preserve full three.js text and Blockly attribution', () => {
  const three = require.resolve('three');
  const text = notices([three, three, require.resolve('blockly/core')]);
  assert.equal(text.split('## three@').length - 1, 1);
  assert.ok(text.includes(fs.readFileSync(path.join(__dirname, '../node_modules/three/LICENSE'), 'utf8')));
  assert.ok(text.includes('Copyright Google LLC'));
  assert.ok(text.includes(fs.readFileSync(path.join(__dirname, '../licenses/blockly-12.5.1.txt'), 'utf8')));
});

test('guide notices include font and embedded icon licenses', () => {
  const text = notices([], { fonts: true });
  for (const file of ['Inter-OFL.txt', 'Lucide-ISC.txt'])
    assert.ok(text.includes(fs.readFileSync(path.join(__dirname, '../licenses', file), 'utf8')));
});

test('unknown bundled packages without text fail instead of disappearing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcreatepp-license-'));
  const pkg = path.join(dir, 'node_modules', 'missing-notice');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'missing-notice', version: '1.0.0', license: 'MIT' }));
  assert.throws(() => notices([path.join(pkg, 'index.js')]), /missing-notice@1.0.0/);
  fs.writeFileSync(path.join(pkg, 'NOTICE'), 'Attribution alone is not a license');
  assert.throws(() => notices([path.join(pkg, 'index.js')]), /missing-notice@1.0.0/);
});

test('original NOTICE text is retained along with LICENSE', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jcreatepp-license-'));
  const pkg = path.join(dir, 'node_modules', 'with-notice');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'with-notice', version: '1.0.0' }));
  fs.writeFileSync(path.join(pkg, 'LICENSE'), 'original license text');
  fs.writeFileSync(path.join(pkg, 'NOTICE'), 'original attribution text');
  const text = notices([path.join(pkg, 'index.js')]);
  assert.ok(text.includes('original license text'));
  assert.ok(text.includes('original attribution text'));
});

test('Unity package carries the same main license as the repository', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, '../LICENSE'), 'utf8'), fs.readFileSync(path.join(__dirname, '../unity/Jcreatepp/LICENSE'), 'utf8'));
  assert.equal(require('../unity/Jcreatepp/package.json').license, 'Apache-2.0');
});
