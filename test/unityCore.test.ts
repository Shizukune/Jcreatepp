/**
 * Unity block core (src/unityHost/core.ts → unity/Jcreatepp/Editor/Core/jcreatepp-core.txt):
 * up to date with its sources, runs with no browser or Node globals (like Jint), and gives exactly
 * what the Web editor's pipeline gives for the same saved workspace (errors, warnings, code, setup,
 * size, variables, parts). The last tests use core.ts in-process to check Blockly's event state.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import * as Blockly from 'blockly/core';
import { PARTS, defaultValues, paramValue, type PartParam } from '../src/parts/catalog';
import { insertPart } from '../src/parts/insert';
import { collectWarnings } from '../src/validator';
import { programToJS } from '../src/codegen';
import { buildUnitySetup, describeScriptSize, scriptByteLength } from '../src/unitySetup';
import { utf8ByteLength } from '../src/utf8';
import { SCENARIOS } from './realdevice/scenarios';
import { b, onEvent, workspace } from './build';
import { convertState, loadWorkspace, saveWorkspace } from './harness';
import * as inProcess from '../src/unityHost/core';

const root = path.resolve(__dirname, '../..');
const bundlePath = path.join(root, 'unity/Jcreatepp/Editor/Core/jcreatepp-core.txt');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { inputsHash } = require(path.join(root, 'scripts/unitySimInputs.js')) as { inputsHash: (r: string, name?: string) => string };

type Core = typeof inProcess;

/** One core in its own context with no browser or Node globals (like Jint). Shared: loading takes a moment. */
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(bundlePath, 'utf8'), context);
const core = context.JcreateppCore as Core;

/** Values from the other context have other prototypes; compare as plain data. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const fixtures = fs
  .readdirSync(path.join(root, 'test/fixtures'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f, state: JSON.parse(fs.readFileSync(path.join(root, 'test/fixtures', f), 'utf8')) as object }));
const kit = SCENARIOS.map((s) => ({ name: s.file, state: s.state }));

/** What the Web editor's own pipeline gives for a state (the expected value). */
function direct(state: object) {
  const { program, errors } = convertState(state);
  const ws = loadWorkspace(state);
  const warnings = [...collectWarnings(ws)].filter(([, text]) => text).map(([block, text]) => ({ blockId: block.id, text }));
  ws.dispose();
  const code = errors.length === 0 ? programToJS(program) : '';
  const bytes = code ? scriptByteLength(code) : 0;
  return {
    errors,
    warnings,
    code,
    setupJson: code ? JSON.stringify(buildUnitySetup(program, code)) : '',
    bytes,
    variables: (program.variables ?? []).map((v) => ({ kind: v.kind, name: v.name, stateKey: v.stateKey })),
  };
}

test('unity core: up to date with its sources (npm run unity:sim)', () => {
  const header = fs.readFileSync(bundlePath, 'utf8').split('\n').slice(0, 3).join('\n');
  assert.equal(/source-hash: ([0-9a-f]{64})/.exec(header)?.[1], inputsHash(root, 'core'), 'run `npm run unity:sim`');
  assert.ok(fs.readFileSync(bundlePath, 'utf8').includes('var JcreateppCore;'), 'the marker CoreHost looks for');
});

test('unity core: version', () => {
  const v = plain(core.version());
  assert.equal(v.format, 1);
  assert.equal(v.jcreatepp, JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
  assert.match(v.blockly, /^12\./);
  assert.ok(v.blockTypes.includes('jcreatepp_on_start') && v.blockTypes.includes('math_number'));
});

for (const { name, state } of [...fixtures, ...kit]) {
  test(`unity core: ${name} converts exactly like the Web editor`, () => {
    const want = direct(state);
    const got = plain(core.convert(JSON.stringify(state)));
    assert.equal(got.ok, true, got.error);
    assert.deepEqual(got.errors, want.errors);
    assert.deepEqual(got.warnings.map((w) => ({ blockId: w.blockId, text: w.text })), want.warnings);
    assert.equal(got.code, want.code);
    assert.equal(got.setupJson, want.setupJson);
    assert.equal(got.size.bytes, want.bytes);
    if (want.code) assert.equal(got.size.text, describeScriptSize(want.bytes).text);
    assert.deepEqual(got.variables, want.variables);
  });
}

test('unity core: warnings name the event they are in', () => {
  const state = workspace(
    onEvent('jcreatepp_on_receive', [b('jcreatepp_reply_message_once', { fields: { MESSAGE: 'pong' } })], { MESSAGE: 'ping' }),
    onEvent('jcreatepp_on_interact', [b('jcreatepp_reply_message_once', { fields: { MESSAGE: 'pong' } })]),
    b('jcreatepp_save_position'),
    onEvent('jcreatepp_on_start', []),
    onEvent('jcreatepp_on_start', []),
  );
  const got = plain(core.convert(JSON.stringify(state)));
  const ws = loadWorkspace(state);
  const byType = (t: string) => ws.getAllBlocks(false).filter((x) => x.type === t);
  const interact = byType('jcreatepp_on_interact')[0];
  const reply = got.warnings.find((w) => w.blockType === 'jcreatepp_reply_message_once');
  assert.ok(reply, JSON.stringify(got.warnings));
  assert.deepEqual([reply.eventId, reply.eventType, reply.eventMessage], [interact.id, 'jcreatepp_on_interact', '']);
  const outside = got.warnings.find((w) => w.blockType === 'jcreatepp_save_position');
  assert.deepEqual([outside?.eventId, outside?.eventType], ['', '']);
  const starts = got.warnings.filter((w) => w.blockType === 'jcreatepp_on_start');
  assert.equal(starts.length, 2);
  for (const w of starts) assert.equal(w.eventId, w.blockId, 'an event block is its own event');
  ws.dispose();

  // Two receive events are told apart by their message.
  const two = workspace(
    onEvent('jcreatepp_on_receive', [b('jcreatepp_set_jump_speed')], { MESSAGE: 'a' }),
    onEvent('jcreatepp_on_receive', [], { MESSAGE: 'b' }),
  );
  const w2 = plain(core.convert(JSON.stringify(two))).warnings;
  assert.ok(w2.some((w) => w.eventType === 'jcreatepp_on_receive' && w.eventMessage === 'a'), JSON.stringify(w2));
});

test('unity core: message name limit is 100 UTF-8 bytes (validator unchanged without TextEncoder)', () => {
  const warn = (message: string) =>
    plain(core.convert(JSON.stringify(workspace(onEvent('jcreatepp_on_receive', [], { MESSAGE: message }))))).warnings.map((w) => w.text);
  assert.deepEqual(warn('a'.repeat(100)), []);
  assert.equal(warn('a'.repeat(101)).length, 1);
  assert.deepEqual(warn('a' + 'あ'.repeat(33)), []); // 1 + 99 bytes
  assert.equal(warn('ab' + 'あ'.repeat(33)).length, 1); // 101 bytes
});

test('utf8ByteLength: same as TextEncoder', () => {
  const samples = ['', 'abc', 'é', 'あいう', '😀', 'a😀b', '\ud800', '\udc00', 'x\ud800y', '\ud83d😀', ' ', '߿ࠀ￿'];
  for (const s of samples) assert.equal(utf8ByteLength(s), new TextEncoder().encode(s).length, JSON.stringify(s));
});

test('script size: craft item limit at 20,000 bytes', () => {
  assert.equal(describeScriptSize(20000).overCraftItemLimit, false);
  assert.equal(describeScriptSize(20001).overCraftItemLimit, true);
  assert.match(describeScriptSize(20001).text, /20,001 バイト/);
});

/** Saved state with the block ids taken out (new blocks get random ids). */
function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'id').map(([k, v]) => [k, withoutIds(v)]));
  }
  return value;
}

function ids(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => ids(v, into));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'id' && typeof v === 'string') into.push(v);
      else ids(v, into);
    }
  }
  return into;
}

test('unity core: every part adds like the Web parts tab (empty workspace and every kit script)', () => {
  for (const p of PARTS) {
    for (const base of [{ name: 'empty', state: workspace() }, ...kit]) {
      const ws = loadWorkspace(base.state);
      const want = insertPart(ws, p, defaultValues(p));
      const got = plain(core.addPart(JSON.stringify(base.state), p.id, ''));
      const label = `${p.id} on ${base.name}`;
      assert.equal(got.ok, want.ok, `${label}: ${got.error}`);
      if (want.ok) {
        const out = JSON.parse(got.json);
        assert.deepEqual(withoutIds(out), withoutIds(saveWorkspace(ws)), label);
        const before = ids(base.state);
        const after = ids(out);
        for (const id of before) assert.ok(after.includes(id), `${label}: keeps existing id ${id}`);
        assert.equal(new Set(after).size, after.length, `${label}: ids are unique`);
        // The result reads back in the Web editor's pipeline without new errors.
        assert.deepEqual(plain(core.convert(got.json)).errors, convertState(out).errors, label);
      } else {
        assert.equal(got.error, want.reason, label);
      }
      ws.dispose();
    }
  }
});

test('unity core: part values are checked like the parts form', () => {
  const spin = PARTS.find((p) => p.id === 'spin')!;
  const speed = spin.params.find((p) => p.key === 'speed') as PartParam & { kind: 'number' };
  const axis = spin.params.find((p) => p.key === 'axis')!;
  assert.equal(paramValue(speed, 99999), speed.max);
  assert.equal(paramValue(speed, '-99999'), speed.min);
  assert.equal(paramValue(speed, 'abc'), speed.default);
  assert.equal(paramValue(speed, null), speed.default);
  assert.equal(paramValue(speed, Infinity), speed.default);
  assert.equal(paramValue(speed, ''), 0, 'Number("") is 0, as in the form');
  assert.equal(paramValue(axis, 'Z'), 'Z');
  assert.equal(paramValue(axis, 'W'), axis.default);

  const add = (values: string) => plain(core.addPart(JSON.stringify(workspace()), 'spin', values));
  const clamped = add(JSON.stringify({ speed: 99999, axis: 'W' }));
  assert.equal(clamped.ok, true, clamped.error);
  assert.match(clamped.json, new RegExp(`"NUM":${speed.max}\\b`));
  assert.match(clamped.json, new RegExp(`"AXIS":"${axis.default}"`));
  assert.equal(add('{').ok, false);
  assert.equal(add('[1]').ok, false);
  assert.equal(plain(core.addPart(JSON.stringify(workspace()), 'nope', '')).ok, false);
});

/** A chain of `n` statements in one event (each next is one level deeper). */
function chainState(n: number): object {
  let next: object | undefined;
  for (let i = 0; i < n; i++) next = { type: 'jcreatepp_save_position', ...(next ? { next: { block: next } } : {}) };
  return { blocks: { languageVersion: 0, blocks: [{ type: 'jcreatepp_on_interact', inputs: next ? { DO: { block: next } } : {} }] } };
}

test('unity core: refuses inputs before Blockly reads them', () => {
  const refused = (json: string, pattern: RegExp) => {
    const r = plain(core.convert(json));
    assert.equal(r.ok, false, json.slice(0, 80));
    assert.equal(r.broken, false);
    assert.match(r.error, pattern);
    const a = plain(core.addPart(json, 'spin', ''));
    assert.equal(a.ok, false);
    assert.match(a.error, pattern);
  };
  refused('{', /JSON/);
  refused('[]', /形が違います/);
  refused('{"blocks":{"blocks":{}}}', /blocks\.blocks/);
  refused('{"blocks":{"blocks":[{"id":"x"}]}}', /種類の無い/);
  refused('{"blocks":{"blocks":[{"type":"jcreatepp_on_start","next":5}]}}', /つながり/);
  refused(JSON.stringify(workspace(b('jcreatepp_future_block'))), /知らない種類.*jcreatepp_future_block.*Web 版/);
  refused(' '.repeat(5_000_001), /大きすぎ/);
  const many = { blocks: { languageVersion: 0, blocks: Array.from({ length: 5001 }, (_, i) => ({ type: 'jcreatepp_save_position', x: 0, y: i })) } };
  refused(JSON.stringify(many), /多すぎ/);
  refused(JSON.stringify(chainState(150)), /深すぎ/); // event + 150 = 151 levels
  // Very many inputs on one block: refused as a result, not by throwing (no argument-list overflow).
  const inputs: Record<string, object> = {};
  for (let i = 0; i < 150_000; i++) inputs['I' + i] = {};
  refused(JSON.stringify({ blocks: { languageVersion: 0, blocks: [{ type: 'jcreatepp_on_start', inputs }] } }), /つながりが多すぎ/);

  const deepest = plain(core.convert(JSON.stringify(chainState(149)))); // event + 149 = 150 levels
  assert.equal(deepest.ok, true, deepest.error);
  assert.equal(plain(core.convert('{}')).ok, true, 'an empty workspace is fine');

  // Adding a part that would go over the limit is refused, and the original is not changed.
  const full = { blocks: { languageVersion: 0, blocks: Array.from({ length: 5000 }, (_, i) => ({ type: 'jcreatepp_save_position', x: 0, y: i })) } };
  const over = plain(core.addPart(JSON.stringify(full), 'spin', ''));
  assert.equal(over.ok, false);
  assert.match(over.error, /大きくなりすぎます/);
});

test('unity core (in process): Blockly events, group and undo recording are put back', () => {
  const state = JSON.stringify(SCENARIOS[0].state);
  assert.equal(Blockly.Events.isEnabled(), true);
  inProcess.convert(state);
  inProcess.addPart(state, 'spin', '');
  inProcess.convert('{');
  assert.equal(Blockly.Events.isEnabled(), true, 'enabled again after calls and refusals');

  // Already disabled (nested) by a caller: stays disabled, one level.
  Blockly.Events.disable();
  inProcess.convert(state);
  assert.equal(Blockly.Events.isEnabled(), false);
  Blockly.Events.enable();
  assert.equal(Blockly.Events.isEnabled(), true);

  Blockly.Events.setGroup('caller-group');
  Blockly.Events.setRecordUndo(false);
  inProcess.addPart(state, 'spin', '');
  assert.equal(Blockly.Events.getGroup(), 'caller-group');
  assert.equal(Blockly.Events.getRecordUndo(), false);
  Blockly.Events.setGroup(false);
  Blockly.Events.setRecordUndo(true);
});

// Keep last: marks the in-process core broken for the rest of this file.
test('unity core (in process): Blockly throwing inside marks the core broken and restores events', () => {
  // A known block with an input it does not have: passes the checks, Blockly throws while loading.
  const bad = JSON.stringify({ blocks: { languageVersion: 0, blocks: [{ type: 'jcreatepp_on_start', inputs: { NOPE: { block: { type: 'math_number' } } } }] } });
  Blockly.Events.setGroup('g');
  const r = inProcess.convert(bad);
  assert.equal(r.ok, false);
  assert.equal(r.broken, true);
  assert.match(r.error, /開き直して/);
  assert.equal(Blockly.Events.isEnabled(), true);
  assert.equal(Blockly.Events.getGroup(), 'g');
  assert.equal(Blockly.Events.getRecordUndo(), true);
  Blockly.Events.setGroup(false);
  const after = inProcess.convert(JSON.stringify(workspace()));
  assert.equal(after.ok, false, 'later calls are refused');
  assert.equal(after.broken, true);
  assert.equal(inProcess.addPart(JSON.stringify(workspace()), 'spin', '').broken, true);
});
