/**
 * P8: preview keyboard -> ride input follows the Cluster API (src/preview/steerInput.ts).
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { SteerInput } from '../src/preview/steerInput';

test('diagonal input is normalized to length 1 (Cluster: 0..1)', () => {
  const s = new SteerInput();
  s.press('KeyW');
  const change = s.press('KeyD');
  assert.ok(change.steer);
  assert.ok(Math.abs(Math.hypot(change.steer!.x, change.steer!.y) - 1) < 1e-9);
  assert.ok(change.steer!.x > 0 && change.steer!.y > 0);
});

test('only the input that changed is notified', () => {
  const s = new SteerInput();
  assert.deepEqual(s.press('KeyW'), { steer: { x: 0, y: 1 } });
  assert.deepEqual(s.press('KeyE'), { axis: 1 }, 'up/down does not resend the planar input');
  assert.deepEqual(s.press('KeyW'), {}, 'key repeat sends nothing');
  assert.deepEqual(s.release('KeyE'), { axis: 0 });
});

test('two keys for the same action: releasing one keeps the other held', () => {
  const s = new SteerInput();
  s.press('KeyW');
  s.press('ArrowUp');
  assert.deepEqual(s.release('KeyW'), {}, 'still moving forward with ↑');
  assert.deepEqual(s.release('ArrowUp'), { steer: { x: 0, y: 0 } });
});

test('clear releases everything (focus lost) and reports the stop once', () => {
  const s = new SteerInput();
  s.press('KeyS');
  s.press('KeyQ');
  assert.deepEqual(s.clear(), { steer: { x: 0, y: 0 }, axis: 0 });
  assert.deepEqual(s.clear(), {});
});

test('unrelated keys are ignored', () => {
  const s = new SteerInput();
  assert.equal(SteerInput.handles('KeyZ'), false);
  assert.deepEqual(s.press('KeyZ'), {});
});
