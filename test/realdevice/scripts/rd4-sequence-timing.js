// Jcreate++ 実機テスト rd4「待機のタイミング」 — 手順は CHECKLIST.md
// 位置を動かすブロックが複数あるので、このスクリプトが最後に決めた位置を覚えておき、そこに足していく
// （$.getPosition() は移動中の位置を返すので、同じフレームで何度も読むと、前の動きが消えてしまう）
const itemPosition = () => { const p = $.state["__jpp_pose_position"]; return p ? p.clone() : ($.getPosition() || new Vector3(0, 0, 0)); };
// アイテムを pos に動かして、その位置を覚える
const placeItem = (pos) => { $.state["__jpp_pose_position"] = pos; $.setPosition(pos); };

// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う

  // 一連の動作（ブロック t50）: 実行中なら、今のステップから続きを進める
  if ($.state["__jpp_seq_active_t50"]) {
    let step = $.state["__jpp_seq_step_t50"] || 0;
    let budget = deltaTime; // このフレームで使える時間（待つステップが使う）
    let yielded = false; // true になったら、続きは次のフレーム
    let guard = 0;
    const MAX_SYNC_STEPS_PER_TICK = 100;

    while (!yielded && guard < MAX_SYNC_STEPS_PER_TICK) {
      guard++;
      switch (step) {
        case 0: {
          // 位置を x:0 y:1 z:0 ずつ変える
          placeItem(itemPosition().add(new Vector3(0, 1, 0)));
          step++;
          break;
        }
        case 1: {
          // 1 秒待つ
          let time = ($.state["__jpp_seq_time_t50"] || 0) + budget;
          const seconds = 1;
          if (time >= seconds - 1e-6) {
            // 待ち終わり: 余った時間は次のステップに回す
            budget = Math.max(0, time - seconds);
            $.state["__jpp_seq_time_t50"] = 0;
            step++;
          } else {
            // まだ待つ: 続きは次のフレーム
            $.state["__jpp_seq_time_t50"] = time;
            budget = 0;
            yielded = true;
          }
          break;
        }
        case 2: {
          // 1 秒待つ
          let time = ($.state["__jpp_seq_time_t50"] || 0) + budget;
          const seconds = 1;
          if (time >= seconds - 1e-6) {
            // 待ち終わり: 余った時間は次のステップに回す
            budget = Math.max(0, time - seconds);
            $.state["__jpp_seq_time_t50"] = 0;
            step++;
          } else {
            // まだ待つ: 続きは次のフレーム
            $.state["__jpp_seq_time_t50"] = time;
            budget = 0;
            yielded = true;
          }
          break;
        }
        case 3: {
          // 1 秒待つ
          let time = ($.state["__jpp_seq_time_t50"] || 0) + budget;
          const seconds = 1;
          if (time >= seconds - 1e-6) {
            // 待ち終わり: 余った時間は次のステップに回す
            budget = Math.max(0, time - seconds);
            $.state["__jpp_seq_time_t50"] = 0;
            step++;
          } else {
            // まだ待つ: 続きは次のフレーム
            $.state["__jpp_seq_time_t50"] = time;
            budget = 0;
            yielded = true;
          }
          break;
        }
        case 4: {
          // 位置を x:0 y:-1 z:0 ずつ変える
          placeItem(itemPosition().add(new Vector3(0, -1, 0)));
          step++;
          break;
        }
        case 5: {
          // 最後まで進んだので終わる（次に始めるときは最初から）
          $.state["__jpp_seq_active_t50"] = false;
          step = 0;
          $.state["__jpp_seq_step_t50"] = 0;
          $.state["__jpp_seq_time_t50"] = 0;
          yielded = true;
          break;
        }
        default: {
          yielded = true;
          break;
        }
      }
    }

    $.state["__jpp_seq_step_t50"] = step;
  }
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // 一連の動作を始める（中は「毎フレーム」の中で順番に進む）
  if (!$.state["__jpp_seq_active_t50"]) {
    $.state["__jpp_seq_active_t50"] = true;
    $.state["__jpp_seq_step_t50"] = 0;
    $.state["__jpp_seq_time_t50"] = 0;
  }
});
