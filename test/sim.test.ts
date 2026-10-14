/**
 * Behavior tests: run generated Cluster Script on the src/sim mock.
 * Known issues from docs-internal/sequence-variable-review.md are recorded as `todo`
 * tests with the expected (fixed) behavior; they report but do not fail the run.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Quaternion, Vector3 } from '../src/sim/math';
import { createRunner } from '../src/sim/runner';
import { b, bool, num, onEvent, workspace, xyz } from './build';
import { generateCode } from './harness';

const fixtureDir = path.resolve(__dirname, '../../test/fixtures');

// ── math (Cluster conventions) ──

test('math: Y +90 degrees turns forward (+Z) to +X', () => {
  const q = new Quaternion().setFromEulerAngles(new Vector3(0, 90, 0));
  assert.ok(new Vector3(0, 0, 1).applyQuaternion(q).equals(new Vector3(1, 0, 0)));
});

test('math: Euler order is ZXY (q = qY * qX * qZ)', () => {
  const e = new Vector3(30, 45, 60);
  const q = new Quaternion().setFromEulerAngles(e);
  const manual = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 45)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 30))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 60));
  assert.ok(q.equals(manual));
  assert.ok(new Quaternion().setFromEulerAngles(q.createEulerAngles()).equals(q), 'createEulerAngles round-trips');
});

test('math: mutating methods return this, clone does not alias', () => {
  const v = new Vector3(1, 2, 3);
  const c = v.clone();
  assert.equal(v.add(new Vector3(1, 1, 1)), v);
  assert.deepEqual([c.x, c.y, c.z], [1, 2, 3]);
});

// ── every fixture runs on the mock ──

for (const file of fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json') && f !== 'errors.json')) {
  test(`fixture runs without runtime errors: ${file}`, () => {
    const code = generateCode(JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8')));
    const r = createRunner(code);
    r.start();
    r.advance(1);
    r.interact();
    r.grab(true);
    r.grab(false);
    r.collide();
    r.receive('open', 3);
    r.receive('push');
    r.ride(true);
    r.steer({ x: 0, y: 1 }); // Vector2: y = forward
    r.steerAdditionalAxis(1);
    r.advance(1);
    r.ride(false);
    r.advance(10);
    assert.deepEqual(r.errors(), []);
    assert.deepEqual([...r.unsupported], [], 'generated code uses $ APIs the mock does not provide');
  });
}

test('runner: advance() carries fractional time over to later calls', () => {
  const r = createRunner('');
  for (let i = 0; i < 100; i++) r.advance(0.01, 1 / 60);
  assert.ok(Math.abs(r.time - 1) < 1 / 60, `time=${r.time}`);
});

test('ride template moves the item while ridden and steered forward', () => {
  const code = generateCode(JSON.parse(fs.readFileSync(path.join(fixtureDir, 'templates.json'), 'utf8')));
  const r = createRunner(code);
  r.ride(true);
  r.steer({ x: 0, y: 1 }); // Vector2: y = forward
  r.advance(1);
  assert.ok(r.item.position.length() > 0, 'moved while riding');
  assert.deepEqual(r.errors(), []);
});

// ── trace mode (3D preview): reports blocks, never changes behavior ──

function exercise(code: string, onTrace?: (id: string, phase: string) => void) {
  const r = createRunner(code, { onTrace });
  r.start();
  r.advance(0.5);
  r.interact();
  r.collide();
  r.receive('open', 3);
  r.ride(true);
  r.steer({ x: 0.5, y: 1 });
  r.advance(3);
  return { state: JSON.stringify(Object.entries(r.$.state).sort()), pos: r.item.position, rot: r.item.rotation, log: JSON.stringify(r.log) };
}

for (const file of fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json') && f !== 'errors.json')) {
  test(`trace on/off behaves the same: ${file}`, () => {
    const state = JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
    assert.equal(generateCode(state, { trace: false }), generateCode(state), 'trace:false must equal the default output');
    const plain = exercise(generateCode(state));
    const traced = exercise(generateCode(state, { trace: true }), () => undefined);
    assert.equal(traced.state, plain.state);
    assert.equal(traced.log, plain.log);
    assert.ok(traced.pos.equals(plain.pos) && traced.rot.equals(plain.rot));
  });
}

test('trace reports run / wait / tick with block ids', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_move_by', { id: 'move', inputs: { ...xyz(0, 1, 0), DURATION: num(1) } }),
    b('jcreatepp_sequence', { id: 'seq', stmts: { DO: [b('jcreatepp_wait_seconds', { id: 'wait', inputs: { SECONDS: num(1) } })] } }),
  ])), { trace: true });
  const seen = new Set<string>();
  exercise(code, (id, phase) => seen.add(`${id}:${phase}`));
  for (const expected of ['move:run', 'move:tick', 'seq:run', 'wait:wait']) assert.ok(seen.has(expected), `missing ${expected}`);
});

// ── state values are not aliased by later movement ──

test('save position -> move -> load position restores the saved point', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_start', [
      b('jcreatepp_set_position', { inputs: xyz(1, 2, 3) }),
      b('jcreatepp_save_position'),
      b('jcreatepp_add_position', { inputs: xyz(5, 0, 0) }),
    ]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_load_position')]),
  ));
  const r = createRunner(code);
  r.start();
  assert.ok(r.item.position.equals(new Vector3(6, 2, 3)));
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(1, 2, 3)));
});

test('oscillate keeps its origin across several periods', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_update', [b('jcreatepp_oscillate', { fields: { AXIS: 'X' }, inputs: { WIDTH: num(2), SPEED: num(Math.PI) } })]),
  ));
  const r = createRunner(code, { position: new Vector3(10, 0, 0) });
  r.advance(4, 1 / 60); // two full periods (sin(PI * t))
  assert.ok(Math.abs(r.item.position.x - 10) < 0.2, `x=${r.item.position.x}`);
});

// ── rotation semantics: smooth rotate == rotate_by ──

test('smooth rotate ends at the same rotation as rotate_by, even from a tilted start', () => {
  const tilted = new Quaternion().setFromEulerAngles(new Vector3(30, 20, 10));
  const delta = { X: num(45), Y: num(90), Z: num(-30) };
  const instant = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [b('jcreatepp_add_rotation', { inputs: delta })]))), { rotation: tilted });
  const smooth = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_rotate_by', { inputs: { X: num(45), Y: num(90), Z: num(-30), DURATION: num(1) } }),
  ]))), { rotation: tilted });
  instant.interact();
  smooth.interact();
  smooth.advance(1.5);
  assert.ok(smooth.item.rotation.equals(instant.item.rotation));
});

test('smooth rotate keeps full turns (Y 360 passes through 180 halfway)', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_rotate_by', { inputs: { X: num(0), Y: num(360), Z: num(0), DURATION: num(2) } }),
  ]))));
  r.interact();
  r.advance(1);
  assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(0, 180, 0)), 'halfway is 180 degrees');
  r.advance(1.5);
  assert.ok(r.item.rotation.equals(new Quaternion()), 'ends back at the start orientation');
});

// ── known issues (docs-internal/sequence-variable-review.md) ──

test('S-1: collision target inside a sequence must not throw at runtime', { todo: 'known issue S-1' }, () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_collide', [
    b('jcreatepp_sequence', { stmts: { DO: [
      b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(0.1) } }),
      b('jcreatepp_send_message_to_collision_once', { fields: { MESSAGE: 'hit' }, inputs: { CONDITION: bool(true) } }),
    ] } }),
  ])));
  const r = createRunner(code);
  r.collide();
  r.advance(1);
  assert.deepEqual(r.errors(), []);
});

test('S-4: three 1s waits finish at 3s regardless of frame time', { todo: 'known issue S-4' }, () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_sequence', { stmts: { DO: [
      b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } }),
      b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } }),
      b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } }),
      b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'done', OPERATION: 'true' } }),
    ] } }),
  ])));
  for (const dt of [1 / 60, 0.25]) {
    const r = createRunner(code);
    r.start();
    while (!r.$.state['__jpp_flag_done'] && r.time < 10) r.update(dt);
    assert.ok(Math.abs(r.time - 3) <= dt + 1e-9, `dt=${dt}: finished at ${r.time}`);
  }
});

test('S-5: if_edge inside a sequence fires on every run of the sequence', { todo: 'known issue S-5 (spec undecided)' }, () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_sequence', { stmts: { DO: [
      b('jcreatepp_if_edge', { inputs: { CONDITION: bool(true) }, stmts: { DO: [
        b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'fired' }, inputs: { DELTA: num(1) } }),
      ] } }),
      b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(0.1) } }),
    ] } }),
  ])));
  const r = createRunner(code);
  r.interact();
  r.advance(0.5);
  r.interact();
  r.advance(0.5);
  assert.equal(r.$.state['var.fired'], 2);
});
