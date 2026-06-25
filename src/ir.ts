/**
 * Jcreate++ IR (Intermediate Representation) v0.2
 *
 * ── 目的 ──
 * Blockly ブロック → JS コード生成の間に挟む最小の中間表現。
 * 生成コードの可読性確保、出力順の制御、バリデーションの分離を実現する。
 *
 * ── 責務 ──
 * - ブロック構造を「何をしたいか」に変換した結果を保持する
 * - 各イベントハンドラの body に Stmt を順序付きで格納する
 * - バリデーション（重複検出等）のベースとなる
 *
 * ── 非責務 ──
 * - Cluster API の具体的な書き方（codegen.ts の責務）
 * - Blockly の内部構造への依存
 * - 実行時の状態管理
 *
 * ── 不変条件 ──
 * 1. Program は各イベント (onStart, onUpdate, onInteract) を高々1つしか持たない
 * 2. Handler.body の順序は実行順を表す
 * 3. Stmt は v0.1 では即時実行命令のみ（非同期命令なし）
 * 4. Expr は副作用を持たない
 * 5. sequence / variable / communication は v0.2 では表現しない
 * 6. 文脈つき値（delta_time, player_ref）は文脈検証済みの前提で格納される
 *
 * ── 内部予約接頭辞 ──
 * __jpp_ — 将来の内部変数名（ステートマシン、カウンタ等）に使用予定。
 * ユーザー定義の変数名との衝突を防ぐため、この接頭辞で始まる識別子は予約済みとして扱う。
 * v0.2 では未使用。
 *
 * ── 将来拡張方針 ──
 * - Stmt に if / wait / send_signal 等を追加する
 * - Expr に number / boolean / variable / binary 等を追加する
 * - Program に onCollide 等のイベントを追加する
 * - sequence / 並列制御は Handler レベルで表現する可能性あり
 */

// ── 型定義 ──

export type Program = {
  onStart?: Handler;
  onUpdate?: Handler;
  onInteract?: Handler;
  onCollide?: Handler;
  onGrabStart?: Handler;
  onGrabEnd?: Handler;
  onReceives?: ReceiveHandler[];
  rideTemplate?: {
    forwardSpeed: Expr;
    upDownSpeed: Expr;
    turnSpeed: Expr;
  };
  chaseTemplate?: {
    moveSpeed: Expr;
    maxDistance: Expr;
    minDistance: Expr;
  };
};

export type Handler = {
  body: Stmt[];
};

export type ReceiveHandler = {
  message: string;
  handler: Handler;
};

export type Stmt =
  | { kind: 'set_position', x: Expr, y: Expr, z: Expr }
  | { kind: 'move_by', x: Expr, y: Expr, z: Expr }
  | { kind: 'set_rotation', x: Expr, y: Expr, z: Expr }
  | { kind: 'rotate_by', x: Expr, y: Expr, z: Expr }
  | { kind: 'random_warp', rangeX: Expr, rangeZ: Expr }
  | { kind: 'save_position' }
  | { kind: 'load_position' }
  | { kind: 'add_force', dirX: Expr, dirY: Expr, dirZ: Expr, power: Expr }
  | { kind: 'continuous_rotation', axis: 'X' | 'Y' | 'Z', speed: Expr }
  | { kind: 'timed_random_warp', interval: Expr, range: Expr, blockId: string }
  | { kind: 'timed_move_return', dirX: Expr, dirY: Expr, dirZ: Expr, speed: Expr, duration: Expr, blockId: string }
  | { kind: 'set_move_speed', rate: Expr }
  | { kind: 'set_jump_speed', rate: Expr }
  | { kind: 'set_flag', name: string, operation: 'true' | 'false' | 'toggle' }
  | { kind: 'set_number_var', name: string, value: Expr }
  | { kind: 'change_number_var', name: string, delta: Expr }
  | { kind: 'start_cooldown', name: string, seconds: Expr }
  | { kind: 'send_message_near_once', message: string, range: Expr, condition: BoolExpr, value?: MessageSendValue, blockId: string }
  | { kind: 'send_message_to_item_once', message: string, itemName: string, condition: BoolExpr, value?: MessageSendValue, blockId: string }
  | { kind: 'reply_message_once', message: string, condition: BoolExpr, value?: MessageSendValue, blockId: string }
  | { kind: 'if', condition: BoolExpr, thenBody: Stmt[], elseBody?: Stmt[] }
  | { kind: 'sequence', id: string, body: Stmt[] }
  | { kind: 'wait_seconds', seconds: Expr }
  | { kind: 'wait_until', condition: BoolExpr }
  | { kind: 'run_for_seconds', seconds: Expr, body: Stmt[] }
  | { kind: 'oscillate', axis: 'X' | 'Y' | 'Z', width: Expr, speed: Expr, blockId: string };

export type Expr =
  | RawExpr
  | NumberLiteralExpr
  | StringLiteralExpr
  | DeltaTimeExpr
  | PlayerRefExpr
  | NumberVarExpr
  | RandomNumberExpr
  | CooldownRemainingExpr
  | MessageValueExpr
  | BinaryExpr;
  // 将来: | SelfPositionExpr
  // 将来: | SelfRotationExpr
  // 将来: | VariableExpr
  // 将来: | BinaryExpr

export type BoolExpr =
  | { kind: 'raw_bool', code: string }
  | { kind: 'compare', operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE', left: Expr, right: Expr }
  | { kind: 'not', expr: BoolExpr }
  | { kind: 'and', left: BoolExpr, right: BoolExpr }
  | { kind: 'or', left: BoolExpr, right: BoolExpr }
  | { kind: 'flag', name: string }
  | { kind: 'cooldown_active', name: string }
  | { kind: 'message_value_bool' };

export type MessageSendValue =
  | { valueType: 'number' | 'string', value: Expr }
  | { valueType: 'boolean', value: BoolExpr };

export type RawExpr = {
  kind: 'raw';
  code: string;
};

export type NumberLiteralExpr = {
  kind: 'number_literal';
  value: number;
};

export type StringLiteralExpr = {
  kind: 'string_literal';
  value: string;
};

export type DeltaTimeExpr = {
  kind: 'delta_time';
};

export type PlayerRefExpr = {
  kind: 'player_ref';
};

export type NumberVarExpr = {
  kind: 'number_var';
  name: string;
};

export type RandomNumberExpr = {
  kind: 'random_number';
  min: Expr;
  max: Expr;
  mode: 'float' | 'integer';
};

export type CooldownRemainingExpr = {
  kind: 'cooldown_remaining';
  name: string;
};

export type MessageValueExpr = {
  kind: 'message_value';
  valueType: 'number' | 'string';
};

export type BinaryExpr = {
  kind: 'binary';
  operator: 'ADD' | 'SUB' | 'MUL' | 'DIV';
  left: Expr;
  right: Expr;
};

// ── ヘルパー ──

/** Blockly の valueToCode() で取得した JS 式文字列を Expr に変換する */
export function raw(code: string): RawExpr {
  return { kind: 'raw', code };
}

export function numberLiteral(value: number): NumberLiteralExpr {
  return { kind: 'number_literal', value };
}

export function stringLiteral(value: string): StringLiteralExpr {
  return { kind: 'string_literal', value };
}

export function deltaTime(): DeltaTimeExpr {
  return { kind: 'delta_time' };
}

export function playerRef(): PlayerRefExpr {
  return { kind: 'player_ref' };
}

export function numberVar(name: string): NumberVarExpr {
  return { kind: 'number_var', name };
}

export function randomNumber(min: Expr, max: Expr, mode: RandomNumberExpr['mode']): RandomNumberExpr {
  return { kind: 'random_number', min, max, mode };
}

export function cooldownRemaining(name: string): CooldownRemainingExpr {
  return { kind: 'cooldown_remaining', name };
}

export function messageValue(valueType: MessageValueExpr['valueType']): MessageValueExpr {
  return { kind: 'message_value', valueType };
}

export function binary(operator: BinaryExpr['operator'], left: Expr, right: Expr): BinaryExpr {
  return { kind: 'binary', operator, left, right };
}

export function not(expr: BoolExpr): BoolExpr {
  return { kind: 'not', expr };
}

export function and(left: BoolExpr, right: BoolExpr): BoolExpr {
  return { kind: 'and', left, right };
}

export function or(left: BoolExpr, right: BoolExpr): BoolExpr {
  return { kind: 'or', left, right };
}
