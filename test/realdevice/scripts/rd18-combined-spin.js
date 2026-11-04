// Jcreate++ 実機テスト rd18「回転の足し合わせ」 — 手順は CHECKLIST.md
// 向きを変えるブロックが複数あるので、このスクリプトが最後に決めた向きを覚えておき、そこから回していく
// （$.getRotation() は回転中の向きを返すので、同じフレームで何度も読むと、前の回転が消えてしまう）
// ただし今の向きが「最後に回す前の向き → 決めた向き」の回る途中から 3 度以上外れていたら、手で持つ・物理などで回ったので、今の向きから始める
const itemRotation = () => {
  const now = $.getRotation() || new Quaternion();
  const q = $.state["__jpp_pose_rotation"];
  const from = $.state["__jpp_pose_rotation_from"];
  if (!q || !from) return now;
  // 回る途中で、今の向きにいちばん近い向きとの角度（向きを 4 つの数の組として、from と q を結ぶ円の上で探す）
  const sign = from.dot(q) < 0 ? -1 : 1;
  const c = Math.min(1, sign * from.dot(q));
  const s = Math.sqrt(1 - c * c);
  const a = now.dot(from);
  const b = s > 1e-6 ? (sign * now.dot(q) - c * a) / s : 0;
  let nearest = 0;
  for (const k of [1, -1]) {
    const angle = Math.min(Math.acos(c), Math.max(0, Math.atan2(k * b, k * a)));
    nearest = Math.max(nearest, k * (a * Math.cos(angle) + b * Math.sin(angle)));
  }
  if (2 * Math.acos(Math.min(1, nearest)) * 180 / Math.PI > 3) return now;
  // 決めた向きになったら、回る途中は終わり（このあとは決めた向きからのずれだけを見る）
  if (Math.abs(now.dot(q)) > 0.99999999) $.state["__jpp_pose_rotation_from"] = q;
  return q.clone();
};
// アイテムを rot の向きにして、その向きと、回す前の向きを覚える（すぐに向いたときは、回す前の向きはいらない）
const turnItem = (rot) => {
  const before = $.getRotation() || new Quaternion();
  $.setRotation(rot);
  const after = $.getRotation();
  $.state["__jpp_pose_rotation"] = rot;
  $.state["__jpp_pose_rotation_from"] = after && Math.abs(after.dot(rot)) > 0.99999999 ? rot : before;
};

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う

  // Y 軸を 速度 30 で回転し続ける
  turnItem(itemRotation().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 30 * deltaTime)));
  // Y 軸を 速度 15 で回転し続ける
  turnItem(itemRotation().multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 15 * deltaTime)));
});
