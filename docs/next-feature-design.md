# Jcreate++ 次期ブロック設計メモ

## 目的

次に追加する候補を、現状の Jcreate++ の基幹システムに合わせて破綻しにくい順番で設計する。

対象:

- 自動テスト基盤
- ランダム数値
- メッセージ値の送受信
- Unity 必要設定の表示
- 衝突イベント
- 滑らかな移動
- クールダウン

## 現状の基幹システム

Jcreate++ は次の流れで成り立っている。

```text
Blockly ブロック
  ↓
generators/jcreatepp.ts
  ↓
IR: ir.ts
  ↓
codegen/*
  ↓
Cluster Script JS
```

この構造は維持する。

特に重要なのは、時間経過を使う処理を `programToJS()` が 1 個の `$.onUpdate((deltaTime) => {...})` に集約している点。

そのため、滑らかな移動・クールダウン・範囲監視などは、各ブロックが勝手に `onUpdate` を生やすのではなく、IR か runtime task として集約する。

## 設計方針

### 1. ブロック追加は IR 経由にする

短期的に `raw` JS で逃がすと早いが、後からバリデーション・テスト・Unity 必要設定の抽出が難しくなる。

新機能は原則として次のどちらかに分類する。

- `Expr`: 値を返すブロック
- `Stmt`: 動作するブロック
- `Program` / `Handler`: イベントを作るブロック

### 2. 時間を使う機能は update task に寄せる

以下は全部「毎フレーム状態を見て進める処理」なので、同じ設計に寄せる。

- 滑らかな移動
- クールダウン
- 範囲に入った/出た
- 一定時間の処理

将来的には内部的に次のような概念を持つと扱いやすい。

```ts
type RuntimeTask =
  | { kind: 'smooth_move'; id: string; ... }
  | { kind: 'cooldown'; id: string; ... }
  | { kind: 'overlap_watch'; id: string; ... };
```

ただし最初から大きく作り替えず、まずは既存の `sequence` と `programToJS()` の onUpdate 集約に乗せる。

### 3. Unity 側設定は codegen とは別に収集する

Cluster Script だけでは完結しないものがある。

例:

- `worldItemReference(id)` → World Item Reference List が必要
- `$.audio(id)` → Item Audio Set List が必要
- `$.material(id)` → Item Material Set List が必要
- `$.getOverlaps()` → OverlapDetectorShape / Collider / Layer 設定が必要
- `$.setPosition()` の継続移動 → Movable Item 前提

このため、ブロックから必要設定を集めて UI に表示する仕組みを入れる。

```ts
type UnityRequirement =
  | { kind: 'movable_item'; reason: string; blockId: string }
  | { kind: 'world_item_reference'; id: string; reason: string; blockId: string }
  | { kind: 'overlap_detector'; reason: string; blockId: string }
  | { kind: 'audio_set'; id: string; reason: string; blockId: string }
  | { kind: 'material_set'; id: string; reason: string; blockId: string };
```

初期実装では `collectUnityRequirements(program)` を追加し、コード出力欄の近くに「Unity側で必要な設定」として表示するのがよい。

## 機能別設計

### 自動テスト基盤

優先度: 最優先

目的:

- IR → JS の生成結果を固定する
- 既存ブロック追加時の破壊を早めに検出する
- Cluster 実行環境がなくても疑似的に動作確認する

段階:

1. codegen のユニットテスト
   - `programToJS(program)` の出力に必要な API 呼び出しが含まれるか確認する
   - 例: メッセージ送信なら `.send("xxx", value)` が出るか

2. 小さい mock runtime
   - `$`
   - `$.state`
   - `$.onUpdate`
   - `$.onReceive`
   - `$.setPosition`
   - `$.getPosition`
   - `ItemHandle.send`

3. 状態遷移テスト
   - once 系メッセージが押しっぱなしで連発しない
   - cooldown 中は実行されない
   - smooth move が deltaTime で進む

推奨:

- テストランナーは Vitest が扱いやすい
- ただし依存追加が必要
- 依存を増やしたくない場合は Node の `node:test` + TypeScript ビルド後の JS を対象にする

### ランダム数値

優先度: 高

分類:

- `Expr`

IR:

```ts
type RandomNumberExpr = {
  kind: 'random_number';
  min: Expr;
  max: Expr;
  mode: 'float' | 'integer';
};
```

codegen:

```js
// float
min + Math.random() * (max - min)

// integer
Math.floor(min + Math.random() * (max - min + 1))
```

注意:

- `min > max` のときの扱いを決める
- 初心者向けには `Math.min/Math.max` で自動補正する方が安全

Unity 必要設定:

- なし

実装難度:

- 低い

### メッセージ値の送受信

優先度: 高

現状:

- メッセージ名の送受信はある
- 送信値は `null`
- 受信側の `arg` をブロックで参照できない

設計:

送信側:

```ts
type SendMessageToItemOnceStmt = {
  kind: 'send_message_to_item_once';
  message: string;
  itemName: string;
  value?: Expr | BoolExpr | StringExpr;
  condition: BoolExpr;
  blockId: string;
};
```

受信側:

```ts
type MessageValueExpr = {
  kind: 'message_value';
  valueType: 'number' | 'string' | 'boolean' | 'raw';
};
```

最初は数値だけでよい。

理由:

- 数値を受け取れれば、スコア、段階、扉番号、残り時間などが作れる
- 型を広げるのは後からでよい

バリデーション:

- `message_value` は `onReceive` の中だけ使用可能
- `reply_message_once` と同様、sequence の中では禁止が安全

Unity 必要設定:

- `worldItemReference` を使う送信では World Item Reference List が必要
- 範囲送信では対象 Item 側の Collider / Shape 設定が必要

実装難度:

- 中

### Unity 必要設定の表示

優先度: 高

設計:

`Program` または `Workspace` から必要設定を収集する。

最初は IR ベースでよい。

```ts
function collectUnityRequirements(program: Program): UnityRequirement[]
```

表示例:

```text
Unity側で必要な設定:
- このアイテムを Movable Item にしてください（滑らかな移動）
- World Item Reference List に "door01" を登録してください
- 範囲判定には OverlapDetectorShape または判定用 Collider が必要です
```

ポイント:

- エラーではなく「必要設定」として出す
- 実行できない原因をユーザーに見える形にする
- 生成 JS のコメントにも同じ内容を入れると親切

実装難度:

- 中

### 衝突イベント

優先度: 中

分類:

- `Program` / `Handler`

IR:

```ts
type Program = {
  onCollide?: Handler;
};
```

codegen:

```js
$.onCollide((collision) => {
  // body
});
```

最初のブロック:

- 「衝突したとき」

後回しにしてよいもの:

- 衝突相手の種類判定
- 衝突相手の速度
- 衝突相手へメッセージ送信

理由:

- まずイベントとして使えるだけでも、スイッチ・トラップ・当たり判定が作れる

Unity 必要設定:

- 物理判定用の Collider / Physical Shape
- 必要に応じて Rigidbody / Movable 設定

実装難度:

- 中

### 滑らかな移動

優先度: 中

分類:

- `Stmt`
- sequence と相性が良い

おすすめブロック:

- 「指定位置まで N 秒で移動する」
- 「現在位置から X/Y/Z だけ N 秒で移動する」

IR:

```ts
type SmoothMoveStmt = {
  kind: 'smooth_move';
  mode: 'to' | 'by';
  x: Expr;
  y: Expr;
  z: Expr;
  duration: Expr;
  blockId: string;
};
```

実行方式:

- sequence 内では `wait_seconds` と同じように state machine の step として進める
- 非 sequence では「開始だけ」して onUpdate task が進める設計も可能だが、初期実装では sequence 専用にするのが安全

理由:

- 「動き終わるまで待つ」が表現しやすい
- 途中で次の処理に進む/進まないの意味が明確になる

Unity 必要設定:

- Movable Item 前提

実装難度:

- 中

### クールダウン

優先度: 中

用途:

- ボタン連打防止
- メッセージ連発防止
- トラップの再発動待ち

最初に作るべき形:

1. 値ブロック
   - 「クールダウン中？」

2. 文ブロック
   - 「クールダウンを開始する N 秒」

IR:

```ts
type CooldownActiveExpr = {
  kind: 'cooldown_active';
  name: string;
};

type StartCooldownStmt = {
  kind: 'start_cooldown';
  name: string;
  seconds: Expr;
};
```

実行方式:

- `$.state["__jpp_cd_until_x"]` ではなく、現状は絶対時刻 API に依存しない方が安全
- `$.onUpdate` で `remaining -= deltaTime` する

必要な追加:

- `programToJS()` に cooldown tick を入れる
- ただし「使われている cooldown 名」だけ tick する

Unity 必要設定:

- なし

実装難度:

- 中

## 推奨実装順

### Phase 1: 土台

1. 自動テスト基盤
2. ランダム数値
3. Unity 必要設定の収集・表示

理由:

- ランダム数値は最小の Expr 追加で、テスト基盤の題材にちょうどよい
- Unity 必要設定表示を早く入れると、以後のブロックで「動かない理由」が説明しやすくなる

### Phase 2: メッセージを実用化

4. メッセージ値を送る
5. メッセージ値を受け取る

理由:

- 既存の message ブロック資産を伸ばせる
- 作例の幅が一気に広がる

### Phase 3: 物理・時間系

6. 衝突イベント
7. クールダウン
8. 滑らかな移動

理由:

- 衝突イベント単体でも使えるが、実用上はクールダウンと一緒に使いたくなる
- 滑らかな移動は sequence state machine との統合を慎重にやる必要がある

## 作例に直結する組み合わせ

### ランダム宝箱

- インタラクト
- ランダム数値
- メッセージ値送信

### 番号付きドア

- メッセージ値受信
- 条件分岐
- 滑らかな移動

### 踏むと動く床

- 衝突イベント
- クールダウン
- 滑らかな移動

### 時間制限スイッチ

- メッセージ送信
- クールダウン
- sequence

## 実装時の注意

- `deltaTime` ブロックをどこでも使えるようにしない
  - sequence の内部実行は onUpdate だが、ユーザー視点のイベント文脈とはズレる
  - 滑らかな移動は専用 Stmt として扱う方が安全

- Unity の Tag に依存した設計は避ける
  - Cluster Script 側から Unity Tag を直接検索する前提は弱い
  - グループ化は message 名、World Item Reference、または明示的な group id で表現する

- `$.state` のキーは必ず `__jpp_` 系で隔離する
  - ユーザー変数と衝突しないようにする

- once 系・cooldown 系は blockId を使って状態を分離する
  - 同じ種類のブロックを複数置いても干渉しないようにする

