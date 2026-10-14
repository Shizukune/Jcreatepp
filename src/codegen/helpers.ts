/**
 * Small runtime helpers emitted once at the top of the generated script, only when used.
 * Each comes with a Japanese comment so the generated script explains itself.
 */

const DEFINITIONS = {
  roundDecimal: [
    '// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）',
    'const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };',
  ].join('\n'),
  getCooldown: [
    '// クールダウンの残り秒数（始まっていなければ 0）',
    'const getCooldown = (name) => { const v = $.state["__jpp_cd_" + name]; return typeof v === "number" ? v : 0; };',
  ].join('\n'),
} as const;

export type HelperName = keyof typeof DEFINITIONS;

let used: Set<HelperName> | null = null;

/** Marks a helper as needed and returns the name to call it by. */
export function useHelper(name: HelperName): string {
  used?.add(name);
  return name;
}

/** Runs codegen and prepends the definitions of the helpers it used. */
export function withHelpers(generate: () => string): string {
  const previous = used;
  used = new Set();
  try {
    const body = generate();
    const definitions = [...used].sort().map((name) => DEFINITIONS[name]);
    return definitions.length > 0 ? `${definitions.join('\n')}\n\n${body}` : body;
  } finally {
    used = previous;
  }
}
