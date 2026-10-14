# Jcreate++ 開発ルール（Claude Code 向け）

Blockly で組んだブロックから Cluster Script（JavaScript）を生成するエディタ。

## 構成
- `src/blocks/` ブロック定義・イベント文脈ルール（値ブロックのイベント文脈は `context.ts`、文ブロックの置き場所と「一連の動作」まわりは `placement.ts` が正本。変換エラーとエディタ警告の両方がここを使う。置き場所ルールを足すときは `placement.ts` だけを変え、`test/placement.test.ts` の固定ケースも足す）
- `src/generators/jcreatepp.ts` Blockly ワークスペース → IR（`src/ir.ts`）変換とエラー検出
- `src/codegen/` IR → Cluster Script 生成（Cluster Script の構文はここだけが持つ）
- `src/unityRequirements.ts` IR → Unity 側で必要な設定の案内
- `src/index.ts` UI（DOM）。テストからは読み込まない
- `src/variables.ts` 変数の正本: 種類・`$.state` キー規則（codegen はここを使う）・IR からの変数一覧（`Program.variables`）。ブロック側の読み書き表は `src/blocks/variableBlocks.ts`（両者の一致は `test/variables.test.ts`）
- `src/sim/` Cluster Script 互換の `$` モックと実行器（DOM 非依存。テストと 3D プレビューで共用）
- `src/preview/` 3D プレビュー（three.js、タブを開いたときに動的 import）。座標系の変換は `coords.ts` だけに置く
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
   - `src/sim/` は DOM 非依存。将来の 3D プレビューでも同じモックを使う（設計: `docs-internal/3d-preview-design.md`、gitignore 対象）
3. `npm run build`（本番ビルド。プッシュ前に必須）— GitHub Actions のデプロイはこのビルドで失敗する。`tsc` が通っても本番の圧縮（Terser）で落ちることがある（例: 引用符なしの日本語オブジェクトキーに「・」）
4. Codex レビュー（読み取り専用）: `powershell -ExecutionPolicy Bypass -File ..\codex-review.ps1 -Uncommitted -Context "<目的・想定動作>" -Focus "<重点>"`
   - 指摘は鵜呑みにせず、コードと照合して妥当性を判断してから報告する

## 報告形式
【実装概要】【変更ファイル】【テスト結果】【Codexレビュー】【Claude Codeの評価】【対応方針】【未解決事項】
