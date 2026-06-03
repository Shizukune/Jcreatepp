# Jcreate++ Design Review

## Purpose

This document summarizes the current design, generated Cluster Script validity, and refactoring points before adding message-triggered `if` behavior.

Current target:

- Generate simple Cluster Script from Blockly blocks.
- Support `if` statements.
- Support message exchange.
- Trigger behavior by received message, then run conditional logic.

## Official References

- Cluster Script Reference: https://docs.cluster.mu/script/
- ClusterScript: https://docs.cluster.mu/script/interfaces/ClusterScript.html
- ClusterScript.onStart: https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart
- ClusterScript.onUpdate: https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate
- ClusterScript.onInteract: https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract
- ClusterScript.onReceive: https://docs.cluster.mu/script/interfaces/ClusterScript.html#onreceive
- Vector3: https://docs.cluster.mu/script/classes/Vector3.html
- Quaternion: https://docs.cluster.mu/script/classes/Quaternion.html

## Current Architecture

The project is already split into three useful layers:

1. Block definitions
   - `src/blocks/jcreatepp.ts`
   - Defines Blockly block shapes, labels, inputs, categories, and tooltips.

2. Blockly to IR conversion
   - `src/generators/jcreatepp.ts`
   - Walks the Blockly workspace and creates a typed intermediate representation.
   - Also collects generation-blocking errors.

3. IR to Cluster Script code generation
   - `src/codegen.ts`
   - Converts IR into JavaScript code compatible with Cluster Script.

This split is good. It keeps Blockly-specific logic out of the final code generator and makes future refactoring easier.

## Current Supported Concepts

Events:

- `onStart`
- `onUpdate`
- `onInteract`
- `onGrab` split into grab start/end in the block UI

Actions:

- Set position
- Add position
- Set rotation
- Add rotation
- Random warp
- Save/load position
- Add force
- Oscillate
- Ride template

Control:

- `if`
- `if / else`
- Sequence state machine
- Wait seconds
- Wait until

State:

- Boolean flags stored under `$.state.__jpp_flag_*`

## Generated Code Validity

`npm run build` succeeds after installing dependencies.

Known build warnings:

- Bundle size warning from webpack.
- npm audit warnings.
- One dependency expects Node 20+, while the current runtime was Node 18.

These warnings do not currently block TypeScript compilation.

## Generated Cluster Script Risks

### 1. Flag names can break generated JavaScript

Current generation:

```js
$.state.__jpp_flag_${stmt.name} = true;
```

Risk:

- If the user enters a flag name with spaces, hyphens, Japanese text, punctuation, or other non-identifier characters, generated JavaScript may become invalid.

Safer options:

```js
$.state["__jpp_flag_" + safeName] = true;
```

or:

```js
$.state.__jpp_flag_opened = true;
```

with strict validation that flag names must match:

```txt
^[A-Za-z_][A-Za-z0-9_]*$
```

Recommendation:

- Prefer bracket property access internally.
- Still validate or normalize the user-facing name so saved data is predictable.

### 2. Some top-level action blocks may be silently ignored

`workspaceToProgram()` currently reports event-outside errors for only these actions:

- `jcreatepp_set_position`
- `jcreatepp_add_position`
- `jcreatepp_set_rotation`
- `jcreatepp_add_rotation`

But more statement blocks now exist:

- `jcreatepp_random_warp`
- `jcreatepp_save_position`
- `jcreatepp_load_position`
- `jcreatepp_add_force`
- `jcreatepp_set_flag`
- `jcreatepp_oscillate`
- `jcreatepp_sequence`
- wait blocks

Risk:

- A user can place a block at top level.
- The UI may allow it.
- Code generation may ignore it without a clear error.

Recommendation:

- Create a shared statement-block registry.
- Use it in both validator and generator.
- Any statement block outside an event or approved top-level context should produce a generation error.

### 3. Sequences under grab events may not run

IR supports:

- `onGrabStart`
- `onGrabEnd`

But `getAllSequences()` currently extracts sequences only from:

- `onStart`
- `onUpdate`
- `onInteract`

Risk:

- A sequence inside grab start/end can start, but its state machine may not be generated into `onUpdate`.

Recommendation:

- Either disallow sequence in grab events, or include grab handlers in sequence extraction.
- Including grab handlers is more consistent if grab events are intended to behave like interact events.

### 4. `if` and `sequence` currently have unclear interaction

The code allows `sequence` to appear inside `if`, and `extractSequences()` recursively finds sequences inside `if`.

However, wait blocks are blocked when inside `if`:

- `wait_seconds`
- `wait_until`

Risk:

- The user likely wants this:

```txt
if message is "open":
  wait 1 second
  move
```

But the current rules make that difficult or impossible if the wait is inside an `if`.

Important design distinction:

- `if` as an immediate branch is simple.
- `sequence` is not immediate. It is a task that starts now and advances over future `onUpdate` ticks.

Recommendation:

- Treat sequence as a startable task.
- Allow `if` to start a sequence.
- Keep waits inside sequence, not inside arbitrary immediate statements.
- Consider making this explicit in IR:

```ts
type Stmt =
  | { kind: "if", condition: BoolExpr, thenBody: Stmt[], elseBody?: Stmt[] }
  | { kind: "start_sequence", id: string }
  | ...

type SequenceDef = {
  id: string;
  body: SequenceStep[];
};
```

This separates "starting a sequence" from "defining the sequence body".

### 5. `BoolExpr.near` exists but is not generated

`ir.ts` defines:

```ts
| { kind: 'near', a: TargetRef, b: TargetRef, distance: Expr }
```

But `boolExprToJS()` does not implement it and falls through to `false`.

Risk:

- If a block later starts producing `near`, it will silently generate a false condition.

Recommendation:

- Remove `near` until implemented, or make `boolExprToJS()` exhaustive so TypeScript fails when a BoolExpr is unhandled.

## Parts Generation Flow

Current rough flow:

```txt
Blockly blocks
  -> workspaceToProgram()
  -> Program IR
  -> programToJS()
  -> Cluster Script JS
```

Block definitions are UI parts. They do not decide runtime semantics.

IR conversion decides:

- Which event a block belongs to.
- What statement type it becomes.
- Whether a block is invalid in the current context.

Code generation decides:

- The actual Cluster Script API calls.
- Event registration order.
- State variable names.
- Sequence state machine code.

This is a good separation. The main refactoring opportunity is to reduce duplicated block-type knowledge across:

- `src/blocks/jcreatepp.ts`
- `src/blocks/context.ts`
- `src/validator.ts`
- `src/generators/jcreatepp.ts`
- `src/codegen.ts`

## Suggested Refactoring Direction

### 1. Add block metadata

Create a single source of truth for block capabilities:

```ts
type BlockMeta = {
  type: string;
  kind: "event" | "statement" | "value" | "condition" | "template";
  allowedContexts?: EventContext[];
  topLevelAllowed?: boolean;
  sequenceAllowed?: boolean;
  ifAllowed?: boolean;
};
```

Use it for:

- Toolbox grouping
- Validator warnings
- Generator errors
- Context checks

### 2. Sanitize or encode state keys

Introduce helpers:

```ts
function stateKey(prefix: string, userName: string): string;
function blockIdKey(prefix: string, blockId: string): string;
```

Generated code should prefer bracket access:

```js
$.state["__jpp_flag_open"] = true;
```

### 3. Separate sequence definitions from sequence starts

Current sequence is both:

- A statement in an event body.
- A body that needs an `onUpdate` state machine.

Suggested model:

```ts
type Program = {
  handlers: HandlerMap;
  sequences: SequenceDef[];
};
```

Then event code starts a sequence:

```js
if (!$.state["__jpp_seq_active_x"]) {
  $.state["__jpp_seq_active_x"] = true;
  $.state["__jpp_seq_step_x"] = 0;
  $.state["__jpp_seq_time_x"] = 0;
}
```

And `onUpdate` always contains the runner for all sequence definitions.

### 4. Add message receive as a first-class event

Cluster receive should map to:

```js
$.onReceive((messageType, arg, sender) => {
  ...
}, { item: true, player: true });
```

Suggested block:

```txt
メッセージを受け取ったとき [DO]
```

Suggested value/condition blocks:

```txt
受信メッセージ名
受信メッセージ名 = "open"
```

For MVP, a simpler event block may be better:

```txt
メッセージ "open" を受け取ったとき [DO]
```

This generates:

```js
$.onReceive((messageType, arg, sender) => {
  if (messageType === "open") {
    ...
  }
}, { item: true, player: true });
```

This avoids needing string comparison blocks immediately.

## Recommended MVP Path

1. Keep the current IR architecture.
2. Fix identifier/state-key safety.
3. Fix statement-block validation coverage.
4. Decide how `if -> sequence` should behave.
5. Refactor sequence into "definition + start command" if message-triggered wait behavior is needed.
6. Add `onReceive` as an event.
7. Add a message-specific trigger block:

```txt
メッセージ "open" を受け取ったとき
```

8. Generate:

```js
$.onReceive((messageType, arg, sender) => {
  if (messageType === "open") {
    // generated statements
  }
}, { item: true, player: true });
```

## Open Design Questions

1. Should message receive accept only player messages, only item messages, or both?
2. Should a message trigger start a sequence even if the same sequence is already running?
3. Should repeated messages restart the sequence from step 0, ignore while running, or queue?
4. Should flags be user-visible variables, or only internal implementation details?
5. Should `if` be allowed inside sequence?
6. Should wait blocks be allowed inside `if` when the `if` itself is inside sequence?

## Suggested Defaults

For MVP:

- Receive from both item and player.
- If a sequence is already running, ignore repeat triggers.
- Use bracket access for all `$.state` keys.
- Allow `if` to start a sequence.
- Do not allow waits directly inside immediate `if`.
- Later, support `if` inside sequence as a sequence step.

