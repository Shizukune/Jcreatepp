/**
 * Jcreate++ IR (Intermediate Representation) v0.1
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
 * 5. sequence / if / variable / communication は v0.1 では表現しない
 *
 * ── 内部予約接頭辞 ──
 * __jpp_ — 将来の内部変数名（ステートマシン、カウンタ等）に使用予定。
 * ユーザー定義の変数名との衝突を防ぐため、この接頭辞で始まる識別子は予約済みとして扱う。
 * v0.1 では未使用。
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
};

export type Handler = {
  body: Stmt[];
};

export type Stmt =
  | SetPositionStmt
  | AddPositionStmt
  | SetRotationStmt
  | AddRotationStmt
  | IfStmt;
  // 将来: | WaitStmt
  // 将来: | SendSignalStmt

export type SetPositionStmt = {
  kind: 'set_position';
  x: Expr;
  y: Expr;
  z: Expr;
};

export type AddPositionStmt = {
  kind: 'add_position';
  x: Expr;
  y: Expr;
  z: Expr;
};

export type SetRotationStmt = {
  kind: 'set_rotation';
  x: Expr;
  y: Expr;
  z: Expr;
};

export type AddRotationStmt = {
  kind: 'add_rotation';
  x: Expr;
  y: Expr;
  z: Expr;
};

export type IfStmt = {
  kind: 'if';
  condition: BoolExpr;
  thenBody: Stmt[];
  // 将来: elseBody?: Stmt[];
};

export type Expr =
  | RawExpr;
  // 将来: | NumberExpr
  // 将来: | VariableExpr
  // 将来: | BinaryExpr

export type TargetRef = 
  | { kind: 'self' }
  | { kind: 'player' }
  | { kind: 'item', id: string }
  | { kind: 'node', name: string }
  | { kind: 'var', name: string };

export type BoolExpr =
  | { kind: 'raw_bool'; code: string }
  | { kind: 'compare'; op: '==' | '!=' | '<' | '<=' | '>' | '>='; left: Expr; right: Expr }
  | { kind: 'not'; expr: BoolExpr }
  | { kind: 'and'; left: BoolExpr; right: BoolExpr }
  | { kind: 'or'; left: BoolExpr; right: BoolExpr }
  | { kind: 'near'; a: TargetRef; b: TargetRef; distance: Expr };

export type RawExpr = {
  kind: 'raw';
  code: string;
};

// ── ヘルパー ──

/** Blockly の valueToCode() で取得した JS 式文字列を Expr に変換する */
export function raw(code: string): RawExpr {
  return { kind: 'raw', code };
}
