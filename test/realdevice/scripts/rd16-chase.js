// Jcreate++ 実機テスト rd16「追いかけるギミック」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // 追いかけるギミック: いちばん近いプレイヤーの方を向いて近づく
  {
    const pos = $.getPosition() || new Vector3(0, 0, 0);
    let target = null;
    let nearest = Infinity;
    for (const player of $.getPlayersNear(pos, 10)) {
      const playerPos = player.getPosition();
      if (!playerPos) continue;
      const distance = playerPos.clone().sub(pos).length();
      if (distance < nearest) {
        nearest = distance;
        target = player;
      }
    }
    if (target && target.exists()) {
      const targetPos = target.getPosition();
      if (targetPos) {
        const dir = targetPos.clone().sub(pos);
        const length = dir.length();
        if (length > 0) {
          // 前（+Z）がプレイヤーを向くように回す
          const angle = Math.atan2(dir.x, dir.z) * 180 / Math.PI;
          $.setRotation(new Quaternion().setFromEulerAngles(new Vector3(0, angle, 0)));
          if (length > 1.5) {
            $.setPosition(pos.add(dir.normalize().multiplyScalar(2 * deltaTime)));
          }
        }
      }
    }
  }
});
