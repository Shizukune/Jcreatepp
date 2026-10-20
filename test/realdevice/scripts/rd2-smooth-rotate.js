// Jcreate++ 実機テスト rd2「秒数つき回転」 — 手順は CHECKLIST.md
// ── 開始時 ──
$.onStart(() => {
  // 角度を x:30 y:0 z:0 にする
  $.setRotation(new Quaternion().setFromEulerAngles(new Vector3(30, 0, 0)));
});

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // 「角度を x:0 y:90 z:0 だけ 2 秒かけて回す」の途中の動き
  if ($.state["__jpp_smooth_rotq_t19_active"]) {
    const read = (key, fallback) => (typeof $.state[key] === "number" ? $.state[key] : fallback);
    const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
    const duration = Math.max(0.001, read("__jpp_smooth_rotq_t19_duration", 0.001));
    const from = new Quaternion(read("__jpp_smooth_rotq_t19_from_qx", 0), read("__jpp_smooth_rotq_t19_from_qy", 0), read("__jpp_smooth_rotq_t19_from_qz", 0), read("__jpp_smooth_rotq_t19_from_qw", 1));
    const elapsed = Math.min(duration, read("__jpp_smooth_rotq_t19_elapsed", 0) + delta);
    const t = elapsed / duration; // 0（始め）〜 1（終わり）
    // 「角度を〜ずつ変える」と同じ回し方で、回す量を t の割合だけ進める
    const step = new Vector3(read("__jpp_smooth_rotq_t19_delta_x", 0) * t, read("__jpp_smooth_rotq_t19_delta_y", 0) * t, read("__jpp_smooth_rotq_t19_delta_z", 0) * t);
    $.setRotation(from.multiply(new Quaternion().setFromEulerAngles(step)));
    $.state["__jpp_smooth_rotq_t19_elapsed"] = elapsed;
    if (elapsed >= duration) {
      $.state["__jpp_smooth_rotq_t19_active"] = false;
    }
  }
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // 角度を x:0 y:90 z:0 だけ 2 秒かけて回す
  {
    // 回り始め: 今の向きと回す量を覚えて、毎フレームの処理で少しずつ回す
    const from = $.getRotation() || new Quaternion();
    $.state["__jpp_smooth_rotq_t19_active"] = true;
    $.state["__jpp_smooth_rotq_t19_elapsed"] = 0;
    $.state["__jpp_smooth_rotq_t19_duration"] = 2;
    $.state["__jpp_smooth_rotq_t19_from_qx"] = from.x;
    $.state["__jpp_smooth_rotq_t19_from_qy"] = from.y;
    $.state["__jpp_smooth_rotq_t19_from_qz"] = from.z;
    $.state["__jpp_smooth_rotq_t19_from_qw"] = from.w;
    $.state["__jpp_smooth_rotq_t19_delta_x"] = 0;
    $.state["__jpp_smooth_rotq_t19_delta_y"] = 90;
    $.state["__jpp_smooth_rotq_t19_delta_z"] = 0;
  }
});
