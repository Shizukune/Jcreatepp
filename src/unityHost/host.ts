/**
 * Entry point of the Unity editor preview (unity/Jcreatepp/Editor/Preview). Bundled on its own by
 * webpack.unity.config.js into one script exposing the global `JcreateppHost`, which Unity runs in
 * Jint (a C# JavaScript engine). It runs a generated Cluster Script on the same simulator as the
 * Web preview (src/sim), so both previews move the same way.
 *
 * Contract for the C# side (SimHost.cs):
 * - Arguments and results are numbers, strings, booleans, arrays and plain objects only.
 * - Functions do not use `this`; they can be called without a receiver.
 * - Log entries are collected right after each load / step / fire and stamped with the simulation
 *   time of that moment; snapshot() returns the entries added since the previous snapshot().
 * - Unity has only the .js (no block / IR information), so the state shows what is in $.state at
 *   run time: a variable appears once it has a value. Nothing is guessed (no "never set" notes).
 */

import { Quaternion, Vector3 } from '../sim/math';
import { createRunner, type Runner } from '../sim/runner';
import { formatLog } from '../preview/logText';
import { parseReceiveValue } from '../preview/receiveValue';
import { VARIABLE_KIND_LABEL, variableStateKey, type VariableKind } from '../variables';

const LOG_KEPT = 200;

export type HostLog = { time: number; kind: string; text: string };

export type HostStateRow = {
  /** 'number' | 'string' | 'bool' | 'cooldown' | 'sequence' */
  kind: string;
  /** Group heading in Japanese (数値変数, クールダウン, …). */
  group: string;
  name: string;
  /** Display text (ON / OFF, あと 0.42 秒, …). */
  text: string;
};

export type HostSnapshot = {
  time: number;
  position: number[]; // x, y, z
  rotation: number[]; // x, y, z, w
  euler: number[]; // degrees, 0..360 like Unity's eulerAngles
  /** Events that have handlers: interact, grab, release, collide, receive. */
  events: string[];
  state: HostStateRow[];
  /** Entries added since the previous snapshot(), oldest first. */
  log: HostLog[];
  /** The latest runtime error of this run ('' when none). Kept until load() is called again. */
  lastError: string;
  unsupported: string[];
};

let runner: Runner | null = null;
let pending: HostLog[] = [];
let lastError = '';

/** Moves the runner's new log entries into `pending`, stamped with the current simulation time. */
function collect(): void {
  if (!runner) return;
  // splice, not reassignment: the mock keeps a reference to this array.
  const entries = runner.log.splice(0);
  for (const entry of entries) {
    const text = formatLog(entry);
    pending.push({ time: runner.time, kind: entry.type, text });
    if (entry.type === 'error') lastError = text;
  }
  if (pending.length > LOG_KEPT) pending.splice(0, pending.length - LOG_KEPT);
}

/**
 * Creates a runner for `code` at the given start transform and runs its 開始時 (onStart).
 * ok = false when the code itself cannot run (syntax error, error at the top level); an error inside
 * onStart is logged and reported as lastError, with ok = true.
 */
export function load(code: string, px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number): { ok: boolean; error: string } {
  runner = null;
  pending = [];
  lastError = '';
  try {
    runner = createRunner(code, { position: new Vector3(px, py, pz), rotation: new Quaternion(qx, qy, qz, qw) });
  } catch (e) {
    const error = `スクリプトを実行できません: ${(e as Error).name}: ${(e as Error).message}`;
    lastError = error;
    return { ok: false, error };
  }
  runner.start();
  collect();
  return { ok: true, error: '' };
}

/** Advances the simulation by one frame of `dt` seconds. */
export function step(dt: number): void {
  if (!runner) return;
  runner.update(dt);
  collect();
}

/** Raises an event: interact, grab, release, collide, receive (with a message name and the typed value). */
export function fire(name: string, message: string, value: string): void {
  if (!runner) return;
  switch (name) {
    case 'interact': runner.interact(); break;
    case 'grab': runner.grab(true); break;
    case 'release': runner.grab(false); break;
    case 'collide': runner.collide(); break;
    case 'receive': runner.receive(message, parseReceiveValue(value)); break;
  }
  collect();
}

const KINDS: VariableKind[] = ['number', 'string', 'bool', 'cooldown'];

function stateRows(state: Record<string, unknown>): HostStateRow[] {
  const rows: HostStateRow[] = [];
  const keys = Object.keys(state).sort();
  for (const kind of KINDS) {
    const prefix = variableStateKey(kind, '');
    for (const key of keys) {
      if (!key.startsWith(prefix)) continue;
      const value = state[key];
      let text: string;
      switch (kind) {
        case 'bool': text = value ? 'ON' : 'OFF'; break;
        case 'cooldown': {
          const left = Math.max(0, Number(value) || 0);
          text = left > 0 ? `あと ${left.toFixed(2)} 秒` : '待機なし';
          break;
        }
        case 'string': text = JSON.stringify(String(value)); break;
        default: text = String(value);
      }
      rows.push({ kind, group: VARIABLE_KIND_LABEL[kind], name: key.slice(prefix.length), text });
    }
  }
  // Sequences, numbered in the order their keys appear (no block names in a .js).
  const seqKeys = keys.filter((k) => k.startsWith('__jpp_seq_active_'));
  seqKeys.forEach((key, i) => {
    const id = key.slice('__jpp_seq_active_'.length);
    const step = Number(state[`__jpp_seq_step_${id}`] ?? 0) + 1;
    rows.push({ kind: 'sequence', group: '一連の動作', name: `一連の動作 ${i + 1}`, text: state[key] ? `実行中（ステップ ${step}）` : '停止' });
  });
  return rows;
}

export function snapshot(): HostSnapshot | null {
  if (!runner) return null;
  const p = runner.item.position;
  const q = runner.item.rotation;
  const e = q.createEulerAngles();
  const h = runner.handlers;
  const events: string[] = [];
  if (h.interact) events.push('interact');
  // One onGrab callback handles both grabbing and releasing.
  if (h.grab) events.push('grab', 'release');
  if (h.collide) events.push('collide');
  if (h.receive) events.push('receive');
  const log = pending;
  pending = [];
  return {
    time: runner.time,
    position: [p.x, p.y, p.z],
    rotation: [q.x, q.y, q.z, q.w],
    euler: [e.x, e.y, e.z],
    events,
    state: stateRows(runner.$.state as Record<string, unknown>),
    log,
    lastError,
    unsupported: [...runner.unsupported],
  };
}
