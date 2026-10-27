/**
 * Unity preview bundle (src/unityHost/host.ts → unity/Jcreatepp/Editor/Preview/Sim/jcreatepp-sim.txt):
 * it is up to date with its sources, runs without browser globals, and moves every real-device kit
 * script exactly like the simulator used directly (so the Unity and Web previews agree).
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { createRunner } from '../src/sim/runner';
import { parseReceiveValue } from '../src/preview/receiveValue';
import { SCENARIOS } from './realdevice/scenarios';
import { generateCode } from './harness';

const root = path.resolve(__dirname, '../..');
const bundlePath = path.join(root, 'unity/Jcreatepp/Editor/Preview/Sim/jcreatepp-sim.txt');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { inputsHash } = require(path.join(root, 'scripts/unitySimInputs.js')) as { inputsHash: (r: string) => string };

type Host = {
  load(code: string, px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number): { ok: boolean; error: string };
  step(dt: number): void;
  fire(name: string, message: string, value: string): void;
  snapshot(): {
    time: number; position: number[]; rotation: number[]; euler: number[]; events: string[];
    state: { kind: string; group: string; name: string; text: string }[];
    log: { time: number; kind: string; text: string }[]; lastError: string; unsupported: string[];
  } | null;
};

/** A fresh host in its own context with no browser or Node globals (like Jint). */
function newHost(): Host {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(bundlePath, 'utf8'), context);
  return context.JcreateppHost as Host;
}

/** Values from the other context have other prototypes; compare as plain data. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

test('unity bundle: up to date with its sources (npm run unity:sim)', () => {
  const header = fs.readFileSync(bundlePath, 'utf8').split('\n').slice(0, 3).join('\n');
  const recorded = /source-hash: ([0-9a-f]{64})/.exec(header)?.[1];
  assert.equal(recorded, inputsHash(root), 'run `npm run unity:sim`');
});

test('unity bundle: has the marker PreviewWindow.LoadBundle looks for', () => {
  // PreviewWindow only accepts a TextAsset containing this declaration (so a wrong asset with the same name is skipped).
  assert.ok(fs.readFileSync(bundlePath, 'utf8').includes('var JcreateppHost;'));
});

test('unity bundle: every kit script moves like the simulator used directly', () => {
  const DT = 1 / 60;
  for (const s of SCENARIOS) {
    const code = generateCode(s.state);
    const host = newHost();
    assert.deepEqual(plain(host.load(code, 0, 0, 0, 0, 0, 0, 1)), { ok: true, error: '' }, s.file);
    const direct = createRunner(code);
    direct.start();
    const ops: (() => void)[] = [];
    for (let i = 0; i < 30; i++) ops.push(() => { host.step(DT); direct.update(DT); });
    ops.push(() => { host.fire('interact', '', ''); direct.interact(); });
    ops.push(() => { host.fire('receive', 'open', ''); direct.receive('open', null); });
    for (let i = 0; i < 90; i++) ops.push(() => { host.step(DT); direct.update(DT); });
    for (const op of ops) op();
    const snap = plain(host.snapshot()!);
    const p = direct.item.position;
    const q = direct.item.rotation;
    assert.deepEqual(snap.position, [p.x, p.y, p.z], `${s.file} position`);
    assert.deepEqual(snap.rotation, [q.x, q.y, q.z, q.w], `${s.file} rotation`);
    assert.equal(snap.time, direct.time, `${s.file} time`);
  }
});

test('unity bundle: start transform, events from handlers, state rows, log stamps', () => {
  const door = SCENARIOS.find((s) => s.file === 'rd10-door.json')!;
  const host = newHost();
  // Tilted start: the item starts where the Unity object is.
  const half = Math.SQRT1_2;
  host.load(generateCode(door.state), 1, 2, 3, 0, half, 0, half);
  let snap = plain(host.snapshot()!);
  assert.deepEqual(snap.position, [1, 2, 3]);
  assert.deepEqual(snap.events, ['interact']);
  host.fire('interact', '', '');
  host.step(0.5);
  snap = plain(host.snapshot()!);
  const flag = snap.state.find((r) => r.kind === 'bool');
  assert.deepEqual(flag, { kind: 'bool', group: '真偽値変数・フラグ', name: 'ドアが開いている', text: 'ON' });
  const cooldown = snap.state.find((r) => r.kind === 'cooldown');
  assert.match(cooldown!.text, /^あと 0\.50 秒$/);

  const grab = newHost();
  grab.load(generateCode(SCENARIOS.find((s) => s.file === 'rd13-grab.json')!.state), 0, 0, 0, 0, 0, 0, 1);
  assert.deepEqual(plain(grab.snapshot()!).events, ['grab', 'release'], 'one onGrab = both buttons');
  grab.fire('grab', '', '');
  grab.step(1 / 60);
  grab.fire('release', '', '');
  const log = plain(grab.snapshot()!).log;
  assert.deepEqual(log.map((l) => [l.kind, l.time]), [['text', 0], ['text', 1 / 60]], 'stamped at the time of each event');
  assert.deepEqual(plain(grab.snapshot()!).log, [], 'entries are returned once');
});

test('unity bundle: errors — syntax error, error in onStart kept as lastError', () => {
  const host = newHost();
  const bad = plain(host.load('$.onStart(() => {', 0, 0, 0, 0, 0, 0, 1));
  assert.equal(bad.ok, false);
  assert.match(bad.error, /スクリプトを実行できません/);
  assert.equal(host.snapshot(), null);

  host.load('$.onStart(() => { null.x; }); $.onUpdate(() => {});', 0, 0, 0, 0, 0, 0, 1);
  const first = plain(host.snapshot()!);
  assert.match(first.lastError, /エラー\[start\]/);
  host.step(1 / 60);
  assert.match(plain(host.snapshot()!).lastError, /エラー\[start\]/, 'kept after an empty snapshot');

  host.load('$.onUpdate(() => { $.somethingNew(); });', 0, 0, 0, 0, 0, 0, 1);
  host.step(1 / 60);
  assert.deepEqual(plain(host.snapshot()!).unsupported, ['$.somethingNew']);
});

test('receive value: same rule in the Web and Unity previews', () => {
  assert.equal(parseReceiveValue(''), null);
  assert.equal(parseReceiveValue('   '), null);
  assert.equal(parseReceiveValue('false'), false);
  assert.equal(parseReceiveValue(' true '), true);
  assert.equal(parseReceiveValue('0'), 0);
  assert.equal(parseReceiveValue('001'), 1);
  assert.equal(parseReceiveValue('open'), 'open');

  const host = newHost();
  host.load('$.onReceive((msg, arg) => { $.state["str.got"] = typeof arg + ":" + String(arg); });', 0, 0, 0, 0, 0, 0, 1);
  host.fire('receive', 'x', '001');
  assert.deepEqual(plain(host.snapshot()!).state, [{ kind: 'string', group: '文字変数', name: 'got', text: '"number:1"' }]);
});

test('two hosts do not share state', () => {
  const a = newHost();
  const b = newHost();
  a.load('$.onInteract(() => { $.state["var.n"] = 1; });', 0, 0, 0, 0, 0, 0, 1);
  b.load('$.onInteract(() => { $.state["var.n"] = 2; });', 0, 0, 0, 0, 0, 0, 1);
  a.fire('interact', '', '');
  assert.equal(plain(a.snapshot()!).state[0].text, '1');
  assert.deepEqual(plain(b.snapshot()!).state, []);
});
