# Changelog

## Unreleased

- ブロック処理の土台（`Editor/Core/`）。まだ画面からは使っていない
  - Web 版と同じ Blockly・変換・置き場所の警告・コード生成・必要な設定・部品を、Jint で動かす（`CoreHost`）
  - Blockly（Apache-2.0）を `jcreatepp-core.txt` に含めて同梱
- EditMode テストに `CoreHostTests` を追加（この Unity での時間を Console に出す）

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
