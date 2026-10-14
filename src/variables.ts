/**
 * Jcreate++ 変数の正本（P7）
 *
 * - 変数の種類と $.state のキー名の規則（codegen もここを使う）
 * - IR から変数一覧（どこかで設定されているか / 読まれているか）を集める
 *
 * フラグは真偽値変数と同じもの（V-4）。クールダウンも「名前つきの値」として一覧に含める。
 */

import type { Program } from './ir';

export type VariableKind = 'number' | 'string' | 'bool' | 'cooldown';

export type VariableInfo = {
  kind: VariableKind;
  name: string;
  /** Key in $.state (without quotes). */
  stateKey: string;
  /** Value read when it has never been set. */
  defaultValue: number | string | boolean;
  /** Set somewhere (set / change / toggle / start). */
  written: boolean;
  /** Read somewhere (blocks that use the value, change / toggle). */
  read: boolean;
};

const PREFIX: Record<VariableKind, string> = {
  number: 'var.',
  string: 'str.',
  bool: 'bool.',
  cooldown: '__jpp_cd_',
};

const DEFAULT_VALUE: Record<VariableKind, number | string | boolean> = {
  number: 0,
  string: '',
  bool: false,
  cooldown: 0,
};

export const VARIABLE_KIND_LABEL: Record<VariableKind, string> = {
  number: '数値変数',
  string: '文字変数',
  bool: '真偽値変数・フラグ',
  cooldown: 'クールダウン',
};

export function variableStateKey(kind: VariableKind, name: string): string {
  return PREFIX[kind] + name;
}

export function variableDefaultValue(kind: VariableKind): number | string | boolean {
  return DEFAULT_VALUE[kind];
}

/** How each IR node kind touches variables. */
const ACCESS: Record<string, { kind: VariableKind; read?: boolean; write?: boolean } | undefined> = {
  number_var: { kind: 'number', read: true },
  string_var: { kind: 'string', read: true },
  bool_var: { kind: 'bool', read: true },
  flag: { kind: 'bool', read: true },
  cooldown_remaining: { kind: 'cooldown', read: true },
  cooldown_active: { kind: 'cooldown', read: true },
  set_number_var: { kind: 'number', write: true },
  change_number_var: { kind: 'number', read: true, write: true },
  set_string_var: { kind: 'string', write: true },
  set_bool_var: { kind: 'bool', write: true },
  set_flag: { kind: 'bool', write: true },
  start_cooldown: { kind: 'cooldown', write: true },
};

/**
 * All variables used by the program, sorted by kind then name.
 * Walks every nested node, so new statement / expression kinds are covered automatically.
 */
export function collectVariables(program: Program): VariableInfo[] {
  const found = new Map<string, VariableInfo>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const access = typeof record.kind === 'string' ? ACCESS[record.kind] : undefined;
    if (access && typeof record.name === 'string') {
      const toggles = record.kind === 'set_flag' && record.operation === 'toggle';
      const key = variableStateKey(access.kind, record.name);
      const info = found.get(key) ?? {
        kind: access.kind,
        name: record.name,
        stateKey: key,
        defaultValue: variableDefaultValue(access.kind),
        written: false,
        read: false,
      };
      info.written ||= !!access.write;
      info.read ||= !!access.read || toggles;
      found.set(key, info);
    }
    for (const [field, child] of Object.entries(record)) {
      if (field !== 'src' && field !== 'variables') visit(child);
    }
  };
  visit(program);

  const order: VariableKind[] = ['number', 'string', 'bool', 'cooldown'];
  return [...found.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name));
}
