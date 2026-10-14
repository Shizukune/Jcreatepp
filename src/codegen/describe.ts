/**
 * Japanese one-line descriptions of IR nodes, used as comments in the generated code so a reader
 * can match each part of the script to the block that produced it.
 */

import type { BoolExpr, Expr, MessageTarget, Stmt } from '../ir';
import { commentText } from './format';

const BINARY: Record<string, string> = { ADD: '+', SUB: '-', MUL: '×', DIV: '÷' };
const COMPARE: Record<string, string> = { EQ: '=', NEQ: '≠', LT: '<', LTE: '≦', GT: '>', GTE: '≧' };

export function describeExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'number_literal': return String(expr.value);
    case 'string_literal': return `「${expr.value}」`;
    case 'delta_time': return '経過時間';
    case 'player_ref': return 'プレイヤー';
    case 'collision_handle': return '衝突相手';
    case 'number_var': return `数値変数 ${expr.name}`;
    case 'string_var': return `文字変数 ${expr.name}`;
    case 'random_number':
      return `${describeExpr(expr.min)}〜${describeExpr(expr.max)} のランダムな${expr.mode === 'integer' ? '整数' : '数'}`;
    case 'players_near_count': return `範囲 ${describeExpr(expr.range)}m のプレイヤー人数`;
    case 'cooldown_remaining': return `クールダウン ${expr.name} の残り秒数`;
    case 'message_value': return expr.valueType === 'string' ? '受け取った文字' : '受け取った数値';
    case 'binary': return `(${describeExpr(expr.left)} ${BINARY[expr.operator]} ${describeExpr(expr.right)})`;
    case 'raw': return '値';
  }
}

export function describeBool(expr: BoolExpr): string {
  switch (expr.kind) {
    case 'compare': return `${describeExpr(expr.left)} ${COMPARE[expr.operator]} ${describeExpr(expr.right)}`;
    case 'not': return `「${describeBool(expr.expr)}」ではない`;
    case 'and': return `${describeBool(expr.left)} かつ ${describeBool(expr.right)}`;
    case 'or': return `${describeBool(expr.left)} または ${describeBool(expr.right)}`;
    case 'bool_literal': return String(expr.value);
    case 'flag': return `フラグ ${expr.name}`;
    case 'bool_var': return `真偽値変数 ${expr.name}`;
    case 'cooldown_active': return `クールダウン ${expr.name} 中`;
    case 'message_value_bool': return '受け取った真偽値';
    case 'players_near': return `範囲 ${describeExpr(expr.range)}m にプレイヤーがいる`;
    case 'raycast_forward':
      return `前方 ${describeExpr(expr.distance)}m に${expr.target === 'item' ? 'アイテム' : expr.target === 'player' ? 'プレイヤー' : '何か'}がある`;
    case 'raw_bool': return '条件';
  }
}

const xyz = (s: { x: Expr; y: Expr; z: Expr }) => `x:${describeExpr(s.x)} y:${describeExpr(s.y)} z:${describeExpr(s.z)}`;

function target(t: MessageTarget): string {
  switch (t.kind) {
    case 'near': return `範囲 ${describeExpr(t.range)}m のアイテム`;
    case 'world_item': return `指定アイテム ${t.itemName}`;
    case 'sender': return '送ってきた相手';
    case 'handle': return '衝突相手';
  }
}

/** One-line description of a statement block, or '' when no comment is useful. */
export function describeStmt(stmt: Stmt): string {
  return commentText(describe(stmt));
}

function describe(stmt: Stmt): string {
  switch (stmt.kind) {
    case 'set_position': return `位置を ${xyz(stmt)} にする`;
    case 'move_by': return `位置を ${xyz(stmt)} ずつ変える`;
    case 'smooth_move_by': return `位置を ${xyz(stmt)} だけ ${describeExpr(stmt.duration)} 秒かけて動かす`;
    case 'move_local': return `向いている方向に 右:${describeExpr(stmt.x)} 上:${describeExpr(stmt.y)} 前:${describeExpr(stmt.z)} 進む`;
    case 'smooth_move_local':
      return `向いている方向に 右:${describeExpr(stmt.x)} 上:${describeExpr(stmt.y)} 前:${describeExpr(stmt.z)} を ${describeExpr(stmt.duration)} 秒かけて進む`;
    case 'set_rotation': return `角度を ${xyz(stmt)} にする`;
    case 'rotate_by': return `角度を ${xyz(stmt)} ずつ変える`;
    case 'smooth_rotate_by': return `角度を ${xyz(stmt)} だけ ${describeExpr(stmt.duration)} 秒かけて回す`;
    case 'random_warp': return `現在位置から範囲 X:${describeExpr(stmt.rangeX)} Z:${describeExpr(stmt.rangeZ)} へランダム移動する`;
    case 'save_position': return '今の位置を保存する';
    case 'load_position': return '保存した位置に戻る';
    case 'add_force': return `${describeExpr(stmt.power)} の強さで X:${describeExpr(stmt.dirX)} Y:${describeExpr(stmt.dirY)} Z:${describeExpr(stmt.dirZ)} の方向に力を加える`;
    case 'continuous_rotation': return `${stmt.axis} 軸を 速度 ${describeExpr(stmt.speed)} で回転し続ける`;
    case 'timed_random_warp': return `${describeExpr(stmt.interval)} 秒ごとに 範囲 ${describeExpr(stmt.range)} へランダムワープ`;
    case 'timed_move_return':
      return `X:${describeExpr(stmt.dirX)} Y:${describeExpr(stmt.dirY)} Z:${describeExpr(stmt.dirZ)} 方向へ 速度 ${describeExpr(stmt.speed)} で ${describeExpr(stmt.duration)} 秒移動して戻る`;
    case 'set_move_speed': return `プレイヤーの移動速度倍率を ${describeExpr(stmt.rate)} にする`;
    case 'set_jump_speed': return `プレイヤーのジャンプ速度倍率を ${describeExpr(stmt.rate)} にする`;
    case 'play_audio': return `音 ${stmt.audioSetId} を 音量 ${describeExpr(stmt.volume)} で鳴らす`;
    case 'set_subnode_text': return `サブノード ${stmt.subNodeName} の ${stmt.componentType} の文字を ${describeExpr(stmt.value)} にする`;
    case 'set_component_enabled': return `サブノード ${stmt.subNodeName} の ${stmt.componentType} を ${describeBool(stmt.enabled)} にする`;
    case 'set_flag':
      return `フラグ ${stmt.name} を ${stmt.operation === 'toggle' ? '切り替える' : `${stmt.operation} にする`}`;
    case 'set_number_var': return `数値変数 ${stmt.name} を ${describeExpr(stmt.value)} にする`;
    case 'change_number_var': return `数値変数 ${stmt.name} を ${describeExpr(stmt.delta)} だけ増やす`;
    case 'set_string_var': return `文字変数 ${stmt.name} を ${describeExpr(stmt.value)} にする`;
    case 'set_bool_var': return `真偽値変数 ${stmt.name} を ${describeBool(stmt.value)} にする`;
    case 'start_cooldown': return `クールダウン ${stmt.name} を ${describeExpr(stmt.seconds)} 秒で開始する`;
    case 'send_message': {
      const condition = stmt.condition ? `もし ${describeBool(stmt.condition)} ${stmt.edgeOnce ? 'になったら' : 'なら'} ` : '';
      const value = stmt.value ? ` と値 ${stmt.value.valueType === 'boolean' ? describeBool(stmt.value.value) : describeExpr(stmt.value.value)}` : '';
      const verb = stmt.target.kind === 'sender' ? '返す' : stmt.edgeOnce ? '1回だけ送る' : '送る';
      return `${condition}${target(stmt.target)} に メッセージ「${stmt.message}」${value}を${verb}`;
    }
    case 'if': return `もし ${describeBool(stmt.condition)} なら`;
    case 'if_edge': return `もし ${describeBool(stmt.condition)} になった瞬間だけ`;
    case 'sequence': return '一連の動作を始める（中は「毎フレーム」の中で順番に進む）';
    case 'wait_seconds': return `${describeExpr(stmt.seconds)} 秒待つ`;
    case 'wait_until': return `${describeBool(stmt.condition)} まで待つ`;
    case 'run_for_seconds': return `${describeExpr(stmt.seconds)} 秒間、毎フレーム実行する`;
    case 'oscillate': return `${stmt.axis} 方向に 幅 ${describeExpr(stmt.width)} 速さ ${describeExpr(stmt.speed)} で往復する`;
  }
}
