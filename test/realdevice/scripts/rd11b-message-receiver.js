// Jcreate++ 実機テスト rd11b「メッセージ（受け取る側）」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う

  // 「位置を x:0 y:1 z:0 だけ 1 秒かけて動かす」の途中の動き
  if ($.state["__jpp_smooth_pos_t126_active"]) {
    const duration = $.state["__jpp_smooth_pos_t126_duration"];
    const elapsed = Math.min(duration, $.state["__jpp_smooth_pos_t126_elapsed"] + deltaTime);
    $.state["__jpp_smooth_pos_t126_elapsed"] = elapsed;
    const from = $.state["__jpp_smooth_pos_t126_from"];
    const to = $.state["__jpp_smooth_pos_t126_to"];
    // 始点から終点へ、経った時間の割合（0〜1）だけ進める。最後はちょうど終点に置く
    $.setPosition(elapsed < duration ? from.clone().lerp(to, elapsed / duration) : to);
    if (elapsed >= duration) {
      $.state["__jpp_smooth_pos_t126_active"] = false;
    }
  }
});

// ── メッセージを受け取ったとき ──
$.onReceive((msg, arg, sender) => {
  // メッセージ「open」を受け取ったとき
  if (msg === "open") {
    // 位置を x:0 y:1 z:0 だけ 1 秒かけて動かす
    {
      // 動き始め: 始点と終点を覚えて、毎フレーム少しずつ動かす
      const from = $.getPosition() || new Vector3(0, 0, 0);
      $.state["__jpp_smooth_pos_t126_active"] = true;
      $.state["__jpp_smooth_pos_t126_elapsed"] = 0;
      $.state["__jpp_smooth_pos_t126_duration"] = 1;
      $.state["__jpp_smooth_pos_t126_from"] = from;
      $.state["__jpp_smooth_pos_t126_to"] = from.clone().add(new Vector3(0, 1, 0));
    }
    // もし true なら 送ってきた相手 に メッセージ「ack」を返す
    {
      if (sender && typeof sender.send === "function" && (typeof sender.exists !== "function" || sender.exists())) {
        sender.send("ack", null);
      }
    }
  }
}, { item: true, player: true });
