/**
 * Real-device kit (test/realdevice): every scenario converts cleanly, its exported JSON is up to
 * date, and the simulator shows the result the README tells you to expect on Cluster.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Quaternion, Vector3 } from '../src/sim/math';
import { createRunner } from '../src/sim/runner';
import { SCENARIOS } from './realdevice/scenarios';
import { generateCode } from './harness';

const kitDir = path.resolve(__dirname, '../../test/realdevice');
const run = (file: string) => {
  const scenario = SCENARIOS.find((s) => s.file === file)!;
  const r = createRunner(generateCode(scenario.state));
  r.start();
  return r;
};

test('real-device kit: exported JSON files are up to date (npm run realdevice:export)', () => {
  for (const s of SCENARIOS) {
    const file = path.join(kitDir, s.file);
    assert.ok(fs.existsSync(file), `${s.file} missing`);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), JSON.parse(JSON.stringify(s.state)), s.file);
  }
});

test('real-device kit: expected results in the simulator', () => {
  let r = run('rd1-position-immediate.json');
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(0, 1, 0)), 'rd1: rises 1 per interact');

  r = run('rd2-smooth-rotate.json');
  r.interact();
  r.advance(2.5);
  assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(30, 0, 0).multiply(new Quaternion().setFromEulerAngles(0, 90, 0))), 'rd2');
  assert.deepEqual(r.errors(), []);

  r = run('rd3-decimal.json');
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(0, 1, 0)), 'rd3: goes up');

  r = run('rd4-sequence-timing.json');
  r.interact();
  r.advance(2.9);
  assert.ok(r.item.position.equals(new Vector3(0, 1, 0)), 'rd4: still up at 2.9s');
  r.advance(0.2);
  assert.ok(r.item.position.equals(new Vector3(0, 0, 0)), 'rd4: back down at ~3s');

  r = run('rd5-sequence-rerun.json');
  for (let i = 0; i < 3; i++) {
    r.interact();
    r.advance(1);
  }
  assert.ok(r.item.position.equals(new Vector3(0, 1.5, 0)), 'rd5: rises 0.5 on every interact');

  r = run('rd6-flag-bool.json');
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(0, 1, 0)), 'rd6: first interact goes up');
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(0, 0, 0)), 'rd6: second goes down');

  r = run('rd7-move-local.json');
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(1, 0, 0)), 'rd7: forward after Y 90 is +X');

  r = run('rd8-ride-forward.json');
  r.ride(true);
  r.steer({ x: 0, y: 1 });
  r.advance(1);
  assert.ok(r.item.position.equals(new Vector3(0, 0, 3), 1e-3), 'rd8: +Z');
});
