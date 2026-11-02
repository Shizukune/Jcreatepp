// Jcreate++ 実機テスト rd15「近くのプレイヤー」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う

  // もし 範囲 3m にプレイヤーがいる なら
  if ($.getPlayersNear($.getPosition() || new Vector3(0, 0, 0), 3).length > 0) {
    // Y 軸を 速度 90 で回転し続ける
    $.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 90 * deltaTime)));
  }
});
