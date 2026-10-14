/**
 * Rows for the preview's state panel (P7). Pure: no DOM, so it is unit-tested.
 *
 * Driven by the IR variable list, so variables show up (with their default value) before they
 * are first set, and variables that are read but never set are pointed out.
 */

import { VARIABLE_KIND_LABEL, variableStateKey, type VariableInfo, type VariableKind } from '../variables';

export type StateRow = { group: string; name: string; value: string; note?: string };

export function buildStateRows(variables: VariableInfo[], state: Record<string, unknown>): StateRow[] {
  const rows: StateRow[] = [];
  for (const v of variables) {
    const raw = state[v.stateKey];
    const value = raw === undefined ? v.defaultValue : raw;
    const row: StateRow = { group: VARIABLE_KIND_LABEL[v.kind], name: v.name, value: formatValue(v, value) };
    if (!v.written) row.note = 'どこでも設定されていません';
    else if (raw === undefined) row.note = 'まだ設定されていない（初期値）';
    rows.push(row);
  }

  // Variable keys present at runtime but not in the IR list (e.g. set by raw code) stay visible.
  const listed = new Set(variables.map((v) => v.stateKey));
  for (const key of Object.keys(state).sort()) {
    if (listed.has(key)) continue;
    const kind = (Object.keys(VARIABLE_KIND_LABEL) as VariableKind[]).find((k) => key.startsWith(variableStateKey(k, '')));
    if (!kind) continue;
    const info: VariableInfo = { kind, name: key.slice(variableStateKey(kind, '').length), stateKey: key, defaultValue: '', written: true, read: false };
    rows.push({ group: VARIABLE_KIND_LABEL[kind], name: info.name, value: formatValue(info, state[key]), note: 'ブロックの一覧にない値' });
  }

  // Sequence progress comes from the runtime state.
  for (const key of Object.keys(state).sort()) {
    if (!key.startsWith('__jpp_seq_active_')) continue;
    const id = key.slice('__jpp_seq_active_'.length);
    const step = Number(state[`__jpp_seq_step_${id}`] ?? 0) + 1;
    rows.push({ group: '一連の動作', name: id, value: state[key] ? `実行中（ステップ ${step}）` : '停止' });
  }
  return rows;
}

function formatValue(v: VariableInfo, value: unknown): string {
  switch (v.kind) {
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
