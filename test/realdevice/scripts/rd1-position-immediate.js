// Jcreate++ 実機テスト rd1「位置の即時反映」 — 手順は CHECKLIST.md
// ── インタラクト時 ──
$.onInteract((player) => {
  // 位置を x:0 y:0.5 z:0 ずつ変える
  $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, 0.5, 0)));
  // 位置を x:0 y:0.5 z:0 ずつ変える
  $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, 0.5, 0)));
});
