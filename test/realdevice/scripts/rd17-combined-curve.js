// Jcreate++ 実機テスト rd17「動きの足し合わせ（曲がりながら）」 — 手順は CHECKLIST.md
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

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う

  // Y 方向に 幅 0.5 速さ 2 で往復する
  {
    if (!$.state["__jpp_osc_init_pos_t165"] || typeof $.state["__jpp_osc_offset_t165"] !== "number") {
      // 最初の位置を往復の中心として覚える（前の JS の途中から続くときも、今の位置からやり直す）
      $.state["__jpp_osc_init_pos_t165"] = itemPosition();
      $.state["__jpp_osc_time_t165"] = 0;
      $.state["__jpp_osc_offset_t165"] = 0;
    }
    $.state["__jpp_osc_time_t165"] += deltaTime * 2;
    const offset = Math.sin($.state["__jpp_osc_time_t165"]) * 0.5; // 中心からのずれ
    // 前のフレームからずれが変わった分だけ動かす（ほかの動きと足し合わせるため）
    const change = offset - $.state["__jpp_osc_offset_t165"];
    $.state["__jpp_osc_offset_t165"] = offset;
    placeItem(itemPosition().add(new Vector3(0, change, 0)));
  }
  // X 方向に 幅 1 速さ 1 で往復する
  {
    if (!$.state["__jpp_osc_init_pos_t168"] || typeof $.state["__jpp_osc_offset_t168"] !== "number") {
      // 最初の位置を往復の中心として覚える（前の JS の途中から続くときも、今の位置からやり直す）
      $.state["__jpp_osc_init_pos_t168"] = itemPosition();
      $.state["__jpp_osc_time_t168"] = 0;
      $.state["__jpp_osc_offset_t168"] = 0;
    }
    $.state["__jpp_osc_time_t168"] += deltaTime * 1;
    const offset = Math.sin($.state["__jpp_osc_time_t168"]) * 1; // 中心からのずれ
    // 前のフレームからずれが変わった分だけ動かす（ほかの動きと足し合わせるため）
    const change = offset - $.state["__jpp_osc_offset_t168"];
    $.state["__jpp_osc_offset_t168"] = offset;
    placeItem(itemPosition().add(new Vector3(change, 0, 0)));
  }
  // Y 軸を 速度 45 で回転し続ける
  $.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 45 * deltaTime)));
});
