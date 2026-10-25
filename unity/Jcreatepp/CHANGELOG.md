# Changelog

## 0.2.0 (2026-10-26)

- プレビュー（メニュー「Jcreate++ > プレビュー」）
  - スクリプトを、ウィンドウの中の立方体で動かして見る（シーンと Play モードには触れない）
  - 再生・一時停止・1コマ・最初から、速さ
  - 使っているイベントのボタン（インタラクト時・持ったとき・離したとき・衝突したとき・メッセージを受け取ったとき）
  - 位置と角度、変数・フラグ・クールダウン、ログ
  - 動きの計算は Jcreate++ の Web版 3D プレビューと同じシミュレーター
- JavaScript エンジン Jint（BSD-2-Clause）と、その依存の Acornima（BSD-3-Clause）・System.Runtime.CompilerServices.Unsafe（MIT）を同梱（Editor のみ）
- EditMode テスト（Test Runner）

## 0.1.0 (2026-10-22)

- 最初の試作
  - メニュー「Jcreate++」から、.js を選んでオブジェクトに設定する
  - Item / Scriptable Item / Movable Item / Grabbable Item / Ridable Item（Seat）を自動で付ける
  - 音・参照・サブノード・Collider の確認
