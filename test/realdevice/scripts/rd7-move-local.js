// Jcreate++ 実機テスト rd7「向いている方向に進む」 — 手順は CHECKLIST.md
// ── 開始時 ──
$.onStart(() => {
  // 角度を x:0 y:90 z:0 にする
  $.setRotation(new Quaternion().setFromEulerAngles(new Vector3(0, 90, 0)));
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // 向いている方向に 右:0 上:0 前:1 進む
  {
    const rot = $.getRotation() || new Quaternion();
    const pos = $.getPosition() || new Vector3(0, 0, 0);
    $.setPosition(pos.add(new Vector3(0, 0, 1).applyQuaternion(rot)));
  }
});
