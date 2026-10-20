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
import { kitFiles } from './realdevice/kit';
import { generateCode } from './harness';

const kitDir = path.resolve(__dirname, '../../test/realdevice');
const run = (file: string) => {
  const scenario = SCENARIOS.find((s) => s.file === file)!;
  const r = createRunner(generateCode(scenario.state));
  r.start();
  return r;
};

test('real-device kit: workspace JSON, scripts and CHECKLIST.md are up to date (npm run realdevice:export)', () => {
  const normalize = (t: string) => t.replace(/\r\n/g, '\n');
  for (const k of kitFiles()) {
    const file = path.join(kitDir, k.path);
    assert.ok(fs.existsSync(file), `${k.path} missing`);
    assert.equal(normalize(fs.readFileSync(file, 'utf8')), normalize(k.content), `${k.path} is stale`);
  }
  // Every scenario has its script and a line in the checklist.
  const checklist = fs.readFileSync(path.join(kitDir, 'CHECKLIST.md'), 'utf8');
  for (const s of SCENARIOS) assert.ok(checklist.includes(`scripts/${s.file.replace(/\.json$/, '.js')}`), s.file);
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

test('real-device kit: main features (rd9-rd16) in the simulator', () => {
  const yaw = (q: Quaternion) => q.createEulerAngles().y;
  const near = (a: number, b: number, eps = 1) => Math.abs(((a - b + 540) % 360) - 180) < eps;

  let r = run('rd9-spin-bob.json');
  r.advance(1);
  assert.ok(near(yaw(r.item.rotation), 45), 'rd9: 45 deg per second');
  let maxY = 0;
  for (let i = 0; i < 240; i++) {
    r.advance(1 / 60);
    maxY = Math.max(maxY, Math.abs(r.item.position.y));
  }
  assert.ok(maxY > 0.45 && maxY <= 0.5 + 1e-9, `rd9: bobs ±0.5 (max ${maxY})`);

  r = run('rd10-door.json');
  r.interact();
  r.advance(0.3);
  r.interact(); // ignored while moving
  r.advance(1.5);
  assert.ok(near(yaw(r.item.rotation), 90), 'rd10: opens 90, mid-move click ignored');
  r.interact();
  r.advance(1.5);
  assert.ok(near(yaw(r.item.rotation), 0), 'rd10: closes');

  r = run('rd11a-message-sender.json');
  r.interact();
  assert.deepEqual(r.log.filter((l) => l.type === 'send').map((l) => (l as { target: string; message: string }).message), ['open'], 'rd11a: sends open');
  r.receive('ack');
  assert.ok(near(yaw(r.item.rotation), 45), 'rd11a: turns 45 on ack');

  r = run('rd11b-message-receiver.json');
  r.receive('open');
  // The reply goes out right away, before the rise has finished (the checklist says so).
  assert.equal(r.log.filter((l) => l.type === 'send').length, 1, 'rd11b: ack is sent immediately');
  assert.ok(r.item.position.equals(new Vector3(0, 0, 0)), 'rd11b: not risen yet when replying');
  r.advance(1.2);
  assert.ok(r.item.position.equals(new Vector3(0, 1, 0), 1e-6), 'rd11b: rises 1 m');
  assert.deepEqual(r.log.filter((l) => l.type === 'send').map((l) => (l as { message: string }).message), ['ack'], 'rd11b: replies ack');

  const texts = (x: typeof r) => x.log.filter((l) => l.type === 'text').map((l) => (l as { text: string }).text);
  r = run('rd12-sound-text.json');
  for (let i = 0; i < 3; i++) r.interact();
  assert.deepEqual(texts(r), ['0', '1', '2', '3'], 'rd12: 0 -> 3');
  assert.equal(r.log.filter((l) => l.type === 'audio').length, 3, 'rd12: a sound per click');

  r = run('rd13-grab.json');
  r.grab(true);
  r.grab(false);
  assert.deepEqual(texts(r), ['持った', '離した'], 'rd13');

  r = run('rd14-collide.json');
  r.collide();
  r.collide();
  assert.deepEqual(texts(r), ['1', '2'], 'rd14: one per collision');

  r = run('rd15-player-near.json');
  r.advance(1);
  assert.ok(near(yaw(r.item.rotation), 0), 'rd15: still without a player');
  r.world.players.push(r.createHandle('player', 'p', new Vector3(0, 0, 2)));
  r.advance(1);
  assert.ok(near(yaw(r.item.rotation), 90), 'rd15: turns while a player is within 3 m');

  r = run('rd16-chase.json');
  r.world.players.push(r.createHandle('player', 'p', new Vector3(0, 0, 5)));
  r.advance(5);
  const d = r.item.position.clone().sub(new Vector3(0, 0, 5)).length();
  assert.ok(d < 2 && d > 1, `rd16: stops about 1.5 m away (${d.toFixed(2)})`);

  for (const s of SCENARIOS) {
    const x = run(s.file);
    x.advance(0.5);
    assert.deepEqual(x.errors(), [], `${s.file}: no runtime errors`);
  }
});
