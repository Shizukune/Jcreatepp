/**
 * Preview layout data (src/preview/programInfo.ts, stateRows.ts): which event buttons are shown,
 * sequence display names (with the same key as the generated state), and the "changed" mark.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { describeSequences, hasAnyEvent, previewEvents, previewProgramInfo } from '../src/preview/programInfo';
import { buildStateRows, changedKeys } from '../src/preview/stateRows';
import { createRunner } from '../src/sim/runner';
import { b, num, onEvent, workspace } from './build';
import { convertState, generateCode } from './harness';

const wait = (s: number) => b('jcreatepp_wait_seconds', { inputs: { SECONDS: num(s) } });
const seq = (...body: ReturnType<typeof b>[]) => b('jcreatepp_sequence', { stmts: { DO: body } });

test('event buttons: only the events the program has, receive names without duplicates', () => {
  const { program } = convertState(workspace(
    onEvent('jcreatepp_on_interact', []),
    b('jcreatepp_on_receive', { fields: { MESSAGE: 'open' } }),
    b('jcreatepp_on_receive', { fields: { MESSAGE: 'close' } }),
    b('jcreatepp_on_receive', { fields: { MESSAGE: 'open' } }),
  ));
  assert.deepEqual(previewEvents(program), { interact: true, grab: false, release: false, collide: false, ride: false, receives: ['open', 'close'] });
  assert.equal(hasAnyEvent(previewEvents(convertState(workspace(onEvent('jcreatepp_on_update', []))).program)), false);
  assert.equal(previewProgramInfo(null).events.interact, false);
});

test('sequence names: the event they are in, numbered when there are several, same key as the state', () => {
  const state = workspace(
    onEvent('jcreatepp_on_interact', [seq(wait(1), wait(1)), seq(wait(1))]),
    b('jcreatepp_on_receive', { fields: { MESSAGE: 'go' }, stmts: { DO: [seq(wait(1))] } }),
  );
  const { program } = convertState(state);
  const seqs = describeSequences(program);
  assert.deepEqual(seqs.map((s) => [s.label, s.steps]), [
    ['一連の動作（インタラクト時・1つ目）', 2],
    ['一連の動作（インタラクト時・2つ目）', 1],
    ['一連の動作（「go」を受け取ったとき）', 1],
  ]);

  // The keys match the state the generated code writes.
  const runner = createRunner(generateCode(state));
  runner.start();
  runner.interact();
  runner.advance(0.1);
  const rows = buildStateRows(program.variables ?? [], runner.$.state as Record<string, unknown>, seqs);
  const seqRows = rows.filter((r) => r.kind === 'sequence');
  assert.deepEqual(seqRows.map((r) => r.sequence!.status), ['running', 'running', 'idle']);
  assert.equal(seqRows[0].value, '実行中（ステップ 1 / 2）');
  assert.equal(seqRows[2].value, 'まだ始まっていない');
});

test('changed mark: values that changed, cooldowns only when restarted', () => {
  const vars = [
    { kind: 'number' as const, name: 'score', stateKey: 'var.score', defaultValue: 0, written: true, read: true },
    { kind: 'cooldown' as const, name: 'tap', stateKey: '__jpp_cd_tap', defaultValue: 0, written: true, read: true },
  ];
  const before = buildStateRows(vars, { 'var.score': 1, __jpp_cd_tap: 2 });
  const prev = new Map(before.map((r) => [r.key, r.raw]));
  assert.deepEqual(changedKeys(prev, buildStateRows(vars, { 'var.score': 1, __jpp_cd_tap: 1.9 })), [], 'ticking down is not a change');
  assert.deepEqual(changedKeys(prev, buildStateRows(vars, { 'var.score': 2, __jpp_cd_tap: 3 })), ['var.score', '__jpp_cd_tap']);
  assert.deepEqual(changedKeys(new Map(), before), [], 'nothing is "changed" on the first observation');
});
