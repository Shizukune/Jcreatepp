// Jcreate++ 実機テスト rd11a「メッセージ（送る側）」 — 手順は CHECKLIST.md
// ── インタラクト時 ──
$.onInteract((player) => {
  // もし true なら 指定アイテム receiver に メッセージ「open」を送る
  {
    const target = $.worldItemReference("receiver");
    if (target && target.exists()) {
      target.send("open", null);
    }
  }
});

// ── メッセージを受け取ったとき ──
$.onReceive((msg, arg, sender) => {
  // メッセージ「ack」を受け取ったとき
  if (msg === "ack") {
    // 角度を x:0 y:45 z:0 ずつ変える
    {
      const rot = $.getRotation();
      $.setRotation((rot ? rot.clone() : new Quaternion()).multiply(new Quaternion().setFromEulerAngles(new Vector3(0, 45, 0))));
    }
  }
}, { item: true, player: true });
