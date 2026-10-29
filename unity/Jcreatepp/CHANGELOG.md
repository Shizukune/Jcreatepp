# Changelog

## Unreleased

- ブロックエディター（メニュー「Jcreate++ > ブロックエディター」）
  - Web 版と同じパレット（カテゴリと初期値）から、ドラッグでブロックを置いてつなげる。値の入力・選択、削除（Delete / パレットに戻す）、複製、整列、Ctrl+Z / Ctrl+Y
  - つながる場所と型のチェックは Blockly と同じ（数値の所に真偽値は入らない、など）。途中に入れると下のブロックが続く
  - 自動で変換して、変換できないところ・警告（「見る」でブロックへ移動）・コード・大きさ・アイテムに必要なものを表示
  - 「プレビューで動かす」で、保存しないままプレビューへ（ブロックを変えると、開いているプレビューもやり直す）
  - 「選択中のオブジェクトに設定する」で、保存したブロックと同じ名前の .js を書き出して Item / Scriptable Item などを付ける
  - 保存は Web 版と同じ形の .json（Web 版の「読み込み」で開ける。Web 版で保存した .json も開ける）。Project ウィンドウでダブルクリックしても開く
  - 部品（自動でブロック）を値を選んで追加
- ブロックの形・パレットは、同梱のブロック処理の Blockly から読む（`CoreEditorScript.cs`。読み込むときにブロック処理へ入口を足す。ファイルは変えない）
- 修正: 影のブロック（数値の入力の初期値など）があるブロックを、ブロック処理が変換できなかった（Jint に DOM が無く、Blockly が影の XML 控えを作れなかった）。最小の代わりを渡すようにした
- プレビューが、.js のほかにブロックエディターのコードも受け取れるようにした。ブロックが変換できないとき（または自動でやり直さない設定のとき）は、最後に変換できたコードで動いていることを警告で出す
- 書き出した .js があとで変更されていたら、上書きの前に確認する。Project ウィンドウからファイルを開くとき・保存済みのファイルを空にしたときも、未保存の変更を確認する
- パレットの定義 `Editor/Blocks/jcreatepp-toolbox.json`（Web 版の `src/toolbox.ts` から `Tools~/make-toolbox.ps1` で作る）
- EditMode テストに `BlockEditorTests` を追加
- ブロック処理の土台（`Editor/Core/`）
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
