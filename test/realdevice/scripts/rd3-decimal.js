// Jcreate++ 実機テスト rd3「小数の計算」 — 手順は CHECKLIST.md
// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）
const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };
// 位置を動かすブロックが複数あるので、このスクリプトが最後に決めた位置を覚えておき、そこに足していく
// （$.getPosition() は移動中の位置を返すので、同じフレームで何度も読むと、前の動きが消えてしまう）
// ただし今の位置が「最後に動かす前の位置 → 決めた位置」の線から 5cm 以上外れていたら、手で持つ・物理などで動いたので、今の位置から始める
const itemPosition = () => {
  const now = $.getPosition() || new Vector3(0, 0, 0);
  const p = $.state["__jpp_pose_position"];
  const from = $.state["__jpp_pose_position_from"];
  if (!p || !from) return now;
  // 線の上で、今の位置にいちばん近い点までの距離
  const line = p.clone().sub(from);
  const t = line.lengthSq() > 0 ? Math.min(1, Math.max(0, now.clone().sub(from).dot(line) / line.lengthSq())) : 1;
  if (now.clone().sub(from.clone().add(line.multiplyScalar(t))).length() > 0.05) return now;
  // 決めた位置に着いたら、線は終わり（このあとは決めた位置からのずれだけを見る）
  if (now.clone().sub(p).length() < 0.001) $.state["__jpp_pose_position_from"] = p;
  return p.clone();
};
// アイテムを pos に動かして、その位置と、動かす前の位置を覚える（すぐに着いたときは、動かす前の位置はいらない）
const placeItem = (pos) => {
  const before = $.getPosition() || new Vector3(0, 0, 0);
  $.setPosition(pos);
  const after = $.getPosition();
  $.state["__jpp_pose_position"] = pos;
  $.state["__jpp_pose_position_from"] = after && after.clone().sub(pos).length() < 0.001 ? pos : before;
};

// ── インタラクト時 ──
$.onInteract((player) => {
  // もし (0.1 + 0.2) = 0.3 なら
  if (roundDecimal(0.1 + 0.2) === 0.3) {
    // 位置を x:0 y:1 z:0 ずつ変える
    placeItem(itemPosition().add(new Vector3(0, 1, 0)));
  } else {
    // 位置を x:0 y:-1 z:0 ずつ変える
    placeItem(itemPosition().add(new Vector3(0, -1, 0)));
  }
});
