// Jcreate++ 実機テスト rd3「小数の計算」 — 手順は CHECKLIST.md
// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）
const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };
// 位置を動かすブロックが複数あるので、このスクリプトが最後に決めた位置を覚えておき、そこに足していく
// （$.getPosition() は移動中の位置を返すので、同じフレームで何度も読むと、前の動きが消えてしまう）
const itemPosition = () => { const p = $.state["__jpp_pose_position"]; return p ? p.clone() : ($.getPosition() || new Vector3(0, 0, 0)); };
// アイテムを pos に動かして、その位置を覚える
const placeItem = (pos) => { $.state["__jpp_pose_position"] = pos; $.setPosition(pos); };

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
