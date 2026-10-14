/**
 * Small runtime helpers emitted once at the top of the generated script, only when used.
 */

const DEFINITIONS = {
  // 15 significant digits removes binary float noise (0.1 + 0.2 -> 0.3). Keeps the original value
  // when rounding would overflow a finite number to Infinity (near Number.MAX_VALUE).
  num: 'const __jpp_num = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };',
} as const;

export type HelperName = keyof typeof DEFINITIONS;

let used: Set<HelperName> | null = null;

/** Marks a helper as needed and returns the name to call it by. */
export function useHelper(name: HelperName): string {
  used?.add(name);
  return `__jpp_${name}`;
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
