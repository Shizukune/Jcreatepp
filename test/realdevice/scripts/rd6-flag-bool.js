// Jcreate++ 実機テスト rd6「フラグと真偽値変数」 — 手順は CHECKLIST.md
// ── インタラクト時 ──
$.onInteract((player) => {
  // フラグ lamp を 切り替える
  $.state["bool.lamp"] = !$.state["bool.lamp"];
  // もし 真偽値変数 lamp なら
  if (!!$.state["bool.lamp"]) {
    // 位置を x:0 y:1 z:0 ずつ変える
    $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, 1, 0)));
  } else {
    // 位置を x:0 y:-1 z:0 ずつ変える
    $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, -1, 0)));
  }
});
