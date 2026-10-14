/**
 * P7: variable list in the IR, state key rule, never-set warnings, preview state rows.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectVariables, variableStateKey } from '../src/variables';
import { buildStateRows } from '../src/preview/stateRows';
import { VARIABLE_BLOCKS, blockVariableAccess } from '../src/blocks/variableBlocks';
import { createRunner } from '../src/sim/runner';
import { collectWarnings } from '../src/validator';
import { b, bool, num, onEvent, workspace } from './build';
import { convertState, generateCode, loadWorkspace } from './harness';

const fixtureDir = path.resolve(__dirname, '../../test/fixtures');

const sample = () => workspace(
  onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'score' }, inputs: { VALUE: num(0) } }),
    b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'door', OPERATION: 'false' } }),
  ]),
  onEvent('jcreatepp_on_interact', [
    b('jcreatepp_change_number_var', { fields: { VAR_NAME: 'score' }, inputs: { DELTA: num(1) } }),
    b('jcreatepp_set_flag', { fields: { FLAG_NAME: 'lamp', OPERATION: 'toggle' } }),
    b('jcreatepp_start_cooldown', { fields: { COOLDOWN_NAME: 'tap' }, inputs: { SECONDS: num(2) } }),
    b('jcreatepp_set_string_var', { fields: { VAR_NAME: 'label' }, inputs: { VALUE: b('jcreatepp_string_var', { fields: { VAR_NAME: 'title' } }) } }),
    b('jcreatepp_if', {
      inputs: { CONDITION: b('jcreatepp_and', { inputs: { A: b('jcreatepp_bool_var', { fields: { VAR_NAME: 'door' } }), B: b('jcreatepp_cooldown_active', { fields: { COOLDOWN_NAME: 'tap' } }) } }) },
      stmts: { DO: [b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'ok' }, inputs: { VALUE: bool(true) } })] },
    }),
  ]),
);

test('IR variable list: kinds, set / read, flags are booleans', () => {
  const { program, errors } = convertState(sample());
  assert.deepEqual(errors, []);
  const summary = (program.variables ?? []).map((v) => `${v.kind}:${v.name}:${v.written ? 'w' : '-'}${v.read ? 'r' : '-'}`);
  assert.deepEqual(summary, [
    'number:score:wr',
    'string:label:w-',
    'string:title:-r',
    'bool:door:wr',
    'bool:lamp:wr',
    'bool:ok:w-',
    'cooldown:tap:wr',
  ]);
});

test('generated code uses exactly the state keys listed in the IR', () => {
  const state = sample();
  const { program } = convertState(state);
  const r = createRunner(generateCode(state));
  r.start();
  r.interact();
  const userKeys = Object.keys(r.$.state).filter((k) => !k.startsWith('__jpp_') || k.startsWith('__jpp_cd_')).sort();
  const listed = (program.variables ?? []).filter((v) => v.written).map((v) => v.stateKey).sort();
  // Every key the code wrote is listed (bool.ok is listed but only set when its if runs).
  for (const key of userKeys) assert.ok(listed.includes(key), `${key} missing from the IR list ${JSON.stringify(listed)}`);
  assert.ok(listed.includes('bool.ok'));
  assert.equal(variableStateKey('number', 'score'), 'var.score');
});

test('every fixture: the IR variable list matches collectVariables and converts', () => {
  for (const file of fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json') && f !== 'errors.json')) {
    const { program, errors } = convertState(JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8')));
    assert.deepEqual(errors, [], file);
    assert.deepEqual(program.variables, collectVariables({ ...program, variables: undefined }), file);
  }
});

test('editor warns about variables that are read but never set (and the IR agrees)', () => {
  const state = workspace(
    onEvent('jcreatepp_on_start', [b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'score' }, inputs: { VALUE: num(1) } })]),
    onEvent('jcreatepp_on_interact', [
      b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'copy' }, inputs: { VALUE: b('jcreatepp_number_var', { id: 'typo', fields: { VAR_NAME: 'scroe' } }) } }),
      b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'ok' }, inputs: { VALUE: b('jcreatepp_number_var', { id: 'good', fields: { VAR_NAME: 'score' } }) } }),
      b('jcreatepp_if', { inputs: { CONDITION: b('jcreatepp_flag', { id: 'literal', fields: { FLAG_NAME: 'true' } }) } }),
      b('jcreatepp_if', { inputs: { CONDITION: b('jcreatepp_cooldown_active', { id: 'cd', fields: { COOLDOWN_NAME: 'never' } }) } }),
    ]),
  );
  const ws = loadWorkspace(state);
  const warnings = collectWarnings(ws);
  assert.match(warnings.get(ws.getBlockById('typo')!) ?? '', /数値変数「scroe」はどこでも値を設定していません.*0 として扱われます/);
  assert.match(warnings.get(ws.getBlockById('cd')!) ?? '', /クールダウン「never」はどこでも開始していません/);
  assert.equal(warnings.get(ws.getBlockById('good')!), null);
  assert.doesNotMatch(warnings.get(ws.getBlockById('literal')!) ?? '', /どこでも/, 'flag "true" is a literal, not a variable');

  const { program } = convertState(state);
  const neverSet = (program.variables ?? []).filter((v) => v.read && !v.written).map((v) => `${v.kind}:${v.name}`);
  assert.deepEqual(neverSet, ['number:scroe', 'cooldown:never']);
});

test('block access table agrees with the IR for every variable block (incl. flag toggle)', () => {
  const samples: [string, Record<string, unknown>][] = Object.keys(VARIABLE_BLOCKS).map((type) => [type, {}]);
  samples.push(['jcreatepp_set_flag', { OPERATION: 'toggle' }], ['jcreatepp_set_flag', { OPERATION: 'true' }]);
  for (const [type, extraFields] of samples) {
    const access = VARIABLE_BLOCKS[type];
    const fields = { [access.field]: 'x', ...extraFields };
    const block = b(type, { id: 'v', fields });
    // Value blocks need a statement to sit in; statements go directly in the event.
    const isValue = !type.startsWith('jcreatepp_set_') && type !== 'jcreatepp_change_number_var' && type !== 'jcreatepp_start_cooldown';
    const holder = !isValue ? block
      : type === 'jcreatepp_string_var' ? b('jcreatepp_set_string_var', { fields: { VAR_NAME: 'holder' }, inputs: { VALUE: block } })
        : type === 'jcreatepp_number_var' || type === 'jcreatepp_cooldown_remaining' ? b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'holder' }, inputs: { VALUE: block } })
          : b('jcreatepp_set_bool_var', { fields: { VAR_NAME: 'holder' }, inputs: { VALUE: block } });
    const state = workspace(onEvent('jcreatepp_on_start', [holder]));
    const { program, errors } = convertState(state);
    assert.deepEqual(errors, [], type);
    const ir = (program.variables ?? []).find((v) => v.name === 'x')!;
    const fromBlock = blockVariableAccess(type, (name) => (fields as Record<string, unknown>)[name] ?? (name === 'OPERATION' ? 'true' : undefined))!;
    assert.deepEqual({ kind: fromBlock.kind, read: fromBlock.read, write: fromBlock.write }, { kind: ir.kind, read: ir.read, write: ir.written }, `${type} ${JSON.stringify(extraFields)}`);
  }
});

test('preview state rows keep variable keys that are not in the IR list visible', () => {
  const rows = buildStateRows([], { 'var.remote': 42, 'bool.lamp': true, __jpp_edge_x: true });
  assert.deepEqual(rows.map((r) => `${r.group}:${r.name}:${r.value}`), ['真偽値変数・フラグ:lamp:true', '数値変数:remote:42']);
  assert.ok(rows.every((r) => r.note === 'ブロックの一覧にない値'));
});

test('preview state rows: defaults before first set, notes, sequence progress', () => {
  const { program } = convertState(sample());
  const rows = buildStateRows(program.variables ?? [], {
    'var.score': 0.3,
    'bool.door': true,
    __jpp_cd_tap: 1.234,
    __jpp_seq_active_b9: true,
    __jpp_seq_step_b9: 1,
  });
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(byName.score.value, '0.3');
  assert.equal(byName.label.value, '""');
  assert.equal(byName.label.note, 'まだ設定されていない（初期値）');
  assert.equal(byName.title.note, 'どこでも設定されていません');
  assert.equal(byName.door.group, '真偽値変数・フラグ');
  assert.equal(byName.tap.value, '残り 1.23 秒');
  assert.deepEqual(byName.b9, { group: '一連の動作', name: 'b9', value: '実行中（ステップ 2）' });
});
