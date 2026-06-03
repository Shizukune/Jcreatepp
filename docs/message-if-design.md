# Jcreate++ Message and If Extension Design

## Purpose

Cluster Script向けに、簡単な `if` 文、メッセージ受信、メッセージをトリガーにした動作開始を実現する。

MVPでは、汎用的なメッセージ処理よりも「特定のメッセージを受け取ったら動く」体験を優先する。

## MVP Decision

次の方針で進める。

1. メッセージ受信ブロックは固定文字列トリガーにする。

   ```txt
   メッセージ "open" を受け取ったとき
   ```

2. `$.state` はドット記法ではなくブラケット記法で生成する。

   ```js
   $.state["__jpp_flag_" + safeName] = true;
   ```

   これにより、フラグ名や内部キーに空白・日本語・記号が混じっても JavaScript 構文エラーになりにくくする。

3. `if` ブロックの中に「一連の動作」ブロックを置けるようにする。

   ただし内部的には、sequenceを即時実行するのではなく「sequenceを開始する文」として扱う。

4. `onReceive` は複数配置できるイベントとして扱う。

   通常イベントの `onStart` や `onUpdate` は同種1つまでだが、`onReceive` は複数配置を許可する。

5. 同じメッセージ名の `onReceive` ブロックが複数ある場合は、すべて実行する。

   生成時に同じ `if (msg === "...")` の中へ統合する。

6. 受信元はMVPでは両対応にする。

   ```js
   { item: true, player: true }
   ```

## Official Cluster Script Shape

Cluster Script側では、受信イベントは次の形で生成する。

```js
$.onReceive((msg, arg, sender) => {
  if (msg === "open") {
    // generated statements
  }
}, { item: true, player: true });
```

複数メッセージがある場合:

```js
$.onReceive((msg, arg, sender) => {
  if (msg === "open") {
    // open handlers
  }
  if (msg === "close") {
    // close handlers
  }
}, { item: true, player: true });
```

同じメッセージ名が複数ある場合:

```js
$.onReceive((msg, arg, sender) => {
  if (msg === "open") {
    // first open handler
    // second open handler
  }
}, { item: true, player: true });
```

## User-Facing Behavior

### Message Receive

ユーザーには次のイベントブロックとして見せる。

```txt
メッセージ [open] を受け取ったとき
  ...
```

MVPでは、受信メッセージ名を条件ブロックで比較させるのではなく、イベントブロック自体に固定文字列を持たせる。

理由:

- ブロック数が少なく済む。
- 初心者にとって「受け取ったら動く」が直接表現できる。
- `if msg === "open"` のような内部構造を意識しなくてよい。

### If + Sequence

ユーザーには次のように置けるようにする。

```txt
メッセージ "open" を受け取ったとき
  もし フラグ doorEnabled なら
    一連の動作
      1 秒待つ
      位置を x:0 y:2 z:0 ずつ変える
```

内部的には:

- `if` は即時に条件判定する。
- 条件が true なら sequence を開始する。
- sequence 本体は `onUpdate` のステートマシンで進む。

## Sequence Design

現状の sequence は、1つの `Stmt` が次の2つの責務を持っている。

- イベント内でsequenceを開始する。
- sequence本体を保持する。

MVP以降の安全な形として、内部的には分離する。

```ts
type Program = {
  onStart?: Handler;
  onUpdate?: Handler;
  onInteract?: Handler;
  onGrabStart?: Handler;
  onGrabEnd?: Handler;
  onReceives?: ReceiveHandler[];
  sequences?: SequenceDef[];
};

type ReceiveHandler = {
  message: string;
  handler: Handler;
};

type SequenceDef = {
  id: string;
  body: SequenceStep[];
};

type Stmt =
  | { kind: "if", condition: BoolExpr, thenBody: Stmt[], elseBody?: Stmt[] }
  | { kind: "start_sequence", id: string }
  | ...
```

ただし、最初の実装で大きく崩したくない場合は、現在の `sequence` Stmt を維持しつつ、codegen側で以下を徹底する。

- sequenceを発見したら必ず `onUpdate` に runner を生成する。
- sequence Stmt がイベントや `if` の中に出たら「開始コード」を生成する。
- sequence内の wait は sequence runner の中でだけ生成する。

## Repeat Trigger Policy

同じsequenceがすでに実行中に、同じメッセージやイベントで再度開始された場合:

MVPでは「実行中なら無視」とする。

生成例:

```js
if (!$.state["__jpp_seq_active_x"]) {
  $.state["__jpp_seq_active_x"] = true;
  $.state["__jpp_seq_step_x"] = 0;
  $.state["__jpp_seq_time_x"] = 0;
}
```

理由:

- 挙動が単純。
- 連打で状態が壊れにくい。
- キューや強制リスタートより実装が安全。

将来オプション:

- 実行中なら無視
- 最初からやり直す
- キューに積む

## State Key Safety

現在の危険な生成:

```js
$.state.__jpp_flag_名前 = true;
$.state.__jpp_flag_my-flag = true;
```

安全な生成:

```js
$.state["__jpp_flag_" + "名前"] = true;
$.state["__jpp_flag_" + "my-flag"] = true;
```

実装では、文字列リテラルとして安全に埋め込むために `JSON.stringify()` 相当のエスケープを使う。

推奨ヘルパー:

```ts
function jsString(value: string): string {
  return JSON.stringify(value);
}

function stateKey(prefix: string, name: string): string {
  return jsString(prefix + name);
}
```

生成例:

```js
$.state["__jpp_flag_名前"] = true;
```

## Event Duplication Rules

通常イベント:

- `onStart`: 1つまで
- `onUpdate`: 1つまで
- `onInteract`: 1つまで
- `onGrabStart`: 1つまで
- `onGrabEnd`: 1つまで

メッセージイベント:

- `onReceive`: 複数可
- 同じメッセージ名も複数可
- 生成時に統合する

そのため、`jcreatepp_on_receive` はイベントブロックではあるが、既存の「同種イベントは1つまで」ルールから除外する。

## File-Level Change Plan

### `src/ir.ts`

Add:

```ts
export type ReceiveHandler = {
  message: string;
  handler: Handler;
};
```

Modify:

```ts
export type Program = {
  onStart?: Handler;
  onUpdate?: Handler;
  onInteract?: Handler;
  onGrabStart?: Handler;
  onGrabEnd?: Handler;
  onReceives?: ReceiveHandler[];
  rideTemplate?: ...
};
```

Optional sequence refactor:

- Add `SequenceDef`.
- Add `start_sequence`.

### `src/blocks/context.ts`

Add receive context:

```ts
export type EventContext =
  | "jcreatepp_on_start"
  | "jcreatepp_on_update"
  | "jcreatepp_on_interact"
  | "jcreatepp_on_grab_start"
  | "jcreatepp_on_grab_end"
  | "jcreatepp_on_receive";
```

Add to event block list, but also expose a duplicate policy:

```ts
export const UNIQUE_EVENT_BLOCK_TYPES = [
  "jcreatepp_on_start",
  "jcreatepp_on_update",
  "jcreatepp_on_interact",
  "jcreatepp_on_grab_start",
  "jcreatepp_on_grab_end",
] as const;
```

`EVENT_BLOCK_TYPES` may include receive, while `UNIQUE_EVENT_BLOCK_TYPES` excludes it.

### `src/blocks/jcreatepp.ts`

Add block:

```ts
const onReceive = {
  type: "jcreatepp_on_receive",
  message0: "メッセージ %1 を受け取ったとき %2 %3",
  args0: [
    { type: "field_input", name: "MESSAGE", text: "open" },
    { type: "input_dummy" },
    { type: "input_statement", name: "DO" },
  ],
  colour: 45,
  tooltip: "指定したメッセージを受け取ったときに実行されます",
  helpUrl: "https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive",
  hat: "cap",
};
```

### `src/toolbox.ts`

Add `jcreatepp_on_receive` to the event category.

### `src/generators/jcreatepp.ts`

Add handling for top-level receive blocks:

```ts
if (type === "jcreatepp_on_receive") {
  const message = block.getFieldValue("MESSAGE") || "";
  const handler = blockToHandler(block, type, generator, errors);
  program.onReceives ??= [];
  program.onReceives.push({ message, handler });
  continue;
}
```

Update duplicate checking:

- Use `UNIQUE_EVENT_BLOCK_TYPES` for one-per-event validation.
- Allow multiple `jcreatepp_on_receive`.

Update top-level statement validation:

- Use a shared statement block list instead of hard-coded first four action blocks.

### `src/codegen.ts`

Add receive generation:

```ts
if (program.onReceives?.length) {
  parts.push(receivesToJS(program.onReceives));
}
```

Group by message:

```ts
function receivesToJS(receives: ReceiveHandler[]): string {
  const groups = groupByMessage(receives);
  const lines: string[] = [];

  for (const [message, handlers] of groups) {
    lines.push(`  if (msg === ${jsString(message)}) {`);
    for (const handler of handlers) {
      for (const stmt of handler.body) {
        lines.push("    " + stmtToJS(stmt).replace(/\n/g, "\n    "));
      }
    }
    lines.push("  }");
  }

  return `$.onReceive((msg, arg, sender) => {\n${lines.join("\n")}\n}, { item: true, player: true });\n`;
}
```

Update `$.state` access:

```ts
return `$.state[${stateKey("__jpp_flag_", stmt.name)}] = true;`;
```

Update sequence extraction:

- Include `onReceives`.
- Include `onGrabStart` and `onGrabEnd`.
- Recursively inspect `if` bodies.

## Validation Rules

Generation-blocking errors:

- Empty message name on `jcreatepp_on_receive`.
- Statement block placed at top level when not top-level allowed.
- Wait block outside sequence.
- Nested sequence.
- `deltaTime` outside `onUpdate`.
- `player` outside supported player event contexts.

Warnings:

- Same message name appears in multiple receive blocks.
  - MVP allows it.
  - Warning is optional, not blocking.

## Verification Plan

### Automated

Run:

```txt
npm run build
```

Expected:

- TypeScript and webpack build succeed.
- Existing bundle size warning is acceptable.

### Manual

1. Open the dev page.
2. Confirm the event category contains:

   ```txt
   メッセージ open を受け取ったとき
   ```

3. Place receive block and an action block.
4. Generate JS.
5. Confirm output contains:

   ```js
   $.onReceive((msg, arg, sender) => {
   ```

6. Confirm output contains:

   ```js
   if (msg === "open") {
   ```

7. Create a Japanese flag name:

   ```txt
   フラグ ドア開放
   ```

8. Confirm generated code uses bracket access:

   ```js
   $.state["__jpp_flag_ドア開放"]
   ```

9. Put a sequence inside `if` inside receive.
10. Confirm generated code starts the sequence in the receive handler and advances it in `onUpdate`.

## Final Conclusion

The MVP design is approved with these constraints:

- Use fixed-message receive blocks.
- Allow multiple receive blocks.
- Execute all handlers for the same message.
- Receive from both item and player.
- Use bracket access for all generated `$.state` keys.
- Allow `if` to start sequences.
- Treat sequence execution as an `onUpdate` state machine.
- Keep wait blocks inside sequence bodies.

