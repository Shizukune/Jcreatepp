// Jcreate++ 実機テスト rd14「衝突」 — 手順は CHECKLIST.md
// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）
const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };

// ── 衝突したとき ──
$.onCollide((collision) => {
  // 数値変数 hits を 1 だけ増やす
  $.state["var.hits"] = roundDecimal(($.state["var.hits"] || 0) + 1);
  // サブノード Label の TextView の文字を 数値変数 hits にする
  {
    const node = $.subNode("Label");
    if (node && typeof node.setText === "function") {
      node.setText(String($.state["var.hits"] || 0));
    }
  }
});
