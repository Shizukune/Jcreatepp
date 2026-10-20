// Jcreate++ 実機テスト rd10「ドア（部品と同じ組み立て）」 — 手順は CHECKLIST.md
// クールダウンの残り秒数（始まっていなければ 0）
const getCooldown = (name) => { const v = $.state["__jpp_cd_" + name]; return typeof v === "number" ? v : 0; };

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // 「角度を x:0 y:-90 z:0 だけ 1 秒かけて回す」の途中の動き
  if ($.state["__jpp_smooth_rotq_t103_active"]) {
    const read = (key, fallback) => (typeof $.state[key] === "number" ? $.state[key] : fallback);
    const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
    const duration = Math.max(0.001, read("__jpp_smooth_rotq_t103_duration", 0.001));
    const from = new Quaternion(read("__jpp_smooth_rotq_t103_from_qx", 0), read("__jpp_smooth_rotq_t103_from_qy", 0), read("__jpp_smooth_rotq_t103_from_qz", 0), read("__jpp_smooth_rotq_t103_from_qw", 1));
    const elapsed = Math.min(duration, read("__jpp_smooth_rotq_t103_elapsed", 0) + delta);
    const t = elapsed / duration; // 0（始め）〜 1（終わり）
    // 「角度を〜ずつ変える」と同じ回し方で、回す量を t の割合だけ進める
    const step = new Vector3(read("__jpp_smooth_rotq_t103_delta_x", 0) * t, read("__jpp_smooth_rotq_t103_delta_y", 0) * t, read("__jpp_smooth_rotq_t103_delta_z", 0) * t);
    $.setRotation(from.multiply(new Quaternion().setFromEulerAngles(step)));
    $.state["__jpp_smooth_rotq_t103_elapsed"] = elapsed;
    if (elapsed >= duration) {
      $.state["__jpp_smooth_rotq_t103_active"] = false;
    }
  }
  // 「角度を x:0 y:90 z:0 だけ 1 秒かけて回す」の途中の動き
  if ($.state["__jpp_smooth_rotq_t109_active"]) {
    const read = (key, fallback) => (typeof $.state[key] === "number" ? $.state[key] : fallback);
    const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
    const duration = Math.max(0.001, read("__jpp_smooth_rotq_t109_duration", 0.001));
    const from = new Quaternion(read("__jpp_smooth_rotq_t109_from_qx", 0), read("__jpp_smooth_rotq_t109_from_qy", 0), read("__jpp_smooth_rotq_t109_from_qz", 0), read("__jpp_smooth_rotq_t109_from_qw", 1));
    const elapsed = Math.min(duration, read("__jpp_smooth_rotq_t109_elapsed", 0) + delta);
    const t = elapsed / duration; // 0（始め）〜 1（終わり）
    // 「角度を〜ずつ変える」と同じ回し方で、回す量を t の割合だけ進める
    const step = new Vector3(read("__jpp_smooth_rotq_t109_delta_x", 0) * t, read("__jpp_smooth_rotq_t109_delta_y", 0) * t, read("__jpp_smooth_rotq_t109_delta_z", 0) * t);
    $.setRotation(from.multiply(new Quaternion().setFromEulerAngles(step)));
    $.state["__jpp_smooth_rotq_t109_elapsed"] = elapsed;
    if (elapsed >= duration) {
      $.state["__jpp_smooth_rotq_t109_active"] = false;
    }
  }

  // クールダウンの残り秒数を減らす
  {
    const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
    for (const key of ["__jpp_cd_ドアが動いている"]) {
      const left = $.state[key];
      if (typeof left === "number" && left > 0) {
        $.state[key] = Math.max(0, left - delta);
      }
    }
  }
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // もし 「クールダウン ドアが動いている 中」ではない なら
  if (!(getCooldown("ドアが動いている") > 0)) {
    // クールダウン ドアが動いている を 1 秒で開始する
    $.state["__jpp_cd_ドアが動いている"] = 1;
    // もし フラグ ドアが開いている なら
    if (!!$.state["bool.ドアが開いている"]) {
      // 角度を x:0 y:-90 z:0 だけ 1 秒かけて回す
      {
        // 回り始め: 今の向きと回す量を覚えて、毎フレームの処理で少しずつ回す
        const from = $.getRotation() || new Quaternion();
        $.state["__jpp_smooth_rotq_t103_active"] = true;
        $.state["__jpp_smooth_rotq_t103_elapsed"] = 0;
        $.state["__jpp_smooth_rotq_t103_duration"] = 1;
        $.state["__jpp_smooth_rotq_t103_from_qx"] = from.x;
        $.state["__jpp_smooth_rotq_t103_from_qy"] = from.y;
        $.state["__jpp_smooth_rotq_t103_from_qz"] = from.z;
        $.state["__jpp_smooth_rotq_t103_from_qw"] = from.w;
        $.state["__jpp_smooth_rotq_t103_delta_x"] = 0;
        $.state["__jpp_smooth_rotq_t103_delta_y"] = -90;
        $.state["__jpp_smooth_rotq_t103_delta_z"] = 0;
      }
      // フラグ ドアが開いている を false にする
      $.state["bool.ドアが開いている"] = false;
    } else {
      // 角度を x:0 y:90 z:0 だけ 1 秒かけて回す
      {
        // 回り始め: 今の向きと回す量を覚えて、毎フレームの処理で少しずつ回す
        const from = $.getRotation() || new Quaternion();
        $.state["__jpp_smooth_rotq_t109_active"] = true;
        $.state["__jpp_smooth_rotq_t109_elapsed"] = 0;
        $.state["__jpp_smooth_rotq_t109_duration"] = 1;
        $.state["__jpp_smooth_rotq_t109_from_qx"] = from.x;
        $.state["__jpp_smooth_rotq_t109_from_qy"] = from.y;
        $.state["__jpp_smooth_rotq_t109_from_qz"] = from.z;
        $.state["__jpp_smooth_rotq_t109_from_qw"] = from.w;
        $.state["__jpp_smooth_rotq_t109_delta_x"] = 0;
        $.state["__jpp_smooth_rotq_t109_delta_y"] = 90;
        $.state["__jpp_smooth_rotq_t109_delta_z"] = 0;
      }
      // フラグ ドアが開いている を true にする
      $.state["bool.ドアが開いている"] = true;
    }
  }
});
