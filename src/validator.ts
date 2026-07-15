/**
 * Realtime validation for the Blockly workspace.
 */

import * as Blockly from 'blockly/core';
import {
  UNIQUE_EVENT_BLOCK_TYPES,
  BLOCK_CONTEXT_RULES,
  isEventBlock,
  isContextAllowed,
  eventLabel,
  valueBlockLabel,
  type EventContext,
} from './blocks/context';

const WAIT_BLOCK_TYPES = [
  'jcreatepp_wait_seconds',
  'jcreatepp_wait_until',
  'jcreatepp_run_for_seconds',
];

const MESSAGE_TYPE_MAX_BYTES = 100;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function validateMessageType(message: string, label: string = 'メッセージ名'): string | null {
  if (!message.trim()) {
    return `${label}を入力してください。`;
  }
  if (utf8ByteLength(message) > MESSAGE_TYPE_MAX_BYTES) {
    return `${label}はUTF-8で${MESSAGE_TYPE_MAX_BYTES}byte以内にしてください。`;
  }
  return null;
}

export function validateWorkspace(workspace: Blockly.Workspace): void {
  const allBlocks = workspace.getAllBlocks(false);
  const warnings = new Map<Blockly.Block, string | null>();

  const warn = (block: Blockly.Block, message: string | null) => {
    if (!warnings.has(block) || warnings.get(block) === null) {
      warnings.set(block, message);
    }
  };

  const eventBlocksByType: Record<string, Blockly.Block[]> = {};
  for (const block of allBlocks) {
    warnings.set(block, null);
    if (isEventBlock(block.type)) {
      eventBlocksByType[block.type] ??= [];
      eventBlocksByType[block.type].push(block);
    }
  }

  for (const type of UNIQUE_EVENT_BLOCK_TYPES) {
    const blocks = eventBlocksByType[type] || [];
    if (blocks.length > 1) {
      for (const block of blocks) {
        warn(block, `${eventLabel(type)}が${blocks.length}個あります。同じ種類のイベントは1つまでにしてください。`);
      }
    }
  }

  const rideTemplates = allBlocks.filter((b) => b.type === 'jcreatepp_ride_template');
  for (const block of rideTemplates) {
    if (rideTemplates.length > 1) {
      warn(block, '乗り物ギミックはワークスペースに1つだけ置けます。');
    } else if (findEventContext(block)) {
      warn(block, '乗り物ギミックはイベントの中に入れず、単独で配置してください。');
    }
  }

  const chaseTemplates = allBlocks.filter((b) => b.type === 'jcreatepp_chase_template');
  for (const block of chaseTemplates) {
    if (chaseTemplates.length > 1) {
      warn(block, '追いかけるギミックはワークスペースに1つだけ置けます。');
    } else if (findEventContext(block)) {
      warn(block, '追いかけるギミックはイベントの中に入れず、単独で配置してください。');
    }
  }

  for (const block of allBlocks) {
    const ctx = findEventContext(block);

    if (isStatementBlock(block) && !ctx) {
      warn(block, 'このブロックはイベントブロックの中に配置してください。');
    }

    const rules = BLOCK_CONTEXT_RULES[block.type];
    if (rules !== undefined && rules.length > 0) {
      if (!ctx) {
        warn(block, `${valueBlockLabel(block.type)}はイベントブロックの中でのみ使えます。`);
      } else if (!isContextAllowed(block.type, ctx)) {
        const allowedNames = rules.map((r) => eventLabel(r)).join(' / ');
        warn(block, `${valueBlockLabel(block.type)}は${allowedNames}の中でのみ使えます。`);
      } else if (block.type === 'jcreatepp_player' && isInsideSequence(block)) {
        warn(block, 'プレイヤーは一連の動作の中では使えません。プレイヤーがあるイベント直下で使ってください。');
      }
    }

    if (
      (block.type === 'jcreatepp_message_value_number' ||
        block.type === 'jcreatepp_message_value_string' ||
        block.type === 'jcreatepp_message_value_boolean') &&
      isInsideSequence(block)
    ) {
      warn(block, '受け取った値は一連の動作の中では使えません。受信直後に変数へ保存してから使ってください。');
    }

    if (WAIT_BLOCK_TYPES.includes(block.type)) {
      if (!isInsideSequence(block)) {
        warn(block, '待機ブロックは「一連の動作」の中でのみ使えます。');
      } else if (isInsideIfWithinCurrentSequence(block)) {
        warn(block, '待機ブロックは一連の動作内の条件分岐の中には置けません。');
      } else if (block.type === 'jcreatepp_run_for_seconds' && isInsideRunForSeconds(block)) {
        warn(block, '「N秒間、毎フレーム実行する」はネストできません。');
      }
    }

    if (block.type === 'jcreatepp_sequence') {
      if (ctx === 'jcreatepp_on_update') {
        warn(block, '一連の動作は毎フレームの中には置けません。開始時やインタラクト時などで使ってください。');
      } else if (isInsideSequence(block)) {
        warn(block, '一連の動作の中に、さらに一連の動作を入れることはできません。');
      }
    }

    validateNames(block, warn);
    validateContextSpecificStatement(block, ctx, warn);
    validateMessageBlock(block, ctx, warn);
  }

  for (const block of allBlocks) {
    block.setWarningText(warnings.get(block) ?? null);
  }
}

function validateNames(block: Blockly.Block, warn: (block: Blockly.Block, message: string | null) => void): void {
  if (block.type === 'jcreatepp_flag' || block.type === 'jcreatepp_set_flag') {
    const name = block.getFieldValue('FLAG_NAME') || '';
    if (!name.trim()) {
      warn(block, 'フラグ名を入力してください。');
    } else if (name.trim() === 'true' || name.trim() === 'false') {
      warn(block, 'true / false は条件そのものです。フラグ名には使わず、真偽値の true / false ブロックを使ってください。');
    } else if (name.startsWith('__jpp_') || name.startsWith('jpp.')) {
      warn(block, 'jpp. / __jpp_ から始まる名前はシステム用のため使用できません。');
    }
  }

  if (
    block.type === 'jcreatepp_number_var' ||
    block.type === 'jcreatepp_set_number_var' ||
    block.type === 'jcreatepp_change_number_var' ||
    block.type === 'jcreatepp_string_var' ||
    block.type === 'jcreatepp_set_string_var' ||
    block.type === 'jcreatepp_bool_var' ||
    block.type === 'jcreatepp_set_bool_var'
  ) {
    const name = block.getFieldValue('VAR_NAME') || '';
    if (!name.trim()) {
      warn(block, '変数名を入力してください。');
    } else if (name.startsWith('__jpp_') || name.startsWith('jpp.')) {
      warn(block, 'jpp. / __jpp_ から始まる名前はシステム用のため使用できません。');
    }
  }

  if (
    block.type === 'jcreatepp_cooldown_active' ||
    block.type === 'jcreatepp_cooldown_remaining' ||
    block.type === 'jcreatepp_start_cooldown'
  ) {
    const name = block.getFieldValue('COOLDOWN_NAME') || '';
    if (!name.trim()) {
      warn(block, 'クールダウン名を入力してください。');
    } else if (name.startsWith('__jpp_') || name.startsWith('jpp.')) {
      warn(block, 'jpp. / __jpp_ から始まる名前はシステム用のため使用できません。');
    }
  }

  if (block.type === 'jcreatepp_play_audio') {
    const audioId = block.getFieldValue('AUDIO_ID') || '';
    if (!audioId.trim()) {
      warn(block, '音のIDを入力してください。');
    }
  }

  if (block.type === 'jcreatepp_set_subnode_text' || block.type === 'jcreatepp_set_component_enabled') {
    const subNodeName = block.getFieldValue('SUBNODE_NAME') || '';
    if (!subNodeName.trim()) {
      warn(block, 'サブノード名を入力してください。');
    }
  }
}

function validateContextSpecificStatement(
  block: Blockly.Block,
  ctx: EventContext | null,
  warn: (block: Blockly.Block, message: string | null) => void,
): void {
  if (block.type === 'jcreatepp_oscillate' && ctx !== 'jcreatepp_on_update') {
    warn(block, '往復するブロックは毎フレームの中でのみ使えます。');
  }

  if (
    (block.type === 'jcreatepp_continuous_rotation' ||
      block.type === 'jcreatepp_timed_random_warp' ||
      block.type === 'jcreatepp_timed_move_return') &&
    ctx !== 'jcreatepp_on_update'
  ) {
    warn(block, 'このブロックは毎フレームの中でのみ使えます。');
  }

  if (block.type === 'jcreatepp_smooth_move_by') {
    if (ctx === 'jcreatepp_on_update') {
      warn(block, '滑らか移動は毎フレームの中には置けません。インタラクト時やメッセージ受信時など、開始するタイミングで使ってください。');
    } else if (isInsideSequence(block)) {
      warn(block, '滑らか移動は一連の動作の中ではなく、インタラクト時やメッセージ受信時などの中に直接置いてください。');
    }
  }

  if (block.type === 'jcreatepp_smooth_rotate_by') {
    if (ctx === 'jcreatepp_on_update') {
      warn(block, '滑らか回転は毎フレームの中には置けません。インタラクト時やメッセージ受信時など、開始するタイミングで使ってください。');
    } else if (isInsideSequence(block)) {
      warn(block, '滑らか回転は一連の動作の中ではなく、インタラクト時やメッセージ受信時などの中に直接置いてください。');
    }
  }

  if (block.type === 'jcreatepp_set_move_speed' || block.type === 'jcreatepp_set_jump_speed') {
    if (!isPlayerEventContext(ctx)) {
      warn(block, 'このブロックはインタラクト時、持ったとき、離したときの中でのみ使えます。');
    } else if (isInsideSequence(block)) {
      warn(block, 'このブロックは一連の動作の中では使えません。プレイヤーがあるイベント直下で使ってください。');
    }
  }
}

function validateMessageBlock(
  block: Blockly.Block,
  ctx: EventContext | null,
  warn: (block: Blockly.Block, message: string | null) => void,
): void {
  const sendMessageTypes = new Set([
    'jcreatepp_on_receive',
    'jcreatepp_send_message_once',
    'jcreatepp_send_message_value_once',
    'jcreatepp_send_message_to_item_once',
    'jcreatepp_send_message_value_to_item_once',
    'jcreatepp_reply_message_once',
    'jcreatepp_reply_message_value_once',
    'jcreatepp_send_message_to_collision_once',
    'jcreatepp_send_message_value_to_collision_once',
  ]);

  if (!sendMessageTypes.has(block.type)) {
    return;
  }

  const message = block.getFieldValue('MESSAGE') || '';
  const label = block.type === 'jcreatepp_on_receive'
    ? 'メッセージ名'
    : block.type.startsWith('jcreatepp_reply')
      ? '返信するメッセージ名'
      : '送信するメッセージ名';
  const warning = validateMessageType(message, label);
  if (warning) {
    warn(block, warning);
  }

  if (
    block.type === 'jcreatepp_send_message_to_item_once' ||
    block.type === 'jcreatepp_send_message_value_to_item_once'
  ) {
    const itemName = block.getFieldValue('ITEM_NAME') || '';
    if (!itemName.trim()) {
      warn(block, '送信先アイテムの参照名を入力してください。');
    }
  }

  if (block.type.startsWith('jcreatepp_reply')) {
    if (ctx !== 'jcreatepp_on_receive') {
      warn(block, '返信ブロックは「メッセージを受け取ったとき」の中でのみ使えます。');
    } else if (isInsideSequence(block)) {
      warn(block, '返信ブロックは一連の動作の中では使えません。受信直後の処理として置いてください。');
    }
  }

  if (block.type.includes('_collision_') && ctx !== 'jcreatepp_on_collide') {
    warn(block, '衝突相手への送信は「衝突したとき」の中でのみ使えます。');
  }
}

export function findEventContext(block: Blockly.Block): EventContext | null {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (isEventBlock(current.type)) {
      return current.type;
    }
    current = current.getSurroundParent();
  }

  let parent: Blockly.Block | null = block.getParent();
  while (parent) {
    if (isEventBlock(parent.type)) {
      return parent.type;
    }
    parent = parent.getParent();
  }

  return null;
}

export function isInsideSequence(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (current.type === 'jcreatepp_sequence') {
      return true;
    }
    current = current.getSurroundParent();
  }
  return false;
}

export function isInsideIf(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (current.type === 'jcreatepp_if' || current.type === 'jcreatepp_if_else' || current.type === 'jcreatepp_if_edge') {
      return true;
    }
    current = current.getSurroundParent();
  }
  return false;
}

export function isInsideIfWithinCurrentSequence(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (current.type === 'jcreatepp_sequence') {
      return false;
    }
    if (current.type === 'jcreatepp_if' || current.type === 'jcreatepp_if_else' || current.type === 'jcreatepp_if_edge') {
      return true;
    }
    current = current.getSurroundParent();
  }
  return false;
}

export function isInsideRunForSeconds(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (current.type === 'jcreatepp_sequence') {
      return false;
    }
    if (current.type === 'jcreatepp_run_for_seconds') {
      return true;
    }
    current = current.getSurroundParent();
  }
  return false;
}

function isStatementBlock(block: Blockly.Block): boolean {
  return !!(block.previousConnection || block.nextConnection);
}

function isPlayerEventContext(type: EventContext | null): boolean {
  return type === 'jcreatepp_on_interact' || type === 'jcreatepp_on_grab_start' || type === 'jcreatepp_on_grab_end';
}
