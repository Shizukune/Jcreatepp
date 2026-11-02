/**
 * Small runtime helpers emitted once at the top of the generated script, only when used.
 * Each comes with a Japanese comment so the generated script explains itself.
 * They are emitted in the order they are listed here (pairs stay together).
 */

const DEFINITIONS = {
  getCooldown: [
    '// クールダウンの残り秒数（始まっていなければ 0）',
    'const getCooldown = (name) => { const v = $.state["__jpp_cd_" + name]; return typeof v === "number" ? v : 0; };',
  ].join('\n'),
  roundDecimal: [
    '// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）',
    'const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };',
  ].join('\n'),
  // The remembered pose (see pose.ts): each pair is always used together.
  itemPosition: [
    '// 位置を動かすブロックが複数あるので、このスクリプトが最後に決めた位置を覚えておき、そこに足していく',
    '// （$.getPosition() は移動中の位置を返すので、同じフレームで何度も読むと、前の動きが消えてしまう）',
    'const itemPosition = () => { const p = $.state["__jpp_pose_position"]; return p ? p.clone() : ($.getPosition() || new Vector3(0, 0, 0)); };',
  ].join('\n'),
  placeItem: [
    '// アイテムを pos に動かして、その位置を覚える',
    'const placeItem = (pos) => { $.state["__jpp_pose_position"] = pos; $.setPosition(pos); };',
  ].join('\n'),
  itemRotation: [
    '// 向きを変えるブロックが複数あるので、このスクリプトが最後に決めた向きを覚えておき、そこから回していく',
    '// （$.getRotation() は回転中の向きを返すので、同じフレームで何度も読むと、前の回転が消えてしまう）',
    'const itemRotation = () => { const q = $.state["__jpp_pose_rotation"]; return q ? q.clone() : ($.getRotation() || new Quaternion()); };',
  ].join('\n'),
  turnItem: [
    '// アイテムを rot の向きにして、その向きを覚える',
    'const turnItem = (rot) => { $.state["__jpp_pose_rotation"] = rot; $.setRotation(rot); };',
  ].join('\n'),
} as const;

export type HelperName = keyof typeof DEFINITIONS;

const ORDER = Object.keys(DEFINITIONS) as HelperName[];

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
    const definitions = ORDER.filter((name) => used!.has(name)).map((name) => DEFINITIONS[name]);
    return definitions.length > 0 ? `${definitions.join('\n')}\n\n${body}` : body;
  } finally {
    used = previous;
  }
}
