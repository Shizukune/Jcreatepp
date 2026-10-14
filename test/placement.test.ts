/**
 * P6: placement rules come from one table (src/blocks/placement.ts).
 * For every rule-bearing block in every relevant placement, the conversion error and the editor
 * warning must be the same text, or both absent.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { STATEMENT_PLACEMENT_RULES, placementError, type Placement } from '../src/blocks/placement';
import type { EventContext } from '../src/blocks/context';
import { collectWarnings } from '../src/validator';
import { b, onEvent, workspace } from './build';
import { conversionErrors, loadWorkspace } from './harness';

const EVENTS: EventContext[] = [
  'jcreatepp_on_start',
  'jcreatepp_on_update',
  'jcreatepp_on_interact',
  'jcreatepp_on_collide',
  'jcreatepp_on_receive',
];

type Spot = { name: string; wrap: (target: object) => object[]; placement: (event: EventContext) => Placement };

// Where the block under test is put inside the event.
const SPOTS: Spot[] = [
  { name: 'directly', wrap: (t) => [t], placement: (event) => ({ event, inSequence: false, inIf: false, inRunFor: false }) },
  {
    name: 'in a sequence',
    wrap: (t) => [b('jcreatepp_sequence', { stmts: { DO: [t as any] } })],
    placement: (event) => ({ event, inSequence: true, inIf: false, inRunFor: false }),
  },
  {
    name: 'in an if inside a sequence',
    wrap: (t) => [b('jcreatepp_sequence', { stmts: { DO: [b('jcreatepp_if', { stmts: { DO: [t as any] } })] } })],
    placement: (event) => ({ event, inSequence: true, inIf: true, inRunFor: false }),
  },
  {
    name: 'in "run for N seconds"',
    wrap: (t) => [b('jcreatepp_sequence', { stmts: { DO: [b('jcreatepp_run_for_seconds', { stmts: { DO: [t as any] } })] } })],
    placement: (event) => ({ event, inSequence: true, inIf: false, inRunFor: true }),
  },
];

for (const type of Object.keys(STATEMENT_PLACEMENT_RULES)) {
  test(`placement: conversion error == editor warning for ${type}`, () => {
    for (const event of EVENTS) {
      for (const spot of SPOTS) {
        const where = `${type} ${spot.name} in ${event}`;
        const target = b(type, { id: 'target' });
        const state = workspace(onEvent(event, spot.wrap(target) as any[], event === 'jcreatepp_on_receive' ? { MESSAGE: 'm' } : undefined));
        const expected = placementError(type, spot.placement(event));

        // The wrapping sequence itself is not allowed in "every frame", so those scenarios test nothing.
        if (spot.name !== 'directly' && event === 'jcreatepp_on_update') continue;

        const errors = conversionErrors(state);
        const ws = loadWorkspace(state);
        const warning = collectWarnings(ws).get(ws.getBlockById('target')!) ?? null;
        if (expected) {
          assert.ok(errors.includes(expected), `${where}: conversion should report\n  ${expected}\n  got ${JSON.stringify(errors)}`);
          assert.equal(warning, expected, `${where}: editor warning`);
        } else {
          assert.deepEqual(errors, [], `${where}: no conversion error expected`);
          assert.equal(warning, null, `${where}: no editor warning expected`);
        }
      }
    }
  });
}

// Independent of the table: fixed expectations, so removing a rule from the table fails here.
test('placement: the set of blocks with placement rules is fixed', () => {
  assert.deepEqual(Object.keys(STATEMENT_PLACEMENT_RULES).sort(), [
    'jcreatepp_continuous_rotation',
    'jcreatepp_oscillate',
    'jcreatepp_reply_message_once',
    'jcreatepp_reply_message_value_once',
    'jcreatepp_run_for_seconds',
    'jcreatepp_send_message_to_collision_once',
    'jcreatepp_send_message_value_to_collision_once',
    'jcreatepp_sequence',
    'jcreatepp_set_jump_speed',
    'jcreatepp_set_move_speed',
    'jcreatepp_smooth_move_by',
    'jcreatepp_smooth_move_local',
    'jcreatepp_smooth_rotate_by',
    'jcreatepp_timed_move_return',
    'jcreatepp_timed_random_warp',
    'jcreatepp_wait_seconds',
    'jcreatepp_wait_until',
  ]);
});

test('placement: fixed allow / deny cases', () => {
  const seq = (...body: object[]) => b('jcreatepp_sequence', { stmts: { DO: body as any[] } });
  const iff = (...body: object[]) => b('jcreatepp_if', { stmts: { DO: body as any[] } });
  const runFor = (...body: object[]) => b('jcreatepp_run_for_seconds', { stmts: { DO: body as any[] } });
  const cases: [string, EventContext, object[], RegExp | null][] = [
    ['wait directly in an event', 'jcreatepp_on_start', [b('jcreatepp_wait_seconds')], /「一連の動作を始める」ブロックの中でしか使えません/],
    ['wait in a sequence', 'jcreatepp_on_start', [seq(b('jcreatepp_wait_seconds'))], null],
    ['wait in an if inside a sequence', 'jcreatepp_on_start', [seq(iff(b('jcreatepp_wait_seconds')))], /条件分岐の中には置けません/],
    ['sequence inside an event-level if, wait inside', 'jcreatepp_on_interact', [iff(seq(b('jcreatepp_wait_seconds')))], null],
    ['run for inside run for', 'jcreatepp_on_start', [seq(runFor(runFor()))], /「N秒間、毎フレーム実行する」の中には置けません/],
    ['sequence in every frame', 'jcreatepp_on_update', [seq()], /毎フレーム」の中には置けません/],
    ['sequence in a sequence', 'jcreatepp_on_start', [seq(seq())], /ネスト禁止/],
    ['smooth move in every frame', 'jcreatepp_on_update', [b('jcreatepp_smooth_move_by')], /毎フレーム」の中には置けません/],
    ['smooth move in a sequence', 'jcreatepp_on_interact', [seq(b('jcreatepp_smooth_rotate_by'))], /一連の動作」の中には置けません/],
    ['continuous rotation outside every frame', 'jcreatepp_on_interact', [b('jcreatepp_continuous_rotation')], /毎フレーム」の中でしか使えません/],
    ['oscillate in every frame', 'jcreatepp_on_update', [b('jcreatepp_oscillate')], null],
    ['move speed when grabbed', 'jcreatepp_on_grab_start', [b('jcreatepp_set_move_speed')], null],
    ['jump speed when released', 'jcreatepp_on_grab_end', [b('jcreatepp_set_jump_speed')], null],
    ['move speed at start', 'jcreatepp_on_start', [b('jcreatepp_set_move_speed')], /「インタラクト時」「持ったとき」「離したとき」の中でしか使えません/],
    ['move speed in a sequence', 'jcreatepp_on_interact', [seq(b('jcreatepp_set_move_speed'))], /プレイヤーがあるイベント直下で使ってください/],
    ['reply when receiving', 'jcreatepp_on_receive', [b('jcreatepp_reply_message_once')], null],
    ['reply at start', 'jcreatepp_on_start', [b('jcreatepp_reply_message_once')], /「メッセージを受け取ったとき」の中でのみ使えます/],
    ['send to collision when colliding', 'jcreatepp_on_collide', [b('jcreatepp_send_message_to_collision_once')], null],
    ['send to collision in a sequence', 'jcreatepp_on_collide', [seq(b('jcreatepp_send_message_to_collision_once'))], /「衝突相手」は「一連の動作」の中では使えません/],
    // Priority: the event rule is reported before the sequence rule.
    ['move speed at start inside a sequence', 'jcreatepp_on_start', [seq(b('jcreatepp_set_move_speed'))], /「インタラクト時」「持ったとき」「離したとき」の中でしか使えません/],
  ];
  for (const [name, event, body, expected] of cases) {
    const state = workspace(onEvent(event, body as any[], event === 'jcreatepp_on_receive' ? { MESSAGE: 'm' } : undefined));
    const errors = conversionErrors(state);
    const warnings = [...collectWarnings(loadWorkspace(state)).values()].filter((w): w is string => !!w);
    if (expected) {
      assert.ok(errors.some((e) => expected.test(e)), `${name}: conversion ${JSON.stringify(errors)}`);
      assert.ok(warnings.some((w) => expected.test(w)), `${name}: warnings ${JSON.stringify(warnings)}`);
    } else {
      assert.deepEqual(errors, [], `${name}: conversion`);
      assert.deepEqual(warnings, [], `${name}: warnings`);
    }
  }
});

test('placement: value blocks that read the event are rejected inside a sequence on both sides', () => {
  const cases: [EventContext, string][] = [
    ['jcreatepp_on_interact', 'jcreatepp_player'],
    ['jcreatepp_on_receive', 'jcreatepp_message_value_number'],
    ['jcreatepp_on_collide', 'jcreatepp_collision_target'],
  ];
  for (const [event, valueType] of cases) {
    // Put the value block into a text-to-item send (VALUE accepts any type) inside a sequence.
    const value = b(valueType, { id: 'value' });
    const send = b('jcreatepp_send_message_value_to_item_once', { fields: { ITEM_NAME: 'door', MESSAGE: 'm', VALUE_TYPE: 'number' }, inputs: { VALUE: value } });
    const state = workspace(onEvent(event, [b('jcreatepp_sequence', { stmts: { DO: [send] } })], event === 'jcreatepp_on_receive' ? { MESSAGE: 'm' } : undefined));
    const errors = conversionErrors(state);
    const ws = loadWorkspace(state);
    const warning = collectWarnings(ws).get(ws.getBlockById('value')!) ?? null;
    assert.ok(warning, `${valueType}: editor warning expected`);
    assert.ok(errors.includes(warning!), `${valueType}: conversion error should match the warning\n  ${warning}\n  got ${JSON.stringify(errors)}`);
  }
});
