# Jcreate++ 開発ルール（Claude Code 向け）

Blockly で組んだブロックから Cluster Script（JavaScript）を生成するエディタ。

## 構成
- `src/blocks/` ブロック定義・イベント文脈ルール（値ブロックのイベント文脈は `context.ts`、文ブロックの置き場所と「一連の動作」まわりは `placement.ts` が正本。変換エラーとエディタ警告の両方がここを使う。置き場所ルールを足すときは `placement.ts` だけを変え、`test/placement.test.ts` の固定ケースも足す）
- `src/generators/jcreatepp.ts` Blockly ワークスペース → IR（`src/ir.ts`）変換とエラー検出
- `src/codegen/` IR → Cluster Script 生成（Cluster Script の構文はここだけが持つ）
  - 生成コードは読む人（学習者）向け: 各文の前に `describe.ts` の日本語コメント、括弧は `format.ts` の `group()` / `bare()` で必要な所だけ、補助関数は `helpers.ts` で使うときだけ先頭に定義
  - 利用者の文字列をコメントに入れるときは必ず `commentText()`、文字列リテラルは `jsString()`（U+2028/2029 で注釈やリテラルを抜けられないように）
  - 生成コードの見た目を変える変更では `test/__behavior__`（動作スナップショット）が1バイトも変わらないことを確認する
- `src/unityRequirements.ts` IR → Unity 側で必要な設定の案内。`src/unitySetup.ts` は同じ内容の機械可読版（将来の Unity 拡張用）
- `src/demos/` ブロックの動き見本（ツールチップ）。`playback.ts` はブロック JSON → IR → コード → sim を DOM なしで再生する共通の土台。`demoRenderer.ts` は three.js を使うので必ず動的 import
- `src/parts/` 部品（ブロックのかたまりを自動で追加）。部品は IR ではなく保存形式のブロック JSON に展開し、追加前にコピーで変換エラーを確認、本番には 1 回の Undo で消せる形で入れる。位置・角度を動かすブロックの表（`insert.ts` の `WRITERS`）は新しい動作ブロックを足したら更新する
- `unity/Jcreatepp/` Unity エディタ拡張（試作。UPM パッケージ形式、Assets にコピーしても使える）。C# は Unity 2021.3 / CCK 3.4 向け、C# 5 相当の書き方で、ここでは Unity が無いのでスタブに対するコンパイル確認まで。スクリプトの読み取り（`ScriptAnalysis.cs`）は生成コードの書き方（`$.setPosition(` など）に依存するので、codegen の API 呼び出しを変えたらここも見直す
  - プレビュー（`Editor/Preview/`）は `src/unityHost/host.ts` を `npm run unity:sim` でまとめた `Sim/jcreatepp-sim.txt` を Jint（同梱 DLL、`Plugins/`）で動かす。`src/sim`・host・それが import するものを変えたら必ず `npm run unity:sim`（古いと `npm test` が失敗する）
  - Unity 無しの確認: `powershell -ExecutionPolicy Bypass -File unitycheckcheck.ps1 [-JintDir <net462 の DLL のフォルダ>]`（スタブでのコンパイルと、本物の Jint で SimHost を動かす確認）
- `src/index.ts` UI（DOM）。テストからは読み込まない
- `src/variables.ts` 変数の正本: 種類・`$.state` キー規則（codegen はここを使う）・IR からの変数一覧（`Program.variables`）。ブロック側の読み書き表は `src/blocks/variableBlocks.ts`（両者の一致は `test/variables.test.ts`）
- `src/sim/` Cluster Script 互換の `$` モックと実行器（DOM 非依存。テストと 3D プレビューで共用）
- `src/preview/` 3D プレビュー（three.js、タブを開いたときに動的 import）。`previewApp.ts` は配線のみで、`scene.ts`（描画）/ `editGizmo.ts`（3D編集）/ `panel.ts`（状態・ログ）/ `rideControls.ts`（乗車操作）に分かれる。座標系の変換は `coords.ts` だけに置く
- `programToJS(program, { trace: true })` はプレビュー専用。Cluster に出すコード・表示・保存には絶対に使わない（`test/sim.test.ts` で trace 有無の一致を確認）
- 処理の流れは Blockly → IR → コード生成。新機能もこの流れに沿わせる（将来の 3D エディタ / Unity Editor 統合は IR を共有する前提）

## 守ること
- 保存データ互換性: ブロックの `type`・入力名・フィールド名・ドロップダウン値は変更しない（例: `_once` 接尾辞は互換のため残している）
- 既存機能に影響する変更・大きな構造変更は、着手前にユーザーへ確認する
- 依存ライブラリを安易に追加しない。認証情報をリポジトリに置かない
- シーケンス制御・変数制御のリファクタリングは、ユーザーの指示があるまで行わない（問題を見つけたら記録のみ）

## 確認手順（完了報告の前に必ず実行）
1. `npx tsc --noEmit`
2. `npm test` — 回帰テスト（Node 組み込みテストランナー、追加依存なし）
   - `test/fixtures/*.json` は保存形式そのもののワークスペース。`test/__snapshots__/*.txt` に生成結果（エラー・Unity設定案内・コード）を固定
   - 出力が意図どおりに変わった場合のみ `npm run test:update` で更新し、差分をユーザーに示す
   - 新しいブロックや生成パターンを追加したら fixture も追加する
   - 生成コードのstateキーにはブロックIDが入るため、既存 fixture のIDは変えない
   - `test/sim.test.ts` は生成コードを `src/sim/`（Cluster Script 互換の `$` モック）で実際に動かす動作テスト。既知の不具合は `todo` テストに期待動作を書いてある（直したら `todo` を外す）
   - 実機確認キット `test/realdevice/`: 正本は `scenarios.ts`。`npm run realdevice:export` で JSON・`scripts/*.js`（生成済み Cluster Script）・`CHECKLIST.md`（手順書）を作り直す。生成コードが変わったら必ず再実行（古いと `npm test` が失敗する）
   - `src/sim/` は DOM 非依存。将来の 3D プレビューでも同じモックを使う（設計: `docs-internal/3d-preview-design.md`、gitignore 対象）
3. `npm run build`（本番ビルド。プッシュ前に必須）— GitHub Actions のデプロイはこのビルドで失敗する。`tsc` が通っても本番の圧縮（Terser）で落ちることがある（例: 引用符なしの日本語オブジェクトキーに「・」）
4. Codex レビュー（読み取り専用）: `powershell -ExecutionPolicy Bypass -File ..\codex-review.ps1 -Uncommitted -Context "<目的・想定動作>" -Focus "<重点>"`
   - 指摘は鵜呑みにせず、コードと照合して妥当性を判断してから報告する

## 報告形式
【実装概要】【変更ファイル】【テスト結果】【Codexレビュー】【Claude Codeの評価】【対応方針】【未解決事項】
