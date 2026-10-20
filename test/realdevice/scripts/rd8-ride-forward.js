// Jcreate++ 実機テスト rd8「乗り物の進む向き」 — 手順は CHECKLIST.md
// ── 乗り物ギミック: 乗る・降りる・操作 ──
$.onRide((isGetOn, player) => {
  if (isGetOn) {
    $.state["__jpp_ride_active"] = true;
  } else {
    // 降りたら止める
    $.state["__jpp_ride_active"] = false;
    $.state["__jpp_ride_fwd"] = 0;
    $.state["__jpp_ride_upd"] = 0;
    $.state["__jpp_ride_trn"] = 0;
  }
});

// 前後・左右の入力（input.y: 前後、input.x: 左右）
$.onSteer((input, player) => {
  if ($.state["__jpp_ride_active"]) {
    $.state["__jpp_ride_fwd"] = input.y * 3;
    $.state["__jpp_ride_trn"] = input.x * 60;
  }
});

// 上下の入力
$.onSteerAdditionalAxis((input, player) => {
  if ($.state["__jpp_ride_active"]) {
    $.state["__jpp_ride_upd"] = input * 1;
  }
});

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // 乗り物ギミック: 乗っている間、入力に合わせて動かす（進む向き: アイテムの前（+Z））
  if ($.state["__jpp_ride_active"]) {
    const pos = $.getPosition() || new Vector3(0, 0, 0);
    const rot = $.getRotation() || new Quaternion();
    const turnAmount = ($.state["__jpp_ride_trn"] || 0) * deltaTime;
    const nextRot = rot.clone().multiply(new Quaternion().setFromEulerAngles(new Vector3(0, turnAmount, 0)));

    const direction = nextRot.clone().createEulerAngles();
    const forwardRadian = direction.y * Math.PI / 180;
    const forwardAmount = $.state["__jpp_ride_fwd"] || 0;
    const forwardVec = new Vector3(
      Math.sin(forwardRadian) * forwardAmount * deltaTime,
      0,
      Math.cos(forwardRadian) * forwardAmount * deltaTime
    );
    const upVec = new Vector3(0, 1, 0).multiplyScalar(($.state["__jpp_ride_upd"] || 0) * deltaTime);

    $.setPosition(pos.clone().add(forwardVec).add(upVec));
    $.setRotation(nextRot);
  }
});
