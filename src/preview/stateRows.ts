/**
 * Rows for the preview's state tab (P7). Pure: no DOM, so it is unit-tested.
 *
 * Driven by the IR variable list, so variables show up (with their default value) before they
 * are first set, and variables that are read but never set are pointed out.
 */

import { VARIABLE_KIND_LABEL, variableStateKey, type VariableInfo, type VariableKind } from '../variables';
import type { SequenceInfo } from './programInfo';

export type StateNote = 'never-set' | 'default' | 'not-listed';

export type StateRow = {
  /** Stable identity of the row (the $.state key), used to update only what changed. */
  key: string;
  kind: VariableKind | 'sequence';
  group: string;
  name: string;
  /** Display text of the value. */
  value: string;
  /** Raw value for comparisons (number of seconds for cooldowns, step for sequences). */
  raw: unknown;
  note?: string;
  noteKind?: StateNote;
  /** Sequences only. */
  sequence?: { status: 'idle' | 'running' | 'stopped'; step: number; steps: number; blockId: string };
};

const NOTE_TEXT: Record<StateNote, string> = {
  'never-set': 'どこでも設定されていません',
  default: 'まだ設定されていない（初期値）',
  'not-listed': 'ブロックの一覧にない値',
};

function withNote(row: StateRow, noteKind: StateNote): StateRow {
  row.noteKind = noteKind;
  row.note = NOTE_TEXT[noteKind];
  return row;
}

export function buildStateRows(variables: VariableInfo[], state: Record<string, unknown>, sequences: SequenceInfo[] = []): StateRow[] {
  const rows: StateRow[] = [];
  for (const v of variables) {
    const raw = state[v.stateKey];
    const value = raw === undefined ? v.defaultValue : raw;
    const row: StateRow = { key: v.stateKey, kind: v.kind, group: VARIABLE_KIND_LABEL[v.kind], name: v.name, value: formatValue(v.kind, value), raw: normalize(v.kind, value) };
    if (!v.written) withNote(row, 'never-set');
    else if (raw === undefined) withNote(row, 'default');
    rows.push(row);
  }

  // Variable keys present at runtime but not in the IR list (e.g. set by raw code) stay visible.
  const listed = new Set(variables.map((v) => v.stateKey));
  for (const key of Object.keys(state).sort()) {
    if (listed.has(key)) continue;
    const kind = (Object.keys(VARIABLE_KIND_LABEL) as VariableKind[]).find((k) => key.startsWith(variableStateKey(k, '')));
    if (!kind) continue;
    const name = key.slice(variableStateKey(kind, '').length);
    rows.push(withNote({ key, kind, group: VARIABLE_KIND_LABEL[kind], name, value: formatValue(kind, state[key]), raw: normalize(kind, state[key]) }, 'not-listed'));
  }

  // Sequences: every sequence of the program (named after its event), plus any others found at runtime.
  const known = new Set(sequences.map((s) => s.key));
  const runtime = Object.keys(state).filter((k) => k.startsWith('__jpp_seq_active_')).map((k) => k.slice('__jpp_seq_active_'.length)).sort();
  const all: SequenceInfo[] = [...sequences, ...runtime.filter((id) => !known.has(id)).map((id) => ({ key: id, blockId: id, label: id, steps: 0 }))];
  for (const seq of all) {
    const active = state[`__jpp_seq_active_${seq.key}`];
    const step = Number(state[`__jpp_seq_step_${seq.key}`] ?? 0) + 1;
    const status = active === undefined ? 'idle' : active ? 'running' : 'stopped';
    const value = status === 'running' ? `実行中（ステップ ${step}${seq.steps ? ` / ${seq.steps}` : ''}）` : status === 'idle' ? 'まだ始まっていない' : '停止';
    rows.push({
      key: `__jpp_seq_active_${seq.key}`,
      kind: 'sequence',
      group: '一連の動作',
      name: seq.label,
      value,
      raw: status === 'running' ? step : status,
      sequence: { status, step, steps: seq.steps, blockId: seq.blockId },
    });
  }
  return rows;
}

function normalize(kind: VariableKind, value: unknown): unknown {
  switch (kind) {
    case 'bool': return !!value;
    case 'cooldown': return Math.max(0, Number(value) || 0);
    default: return value;
  }
}

function formatValue(kind: VariableKind, value: unknown): string {
  switch (kind) {
    case 'number':
      return String(value);
    case 'string':
      return JSON.stringify(value);
    case 'bool':
      return String(!!value);
    case 'cooldown':
      return `残り ${Math.max(0, Number(value) || 0).toFixed(2)} 秒`;
  }
}

/**
 * Which rows count as "changed" between two observations (for the static change mark).
 * Cooldowns tick down every frame, so only a restart (the remaining time went up) counts.
 */
export function changedKeys(previous: Map<string, unknown>, rows: StateRow[]): string[] {
  const changed: string[] = [];
  for (const row of rows) {
    if (!previous.has(row.key)) continue;
    const before = previous.get(row.key);
    if (row.kind === 'cooldown') {
      if (Number(row.raw) > Number(before) + 1e-9) changed.push(row.key);
    } else if (!Object.is(before, row.raw) && JSON.stringify(before) !== JSON.stringify(row.raw)) {
      changed.push(row.key);
    }
  }
  return changed;
}
