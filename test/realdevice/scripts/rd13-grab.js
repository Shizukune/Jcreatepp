// Jcreate++ 実機テスト rd13「つかむ・離す」 — 手順は CHECKLIST.md
// ── 持ったとき / 離したとき ──
$.onGrab((isGrab, isLeftHand, player) => {
  // 持ったとき
  if (isGrab) {
    // サブノード Label の TextView の文字を 「持った」 にする
    {
      const node = $.subNode("Label");
      if (node && typeof node.setText === "function") {
        node.setText(String("持った"));
      }
    }
  }
  // 離したとき
  if (!isGrab) {
    // サブノード Label の TextView の文字を 「離した」 にする
    {
      const node = $.subNode("Label");
      if (node && typeof node.setText === "function") {
        node.setText(String("離した"));
      }
    }
  }
});
