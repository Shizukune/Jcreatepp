/**
 * Jcreate++ 置き場所ルールの正本（P6）
 *
 * 「どのブロックをどこに置けるか」をここだけで定義し、
 * 変換エラー（src/generators/jcreatepp.ts）とエディタ警告（src/validator.ts）の両方が使う。
 * 値ブロックのイベント文脈は context.ts の BLOCK_CONTEXT_RULES、
 * 文ブロックと「一連の動作」まわりの制約はこのファイル。
 */

import type { EventContext } from './context';

/** Where a statement block sits. */
export type Placement = {
  /** Enclosing event block. */
  event: EventContext;
  /** Inside a "一連の動作" (sequence) body. */
  inSequence: boolean;
  /** Inside if / if-else / if-edge, counted only within the current sequence (or event). */
  inIf: boolean;
  /** Inside "N秒間、毎フレーム実行する" within the current sequence. */
  inRunFor: boolean;
};

type Message = (label: string) => string;

type StatementRule = {
  /** Allowed only in these events. */
  onlyIn?: { events: EventContext[]; message: Message };
  /** Not allowed in these events. */
  notIn?: { events: EventContext[]; message: Message };
  /** Sequence requirement. */
  sequence?: { rule: 'required' | 'forbidden'; message: Message };
  notInIf?: Message;
  notInRunFor?: Message;
};

const PLAYER_EVENTS: EventContext[] = ['jcreatepp_on_interact', 'jcreatepp_on_grab_start', 'jcreatepp_on_grab_end'];

const startTiming: StatementRule = {
  notIn: {
    events: ['jcreatepp_on_update'],
    message: (l) => `「${l}」は「毎フレーム」の中には置けません。インタラクト時やメッセージ受信時など、開始するタイミングの中で使ってください。`,
  },
  sequence: {
    rule: 'forbidden',
    message: (l) => `「${l}」は「一連の動作」の中には置けません。インタラクト時やメッセージ受信時などの中に直接置いてください。`,
  },
};

const everyFrameOnly: StatementRule = {
  onlyIn: { events: ['jcreatepp_on_update'], message: (l) => `「${l}」は「毎フレーム」の中でしか使えません。` },
};

const playerOnly: StatementRule = {
  onlyIn: { events: PLAYER_EVENTS, message: (l) => `「${l}」は「インタラクト時」「持ったとき」「離したとき」の中でしか使えません。` },
  sequence: { rule: 'forbidden', message: (l) => `「${l}」は「一連の動作」の中では使えません。プレイヤーがあるイベント直下で使ってください。` },
};

const replyOnly: StatementRule = {
  onlyIn: { events: ['jcreatepp_on_receive'], message: () => '「送ってきた相手に返す」は「メッセージを受け取ったとき」の中でのみ使えます。' },
  sequence: { rule: 'forbidden', message: () => '「送ってきた相手に返す」は「一連の動作」の中では使えません。受信した瞬間の処理として置いてください。' },
};

const COLLISION_IN_SEQUENCE = '「衝突相手」は「一連の動作」の中では使えません。衝突した瞬間の処理として置いてください。';

const collisionOnly: StatementRule = {
  onlyIn: { events: ['jcreatepp_on_collide'], message: () => '衝突相手は「衝突したとき」の中でのみ使えます。' },
  sequence: { rule: 'forbidden', message: () => COLLISION_IN_SEQUENCE },
};

const waitStep: StatementRule = {
  sequence: { rule: 'required', message: (l) => `「${l}」は「一連の動作を始める」ブロックの中でしか使えません。` },
  notInIf: (l) => `「${l}」は「もし〜なら」などの条件分岐の中には置けません。`,
  notInRunFor: (l) => `「${l}」は「N秒間、毎フレーム実行する」の中には置けません。`,
};

/** Placement rules for statement blocks. Blocks not listed can go anywhere inside an event. */
export const STATEMENT_PLACEMENT_RULES: Record<string, StatementRule> = {
  jcreatepp_smooth_move_by: startTiming,
  jcreatepp_smooth_move_local: startTiming,
  jcreatepp_smooth_rotate_by: startTiming,
  jcreatepp_continuous_rotation: everyFrameOnly,
  jcreatepp_timed_random_warp: everyFrameOnly,
  jcreatepp_timed_move_return: everyFrameOnly,
  jcreatepp_oscillate: everyFrameOnly,
  jcreatepp_set_move_speed: playerOnly,
  jcreatepp_set_jump_speed: playerOnly,
  jcreatepp_reply_message_once: replyOnly,
  jcreatepp_reply_message_value_once: replyOnly,
  jcreatepp_send_message_to_collision_once: collisionOnly,
  jcreatepp_send_message_value_to_collision_once: collisionOnly,
  jcreatepp_sequence: {
    notIn: {
      events: ['jcreatepp_on_update'],
      message: (l) => `「${l}」ブロックは「毎フレーム」の中には置けません。「開始時」または「インタラクト時」で使用してください。`,
    },
    sequence: { rule: 'forbidden', message: (l) => `「${l}」ブロックの中に、さらに「一連の動作」を入れることはできません（ネスト禁止）。` },
  },
  jcreatepp_wait_seconds: waitStep,
  jcreatepp_wait_until: waitStep,
  jcreatepp_run_for_seconds: waitStep,
};

/**
 * The first placement violation for a statement block, or null if it may be placed here.
 * Checked in a fixed order: event allow-list, event deny-list, sequence, if, run-for.
 */
export function placementError(blockType: string, p: Placement): string | null {
  const rule = STATEMENT_PLACEMENT_RULES[blockType];
  if (!rule) return null;
  const label = blockLabel(blockType);
  if (rule.onlyIn && !rule.onlyIn.events.includes(p.event)) return rule.onlyIn.message(label);
  if (rule.notIn && rule.notIn.events.includes(p.event)) return rule.notIn.message(label);
  if (rule.sequence?.rule === 'required' && !p.inSequence) return rule.sequence.message(label);
  if (rule.sequence?.rule === 'forbidden' && p.inSequence) return rule.sequence.message(label);
  if (rule.notInIf && p.inIf) return rule.notInIf(label);
  if (rule.notInRunFor && p.inRunFor) return rule.notInRunFor(label);
  return null;
}

/**
 * Value blocks that read the triggering event (player / received value / collision) cannot be
 * used in a sequence: its steps run later in onUpdate, where that event data no longer exists.
 */
const VALUE_IN_SEQUENCE_ERRORS: Record<string, string> = {
  jcreatepp_player: '「プレイヤー」は「一連の動作」の中では使えません。プレイヤーがあるイベント直下で使ってください。',
  jcreatepp_message_value_number: '受け取った値は一連の動作の中では使えません。受信した瞬間の処理として使ってください。',
  jcreatepp_message_value_string: '受け取った値は一連の動作の中では使えません。受信した瞬間の処理として使ってください。',
  jcreatepp_message_value_boolean: '受け取った値は一連の動作の中では使えません。受信した瞬間の処理として使ってください。',
  jcreatepp_collision_target: COLLISION_IN_SEQUENCE,
};

export function valueInSequenceError(blockType: string, inSequence: boolean): string | null {
  return inSequence ? VALUE_IN_SEQUENCE_ERRORS[blockType] ?? null : null;
}

/** ブロック type → 日本語ラベル */
export function blockLabel(type: string): string {
  switch (type) {
    case 'jcreatepp_on_start': return '開始時';
    case 'jcreatepp_on_update': return '毎フレーム';
    case 'jcreatepp_on_interact': return 'インタラクト時';
    case 'jcreatepp_on_collide': return '衝突したとき';
    case 'jcreatepp_on_grab_start': return '持ったとき';
    case 'jcreatepp_on_grab_end': return '離したとき';
    case 'jcreatepp_on_receive': return 'メッセージを受け取ったとき';
    case 'jcreatepp_set_position': return '位置を〜にする';
    case 'jcreatepp_add_position': return '位置を〜ずつ変える';
    case 'jcreatepp_smooth_move_by': return '位置を〜だけ〜秒かけて動かす';
    case 'jcreatepp_move_local': return '向いている方向に進む';
    case 'jcreatepp_smooth_move_local': return '向いている方向に〜秒かけて進む';
    case 'jcreatepp_set_rotation': return '角度を〜にする';
    case 'jcreatepp_add_rotation': return '角度を〜ずつ変える';
    case 'jcreatepp_smooth_rotate_by': return '角度を〜だけ〜秒かけて回す';
    case 'jcreatepp_continuous_rotation': return '回転し続ける';
    case 'jcreatepp_timed_random_warp': return '一定間隔でランダムワープ';
    case 'jcreatepp_timed_move_return': return '一定時間移動して戻る';
    case 'jcreatepp_oscillate': return '往復する';
    case 'jcreatepp_set_move_speed': return 'プレイヤーの移動速度倍率を変える';
    case 'jcreatepp_set_jump_speed': return 'プレイヤーのジャンプ速度倍率を変える';
    case 'jcreatepp_if': return 'もし〜なら';
    case 'jcreatepp_if_else': return 'もし〜なら、でなければ';
    case 'jcreatepp_sequence': return '一連の動作を始める';
    case 'jcreatepp_wait_seconds': return '〜秒待つ';
    case 'jcreatepp_wait_until': return '〜まで待つ';
    case 'jcreatepp_run_for_seconds': return 'N秒間、毎フレーム実行する';
    case 'jcreatepp_compare': return '比較条件';
    case 'jcreatepp_not': return '〜ではない';
    case 'jcreatepp_and': return 'かつ';
    case 'jcreatepp_or': return 'または';
    case 'jcreatepp_delta_time': return '経過時間';
    case 'jcreatepp_player': return 'プレイヤー';
    default: return type;
  }
}
