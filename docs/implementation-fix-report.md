# Jcreate++ MVP Fix Report

## Summary

MVP実装後のレビューで見つかった問題を修正した。

主な修正対象は以下。

- `$.onReceive` 生成コードの改行不具合
- `if -> sequence -> wait` がエラーになる問題
- `jcreatepp_on_receive` 複数配置時のリアルタイム警告
- 空メッセージ名の検証不足

修正後、`npm run build` が成功することを確認した。

## Changed Files

- `src/codegen.ts`
- `src/generators/jcreatepp.ts`
- `src/validator.ts`

## Fix Details

### 1. `$.onReceive` generated newline bug

修正前:

```ts
lines.join('\\n')
```

この状態だと、生成された JavaScript 内に実改行ではなく `\n` 文字列が混ざる可能性があった。

修正後:

```ts
lines.join('\n')
```

これにより、`$.onReceive` 内の `if (msg === "...")` ブロックが通常の複数行 JavaScript として生成される。

対象:

- `src/codegen.ts`

### 2. `if -> sequence -> wait` validation issue

修正前:

- `if` の中に `sequence` を配置できる。
- しかし、その `sequence` の中に `wait_seconds` / `wait_until` を置くと、外側の `if` が原因でエラーになっていた。

これはMVPの目的である「メッセージを受け取ったら if で判定し、一連の動作を開始する」と衝突していた。

修正後:

- `sequence` の中身を変換するとき、外側の `if` の文脈を待機ブロックへ伝播しないようにした。
- これにより、外側の `if` で `sequence` を開始し、その `sequence` 内で待機ブロックを使える。

対象:

- `src/generators/jcreatepp.ts`

意図:

```txt
メッセージ "open" を受け取ったとき
  もし フラグ doorEnabled なら
    一連の動作
      1 秒待つ
      位置を変える
```

この構造を合法にする。

### 3. `onReceive` duplicate warning

修正前:

- `jcreatepp_on_receive` が `EVENT_BLOCK_TYPES` に含まれていた。
- リアルタイムバリデーションが `EVENT_BLOCK_TYPES` 全体を重複チェックしていた。
- そのため、複数の受信ブロックを置くと「同種イベントは1つまで」の警告が出る可能性があった。

修正後:

- 重複チェック対象を `UNIQUE_EVENT_BLOCK_TYPES` に変更した。
- `jcreatepp_on_receive` は複数配置できるイベントとして扱われる。

対象:

- `src/validator.ts`

### 4. Empty message name validation

修正前:

- `jcreatepp_on_receive` のメッセージ名が空でも生成処理へ進めていた。

修正後:

- 生成時に空メッセージ名をエラーにする。
- UI上でも空メッセージ名に警告を出す。

対象:

- `src/generators/jcreatepp.ts`
- `src/validator.ts`

## Verification

実行コマンド:

```txt
npm run build
```

結果:

- TypeScript / webpack build succeeded.
- `bundle.js` が生成された。
- webpack の bundle size warning は残っているが、既存の想定内警告。

残った警告:

- `bundle.js` が推奨サイズを超えている。
- entrypoint size warning。
- webpack performance recommendation。

これらは今回修正範囲外。

## Current MVP Status

今回の修正により、MVPの主要仕様はコード上かなり整った。

対応済み:

- 固定文字列メッセージ受信ブロック
- 複数 `onReceive` ブロック許可
- 同じメッセージ名のハンドラ統合
- `{ item: true, player: true }` による受信
- `$.state` のブラケットアクセス
- `if` 内からの `sequence` 開始
- `sequence` 内の待機処理
- `onGrabStart` / `onGrabEnd` / `onReceive` 内 sequence の runner 抽出

## Remaining Review Points

### 1. Manual UI verification

ビルドは通っているが、ブラウザ上での手動確認は別途必要。

確認したい項目:

- ツールボックスに `メッセージ open を受け取ったとき` が表示される。
- `onReceive` を複数置いても重複警告が出ない。
- 空メッセージ名に警告が出る。
- `if` 内に `sequence` を置き、その中に `wait_seconds` を置ける。
- 生成コードに `$.onReceive` と `$.onUpdate` runner が両方出る。

### 2. Validator and generator rule duplication

現在もブロック種別の知識が複数ファイルに分散している。

将来的には、設計書どおり block metadata registry に寄せると安全。

対象候補:

- `src/blocks/context.ts`
- `src/validator.ts`
- `src/generators/jcreatepp.ts`
- `src/toolbox.ts`

### 3. `BoolExpr.near`

`ir.ts` に `near` が存在するが、codegen 側ではまだ生成されない。

現時点では生成元がなければ事故にならないが、将来ブロック追加時に見落とす可能性がある。

対策候補:

- 未実装なら一旦削除する。
- `boolExprToJS()` を exhaustive check にする。

### 4. Full runtime validation in cluster

Cluster Script APIとしての形は設計に沿っているが、実際の cluster 実行環境で以下は確認したい。

- `$.onReceive` の受信元 `{ item: true, player: true }`
- `sender` を未使用にして問題ないか
- 複数メッセージ分岐の動作
- sequence runner の状態保持

## Conclusion

レビューで見つかったMVP直撃の問題は修正済み。

現時点では、実装は「ビルド可能で、設計方針と大きく整合している」状態。

次の作業は、ブラウザ上での手動確認と、必要であれば実cluster環境での `onReceive` 動作確認。

