/**
 * Jcreate++ コード生成 (IR → JS)
 *
 * IR (Program) を Cluster Script 互換の JS コードに変換する。
 * Cluster API の具体的な書き方はこのファイルに閉じ込める。
 *
 * ── 出力規則 ──
 * - 出力順は固定: onStart → onUpdate → onInteract
 * - インデント: 2 spaces
 * - 1命令1行
 * - 空イベントもそのまま出力する
 *
 * ── Cluster API 参照 ──
 * - $.onStart:      https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart
 * - $.onUpdate:     https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate
 * - $.onInteract:   https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract
 * - $.setPosition:  Vector3 を受け取る
 * - $.setRotation:  Quaternion を受け取る
 * - Vector3:        new Vector3(x, y, z)
 * - Quaternion:     Quaternion.euler(x, y, z) — 静的メソッド
 */

import type { Program, Handler, Stmt, Expr } from './ir';

// ── メイン ──

/**
 * Program (IR) を Cluster Script 互換の JS 文字列に変換する。
 * 出力順は固定: onStart → onUpdate → onInteract
 */
export function programToJS(program: Program): string {
  const parts: string[] = [];

  if (program.onStart) {
    parts.push(handlerToJS('onStart', program.onStart));
  }
  if (program.onUpdate) {
    parts.push(handlerToJS('onUpdate', program.onUpdate));
  }
  if (program.onInteract) {
    parts.push(handlerToJS('onInteract', program.onInteract));
  }

  if (parts.length === 0) {
    return '// ブロックが配置されていません';
  }

  return parts.join('\n');
}

// ── ハンドラ ──

/** イベント名ごとのコールバック引数 */
const EVENT_PARAMS: Record<string, string> = {
  onStart: '',
  onUpdate: 'deltaTime',
  onInteract: 'player',
};

function handlerToJS(event: string, handler: Handler): string {
  const params = EVENT_PARAMS[event] ?? '';
  const bodyLines = handler.body.map((stmt) => '  ' + stmtToJS(stmt));
  const body = bodyLines.join('\n');

  return `$.${event}((${params}) => {\n${body}\n});\n`;
}

// ── ステートメント ──

function stmtToJS(stmt: Stmt): string {
  switch (stmt.kind) {
    case 'set_position':
      return `$.setPosition(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)}));`;

    case 'add_position':
      return `$.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)})));`;

    case 'set_rotation':
      return `$.setRotation(Quaternion.euler(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)}));`;

    case 'add_rotation':
      return `$.setRotation(($.getRotation() || new Quaternion()).multiply(Quaternion.euler(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)})));`;

    case 'if': {
      const condCode = boolExprToJS(stmt.condition);
      if (stmt.thenBody.length === 0) {
        return `if (${condCode}) {\n}`;
      }
      const thenBodyJS = stmt.thenBody.map((s) => '  ' + stmtToJS(s).replace(/\n/g, '\n  ')).join('\n');
      return `if (${condCode}) {\n${thenBodyJS}\n}`;
    }

    default: {
      // 将来の Stmt 追加時にコンパイルエラーで検出するための exhaustive check
      const _exhaustive: never = stmt;
      return `// unknown stmt: ${(_exhaustive as any).kind}`;
    }
  }
}

// ── 式 ──

function exprToJS(expr: Expr): string {
  switch (expr.kind) {
    case 'raw':
      return expr.code;
    // 将来: Expr の kind が増えたらここにケースを追加する
  }
}

function boolExprToJS(expr: import('./ir').BoolExpr): string {
  switch (expr.kind) {
    case 'raw_bool':
      return expr.code;
    default:
      // compare等は現在 dummyGenerator側(index.ts)で javascriptGenerator に変換させており、
      // raw_bool としてコードが渡ってくる構成にしているためここでは raw_bool のみを処理。
      // 将来的に自前でIRから生成する場合はここに追加する。
      return 'false';
  }
}
