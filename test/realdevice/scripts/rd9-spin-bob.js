// Jcreate++ 実機テスト rd9「回り続ける・往復する」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // Y 軸を 速度 45 で回転し続ける
  $.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 45 * deltaTime)));
  // Y 方向に 幅 0.5 速さ 2 で往復する
  {
    if (!$.state["__jpp_osc_init_pos_t92"]) {
      // 最初の位置を往復の中心として覚える
      $.state["__jpp_osc_init_pos_t92"] = $.getPosition() || new Vector3(0, 0, 0);
      $.state["__jpp_osc_time_t92"] = 0;
    }
    $.state["__jpp_osc_time_t92"] += deltaTime * 2;
    const origin = $.state["__jpp_osc_init_pos_t92"];
    const offset = Math.sin($.state["__jpp_osc_time_t92"]) * 0.5;
    $.setPosition(new Vector3(
      origin.x + 0,
      origin.y + offset,
      origin.z + 0
    ));
  }
});
