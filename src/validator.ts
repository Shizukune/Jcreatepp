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
import { placementError, valueInSequenceError } from './blocks/placement';
import { blockVariableAccess, neverSetMessage } from './blocks/variableBlocks';
import { variableStateKey } from './variables';

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
  for (const [block, message] of collectWarnings(workspace)) {
    block.setWarningText(message);
  }
}

/** Warning text per block (null = no warning). Does not touch the UI. */
export function collectWarnings(workspace: Blockly.Workspace): Map<Blockly.Block, string | null> {
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
      }
    }

    const valueError = valueInSequenceError(block.type, isInsideSequence(block));
    if (valueError) {
      warn(block, valueError);
    }

    // Statement placement (shared with conversion errors: src/blocks/placement.ts)
    if (ctx && isStatementBlock(block)) {
      const placement = placementError(block.type, {
        event: ctx,
        inSequence: isInsideSequence(block),
        inIf: isInsideIfWithinCurrentSequence(block),
        inRunFor: isInsideRunForSeconds(block),
      });
      if (placement) {
        warn(block, placement);
      }
    }

    validateNames(block, warn);
    validateMessageBlock(block, warn);
  }

  // Variables that are read but never set anywhere (only blocks inside events run).
  const setVariables = new Set<string>();
  for (const block of allBlocks) {
    const access = blockVariableAccess(block.type, (field) => block.getFieldValue(field));
    if (access?.write && findEventContext(block)) {
      setVariables.add(variableStateKey(access.kind, access.name));
    }
  }
  for (const block of allBlocks) {
    const access = blockVariableAccess(block.type, (field) => block.getFieldValue(field));
    if (!access?.read || !findEventContext(block)) continue;
    const name = access.name;
    // Empty names are reported by validateNames; flags named true / false are literals.
    if (!name.trim() || (block.type === 'jcreatepp_flag' && (name.trim() === 'true' || name.trim() === 'false'))) continue;
    if (!setVariables.has(variableStateKey(access.kind, name))) {
      warn(block, neverSetMessage(access.kind, name));
    }
  }

  return warnings;
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

function validateMessageBlock(
  block: Blockly.Block,
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
