// Jcreate++ 実機テスト rd3「小数の計算」 — 手順は CHECKLIST.md
// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）
const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };

// ── インタラクト時 ──
$.onInteract((player) => {
  // もし (0.1 + 0.2) = 0.3 なら
  if (roundDecimal(0.1 + 0.2) === 0.3) {
    // 位置を x:0 y:1 z:0 ずつ変える
    $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, 1, 0)));
  } else {
    // 位置を x:0 y:-1 z:0 ずつ変える
    $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, -1, 0)));
  }
});
