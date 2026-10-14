/**
 * Regression tests: workspace JSON (save format) -> generated Cluster Script.
 *
 * Each test/fixtures/<name>.json is loaded headlessly and its output is compared with
 * test/__snapshots__/<name>.txt. A missing snapshot is a failure.
 * To create or accept intended output changes: npm run test:update
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateReport, loadWorkspace, saveWorkspace } from './harness';

// Compiled to .test-build/test/, sources live in test/
const testDir = path.resolve(__dirname, '../../test');
const fixtureDir = path.join(testDir, 'fixtures');
const snapshotDir = path.join(testDir, '__snapshots__');
const update = process.argv.includes('--update-snapshots');

const fixtures = fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json')).sort();

for (const file of fixtures) {
  const name = path.basename(file, '.json');
  const state = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));

  test(`codegen snapshot: ${name}`, () => {
    const actual = generateReport(loadWorkspace(state));
    const snapPath = path.join(snapshotDir, `${name}.txt`);

    if (update) {
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(snapPath, actual);
      return;
    }
    assert.ok(fs.existsSync(snapPath), `Snapshot missing for ${name}. Run: npm run test:update`);
    const expected = fs.readFileSync(snapPath, 'utf8').replace(/\r\n/g, '\n');
    assert.equal(actual, expected, `Generated output changed for ${name}. If intended, run: npm run test:update`);
  });

  test(`save/load round-trip: ${name}`, () => {
    const first = loadWorkspace(state);
    const saved = saveWorkspace(first);
    const second = loadWorkspace(saved);
    assert.deepEqual(saveWorkspace(second), saved, 'Saving a reloaded workspace must be stable');
    assert.equal(generateReport(second), generateReport(first), 'Reloaded workspace must generate the same output');
  });
}
