/**
 * Which blocks read or set which kind of variable (P7). Used by the editor warnings.
 * The IR side of the same information is src/variables.ts (collectVariables).
 */

import { VARIABLE_KIND_LABEL, variableDefaultValue, type VariableKind } from '../variables';

export type VariableBlockAccess = { kind: VariableKind; field: string; read: boolean; write: boolean };

export const VARIABLE_BLOCKS: Record<string, VariableBlockAccess> = {
  jcreatepp_number_var: { kind: 'number', field: 'VAR_NAME', read: true, write: false },
  jcreatepp_set_number_var: { kind: 'number', field: 'VAR_NAME', read: false, write: true },
  jcreatepp_change_number_var: { kind: 'number', field: 'VAR_NAME', read: true, write: true },
  jcreatepp_string_var: { kind: 'string', field: 'VAR_NAME', read: true, write: false },
  jcreatepp_set_string_var: { kind: 'string', field: 'VAR_NAME', read: false, write: true },
  jcreatepp_bool_var: { kind: 'bool', field: 'VAR_NAME', read: true, write: false },
  jcreatepp_set_bool_var: { kind: 'bool', field: 'VAR_NAME', read: false, write: true },
  jcreatepp_flag: { kind: 'bool', field: 'FLAG_NAME', read: true, write: false },
  jcreatepp_set_flag: { kind: 'bool', field: 'FLAG_NAME', read: false, write: true },
  jcreatepp_cooldown_active: { kind: 'cooldown', field: 'COOLDOWN_NAME', read: true, write: false },
  jcreatepp_cooldown_remaining: { kind: 'cooldown', field: 'COOLDOWN_NAME', read: true, write: false },
  jcreatepp_start_cooldown: { kind: 'cooldown', field: 'COOLDOWN_NAME', read: false, write: true },
};

/**
 * Variable access of one block, using its field values (same result as collectVariables on the IR):
 * "フラグ … を切り替える" reads the old value, so it is read + write.
 */
export function blockVariableAccess(
  type: string,
  getField: (name: string) => unknown,
): { kind: VariableKind; name: string; read: boolean; write: boolean } | null {
  const access = VARIABLE_BLOCKS[type];
  if (!access) return null;
  const toggles = type === 'jcreatepp_set_flag' && getField('OPERATION') === 'toggle';
  return { kind: access.kind, name: String(getField(access.field) ?? ''), read: access.read || toggles, write: access.write };
}

/** Warning for a variable that is read but never set anywhere (likely a typo in the name). */
export function neverSetMessage(kind: VariableKind, name: string): string {
  if (kind === 'cooldown') {
    return `クールダウン「${name}」はどこでも開始していません。名前の打ち間違いがないか確認してください（このままだと残り0秒として扱われます）。`;
  }
  const value = variableDefaultValue(kind);
  const shown = value === '' ? '空の文字' : String(value);
  return `${VARIABLE_KIND_LABEL[kind]}「${name}」はどこでも値を設定していません。名前の打ち間違いがないか確認してください（このままだと ${shown} として扱われます）。`;
}
