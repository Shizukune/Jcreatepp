// Jcreate++ 実機テスト rd2「秒数つき回転」 — 手順は CHECKLIST.md
// 向きを変えるブロックが複数あるので、このスクリプトが最後に決めた向きを覚えておき、そこから回していく
// （$.getRotation() は回転中の向きを返すので、同じフレームで何度も読むと、前の回転が消えてしまう）
const itemRotation = () => { const q = $.state["__jpp_pose_rotation"]; return q ? q.clone() : ($.getRotation() || new Quaternion()); };
// アイテムを rot の向きにして、その向きを覚える
const turnItem = (rot) => { $.state["__jpp_pose_rotation"] = rot; $.setRotation(rot); };

// ── 開始時 ──
$.onStart(() => {
  // 角度を x:30 y:0 z:0 にする
  turnItem(new Quaternion().setFromEulerAngles(new Vector3(30, 0, 0)));
});

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う

  // 「角度を x:0 y:90 z:0 だけ 2 秒かけて回す」の途中の動き
  if ($.state["__jpp_smooth_rot_t19_active"]) {
    const duration = $.state["__jpp_smooth_rot_t19_duration"];
    const before = $.state["__jpp_smooth_rot_t19_elapsed"];
    const elapsed = Math.min(duration, before + deltaTime);
    $.state["__jpp_smooth_rot_t19_elapsed"] = elapsed;
    const delta = $.state["__jpp_smooth_rot_t19_delta"];
    // 前のフレームまでに回した分を戻してから、今のフレームまでの分を回す（ほかの回転と足し合わせるため）
    const undo = new Quaternion().setFromEulerAngles(delta.clone().multiplyScalar(before / duration)).invert();
    const redo = new Quaternion().setFromEulerAngles(delta.clone().multiplyScalar(elapsed / duration));
    turnItem(itemRotation().multiply(undo).multiply(redo));
    if (elapsed >= duration) {
      $.state["__jpp_smooth_rot_t19_active"] = false;
    }
  }
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // 角度を x:0 y:90 z:0 だけ 2 秒かけて回す
  {
    // 回り始め: 今の向きと回す量を覚えて、毎フレーム少しずつ回す
    $.state["__jpp_smooth_rot_t19_active"] = true;
    $.state["__jpp_smooth_rot_t19_elapsed"] = 0;
    $.state["__jpp_smooth_rot_t19_duration"] = 2;
    $.state["__jpp_smooth_rot_t19_from"] = itemRotation();
    $.state["__jpp_smooth_rot_t19_delta"] = new Vector3(0, 90, 0);
  }
});
