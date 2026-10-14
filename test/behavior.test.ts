/**
 * Behavior snapshots: what the generated code DOES, independent of how it is written.
 *
 * Every fixture (and real-device scenario) is run on the simulator with a fixed script of events;
 * position, rotation, user-visible state and the side-effect log are recorded frame by frame and
 * compared with test/__behavior__/<name>.json. Refactoring the generated code (readability,
 * comments, helpers) must leave these unchanged. Accept intended changes: npm run test:update
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRunner, type Runner } from '../src/sim/runner';
import { Vector3 } from '../src/sim/math';
import { SCENARIOS } from './realdevice/scenarios';
import { generateCode } from './harness';
import { b, num, onEvent, workspace } from './build';

const testDir = path.resolve(__dirname, '../../test');
const fixtureDir = path.join(testDir, 'fixtures');
const snapshotDir = path.join(testDir, '__behavior__');
const update = process.argv.includes('--update-snapshots');

const round = (n: number) => (Math.abs(n) < 1e-9 ? 0 : Math.round(n * 1e6) / 1e6);

function roundDeep(value: unknown): unknown {
  if (typeof value === 'number') return round(value);
  if (value instanceof Vector3) return { x: round(value.x), y: round(value.y), z: round(value.z) };
  if (Array.isArray(value)) return value.map(roundDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundDeep(v)]));
  }
  return value;
}

/** User-visible state only: internal __jpp_ bookkeeping may change shape in a refactor. */
function visibleState(r: Runner): Record<string, unknown> {
  const state = r.$.state as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(state)
      .filter((k) => !k.startsWith('__jpp_') || k.startsWith('__jpp_cd_'))
      .sort()
      .map((k) => [k, roundDeep(state[k])]),
  );
}

function snapshotOf(r: Runner, label: string, logFrom: number) {
  const q = r.item.rotation;
  // q and -q are the same rotation; record a canonical sign.
  const s = q.w < 0 || (q.w === 0 && q.y < 0) ? -1 : 1;
  return {
    at: label,
    t: round(r.time),
    position: roundDeep(r.item.position),
    rotation: [q.x, q.y, q.z, q.w].map((v) => round(v * s)),
    state: visibleState(r),
    // Only entries added since the previous frame.
    log: roundDeep(JSON.parse(JSON.stringify(r.log.slice(logFrom)))),
  };
}

/** The same script of events for every program. */
function record(code: string) {
  const r = createRunner(code, { seed: 42 });
  r.world.players.push(r.createHandle('player', 'near', new Vector3(0, 0, 2)));
  r.world.items.push(r.createHandle('item', 'door', new Vector3(3, 0, 0)));
  const frames: unknown[] = [];
  let logFrom = 0;
  const capture = (label: string) => {
    frames.push(snapshotOf(r, label, logFrom));
    logFrom = r.log.length;
  };
  const step = (label: string, seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 10); i++) {
      r.advance(0.1, 1 / 30);
      capture(`${label}+${(i + 1) / 10}`);
    }
  };
  r.start();
  capture('start');
  step('idle', 1);
  r.interact();
  step('interact', 2);
  r.interact();
  step('interact2', 1.5);
  r.grab(true);
  step('grab', 0.5);
  r.grab(false);
  r.collide();
  step('collide', 1);
  r.receive('open', 3);
  r.receive('push', 'hi');
  step('receive', 1);
  r.ride(true);
  r.steer({ x: 0.5, y: 1 });
  r.steerAdditionalAxis(1);
  step('ride', 1);
  r.ride(false);
  step('end', 4);
  return { errors: r.errors(), unsupported: [...r.unsupported], frames };
}

const programs: [string, object][] = [
  ...fs.readdirSync(fixtureDir)
    .filter((f) => f.endsWith('.json') && f !== 'errors.json')
    .sort()
    .map((f): [string, object] => [path.basename(f, '.json'), JSON.parse(fs.readFileSync(path.join(fixtureDir, f), 'utf8'))]),
  ...SCENARIOS.map((s): [string, object] => [path.basename(s.file, '.json'), s.state]),
  // Random draws every frame: catches changes to how random numbers are computed.
  ['random-draws', workspace(onEvent('jcreatepp_on_update', [
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'dice' }, inputs: { VALUE: b('jcreatepp_random_number', { fields: { MODE: 'integer' }, inputs: { MIN: num(1), MAX: num(6) } }) } }),
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'reversed' }, inputs: { VALUE: b('jcreatepp_random_number', { fields: { MODE: 'integer' }, inputs: { MIN: num(6), MAX: num(1) } }) } }),
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'float' }, inputs: { VALUE: b('jcreatepp_random_number', { fields: { MODE: 'float' }, inputs: { MIN: num(-2.5), MAX: num(10) } }) } }),
    b('jcreatepp_set_number_var', { fields: { VAR_NAME: 'fromVar' }, inputs: { VALUE: b('jcreatepp_random_number', { fields: { MODE: 'integer' }, inputs: { MIN: num(0), MAX: b('jcreatepp_number_var', { fields: { VAR_NAME: 'dice' } }) } }) } }),
  ]))],
];

for (const [name, state] of programs) {
  test(`behavior snapshot: ${name}`, () => {
    const actual = JSON.stringify(record(generateCode(state)), null, 1) + '\n';
    const file = path.join(snapshotDir, `${name}.json`);
    if (update) {
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(file, actual);
      return;
    }
    assert.ok(fs.existsSync(file), `Behavior snapshot missing for ${name}. Run: npm run test:update`);
    const expected = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    // Compare parsed values for a readable diff of the first difference.
    assert.deepEqual(JSON.parse(actual), JSON.parse(expected), `Behavior changed for ${name}. If intended, run: npm run test:update`);
  });
}
