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
import { toolbox } from '../src/toolbox';
import { blocks } from '../src/blocks/jcreatepp';

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

test('a "run" trace fires before its statement (3D move basis = position before the move)', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_position', { id: 'place', inputs: xyz(5, 0, 0) }),
    b('jcreatepp_add_position', { id: 'move', inputs: xyz(1, 0, 0) }),
  ])), { trace: true });
  const before = new Map<string, number>();
  const r: ReturnType<typeof createRunner> = createRunner(code, {
    onTrace: (id, phase) => {
      if (phase === 'run') before.set(id, r.item.position.x);
    },
  });
  r.start();
  assert.equal(before.get('move'), 5, 'basis is the position before the move');
  assert.equal(r.item.position.x, 6, 'basis + delta = actual result');
});

test('3D turn basis: rotation before the block * euler(delta) equals the actual result', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_rotation', { inputs: xyz(20, 40, 0) }),
    b('jcreatepp_add_rotation', { id: 'turn', inputs: xyz(10, 30, 5) }),
  ])), { trace: true });
  let basis: Quaternion | null = null;
  const r: ReturnType<typeof createRunner> = createRunner(code, {
    onTrace: (id, phase) => {
      if (id === 'turn' && phase === 'run') basis = r.item.rotation.clone();
    },
  });
  r.start();
  const predicted = basis!.clone().multiply(new Quaternion().setFromEulerAngles(new Vector3(10, 30, 5)));
  assert.ok(predicted.equals(r.item.rotation));
  // And the inverse used when committing a drag recovers the delta.
  const delta = basis!.clone().invert().multiply(r.item.rotation).createEulerAngles();
  assert.ok(new Quaternion().setFromEulerAngles(delta).equals(new Quaternion().setFromEulerAngles(new Vector3(10, 30, 5))));
});

// ── P3: movement relative to the item's facing ──

test('move_local: forward follows the facing (Y 90 -> forward is +X), right is +X rotated', () => {
  const r = createRunner(generateCode(workspace(
    onEvent('jcreatepp_on_start', [b('jcreatepp_set_rotation', { inputs: xyz(0, 90, 0) })]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_move_local', { inputs: xyz(0, 0, 2) })]),
    onEvent('jcreatepp_on_grab_start', [b('jcreatepp_move_local', { inputs: xyz(1, 0, 0) })]),
  )));
  r.start();
  r.interact();
  assert.ok(r.item.position.equals(new Vector3(2, 0, 0)), JSON.stringify(r.item.position));
  r.grab(true);
  // Facing +X, so "right" is -Z (left-handed, like Unity).
  assert.ok(r.item.position.equals(new Vector3(2, 0, -1)), JSON.stringify(r.item.position));
});

test('smooth_move_local keeps the direction it had when it started, even if the item turns', () => {
  const r = createRunner(generateCode(workspace(
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_move_local', { inputs: { ...xyz(0, 0, 2), DURATION: num(1) } })]),
    onEvent('jcreatepp_on_grab_start', [b('jcreatepp_set_rotation', { inputs: xyz(0, 90, 0) })]),
  )));
  r.interact();
  r.advance(0.5);
  r.grab(true); // turn mid-move
  r.advance(1);
  assert.ok(r.item.position.equals(new Vector3(0, 0, 2)), JSON.stringify(r.item.position));
});

test('smooth_move_local has the same placement rules as the world-space smooth move', () => {
  assert.throws(() => generateCode(workspace(onEvent('jcreatepp_on_update', [
    b('jcreatepp_smooth_move_local', { inputs: { ...xyz(0, 0, 1), DURATION: num(1) } }),
  ]))), /「毎フレーム」の中には置けません/);
});

test('3D local basis: pre-run position + offset turned by pre-run facing equals the result, and inverts back', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_rotation', { inputs: xyz(10, 60, 0) }),
    b('jcreatepp_move_local', { id: 'local', inputs: xyz(1, 2, 3) }),
  ])), { trace: true });
  let pos: Vector3 | null = null;
  let rot: Quaternion | null = null;
  const r: ReturnType<typeof createRunner> = createRunner(code, {
    onTrace: (id, phase) => {
      if (id === 'local' && phase === 'run') {
        pos = r.item.position.clone();
        rot = r.item.rotation.clone();
      }
    },
  });
  r.start();
  assert.ok(pos!.clone().add(new Vector3(1, 2, 3).applyQuaternion(rot!)).equals(r.item.position));
  const back = r.item.position.clone().sub(pos!).applyQuaternion(rot!.clone().invert());
  assert.ok(back.equals(new Vector3(1, 2, 3)), JSON.stringify(back));
});

test('block ids that differ only in symbols keep separate state (smooth moves run independently)', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_move_by', { id: 'a-b', inputs: { ...xyz(1, 0, 0), DURATION: num(1) } }),
    b('jcreatepp_smooth_move_local', { id: 'a+b', inputs: { ...xyz(0, 1, 0), DURATION: num(1) } }),
  ]))));
  r.interact();
  r.advance(2);
  assert.ok(r.item.position.equals(new Vector3(1, 1, 0)) || r.item.position.equals(new Vector3(0, 1, 0)) || r.item.position.equals(new Vector3(1, 0, 0)));
  const keys = Object.keys(r.$.state).filter((k) => k.endsWith('_active'));
  assert.equal(keys.length, 2, `separate state keys: ${keys.join(', ')}`);
});

test('V-3: arithmetic has no binary float noise, while "=" stays exact', () => {
  const v = (name: string) => b('jcreatepp_number_var', { fields: { VAR_NAME: name } });
  const arith = (op: string, a: object, c: object) => b('jcreatepp_arithmetic', { fields: { OP: op }, inputs: { A: a as any, B: c as any } });
  const eq = (a: object, c: object) => b('jcreatepp_compare', { fields: { OP: 'EQ' }, inputs: { A: a as any, B: c as any } });
  const setNum = (name: string, value: object) => b('jcreatepp_set_number_var', { fields: { VAR_NAME: name }, inputs: { VALUE: value as any } });
  const setBool = (name: string, value: object) => b('jcreatepp_set_bool_var', { fields: { VAR_NAME: name }, inputs: { VALUE: value as any } });
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_start', [
    setBool('sum', eq(arith('ADD', num(0.1), num(0.2)), num(0.3))),
    b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'acc' }, inputs: { DELTA: num(0.1) } }),
    b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'acc' }, inputs: { DELTA: num(0.1) } }),
    b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'acc' }, inputs: { DELTA: num(0.1) } }),
    setBool('acc03', eq(v('acc'), num(0.3))),
    setBool('third', eq(arith('MUL', arith('DIV', num(1), num(3)), num(3)), num(1))),
    setBool('close', eq(num(0.3), num(0.3000001))),
    setNum('big', arith('ADD', num(999999999999999), num(0))),
  ]))));
  r.start();
  const s = r.$.state;
  assert.equal(s['bool.sum'], true, '0.1 + 0.2 = 0.3');
  assert.equal(s['var.acc'], 0.3, '0.1 added three times');
  assert.equal(s['bool.acc03'], true);
  assert.equal(s['bool.third'], true, '1 / 3 * 3 = 1');
  assert.equal(s['bool.close'], false, 'no tolerance: different numbers are not equal');
  assert.equal(s['var.big'], 999999999999999, 'large integers stay exact');
});

test('V-3: normalization keeps huge finite values finite, applies to cooldown starts, and is emitted only when needed', () => {
  const arith = (op: string, a: object, c: object) => b('jcreatepp_arithmetic', { fields: { OP: op }, inputs: { A: a as any, B: c as any } });
  const code = generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'max' }, inputs: { VALUE: arith('ADD', num(Number.MAX_VALUE), num(0)) } }),
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'neg' }, inputs: { VALUE: arith('SUB', num(-Number.MAX_VALUE), num(0)) } }),
    b('jcreatepp_start_cooldown', { fields: { COOLDOWN_NAME: 'cd' }, inputs: { SECONDS: arith('ADD', num(0.1), num(0.2)) } }),
  ])));
  assert.equal(code.split('const roundDecimal').length - 1, 1, 'helper defined once');
  const r = createRunner(code);
  r.start();
  assert.equal(r.$.state['var.max'], Number.MAX_VALUE);
  assert.equal(r.$.state['var.neg'], -Number.MAX_VALUE);
  assert.equal(r.$.state['__jpp_cd_cd'], 0.3);
  assert.ok(!generateCode(workspace(onEvent('jcreatepp_on_start', [b('jcreatepp_save_position')]))).includes('roundDecimal'), 'no helper without arithmetic');
});

test('V-4: flag names "true" / "false" stay literals when read (documented exception)', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'true' }, inputs: { VALUE: bool(false) } }),
    b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'seen' }, inputs: { VALUE: b('jcreatepp_flag', { fields: { FLAG_NAME: 'true' } }) } }),
  ]))));
  r.start();
  assert.equal(r.$.state['bool.seen'], true);
});

test('V-4: a flag and a boolean variable with the same name are the same value', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'open', OPERATION: 'true' } }),
    b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'fromFlag' }, inputs: { VALUE: b('jcreatepp_bool_var', { fields: { VAR_NAME: 'open' } }) } }),
    b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'lamp' }, inputs: { VALUE: bool(true) } }),
    b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'lamp', OPERATION: 'toggle' } }),
  ]))));
  r.start();
  assert.equal(r.$.state['bool.fromFlag'], true, 'bool var sees the flag');
  assert.equal(r.$.state['bool.lamp'], false, 'flag toggles the bool var');
});

// ── P8: ride template direction and steering ──

const rideState = (forwardAxis?: string) => workspace(b('jcreatepp_ride_template', {
  fields: forwardAxis ? { FORWARD_AXIS: forwardAxis } : undefined,
  inputs: { FORWARD_SPEED: num(5), UP_DOWN_SPEED: num(2), TURN_SPEED: num(90) },
}));

function rideFor(code: string, yaw: number, input: { x: number; y: number }, axis = 0, seconds = 1) {
  const r = createRunner(code, { rotation: new Quaternion().setFromEulerAngles(0, yaw, 0) });
  r.ride(true);
  r.steer(input);
  r.steerAdditionalAxis(axis);
  r.advance(seconds);
  return r;
}

test('ride template "アイテムの前（+Z）" moves toward the item front, like move_local', () => {
  const code = generateCode(rideState('Z'));
  assert.ok(rideFor(code, 0, { x: 0, y: 1 }).item.position.equals(new Vector3(0, 0, 5), 1e-3));
  assert.ok(rideFor(code, 90, { x: 0, y: 1 }).item.position.equals(new Vector3(5, 0, 0), 1e-3));
  assert.ok(rideFor(code, 0, { x: 0, y: -1 }).item.position.equals(new Vector3(0, 0, -5), 1e-3), 'backwards');
  assert.ok(rideFor(code, 0, { x: 0, y: 0 }, 1).item.position.equals(new Vector3(0, 2, 0), 1e-3), 'up');
});

test('ride template without the field (older saves) keeps the original movement (-X at yaw 0)', () => {
  const code = generateCode(rideState());
  assert.ok(rideFor(code, 0, { x: 0, y: 1 }).item.position.equals(new Vector3(-5, 0, 0), 1e-3));
  assert.equal(code, generateCode(rideState('LEGACY')));
});

test('ride steering: right input turns right (yaw +90 per second at turn speed 90)', () => {
  const r = rideFor(generateCode(rideState('Z')), 0, { x: 1, y: 0 });
  assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(0, 90, 0), 1e-4));
});

test('the toolbox places new ride templates with "アイテムの前（+Z）"', () => {
  const toolboxJson = JSON.stringify(toolbox);
  assert.match(toolboxJson, /"type":"jcreatepp_ride_template","fields":\{"FORWARD_AXIS":"Z"\}/);
});

// ── generated code safety ──

test('user text cannot break out of a comment or string (U+2028 / U+2029 / newlines)', () => {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  const evil = (sep: string) => `a${sep}$.state.injected = true; //`;
  for (const sep of [LS, PS, '\n', '*/']) {
    const code = generateCode(workspace(
      onEvent('jcreatepp_on_receive', [b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'got' }, inputs: { VALUE: num(1) } })], { MESSAGE: evil(sep) }),
      onEvent('jcreatepp_on_start', [b('jcreatepp_sequence', { id: evil(sep), stmts: { DO: [b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(0.1) } })] } })]),
    ));
    const r = createRunner(code);
    r.start();
    r.advance(0.5);
    r.receive('other');
    assert.equal(r.$.state.injected, undefined, `separator ${JSON.stringify(sep)}`);
    r.receive(evil(sep));
    assert.equal(r.$.state['var.got'], 1, 'the message name still matches exactly');
  }
});

test('timers ignore negative or missing frame times (cooldown, smooth move / rotate)', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_start_cooldown', { fields: { COOLDOWN_NAME: 'cd' }, inputs: { SECONDS: num(2) } }),
    b('jcreatepp_smooth_move_by', { inputs: { ...xyz(1, 0, 0), DURATION: num(1) } }),
    b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(1) } }),
  ])));
  const r = createRunner(code);
  r.interact();
  r.update(-1);
  r.update(undefined as unknown as number);
  r.update(NaN);
  r.update(Infinity);
  r.update(-Infinity);
  assert.equal(r.$.state['__jpp_cd_cd'], 2);
  assert.ok(r.item.position.equals(new Vector3(0, 0, 0)), JSON.stringify(r.item.position));
  assert.ok(r.item.rotation.equals(new Quaternion()));
  r.advance(1.5);
  assert.ok(r.item.position.equals(new Vector3(1, 0, 0)), 'still finishes with normal frames');
});

test('every-frame motion ignores NaN / infinite frame times too (oscillate, continuous rotation)', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_update', [
    b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: num(1), SPEED: num(1) } }),
    b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(90) } }),
  ])));
  const r = createRunner(code);
  for (const dt of [NaN, Infinity, -Infinity, -1, undefined as unknown as number]) r.update(dt);
  assert.ok(r.item.position.equals(new Vector3(0, 0, 0)), JSON.stringify(r.item.position));
  assert.ok(r.item.rotation.equals(new Quaternion()), JSON.stringify(r.item.rotation));
});

test('a zero-second smooth move / rotate finishes on the next frame without NaN', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_move_by', { inputs: { ...xyz(0, 2, 0), DURATION: num(0) } }),
    b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(-1) } }),
  ]))));
  r.interact();
  r.update(1 / 60);
  assert.ok(r.item.position.equals(new Vector3(0, 2, 0)), JSON.stringify(r.item.position));
  assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(new Vector3(0, 90, 0))));
});

test('interacting again while turning starts a new turn from the current angle (documented behavior)', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(1) } }),
  ]))));
  r.interact();
  r.advance(0.5);
  r.interact();
  r.advance(1.5);
  assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(new Vector3(0, 135, 0))), 'ends at 45 + 90 degrees');
});

// ── several blocks moving the same thing add up (src/codegen/pose.ts) ──

/** Runs with Cluster-like getters too: they return the transform as it was at the start of the frame. */
const bothGetters = (code: string, check: (r: ReturnType<typeof createRunner>, lagging: boolean) => void, options: { position?: Vector3; rotation?: Quaternion } = {}) => {
  for (const laggingGetters of [false, true]) {
    const r = createRunner(code, { ...options, laggingGetters });
    check(r, laggingGetters);
    assert.deepEqual(r.errors(), [], `lagging=${laggingGetters}: runtime errors`);
  }
};
const near = (a: Vector3, b: Vector3, eps = 1e-6) => a.clone().sub(b).length() < eps;

test('combine: up-down and left-right oscillations both move the item', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_update', [
    b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: num(1), SPEED: num(Math.PI / 2) } }),
    b('jcreatepp_oscillate', { fields: { AXIS: 'X' }, inputs: { WIDTH: num(2), SPEED: num(Math.PI / 2) } }),
  ])));
  bothGetters(code, (r, lagging) => {
    r.advance(1); // a quarter period: both at their widest
    assert.ok(near(r.item.position, new Vector3(12, 1, 0)), `lagging=${lagging}: ${JSON.stringify(r.item.position)}`);
    r.advance(3); // a whole period: back at the center
    assert.ok(near(r.item.position, new Vector3(10, 0, 0), 1e-4), `lagging=${lagging}: ${JSON.stringify(r.item.position)}`);
  }, { position: new Vector3(10, 0, 0) });
});

test('combine: a smooth move adds to an oscillation', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_update', [b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: num(1), SPEED: num(Math.PI / 2) } })]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_move_by', { inputs: { ...xyz(0, 0, 3), DURATION: num(1) } })]),
  ));
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.advance(1);
    assert.ok(near(r.item.position, new Vector3(0, 1, 3)), `lagging=${lagging}: ${JSON.stringify(r.item.position)}`);
  });
});

test('combine: two smooth turns running at the same time add up', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(1) } })]),
    onEvent('jcreatepp_on_receive', [b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 45, 0), DURATION: num(2) } })], { MESSAGE: 'turn' }),
  ));
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.receive('turn');
    r.advance(3);
    assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(new Vector3(0, 135, 0))), `lagging=${lagging}: ${JSON.stringify(r.item.rotation)}`);
  });
});

test('combine: a continuous rotation and a smooth turn add up', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_update', [b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(30) } })]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(1) } })]),
  ));
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.advance(2);
    assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(new Vector3(0, 150, 0))), `lagging=${lagging}: ${JSON.stringify(r.item.rotation.createEulerAngles())}`);
  });
});

test('a single moving block is generated as before and does not need the getters to be up to date', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_move_by', { inputs: { ...xyz(1, 2, 3), DURATION: num(1) } })])));
  assert.ok(!code.includes('itemPosition'), 'no remembered position with one moving block');
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.advance(1.5);
    assert.ok(r.item.position.equals(new Vector3(1, 2, 3)), `lagging=${lagging}`);
  });
});

test('combine: releasing a held item forgets the remembered position (moves continue from where it is)', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_move_by', { inputs: { ...xyz(1, 0, 0), DURATION: num(1) } })]),
    onEvent('jcreatepp_on_receive', [b('jcreatepp_add_position', { inputs: xyz(0, 1, 0) })], { MESSAGE: 'up' }),
    onEvent('jcreatepp_on_grab_end', [b('jcreatepp_set_jump_speed', { inputs: { RATE: num(1) } })]),
  ));
  const r = createRunner(code);
  r.interact();
  r.advance(1.5);
  r.grab(true);
  r.item.position = new Vector3(5, 5, 5); // carried somewhere by the hand
  r.grab(false);
  r.receive('up');
  assert.ok(r.item.position.equals(new Vector3(5, 6, 5)), JSON.stringify(r.item.position));
});

test('combine: an item moved by something else (no grab blocks: physics, a hand) continues from where it is', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_add_position', { inputs: xyz(1, 0, 0) }),
    b('jcreatepp_add_position', { inputs: xyz(1, 0, 0) }),
  ])));
  assert.ok(code.includes('placeItem('), 'combined form');
  assert.ok(!code.includes('$.onGrab'), 'no grab handler');
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.update(1 / 60);
    assert.ok(near(r.item.position, new Vector3(2, 0, 0)), `lagging=${lagging}: ${JSON.stringify(r.item.position)}`);
    r.item.position = new Vector3(10, 0, 3); // moved by something other than this script
    r.update(1 / 60);
    r.interact();
    assert.ok(near(r.item.position, new Vector3(12, 0, 3)), `lagging=${lagging}: ${JSON.stringify(r.item.position)}`);
  });
});

test('combine: moved off the middle of a long move (30 cm), the item continues from where it is', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_add_position', { inputs: xyz(5, 0, 0) }),
    b('jcreatepp_add_position', { inputs: xyz(5, 0, 0) }),
  ])));
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.item.position = new Vector3(5, 0.3, 0); // halfway along the move, 30 cm to the side
    r.update(1 / 60);
    r.interact();
    assert.ok(near(r.item.position, new Vector3(15, 0.3, 0)), `lagging=${lagging}: ${JSON.stringify(r.item.position)}`);
  });
});

test('combine: moved back along the line of a finished move, the item continues from where it is (getters up to date)', () => {
  // With Cluster's getters this one cannot be told apart from the item still on its way: see pose.ts.
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_add_position', { inputs: xyz(5, 0, 0) }),
    b('jcreatepp_add_position', { inputs: xyz(5, 0, 0) }),
  ])));
  const r = createRunner(code);
  r.interact();
  r.item.position = new Vector3(7, 0, 0);
  r.interact();
  assert.ok(near(r.item.position, new Vector3(17, 0, 0)), JSON.stringify(r.item.position));
});

test('combine: turned off the middle of a long turn, the item continues from the angle it has', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_add_rotation', { inputs: xyz(0, 80, 0) }),
    b('jcreatepp_add_rotation', { inputs: xyz(0, 80, 0) }),
  ])));
  bothGetters(code, (r, lagging) => {
    r.interact();
    const turned = new Quaternion().setFromEulerAngles(new Vector3(10, 80, 0)); // halfway, tilted 10 degrees
    r.item.rotation = turned.clone();
    r.update(1 / 60);
    r.interact();
    const want = turned.clone().multiply(new Quaternion().setFromEulerAngles(new Vector3(0, 160, 0)));
    assert.ok(r.item.rotation.equals(want, 1e-6), `lagging=${lagging}: ${JSON.stringify(r.item.rotation.createEulerAngles())}`);
  });
});

test('combine: the same angle written with the other sign (-x, -y, -z, -w) is not taken for an outside turn', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_add_rotation', { inputs: xyz(0, 80, 0) }),
    b('jcreatepp_add_rotation', { inputs: xyz(0, 0, 0) }), // the remembered angle stays where it is (from == q)
  ])));
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.update(1 / 60);
    const q = r.item.rotation;
    r.item.rotation = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    r.update(1 / 60);
    r.interact();
    const yaw = r.item.rotation.createEulerAngles().y;
    assert.ok(Math.abs(yaw - 160) < 1e-6 && [r.item.rotation.x, r.item.rotation.w].every(Number.isFinite), `lagging=${lagging}: yaw ${yaw}`);
  });
});

test('combine: interpolating getters, and slow motion with getters some frames behind, are not taken for outside moves', () => {
  // The remembered pose only counts as moved from outside when the getter leaves the way of the last
  // move. With interpolation toward the new pose it never does. With the transform of n frames ago it
  // does once the motion curves enough in n frames: these slow motions hold up to 12 frames (0.2 s), a
  // fast one already at 1-2 frames (see the next test). Up to the start of the frame (laggingGetters)
  // it holds at any speed.
  const programs = {
    'position, curved (two oscillations)': [
      b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: num(1), SPEED: num(2) } }),
      b('jcreatepp_oscillate', { fields: { AXIS: 'X' }, inputs: { WIDTH: num(2), SPEED: num(3) } }),
    ],
    'rotation, two axes': [
      b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(120) } }),
      b('jcreatepp_continuous_rotation', { fields: { AXIS: 'X' }, inputs: { SPEED: num(45) } }),
    ],
  };
  for (const [name, body] of Object.entries(programs)) {
    const code = generateCode(workspace(onEvent('jcreatepp_on_update', body)));
    for (const options of [{ smoothGetters: 0.3 }, { delayedGetters: 3 }, { delayedGetters: 12 }]) {
      const ref = createRunner(code);
      const r = createRunner(code, options);
      for (let f = 0; f < 600; f++) {
        ref.update(1 / 60);
        r.update(1 / 60);
        const angle = (2 * Math.acos(Math.min(1, Math.abs(r.item.rotation.dot(ref.item.rotation)))) * 180) / Math.PI;
        if (!near(r.item.position, ref.item.position, 1e-6) || angle > 1e-3) assert.fail(`${name} ${JSON.stringify(options)}: differs at frame ${f}`);
      }
      assert.deepEqual(r.errors(), []);
    }
  }
});

test('lag models: one extra frame halves a single turn; start-of-frame getters keep fast combined motion exact', () => {
  // In these lag models a single "keep turning" reads the getter directly: one extra frame of lag halves
  // its speed, and a fast combined motion with one extra frame can be misjudged; with start-of-frame
  // getters both are exact. rd9 shows how getRotation keeps up for a slow single turn only; combined
  // position and rotation are checked on the device by rd17 and rd18.
  const spin = generateCode(workspace(onEvent('jcreatepp_on_update', [b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(45) } })])));
  const yawAfter2s = (options: object) => {
    const r = createRunner(spin, options);
    r.advance(2);
    return r.item.rotation.createEulerAngles().y;
  };
  assert.ok(Math.abs(yawAfter2s({ laggingGetters: true }) - 90) < 1e-6);
  assert.ok(Math.abs(yawAfter2s({ delayedGetters: 1 }) - 45) < 1e-6, 'one extra frame: half the speed');

  const fast = generateCode(workspace(onEvent('jcreatepp_on_update', [
    b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: num(3), SPEED: num(10) } }),
    b('jcreatepp_oscillate', { fields: { AXIS: 'X' }, inputs: { WIDTH: num(3), SPEED: num(10) } }),
  ])));
  const ref = createRunner(fast);
  const lagging = createRunner(fast, { laggingGetters: true });
  for (let f = 0; f < 600; f++) {
    ref.update(1 / 60);
    lagging.update(1 / 60);
    if (!near(lagging.item.position, ref.item.position, 1e-6)) assert.fail(`fast, start-of-frame getters: differs at frame ${f}`);
  }
});

test('combine: an item turned by something else continues from the angle it has', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_add_rotation', { inputs: xyz(0, 10, 0) }),
    b('jcreatepp_add_rotation', { inputs: xyz(0, 10, 0) }),
  ])));
  assert.ok(code.includes('turnItem('), 'combined form');
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.update(1 / 60);
    r.item.rotation = new Quaternion().setFromEulerAngles(new Vector3(0, 90, 0));
    r.update(1 / 60);
    r.interact();
    assert.ok(r.item.rotation.equals(new Quaternion().setFromEulerAngles(new Vector3(0, 110, 0)), 1e-6), `lagging=${lagging}: ${JSON.stringify(r.item.rotation.createEulerAngles())}`);
  });
});

test('combine: two smooth turns on different axes at the same time end the same at any usual frame rate', () => {
  // Turning on X and Y together is one turn about the axis between them; frame by frame it is built
  // from small steps, so it differs slightly with the frame rate (not with the order of the blocks).
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(90, 0, 0), DURATION: num(1) } }),
    b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, 90, 0), DURATION: num(1) } }),
  ])));
  const at = (fps: number) => {
    const r = createRunner(code);
    r.interact();
    r.advance(1.5, 1 / fps);
    return r.item.rotation;
  };
  const degrees = (a: Quaternion, b: Quaternion) => (2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))) * 180) / Math.PI;
  for (const fps of [30, 60, 90]) assert.ok(degrees(at(fps), at(144)) < 2, `${fps} fps vs 144 fps: ${degrees(at(fps), at(144))} degrees`);
});

test('combine: state left by an earlier JS (without the new keys) starts the move over instead of breaking', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_update', [
    b('jcreatepp_oscillate', { id: 'o', fields: { AXIS: 'Y' }, inputs: { WIDTH: num(1), SPEED: num(1) } }),
    b('jcreatepp_timed_move_return', { id: 't', inputs: { ...xyz(1, 0, 0), SPEED: num(1), DURATION: num(1) } }),
  ])));
  bothGetters(code, (r, lagging) => {
    r.advance(0.5);
    // An earlier JS kept the center / "moving" flags, but not the keys added for combining.
    delete (r.$.state as Record<string, unknown>)['__jpp_osc_offset_o'];
    delete (r.$.state as Record<string, unknown>)['__jpp_move_return_moved_t'];
    r.advance(0.5);
    const p = r.item.position;
    assert.ok([p.x, p.y, p.z].every(Number.isFinite), `lagging=${lagging}: ${JSON.stringify(p)}`);
  });
});

test('combine: "move for a while and return" takes back only its own move', () => {
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_update', [b('jcreatepp_timed_move_return', { inputs: { ...xyz(1, 0, 0), SPEED: num(1), DURATION: num(1) } })]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_add_position', { inputs: xyz(0, 5, 0) })]),
  ));
  bothGetters(code, (r, lagging) => {
    r.advance(0.5);
    r.interact(); // moved up by another block while this one is moving
    // Frame by frame until it goes back (it starts over on the next frame: it runs every frame).
    let frames = 0;
    while (r.item.position.x > 1e-9 && frames++ < 60) r.update(1 / 60);
    assert.ok(frames < 60, `lagging=${lagging}: went back on x`);
    assert.ok(Math.abs(r.item.position.y - 5) < 1e-9, `lagging=${lagging}: the other move stays ${JSON.stringify(r.item.position)}`);
  });
});

test('combine: an oscillation whose width changes while it runs stays around its center', () => {
  const width = b('jcreatepp_number_var', { fields: { VAR_NAME: 'w' } });
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_start', [b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'w' }, inputs: { VALUE: num(2) } })]),
    onEvent('jcreatepp_on_update', [
      b('jcreatepp_oscillate', { fields: { AXIS: 'Y' }, inputs: { WIDTH: width, SPEED: num(Math.PI / 2) } }),
      b('jcreatepp_oscillate', { fields: { AXIS: 'X' }, inputs: { WIDTH: num(0), SPEED: num(1) } }),
    ]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'w' }, inputs: { VALUE: num(0) } })]),
  ));
  bothGetters(code, (r, lagging) => {
    r.start();
    r.advance(1); // at the widest point (y = 2)
    assert.ok(Math.abs(r.item.position.y - 2) < 1e-6, `lagging=${lagging}: ${r.item.position.y}`);
    r.interact(); // width 0: the swing stops at the center
    r.advance(0.5);
    assert.ok(Math.abs(r.item.position.y) < 1e-9, `lagging=${lagging}: back at the center ${r.item.position.y}`);
  });
});

test('combine: a turn on several axes from a tilted start still ends like rotate_by', () => {
  const tilted = new Quaternion().setFromEulerAngles(new Vector3(30, 20, 10));
  const delta = { X: num(45), Y: num(90), Z: num(-30) };
  const instant = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [b('jcreatepp_add_rotation', { inputs: delta })]))), { rotation: tilted });
  instant.interact();
  // A second rotating block (never run) switches the turn to the combined form.
  const code = generateCode(workspace(
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_rotate_by', { inputs: { X: num(45), Y: num(90), Z: num(-30), DURATION: num(1) } })]),
    onEvent('jcreatepp_on_receive', [b('jcreatepp_add_rotation', { inputs: xyz(0, 0, 90) })], { MESSAGE: 'never' }),
  ));
  assert.ok(code.includes('turnItem('), 'combined form');
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.advance(0.37, 0.05);
    r.advance(1, 0.07);
    assert.ok(r.item.rotation.equals(instant.item.rotation), `lagging=${lagging}`);
  }, { rotation: tilted });
});

test('trace: a smooth step in a sequence reports run once when it starts (the 3D preview records its start)', () => {
  const phases: string[] = [];
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_sequence', { stmts: { DO: [b('jcreatepp_smooth_move_by', { id: 'm', inputs: { ...xyz(1, 0, 0), DURATION: num(0.5) } })] } }),
  ])), { trace: true });
  const r = createRunner(code, { onTrace: (id, phase) => id === 'm' && phases.push(phase) });
  r.interact();
  r.advance(1);
  assert.equal(phases.filter((p) => p === 'run').length, 1, phases.join(','));
  assert.ok(phases.includes('wait'));
});

// ── a smooth move / turn directly in a sequence is a step the sequence waits for ──

test('sequence: turn 90 degrees in 1 s, wait 2 s, turn back in 1 s', () => {
  const turn = (y: number) => b('jcreatepp_smooth_rotate_by', { inputs: { ...xyz(0, y, 0), DURATION: num(1) } });
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_sequence', { stmts: { DO: [turn(90), b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(2) } }), turn(-90)] } }),
  ])));
  const angle = (r: ReturnType<typeof createRunner>) => r.item.rotation.createEulerAngles().y;
  bothGetters(code, (r, lagging) => {
    r.interact();
    r.advance(0.5, 0.1);
    assert.ok(Math.abs(angle(r) - 45) < 1e-6, `lagging=${lagging}: halfway ${angle(r)}`);
    r.advance(0.5, 0.1);
    assert.ok(Math.abs(angle(r) - 90) < 1e-6, `lagging=${lagging}: turned ${angle(r)}`);
    r.advance(1.9, 0.1);
    assert.ok(Math.abs(angle(r) - 90) < 1e-6, `lagging=${lagging}: still waiting ${angle(r)}`);
    r.advance(0.6, 0.1); // 3.5 s: 0.5 s into the turn back
    assert.ok(Math.abs(angle(r) - 45) < 1e-6, `lagging=${lagging}: turning back ${angle(r)}`);
    r.advance(1, 0.1);
    assert.ok(r.item.rotation.equals(new Quaternion()), `lagging=${lagging}: back at the start`);
    const active = Object.entries(r.$.state).filter(([k, v]) => k.endsWith('_active') && v === true);
    assert.deepEqual(active, [], 'nothing left running');
  });
});

test('sequence: a smooth move hands its spare frame time to the next step', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_sequence', { stmts: { DO: [
      b('jcreatepp_smooth_move_by', { inputs: { ...xyz(1, 0, 0), DURATION: num(0.25) } }),
      b('jcreatepp_smooth_move_by', { inputs: { ...xyz(0, 1, 0), DURATION: num(0.25) } }),
    ] } }),
  ])));
  const r = createRunner(code);
  r.interact();
  r.update(0.375); // the first move ends and the second is half done in the same frame
  assert.ok(near(r.item.position, new Vector3(1, 0.5, 0)), JSON.stringify(r.item.position));
  assert.deepEqual(r.errors(), []);
});

test('sequence: no block allowed inside "N seconds, every frame" reads deltaTime', () => {
  // The step runs its body with the whole frame's deltaTime (not the part of the frame it uses, after
  // time carried over from an earlier step or at the end of the N seconds). That is only right while no
  // block placed inside reads it; if one is allowed there one day, give the body the time it uses.
  for (const type of Object.keys(blocks)) {
    const def = (blocks as Record<string, Record<string, unknown>>)[type];
    if (def.output !== undefined || type.includes('_on_')) continue;
    const inputs: Record<string, ReturnType<typeof num>> = {};
    for (let k = 0; k < 4; k++) {
      for (const arg of (def[`args${k}`] as { type: string; name: string }[] | undefined) ?? []) if (arg.type === 'input_value') inputs[arg.name] = num(1);
    }
    const state = workspace(onEvent('jcreatepp_on_interact', [
      b('jcreatepp_sequence', { stmts: { DO: [b('jcreatepp_run_for_seconds', { inputs: { SECONDS: num(1) }, stmts: { DO: [b(type, { inputs })] } })] } }),
    ]));
    let code: string;
    try {
      code = generateCode(state);
    } catch {
      continue; // not allowed there
    }
    const from = code.indexOf('if (budget > 0 && start < seconds) {');
    const body = code.slice(from, code.indexOf('\n        }\n', from));
    assert.ok(from >= 0 && !/\bdeltaTime\b/.test(body), `${type} reads deltaTime inside "N seconds, every frame"`);
  }
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

test('S-1 (fixed): collision target inside a sequence is a conversion error, not a runtime crash', () => {
  const inSequence = (step: object) => workspace(onEvent('jcreatepp_on_collide', [
    b('jcreatepp_sequence', { stmts: { DO: [b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(0.1) } }), step as any] } }),
  ]));
  // send to the collision target
  assert.throws(() => generateCode(inSequence(
    b('jcreatepp_send_message_to_collision_once', { fields: { MESSAGE: 'hit' }, inputs: { CONDITION: bool(true) } }),
  )), /衝突相手」は「一連の動作」/);
  // collision target used as a sent value
  assert.throws(() => generateCode(inSequence(
    b('jcreatepp_send_message_value_to_item_once', { fields: { ITEM_NAME: 'door', MESSAGE: 'who', VALUE_TYPE: 'number' }, inputs: { CONDITION: bool(true), VALUE: b('jcreatepp_collision_target') } }),
  )), /衝突相手」は「一連の動作」/);
  // directly in the collide event it still works
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_collide', [
    b('jcreatepp_send_message_to_collision_once', { fields: { MESSAGE: 'hit' }, inputs: { CONDITION: bool(true) } }),
  ]))));
  r.collide();
  assert.deepEqual(r.errors(), []);
  assert.equal(r.log.filter((l) => l.type === 'send').length, 1);
});

test('collision target sent as a number value is rejected (use handle)', () => {
  assert.throws(() => generateCode(workspace(onEvent('jcreatepp_on_collide', [
    b('jcreatepp_send_message_value_to_item_once', { fields: { ITEM_NAME: 'door', MESSAGE: 'who', VALUE_TYPE: 'number' }, inputs: { CONDITION: bool(true), VALUE: b('jcreatepp_collision_target') } }),
  ]))), /数値として送れません/);
});

test('V-1 (fixed): number and arithmetic blocks can be shown as text', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'A', COMPONENT: 'TextMeshPro' }, inputs: { TEXT: num(5) } }),
    b('jcreatepp_set_subnode_text', { fields: { SUBNODE_NAME: 'B', COMPONENT: 'TextMeshPro' }, inputs: { TEXT: b('jcreatepp_arithmetic', { fields: { OP: 'ADD' }, inputs: { A: num(1), B: num(2) } }) } }),
  ]))));
  r.interact();
  assert.deepEqual(r.log.filter((l) => l.type === 'text').map((l) => (l as { text: string }).text), ['5', '3']);
});

test('string-mode message values are sent as text even from number blocks', () => {
  const r = createRunner(generateCode(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_send_message_value_to_item_once', { fields: { ITEM_NAME: 'board', MESSAGE: 'n', VALUE_TYPE: 'string' }, inputs: { CONDITION: bool(true), VALUE: num(3) } }),
    b('jcreatepp_send_message_value_to_item_once', { fields: { ITEM_NAME: 'board', MESSAGE: 's', VALUE_TYPE: 'string' }, inputs: { CONDITION: bool(true), VALUE: b('jcreatepp_string_literal', { fields: { TEXT: 'hi' } }) } }),
  ]))));
  r.interact();
  assert.deepEqual(r.log.filter((l) => l.type === 'send').map((l) => (l as { arg: unknown }).arg), ['3', 'hi']);
});

test('V-2 (fixed): flags named true / false and empty flag names are conversion errors', () => {
  const setFlag = (name: string) => workspace(onEvent('jcreatepp_on_start', [b('jcreatepp_set_flag', { fields: { FLAG_NAME: name, OPERATION: 'true' } })]));
  assert.throws(() => generateCode(setFlag('false')), /「true」「false」はフラグ名に使えません/);
  assert.throws(() => generateCode(setFlag('true')), /「true」「false」はフラグ名に使えません/);
  assert.throws(() => generateCode(setFlag('')), /フラグ名を入力してください/);
  assert.throws(() => generateCode(setFlag('__jpp_x')), /フラグ名に jpp\. \/ __jpp_ から始まる名前は使えません/);
  assert.doesNotThrow(() => generateCode(setFlag('door')));
});

test('S-4 (fixed): three 1s waits finish at 3s regardless of frame time', () => {
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
    while (!r.$.state['bool.done'] && r.time < 10) r.update(dt);
    assert.ok(Math.abs(r.time - 3) <= dt + 1e-9, `dt=${dt}: finished at ${r.time}`);
  }
});

test('run for N seconds: body runs on each frame overlapping the window, next step at N seconds', () => {
  const code = generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_sequence', { stmts: { DO: [
      b('jcreatepp_run_for_seconds', { inputs: { SECONDS: num(1) }, stmts: { DO: [
        b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'frames' }, inputs: { DELTA: num(1) } }),
      ] } }),
      b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'done', OPERATION: 'true' } }),
    ] } }),
  ])));
  for (const [dt, frames] of [[0.25, 4], [0.3, 4], [0.6, 2]] as const) {
    const r = createRunner(code);
    r.start();
    while (!r.$.state['bool.done'] && r.time < 5) r.update(dt);
    assert.equal(r.$.state['var.frames'], frames, `dt=${dt}`);
    assert.ok(r.time >= 1 - 1e-9 && r.time < 1 + dt, `dt=${dt}: done at ${r.time}`);
  }
});

test('sequence timing edge cases: no body run without time, negative seconds give no extra time', () => {
  const seq = (...steps: object[]) => generateCode(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_sequence', { stmts: { DO: [...(steps as any[]), b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'done', OPERATION: 'true' } })] } }),
  ])));
  const count = (seconds: number) => b('jcreatepp_run_for_seconds', { inputs: { SECONDS: num(seconds) }, stmts: { DO: [
    b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'frames' }, inputs: { DELTA: num(1) } }),
  ] } });
  const wait = (seconds: number) => b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(seconds) } });

  // wait(1) uses the whole first 1s frame; run_for(1) must start on the next frame only.
  let r = createRunner(seq(wait(1), count(1)));
  r.start();
  r.update(1);
  assert.equal(r.$.state['var.frames'], undefined, 'no body run with zero remaining time');
  r.update(1);
  assert.equal(r.$.state['var.frames'], 1);

  // A negative wait is instant and does not add time for the following wait.
  r = createRunner(seq(wait(-10), wait(5)));
  r.start();
  r.update(0.1);
  assert.ok(!r.$.state['bool.done']);

  // A tiny positive run_for still runs its body once.
  r = createRunner(seq(count(0.0000005)));
  r.start();
  r.update(0.1);
  assert.equal(r.$.state['var.frames'], 1);
});

test('S-5 (fixed): if_edge inside a sequence fires on every run of the sequence', () => {
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
