// Jcreate++ 実機テスト rd11b「メッセージ（受け取る側）」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // 「位置を x:0 y:1 z:0 だけ 1 秒かけて動かす」の途中の動き
  if ($.state["__jpp_smooth_move_t126_active"]) {
    const read = (key, fallback) => (typeof $.state[key] === "number" ? $.state[key] : fallback);
    const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
    const duration = Math.max(0.001, read("__jpp_smooth_move_t126_duration", 0.001));
    const current = $.getPosition() || new Vector3(0, 0, 0);
    const fromX = read("__jpp_smooth_move_t126_from_x", current.x);
    const fromY = read("__jpp_smooth_move_t126_from_y", current.y);
    const fromZ = read("__jpp_smooth_move_t126_from_z", current.z);
    const toX = read("__jpp_smooth_move_t126_to_x", fromX);
    const toY = read("__jpp_smooth_move_t126_to_y", fromY);
    const toZ = read("__jpp_smooth_move_t126_to_z", fromZ);
    const elapsed = Math.min(duration, read("__jpp_smooth_move_t126_elapsed", 0) + delta);
    const t = elapsed / duration; // 0（始点）〜 1（終点）
    $.setPosition(new Vector3(
      fromX + (toX - fromX) * t,
      fromY + (toY - fromY) * t,
      fromZ + (toZ - fromZ) * t
    ));
    $.state["__jpp_smooth_move_t126_elapsed"] = elapsed;
    if (elapsed >= duration) {
      $.state["__jpp_smooth_move_t126_active"] = false;
      $.setPosition(new Vector3(toX, toY, toZ));
    }
  }
});

// ── メッセージを受け取ったとき ──
$.onReceive((msg, arg, sender) => {
  // メッセージ「open」を受け取ったとき
  if (msg === "open") {
    // 位置を x:0 y:1 z:0 だけ 1 秒かけて動かす
    {
      // 動き始め: 始点と終点を覚えて、毎フレームの処理で少しずつ動かす
      const from = $.getPosition() || new Vector3(0, 0, 0);
      const to = from.clone().add(new Vector3(0, 1, 0));
      $.state["__jpp_smooth_move_t126_active"] = true;
      $.state["__jpp_smooth_move_t126_elapsed"] = 0;
      $.state["__jpp_smooth_move_t126_duration"] = 1;
      $.state["__jpp_smooth_move_t126_from_x"] = from.x;
      $.state["__jpp_smooth_move_t126_from_y"] = from.y;
      $.state["__jpp_smooth_move_t126_from_z"] = from.z;
      $.state["__jpp_smooth_move_t126_to_x"] = to.x;
      $.state["__jpp_smooth_move_t126_to_y"] = to.y;
      $.state["__jpp_smooth_move_t126_to_z"] = to.z;
    }
    // もし true なら 送ってきた相手 に メッセージ「ack」を返す
    {
      if (sender && typeof sender.send === "function" && (typeof sender.exists !== "function" || sender.exists())) {
        sender.send("ack", null);
      }
    }
  }
}, { item: true, player: true });
