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
import { b, bool, num, onEvent, workspace, xyz } from './build';
import { conversionErrors, loadWorkspace } from './harness';

test('unfinished template slots block conversion even beside a complete action', () => {
  const move = b('jcreatepp_add_position', { inputs: xyz(0, 1, 0) });
  const draft = { ...b('jcreatepp_if'), data: 'jcreatepp.template.condition' };
  const state = workspace(onEvent('jcreatepp_on_interact', [move, draft]));
  assert.equal(conversionErrors(state).filter(e => e.includes('組み方テンプレート')).length, 2);
  const filled = {
    ...b('jcreatepp_if', {
      inputs: { CONDITION: bool(true) },
      stmts: { DO: [b('jcreatepp_add_position', { inputs: xyz(0, 1, 0) })] },
    }),
    data: 'jcreatepp.template.condition',
  };
  assert.deepEqual(conversionErrors(workspace(onEvent('jcreatepp_on_interact', [filled]))), []);
});

test('a cooldown starter alone does not fill a template action slot', () => {
  const timer = b('jcreatepp_start_cooldown', { fields: { COOLDOWN_NAME: '再使用' } });
  const guard = {
    ...b('jcreatepp_if', { inputs: { CONDITION: bool(true) }, stmts: { DO: [timer] } }),
    data: 'jcreatepp.template.cooldown',
  };
  assert.ok(conversionErrors(workspace(onEvent('jcreatepp_on_interact', [guard])))
    .some(e => e.includes('ここに動作を置く')));
});

test('a cooldown template requires a starter with the same name as its condition', () => {
  const state = (timerName?: string) => {
    const move = b('jcreatepp_add_position', { inputs: xyz(0, 1, 0) });
    const actions = timerName
      ? [b('jcreatepp_start_cooldown', { fields: { COOLDOWN_NAME: timerName }, inputs: { SECONDS: num(3) } }), move]
      : [move];
    const active = b('jcreatepp_cooldown_active', { fields: { COOLDOWN_NAME: '再使用' } });
    const guard = {
      ...b('jcreatepp_if', {
        inputs: { CONDITION: b('jcreatepp_not', { inputs: { BOOL: active } }) },
        stmts: { DO: actions },
      }),
      data: 'jcreatepp.template.cooldown',
    };
    return workspace(onEvent('jcreatepp_on_interact', [guard]));
  };
  assert.ok(conversionErrors(state()).some(e => e.includes('連打防止テンプレート')));
  assert.ok(conversionErrors(state('別名')).some(e => e.includes('連打防止テンプレート')));
  assert.deepEqual(conversionErrors(state('再使用')), []);
});

test('a start/stop template requires the matching interact toggle', () => {
  const state = (name?: string, operation = 'toggle') => {
    const guard = {
      ...b('jcreatepp_if', {
        inputs: { CONDITION: b('jcreatepp_flag', { fields: { FLAG_NAME: '動作中' } }) },
        stmts: { DO: [b('jcreatepp_add_position', { inputs: xyz(0, 1, 0) })] },
      }),
      data: 'jcreatepp.template.toggle',
    };
    const update = onEvent('jcreatepp_on_update', [guard]);
    return name
      ? workspace(onEvent('jcreatepp_on_interact', [
        b('jcreatepp_set_flag', { fields: { FLAG_NAME: name, OPERATION: operation } }),
      ]), update)
      : workspace(update);
  };
  assert.ok(conversionErrors(state()).some(e => e.includes('開始・停止テンプレート')));
  assert.ok(conversionErrors(state('別名')).some(e => e.includes('開始・停止テンプレート')));
  assert.ok(conversionErrors(state('動作中', 'true')).some(e => e.includes('開始・停止テンプレート')));
  assert.deepEqual(conversionErrors(state('動作中')), []);
});

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
    // Directly in a sequence a smooth move is a step the sequence waits for; deeper inside it is not.
    ['smooth rotate in a sequence', 'jcreatepp_on_interact', [seq(b('jcreatepp_smooth_rotate_by'))], null],
    ['smooth move in an if inside a sequence', 'jcreatepp_on_interact', [seq(iff(b('jcreatepp_smooth_move_by')))], /一連の動作の中に直接置いてください/],
    ['smooth move in run for inside a sequence', 'jcreatepp_on_interact', [seq(runFor(b('jcreatepp_smooth_move_local')))], /一連の動作の中に直接置いてください/],
    ['smooth move in an event-level if', 'jcreatepp_on_interact', [iff(b('jcreatepp_smooth_move_by'))], null],
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

test('motion warnings: moves that add up get none; physics, chase turns and every-frame "set" do', () => {
  const num = (value: number) => b('math_number', { fields: { NUM: value } });
  const xyz = (x: number, y: number, z: number) => ({ X: num(x), Y: num(y), Z: num(z) });
  const osc = (axis: string, id: string) => b('jcreatepp_oscillate', { id, fields: { AXIS: axis }, inputs: { WIDTH: num(1), SPEED: num(1) } as any });
  const warningOf = (state: object, id: string) => {
    const ws = loadWorkspace(state);
    return collectWarnings(ws).get(ws.getBlockById(id)!) ?? null;
  };
  const motionWarnings = (state: object) => {
    const ws = loadWorkspace(state);
    return [...collectWarnings(ws).values()].filter((w): w is string => !!w && /足し合わせ|消えてしまいます/.test(w));
  };

  // Two oscillations, or an oscillation and a smooth move: combined, so no warning.
  assert.deepEqual(motionWarnings(workspace(onEvent('jcreatepp_on_update', [osc('Y', 'a'), osc('X', 'b')]))), []);
  assert.deepEqual(motionWarnings(workspace(
    onEvent('jcreatepp_on_update', [osc('Y', 'a')]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_smooth_move_by', { inputs: { ...xyz(1, 0, 0), DURATION: num(1) } as any })]),
  )), []);

  // Physics cannot be combined.
  const force = workspace(
    onEvent('jcreatepp_on_update', [osc('Y', 'a')]),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_add_force', { id: 'f', inputs: { POWER: num(1), ...xyz(0, 1, 0) } as any })]),
  );
  assert.match(warningOf(force, 'f') ?? '', /物理.*「往復する」.*足し合わせられません/);

  // "Set" every frame wipes the other moves.
  const set = workspace(onEvent('jcreatepp_on_update', [b('jcreatepp_set_position', { id: 's', inputs: xyz(0, 0, 0) as any }), osc('X', 'a')]));
  assert.match(warningOf(set, 's') ?? '', /毎フレーム位置が決め直される.*「往復する」/);
  // "Go back to the saved position" every frame puts the item back each frame, too.
  const load = workspace(onEvent('jcreatepp_on_update', [b('jcreatepp_load_position', { id: 'l' }), osc('X', 'a')]));
  assert.match(warningOf(load, 'l') ?? '', /「保存した位置に戻る」.*毎フレーム位置が決め直される.*「往復する」/);
  // ...but not when it is the only move, or not every frame.
  assert.equal(warningOf(workspace(onEvent('jcreatepp_on_update', [b('jcreatepp_set_position', { id: 's', inputs: xyz(0, 0, 0) as any })])), 's'), null);
  assert.deepEqual(motionWarnings(workspace(
    onEvent('jcreatepp_on_start', [b('jcreatepp_set_position', { id: 's', inputs: xyz(0, 0, 0) as any })]),
    onEvent('jcreatepp_on_update', [osc('X', 'a')]),
  )), []);

  // The chase gimmick turns the item every frame.
  const chase = workspace(
    b('jcreatepp_chase_template', { id: 'c', inputs: { MOVE_SPEED: num(1), MAX_DISTANCE: num(10), MIN_DISTANCE: num(1) } as any }),
    onEvent('jcreatepp_on_update', [b('jcreatepp_continuous_rotation', { fields: { AXIS: 'Y' }, inputs: { SPEED: num(30) } as any })]),
  );
  assert.match(warningOf(chase, 'c') ?? '', /向きを決め直す.*「回転し続ける」/);
});
