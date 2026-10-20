// Jcreate++ 実機テスト rd15「近くのプレイヤー」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // もし 範囲 3m にプレイヤーがいる なら
  if ($.getPlayersNear($.getPosition() || new Vector3(0, 0, 0), 3).length > 0) {
    // Y 軸を 速度 90 で回転し続ける
    $.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 90 * deltaTime)));
  }
});
