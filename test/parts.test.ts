/**
 * Parts (src/parts): expansion into ordinary blocks, merging into existing events, name allocation,
 * conflict refusal, one undo step, and the resulting behavior on the simulator.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { PARTS, defaultValues, type Part } from '../src/parts/catalog';
import { channelsWrittenBy, insertPart } from '../src/parts/insert';
import { BLOCK_DEMOS } from '../src/demos/catalog';
import { recordState } from '../src/demos/playback';
import { partDemo } from '../src/parts/demo';
import { createRunner } from '../src/sim/runner';
import { b, num, onEvent, workspace } from './build';
import { conversionErrors, generateCode, loadWorkspace, saveWorkspace } from './harness';

const part = (id: string): Part => PARTS.find((p) => p.id === id)!;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function yaw(code: string, steps: (r: ReturnType<typeof createRunner>) => void): number {
  const runner = createRunner(code);
  runner.start();
  steps(runner);
  return runner.item.rotation.createEulerAngles().y;
}

const angleDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

for (const p of PARTS) {
  test(`part ${p.id}: adds to an empty workspace without conversion errors`, () => {
    const ws = loadWorkspace(workspace());
    const result = insertPart(ws, p, defaultValues(p));
    assert.ok(result.ok, result.ok ? '' : result.reason);
    assert.deepEqual(conversionErrors(saveWorkspace(ws)), []);
  });
}

test('part spin / bob / touch_turn behave as described', () => {
  const add = (id: string) => {
    const ws = loadWorkspace(workspace());
    assert.ok(insertPart(ws, part(id), defaultValues(part(id))).ok);
    return generateCode(saveWorkspace(ws));
  };
  assert.ok(angleDiff(yaw(add('spin'), (r) => r.advance(1)), 90) < 1, 'spin: 90 deg in 1 s');

  const bob = createRunner(add('bob'));
  bob.start();
  const ys: number[] = [];
  for (let i = 0; i < 240; i++) {
    bob.advance(1 / 60);
    ys.push(bob.item.position.y);
  }
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.5, 'bob moves up and down');

  assert.ok(angleDiff(yaw(add('touch_turn'), (r) => { r.interact(); r.advance(1.5); }), 90) < 1, 'touch_turn: 90 deg after a click');
});

test('part door: opens, closes, ignores clicks while moving', () => {
  const ws = loadWorkspace(workspace());
  assert.ok(insertPart(ws, part('door'), defaultValues(part('door'))).ok);
  const code = generateCode(saveWorkspace(ws));
  assert.ok(angleDiff(yaw(code, (r) => { r.interact(); r.advance(1.5); }), 90) < 1, 'open');
  assert.ok(angleDiff(yaw(code, (r) => { r.interact(); r.advance(1.5); r.interact(); r.advance(1.5); }), 0) < 1, 'closed again');
  assert.ok(angleDiff(yaw(code, (r) => { r.interact(); r.advance(0.3); r.interact(); r.advance(2); }), 90) < 1, 'click while opening is ignored');
});

test('parts go into the existing event block instead of adding a second one', () => {
  const ws = loadWorkspace(workspace(onEvent('jcreatepp_on_interact', [
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'count' }, inputs: { VALUE: num(1) } }),
  ])));
  assert.ok(insertPart(ws, part('touch_turn'), defaultValues(part('touch_turn'))).ok);
  const events = ws.getTopBlocks(false).filter((x) => x.type === 'jcreatepp_on_interact');
  assert.equal(events.length, 1);
  const types: string[] = [];
  for (let s = events[0].getInputTargetBlock('DO'); s; s = s.getNextBlock()) types.push(s.type);
  assert.deepEqual(types, ['jcreatepp_set_number_var', 'jcreatepp_smooth_rotate_by'], 'appended after the existing blocks');
  assert.deepEqual(conversionErrors(saveWorkspace(ws)), []);
});

test('part names avoid names already in use (flags and boolean variables share one namespace)', () => {
  const ws = loadWorkspace(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'ドアが開いている' }, inputs: { VALUE: b('jcreatepp_bool_literal', { fields: { BOOL: 'false' } }) } }),
  ])));
  assert.ok(insertPart(ws, part('door'), defaultValues(part('door'))).ok);
  const flags = ws.getAllBlocks(false).filter((x) => x.type === 'jcreatepp_flag' || x.type === 'jcreatepp_set_flag').map((x) => x.getFieldValue('FLAG_NAME'));
  assert.ok(flags.length > 0 && flags.every((f) => f === 'ドアが開いている2'), flags.join(','));
});

test('a part that would fight existing motion is refused and nothing is added', () => {
  const state = workspace(onEvent('jcreatepp_on_update', [b('jcreatepp_add_rotation', { inputs: { X: num(0), Y: num(1), Z: num(0) } })]));
  const ws = loadWorkspace(state);
  const before = JSON.stringify(saveWorkspace(ws));
  const result = insertPart(ws, part('spin'), defaultValues(part('spin')));
  assert.equal(result.ok, false);
  assert.match(result.ok ? '' : result.reason, /角度を〜ずつ変える/);
  assert.equal(JSON.stringify(saveWorkspace(ws)), before);
  // A part on another channel is still fine.
  assert.ok(insertPart(ws, part('bob'), defaultValues(part('bob'))).ok);
});

test('one part = one undo step (undo and redo)', async () => {
  const ws = loadWorkspace(workspace(onEvent('jcreatepp_on_interact', [])));
  await tick();
  ws.clearUndo();
  const before = JSON.stringify(saveWorkspace(ws));
  assert.ok(insertPart(ws, part('door'), defaultValues(part('door'))).ok);
  await tick();
  const after = JSON.stringify(saveWorkspace(ws));
  assert.notEqual(after, before);
  ws.undo(false);
  await tick();
  assert.equal(JSON.stringify(saveWorkspace(ws)), before, 'undo removes the whole part');
  ws.undo(true);
  await tick();
  assert.equal(ws.getAllBlocks(false).filter((x) => x.type === 'jcreatepp_if_else').length, 1, 'redo brings it back');
  assert.deepEqual(conversionErrors(saveWorkspace(ws)), []);
});

test('adding the same motion part twice is refused (two oscillations would fight)', () => {
  const ws = loadWorkspace(workspace());
  assert.ok(insertPart(ws, part('bob'), defaultValues(part('bob'))).ok);
  const second = insertPart(ws, part('bob'), defaultValues(part('bob')));
  assert.equal(second.ok, false, 'two oscillations would fight over the position');
  assert.equal(ws.getTopBlocks(false).filter((x) => x.type === 'jcreatepp_on_update').length, 1);
});

test('every block whose demo moves the item is in the conflict table', () => {
  for (const demo of BLOCK_DEMOS) {
    for (const channel of demo.reproduces) {
      assert.ok(channelsWrittenBy(demo.blockType).includes(channel), `${demo.blockType} writes ${channel}`);
    }
  }
});

test('a part that repeats an existing conversion error is still refused', () => {
  // The workspace already has one error: a wait outside a sequence.
  const wait = () => b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(1) } });
  const ws = loadWorkspace(workspace(onEvent('jcreatepp_on_start', [wait()])));
  assert.equal(conversionErrors(saveWorkspace(ws)).length, 1);
  const before = JSON.stringify(saveWorkspace(ws));
  const broken: Part = {
    id: 'broken', label: '壊れた部品', description: '', size: 'single', params: [], writes: [], names: [], demo: { seconds: 1 },
    expand: () => ({ events: [{ eventType: 'jcreatepp_on_start', body: [{ type: 'jcreatepp_wait_seconds', inputs: { SECONDS: { block: { type: 'math_number', fields: { NUM: 1 } } } } }] }] }),
  };
  const result = insertPart(ws, broken, {});
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(saveWorkspace(ws)), before, 'nothing added');
});

test('every part converts and runs at the minimum and maximum of each number parameter, on every axis', () => {
  for (const p of PARTS) {
    const variants: Record<string, number | string>[] = [];
    for (const param of p.params) {
      if (param.kind === 'number') {
        variants.push({ ...defaultValues(p), [param.key]: param.min }, { ...defaultValues(p), [param.key]: param.max });
      } else {
        for (const a of ['X', 'Y', 'Z']) variants.push({ ...defaultValues(p), [param.key]: a });
      }
    }
    for (const values of variants) {
      const ws = loadWorkspace(workspace());
      const result = insertPart(ws, p, values);
      assert.ok(result.ok, `${p.id} ${JSON.stringify(values)}`);
      const runner = createRunner(generateCode(saveWorkspace(ws)));
      runner.start();
      runner.interact();
      runner.advance(2);
      assert.deepEqual(runner.errors(), [], `${p.id} ${JSON.stringify(values)}`);
    }
  }
});

test('parts follow their axis parameter', () => {
  const run = (id: string, values: Record<string, number | string>) => {
    const ws = loadWorkspace(workspace());
    assert.ok(insertPart(ws, part(id), { ...defaultValues(part(id)), ...values }).ok);
    const runner = createRunner(generateCode(saveWorkspace(ws)));
    runner.start();
    runner.advance(0.5);
    return runner;
  };
  const bobX = run('bob', { axis: 'X' }).item.position;
  assert.ok(Math.abs(bobX.x) > 0.1 && Math.abs(bobX.y) < 1e-9 && Math.abs(bobX.z) < 1e-9, 'bob X moves only along x');
  const spinX = run('spin', { axis: 'X', speed: 90 }).item.rotation.createEulerAngles();
  assert.ok(angleDiff(spinX.x, 45) < 1 && angleDiff(spinX.y, 0) < 1 && angleDiff(spinX.z, 0) < 1, `spin X: ${JSON.stringify(spinX)}`);
});

test('part touch_turn: a click while turning restarts from the current angle (as the description says)', () => {
  const ws = loadWorkspace(workspace());
  assert.ok(insertPart(ws, part('touch_turn'), defaultValues(part('touch_turn'))).ok);
  const code = generateCode(saveWorkspace(ws));
  // 90 deg in 1 s: after 0.5 s it is at 45 deg, the second click adds 90 deg from there.
  assert.ok(angleDiff(yaw(code, (r) => { r.interact(); r.advance(0.5); r.interact(); r.advance(1.5); }), 135) < 1);
});

test('every part card sample converts, runs cleanly and shows what the part writes', () => {
  for (const p of PARTS) {
    const demo = partDemo(p);
    const track = recordState(demo.workspace, demo.seconds, demo.actions);
    assert.deepEqual(track.errors, [], p.id);
    const first = track.frames[0];
    const moved = track.frames.some((f) => f.position.clone().sub(first.position).length() > 0.1);
    const turned = track.frames.some((f) => Math.abs(f.rotation.x * first.rotation.x + f.rotation.y * first.rotation.y + f.rotation.z * first.rotation.z + f.rotation.w * first.rotation.w) < 0.9999);
    if (p.writes.includes('position')) assert.ok(moved, `${p.id} moves`);
    if (p.writes.includes('rotation')) assert.ok(turned, `${p.id} turns`);
  }
});
