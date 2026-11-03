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
    '// ただし今の位置が「最後に動かす前の位置 → 決めた位置」の線から 5cm 以上外れていたら、手で持つ・物理などで動いたので、今の位置から始める',
    'const itemPosition = () => {',
    '  const now = $.getPosition() || new Vector3(0, 0, 0);',
    '  const p = $.state["__jpp_pose_position"];',
    '  const from = $.state["__jpp_pose_position_from"];',
    '  if (!p || !from) return now;',
    '  // 線の上で、今の位置にいちばん近い点までの距離',
    '  const line = p.clone().sub(from);',
    '  const t = line.lengthSq() > 0 ? Math.min(1, Math.max(0, now.clone().sub(from).dot(line) / line.lengthSq())) : 1;',
    '  if (now.clone().sub(from.clone().add(line.multiplyScalar(t))).length() > 0.05) return now;',
    '  // 決めた位置に着いたら、線は終わり（このあとは決めた位置からのずれだけを見る）',
    '  if (now.clone().sub(p).length() < 0.001) $.state["__jpp_pose_position_from"] = p;',
    '  return p.clone();',
    '};',
  ].join('\n'),
  placeItem: [
    '// アイテムを pos に動かして、その位置と、動かす前の位置を覚える（すぐに着いたときは、動かす前の位置はいらない）',
    'const placeItem = (pos) => {',
    '  const before = $.getPosition() || new Vector3(0, 0, 0);',
    '  $.setPosition(pos);',
    '  const after = $.getPosition();',
    '  $.state["__jpp_pose_position"] = pos;',
    '  $.state["__jpp_pose_position_from"] = after && after.clone().sub(pos).length() < 0.001 ? pos : before;',
    '};',
  ].join('\n'),
  itemRotation: [
    '// 向きを変えるブロックが複数あるので、このスクリプトが最後に決めた向きを覚えておき、そこから回していく',
    '// （$.getRotation() は回転中の向きを返すので、同じフレームで何度も読むと、前の回転が消えてしまう）',
    '// ただし今の向きが「最後に回す前の向き → 決めた向き」の回る途中から 3 度以上外れていたら、手で持つ・物理などで回ったので、今の向きから始める',
    'const itemRotation = () => {',
    '  const now = $.getRotation() || new Quaternion();',
    '  const q = $.state["__jpp_pose_rotation"];',
    '  const from = $.state["__jpp_pose_rotation_from"];',
    '  if (!q || !from) return now;',
    '  // 回る途中で、今の向きにいちばん近い向きとの角度（向きを 4 つの数の組として、from と q を結ぶ円の上で探す）',
    '  const sign = from.dot(q) < 0 ? -1 : 1;',
    '  const c = Math.min(1, sign * from.dot(q));',
    '  const s = Math.sqrt(1 - c * c);',
    '  const a = now.dot(from);',
    '  const b = s > 1e-6 ? (sign * now.dot(q) - c * a) / s : 0;',
    '  let nearest = 0;',
    '  for (const k of [1, -1]) {',
    '    const angle = Math.min(Math.acos(c), Math.max(0, Math.atan2(k * b, k * a)));',
    '    nearest = Math.max(nearest, k * (a * Math.cos(angle) + b * Math.sin(angle)));',
    '  }',
    '  if (2 * Math.acos(Math.min(1, nearest)) * 180 / Math.PI > 3) return now;',
    '  // 決めた向きになったら、回る途中は終わり（このあとは決めた向きからのずれだけを見る）',
    '  if (Math.abs(now.dot(q)) > 0.99999999) $.state["__jpp_pose_rotation_from"] = q;',
    '  return q.clone();',
    '};',
  ].join('\n'),
  turnItem: [
    '// アイテムを rot の向きにして、その向きと、回す前の向きを覚える（すぐに向いたときは、回す前の向きはいらない）',
    'const turnItem = (rot) => {',
    '  const before = $.getRotation() || new Quaternion();',
    '  $.setRotation(rot);',
    '  const after = $.getRotation();',
    '  $.state["__jpp_pose_rotation"] = rot;',
    '  $.state["__jpp_pose_rotation_from"] = after && Math.abs(after.dot(rot)) > 0.99999999 ? rot : before;',
    '};',
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
