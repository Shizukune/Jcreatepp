/**
 * Jcreate++ 文脈ルール正本
 *
 * 値ブロックがどのイベント文脈で合法かを定義する唯一のマップ。
 * validator と generators がこのマップを参照する。
 *
 * ── 解釈 ──
 * - [] (空配列)     → 全文脈で合法
 * - ['jcreatepp_on_update'] → onUpdate 文脈のみ合法
 * - 未登録ブロック  → 文脈チェック対象外
 */

// ── イベント文脈型 ──

export type EventContext =
  | 'jcreatepp_on_start'
  | 'jcreatepp_on_update'
  | 'jcreatepp_on_interact'
  | 'jcreatepp_on_grab_start'
  | 'jcreatepp_on_grab_end'
  | 'jcreatepp_on_receive';

// ── イベントブロック type 一覧 ──

export const EVENT_BLOCK_TYPES: readonly EventContext[] = [
  'jcreatepp_on_start',
  'jcreatepp_on_update',
  'jcreatepp_on_interact',
  'jcreatepp_on_grab_start',
  'jcreatepp_on_grab_end',
  'jcreatepp_on_receive',
] as const;

// 同種イベントは1つまでとするイベント群
export const UNIQUE_EVENT_BLOCK_TYPES: readonly EventContext[] = [
  'jcreatepp_on_start',
  'jcreatepp_on_update',
  'jcreatepp_on_interact',
  'jcreatepp_on_grab_start',
  'jcreatepp_on_grab_end',
] as const;

// ── 文脈ルールマップ ──

export const BLOCK_CONTEXT_RULES: Record<string, EventContext[]> = {
  // 全文脈 OK
  math_number: [],
  jcreatepp_number_var: [],
  jcreatepp_arithmetic: [],

  // onUpdate 専用
  jcreatepp_delta_time: ['jcreatepp_on_update'],

  // onInteract, onGrab 専用
  jcreatepp_player: ['jcreatepp_on_interact', 'jcreatepp_on_grab_start', 'jcreatepp_on_grab_end'],

  // 将来:
  // jcreatepp_self_position: [],
  // jcreatepp_self_rotation: [],
};

// ── イベント日本語ラベル ──

export function eventLabel(type: string): string {
  switch (type) {
    case 'jcreatepp_on_start': return '開始時';
    case 'jcreatepp_on_update': return '毎フレーム';
    case 'jcreatepp_on_interact': return 'インタラクト時';
    case 'jcreatepp_on_grab_start': return '持ったとき';
    case 'jcreatepp_on_grab_end': return '離したとき';
    case 'jcreatepp_on_receive': return 'メッセージを受け取ったとき';
    default: return type;
  }
}

// ── ブロック日本語ラベル ──

export function valueBlockLabel(type: string): string {
  switch (type) {
    case 'jcreatepp_delta_time': return '経過時間';
    case 'jcreatepp_player': return 'プレイヤー';
    default: return type;
  }
}

// ── 判定関数 ──

/** ブロック type がイベントブロックか */
export function isEventBlock(type: string): type is EventContext {
  return EVENT_BLOCK_TYPES.includes(type as EventContext);
}

/** BLOCK_CONTEXT_RULES に登録された値ブロックか */
export function isContextCheckedBlock(type: string): boolean {
  return type in BLOCK_CONTEXT_RULES;
}

/** 指定の文脈で合法か判定する */
export function isContextAllowed(
  blockType: string,
  context: EventContext | null,
): boolean {
  const rules = BLOCK_CONTEXT_RULES[blockType];
  if (rules === undefined) return true;  // 未登録 → チェック対象外
  if (rules.length === 0) return true;   // 空配列 → 全文脈OK
  if (context === null) return false;    // イベント外 → NG
  return rules.includes(context);
}
