// Jcreate++ 実機テスト rd1「位置の即時反映」 — 手順は CHECKLIST.md
// 位置を動かすブロックが複数あるので、このスクリプトが最後に決めた位置を覚えておき、そこに足していく
// （$.getPosition() は移動中の位置を返すので、同じフレームで何度も読むと、前の動きが消えてしまう）
const itemPosition = () => { const p = $.state["__jpp_pose_position"]; return p ? p.clone() : ($.getPosition() || new Vector3(0, 0, 0)); };
// アイテムを pos に動かして、その位置を覚える
const placeItem = (pos) => { $.state["__jpp_pose_position"] = pos; $.setPosition(pos); };

// ── インタラクト時 ──
$.onInteract((player) => {
  // 位置を x:0 y:0.5 z:0 ずつ変える
  placeItem(itemPosition().add(new Vector3(0, 0.5, 0)));
  // 位置を x:0 y:0.5 z:0 ずつ変える
  placeItem(itemPosition().add(new Vector3(0, 0.5, 0)));
});
