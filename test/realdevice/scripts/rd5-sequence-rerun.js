// Jcreate++ 実機テスト rd5「一連の動作の再実行」 — 手順は CHECKLIST.md
// ── 毎フレーム ──
$.onUpdate((deltaTime) => {
  // 一連の動作（ブロック t60）: 実行中なら、今のステップから続きを進める
  if ($.state["__jpp_seq_active_t60"]) {
    let step = $.state["__jpp_seq_step_t60"] || 0;
    let budget = deltaTime; // このフレームで使える時間（待つステップが使う）
    let yielded = false; // true になったら、続きは次のフレーム
    let guard = 0;
    const MAX_SYNC_STEPS_PER_TICK = 100;

    while (!yielded && guard < MAX_SYNC_STEPS_PER_TICK) {
      guard++;
      switch (step) {
        case 0: {
          // もし true になった瞬間だけ
          {
            const condition = true;
            if (condition && !$.state["__jpp_edge_t57"]) {
              // 位置を x:0 y:0.5 z:0 ずつ変える
              $.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(0, 0.5, 0)));
              $.state["__jpp_edge_t57"] = true;
            }
            if (!condition) {
              $.state["__jpp_edge_t57"] = false;
            }
          }
          step++;
          break;
        }
        case 1: {
          // 0.5 秒待つ
          let time = ($.state["__jpp_seq_time_t60"] || 0) + budget;
          const seconds = 0.5;
          if (time >= seconds - 1e-6) {
            // 待ち終わり: 余った時間は次のステップに回す
            budget = Math.max(0, time - seconds);
            $.state["__jpp_seq_time_t60"] = 0;
            step++;
          } else {
            // まだ待つ: 続きは次のフレーム
            $.state["__jpp_seq_time_t60"] = time;
            budget = 0;
            yielded = true;
          }
          break;
        }
        case 2: {
          // 最後まで進んだので終わる（次に始めるときは最初から）
          $.state["__jpp_seq_active_t60"] = false;
          step = 0;
          $.state["__jpp_seq_step_t60"] = 0;
          $.state["__jpp_seq_time_t60"] = 0;
          yielded = true;
          break;
        }
        default: {
          yielded = true;
          break;
        }
      }
    }

    $.state["__jpp_seq_step_t60"] = step;
  }
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // 一連の動作を始める（中は「毎フレーム」の中で順番に進む）
  if (!$.state["__jpp_seq_active_t60"]) {
    $.state["__jpp_seq_active_t60"] = true;
    $.state["__jpp_seq_step_t60"] = 0;
    $.state["__jpp_seq_time_t60"] = 0;
    $.state["__jpp_edge_t57"] = false;
  }
});
