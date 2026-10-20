// Jcreate++ 実機テスト rd12「音と文字」 — 手順は CHECKLIST.md
// 小数の計算誤差をなくす（有効数字15桁にそろえる。例: 0.1 + 0.2 → 0.3）
const roundDecimal = (v) => { const n = Number(v.toPrecision(15)); return isFinite(n) || !isFinite(v) ? n : v; };

// ── 開始時 ──
$.onStart(() => {
  // 数値変数 count を 0 にする
  $.state["var.count"] = 0;
  // サブノード Label の TextView の文字を 数値変数 count にする
  {
    const node = $.subNode("Label");
    if (node && typeof node.setText === "function") {
      node.setText(String($.state["var.count"] || 0));
    }
  }
});

// ── インタラクト時 ──
$.onInteract((player) => {
  // 数値変数 count を 1 だけ増やす
  $.state["var.count"] = roundDecimal(($.state["var.count"] || 0) + 1);
  // 音 se を 音量 1 で鳴らす
  {
    const audio = $.audio("se");
    if (audio) {
      audio.volume = 1;
      audio.play();
    }
  }
  // サブノード Label の TextView の文字を 数値変数 count にする
  {
    const node = $.subNode("Label");
    if (node && typeof node.setText === "function") {
      node.setText(String($.state["var.count"] || 0));
    }
  }
});
