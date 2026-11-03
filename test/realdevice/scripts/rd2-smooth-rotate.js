// Jcreate++ 実機テスト rd2「秒数つき回転」 — 手順は CHECKLIST.md
// 向きを変えるブロックが複数あるので、このスクリプトが最後に決めた向きを覚えておき、そこから回していく
// （$.getRotation() は回転中の向きを返すので、同じフレームで何度も読むと、前の回転が消えてしまう）
// ただし今の向きが「最後に回す前の向き → 決めた向き」の回る途中から 3 度以上外れていたら、手で持つ・物理などで回ったので、今の向きから始める
const itemRotation = () => {
  const now = $.getRotation() || new Quaternion();
  const q = $.state["__jpp_pose_rotation"];
  const from = $.state["__jpp_pose_rotation_from"];
  if (!q || !from) return now;
  // 回る途中で、今の向きにいちばん近い向きとの角度（向きを 4 つの数の組として、from と q を結ぶ円の上で探す）
  const sign = from.dot(q) < 0 ? -1 : 1;
  const c = Math.min(1, sign * from.dot(q));
  const s = Math.sqrt(1 - c * c);
  const a = now.dot(from);
  const b = s > 1e-6 ? (sign * now.dot(q) - c * a) / s : 0;
  let nearest = 0;
  for (const k of [1, -1]) {
    const angle = Math.min(Math.acos(c), Math.max(0, Math.atan2(k * b, k * a)));
    nearest = Math.max(nearest, k * (a * Math.cos(angle) + b * Math.sin(angle)));
  }
  if (2 * Math.acos(Math.min(1, nearest)) * 180 / Math.PI > 3) return now;
  // 決めた向きになったら、回る途中は終わり（このあとは決めた向きからのずれだけを見る）
  if (Math.abs(now.dot(q)) > 0.99999999) $.state["__jpp_pose_rotation_from"] = q;
  return q.clone();
};
// アイテムを rot の向きにして、その向きと、回す前の向きを覚える（すぐに向いたときは、回す前の向きはいらない）
const turnItem = (rot) => {
  const before = $.getRotation() || new Quaternion();
  $.setRotation(rot);
  const after = $.getRotation();
  $.state["__jpp_pose_rotation"] = rot;
  $.state["__jpp_pose_rotation_from"] = after && Math.abs(after.dot(rot)) > 0.99999999 ? rot : before;
};

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
