/**
 * Jcreate++ リアルタイムバリデーション
 *
 * ワークスペースの変更を監視し、ブロック上に警告を表示する。
 * JS 生成時のエラー検出は generators/jcreatepp.ts の workspaceToProgram() が担当する。
 * ここではリアルタイム警告のみを行う。
 *
 * ── 検出する警告 ──
 * 1. 同種イベントブロックが複数ある
 * 2. 動作ブロックがイベントブロックの外にある（トップレベルに置かれている）
 * 3. 文脈つき値ブロックが不正な文脈で使われている
 * 4. 待機ブロックが一連の動作（Sequence）の外にある
 * 5. 待機ブロックが if / if_else の中にある
 * 6. Sequence が「毎フレーム」直下にある
 * 7. Sequence がネストしている
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

// 待機ブロック type 一覧
const WAIT_BLOCK_TYPES = [
  'jcreatepp_wait_seconds',
  'jcreatepp_wait_until',
  'jcreatepp_run_for_seconds',
];

/**
 * ワークスペースの全ブロックを走査し、リアルタイム警告を更新する。
 * workspace.addChangeListener() から呼び出す。
 */
export function validateWorkspace(workspace: Blockly.Workspace): void {
  const allBlocks = workspace.getAllBlocks(false);

  // 1. 同種イベントブロックの重複検出
  const eventBlocksByType: Record<string, Blockly.Block[]> = {};

  for (const block of allBlocks) {
    if (isEventBlock(block.type)) {
      if (!eventBlocksByType[block.type]) {
        eventBlocksByType[block.type] = [];
      }
      eventBlocksByType[block.type].push(block);
    }
  }

  // イベントブロックの警告を更新
  for (const type of UNIQUE_EVENT_BLOCK_TYPES) {
    const blocks = eventBlocksByType[type] || [];
    if (blocks.length > 1) {
      for (const block of blocks) {
        block.setWarningText(
          `「${eventLabel(type)}」が${blocks.length}個あります。\n同種イベントは1つまでにしてください。`,
        );
      }
    } else {
      for (const block of blocks) {
        // 他の警告がなければクリア
        block.setWarningText(null);
      }
    }
  }

  // 1.5 乗り物テンプレートの重複と場所検出
  let rideTemplates = allBlocks.filter(b => b.type === 'jcreatepp_ride_template');
  for (const block of rideTemplates) {
    if (rideTemplates.length > 1) {
      block.setWarningText('「乗り物ギミック」はワークスペースに1つしか置けません。');
    } else if (findEventContext(block)) {
      block.setWarningText('「乗り物ギミック」はイベントブロックの中に入れず、単独で配置してください。');
    } else {
      block.setWarningText(null);
    }
  }

  let chaseTemplates = allBlocks.filter(b => b.type === 'jcreatepp_chase_template');
  for (const block of chaseTemplates) {
    if (chaseTemplates.length > 1) {
      block.setWarningText('「追いかけるギミック」はワークスペースに1つしか置けません。');
    } else if (findEventContext(block)) {
      block.setWarningText('「追いかけるギミック」はイベントブロックの中に入れず、単独で配置してください。');
    } else {
      block.setWarningText(null);
    }
  }

  // 2. 動作・制御ブロックがイベント外にある検出
  for (const block of allBlocks) {
    if (isStatementBlock(block)) {
      if (!findEventContext(block)) {
        block.setWarningText(
          'このブロックはイベントブロックの中に配置してください。\n（開始時 / 毎フレーム / インタラクト時 / メッセージ受信 など）',
        );
      } else {
        block.setWarningText(null);
      }
    }
  }

  // 3. 文脈つき値ブロックの文脈チェック
  for (const block of allBlocks) {
    const rules = BLOCK_CONTEXT_RULES[block.type];
    if (rules === undefined) continue;      // 未登録 → チェック対象外
    if (rules.length === 0) continue;       // 全文脈OK → チェック不要

    const ctx = findEventContext(block);

    if (!ctx) {
      // イベント外
      block.setWarningText(
        `「${valueBlockLabel(block.type)}」はイベントブロックの中でのみ使えます。`,
      );
    } else if (!isContextAllowed(block.type, ctx)) {
      // 文脈違反
      const allowedNames = rules.map(r => `「${eventLabel(r)}」`).join(' / ');
      block.setWarningText(
        `「${valueBlockLabel(block.type)}」は${allowedNames}の中でのみ使えます。`,
      );
    } else if (block.type === 'jcreatepp_player' && isInsideSequence(block)) {
      // Sequence 内での player 使用禁止
      block.setWarningText(
        `「プレイヤー」は Sequence（一連の動作）の中では使えません。\nプレイヤー値はインタラクト直下の即時処理でのみ使用できます。`,
      );
    } else {
      block.setWarningText(null);
    }
  }

  // 4. 待機ブロックの場所チェック
  for (const block of allBlocks) {
    if (WAIT_BLOCK_TYPES.includes(block.type)) {
      if (!isInsideSequence(block)) {
        block.setWarningText(
          '待機ブロック（「〜秒待つ」「〜まで待つ」等）は「一連の動作（完了まで待つ）」ブロックの中でしか使えません。',
        );
      } else if (isInsideIfWithinCurrentSequence(block)) {
        block.setWarningText(
          '待機ブロックは「もし〜なら」などの条件分岐の中には置けません。',
        );
      } else if (block.type === 'jcreatepp_run_for_seconds' && isInsideRunForSeconds(block)) {
        block.setWarningText('「N秒間、毎フレーム実行する」はネストできません。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_sequence') {
      const ctx = findEventContext(block);
      if (ctx === 'jcreatepp_on_update') {
        block.setWarningText(
          '「一連の動作（完了まで待つ）」ブロックは「毎フレーム」の中には置けません。\n「開始時」または「インタラクト時」で使用してください。',
        );
      } else if (isInsideSequence(block)) {
        block.setWarningText(
          '「一連の動作（完了まで待つ）」ブロックの中に、さらに「一連の動作」を入れることはできません（ネスト禁止）。',
        );
      } else {
        block.setWarningText(null);
      }
    }

    // 5. フラグ変数名のチェック
    if (block.type === 'jcreatepp_flag' || block.type === 'jcreatepp_set_flag') {
      const name = block.getFieldValue('FLAG_NAME') || '';
      if (!name.trim()) {
        block.setWarningText('フラグ名を入力してください。');
      } else if (name.startsWith('__jpp_')) {
        block.setWarningText('「__jpp_」から始まる名前はシステムで予約されているため使用できません。');
      } else {
        block.setWarningText(null);
      }
    }
    // 6. 往復移動の場所チェック
    if (
      block.type === 'jcreatepp_number_var' ||
      block.type === 'jcreatepp_set_number_var' ||
      block.type === 'jcreatepp_change_number_var'
    ) {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!name.trim()) {
        block.setWarningText('数値変数名を入力してください。');
      } else if (name.startsWith('__jpp_') || name.startsWith('jpp.')) {
        block.setWarningText('jpp / __jpp_ から始まる名前はシステム用のため使用できません。');
      } else {
        block.setWarningText(null);
      }
    }

    if (
      block.type === 'jcreatepp_cooldown_active' ||
      block.type === 'jcreatepp_cooldown_remaining' ||
      block.type === 'jcreatepp_start_cooldown'
    ) {
      const name = block.getFieldValue('COOLDOWN_NAME') || '';
      if (!name.trim()) {
        block.setWarningText('クールダウン名を入力してください。');
      } else if (name.startsWith('__jpp_') || name.startsWith('jpp.')) {
        block.setWarningText('jpp / __jpp_ から始まる名前はシステム用のため使用できません。');
      } else {
        block.setWarningText(null);
      }
    }

    if (
      block.type === 'jcreatepp_message_value_number' ||
      block.type === 'jcreatepp_message_value_string' ||
      block.type === 'jcreatepp_message_value_boolean'
    ) {
      const ctx = findEventContext(block);
      if (ctx !== 'jcreatepp_on_receive') {
        block.setWarningText('受け取った値は「メッセージを受け取ったとき」の中でのみ使えます。');
      } else if (isInsideSequence(block)) {
        block.setWarningText('受け取った値は一連の動作の中では使えません。受信した瞬間の処理として使ってください。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_oscillate') {
      const ctx = findEventContext(block);
      if (ctx !== 'jcreatepp_on_update') {
        block.setWarningText('「往復する」ブロックは「毎フレーム」の中でしか使えません。');
      } else {
        block.setWarningText(null);
      }
    }

    if (
      block.type === 'jcreatepp_continuous_rotation' ||
      block.type === 'jcreatepp_timed_random_warp' ||
      block.type === 'jcreatepp_timed_move_return'
    ) {
      const ctx = findEventContext(block);
      if (ctx !== 'jcreatepp_on_update') {
        block.setWarningText('このブロックは「毎フレーム」の中でしか使えません。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_set_move_speed' || block.type === 'jcreatepp_set_jump_speed') {
      const ctx = findEventContext(block);
      if (!isPlayerEventContext(ctx)) {
        block.setWarningText('このブロックは「インタラクト時」「持ったとき」「離したとき」の中でしか使えません。');
      } else if (isInsideSequence(block)) {
        block.setWarningText('このブロックは「一連の動作」の中では使えません。プレイヤーがあるイベント直下で使ってください。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_on_receive') {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!message.trim()) {
        block.setWarningText('メッセージ名を入力してください。');
      } else {
        block.setWarningText(null);
      }
    }
    if (block.type === 'jcreatepp_send_message_once') {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!message.trim()) {
        block.setWarningText('送信するメッセージ名を入力してください。');
      }
    }

    if (block.type === 'jcreatepp_send_message_to_item_once') {
      const itemName = block.getFieldValue('ITEM_NAME') || '';
      const message = block.getFieldValue('MESSAGE') || '';
      if (!itemName.trim()) {
        block.setWarningText('送信先アイテムの参照名を入力してください。');
      } else if (!message.trim()) {
        block.setWarningText('送信するメッセージ名を入力してください。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_send_message_value_once') {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!message.trim()) {
        block.setWarningText('送信するメッセージ名を入力してください。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_send_message_value_to_item_once') {
      const itemName = block.getFieldValue('ITEM_NAME') || '';
      const message = block.getFieldValue('MESSAGE') || '';
      if (!itemName.trim()) {
        block.setWarningText('送信先アイテムの参照名を入力してください。');
      } else if (!message.trim()) {
        block.setWarningText('送信するメッセージ名を入力してください。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_reply_message_once') {
      const message = block.getFieldValue('MESSAGE') || '';
      const ctx = findEventContext(block);
      if (ctx !== 'jcreatepp_on_receive') {
        block.setWarningText('このブロックは「メッセージを受け取ったとき」の中でのみ使えます。');
      } else if (isInsideSequence(block)) {
        block.setWarningText('このブロックは「一連の動作」の中では使えません。受信した瞬間の処理として置いてください。');
      } else if (!message.trim()) {
        block.setWarningText('返信するメッセージ名を入力してください。');
      } else {
        block.setWarningText(null);
      }
    }

    if (block.type === 'jcreatepp_reply_message_value_once') {
      const message = block.getFieldValue('MESSAGE') || '';
      const ctx = findEventContext(block);
      if (ctx !== 'jcreatepp_on_receive') {
        block.setWarningText('このブロックは「メッセージを受け取ったとき」の中でのみ使えます。');
      } else if (isInsideSequence(block)) {
        block.setWarningText('このブロックは一連の動作の中では使えません。受信した瞬間の処理として置いてください。');
      } else if (!message.trim()) {
        block.setWarningText('返信するメッセージ名を入力してください。');
      } else {
        block.setWarningText(null);
      }
    }
  }
}

/**
 * ブロックが属するイベント文脈を返す。
 * 値ブロック (output あり) は getSurroundParent() ではイベントに到達できない場合があるため、
 * getParent() チェインも使って辿る。
 */
export function findEventContext(block: Blockly.Block): EventContext | null {
  // まず getSurroundParent で辿る（statement ブロック向け）
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (isEventBlock(current.type)) {
      return current.type;
    }
    current = current.getSurroundParent();
  }

  // getSurroundParent で見つからなかった場合、getParent で辿る（値ブロック向け）
  let parent: Blockly.Block | null = block.getParent();
  while (parent) {
    if (isEventBlock(parent.type)) {
      return parent.type;
    }
    parent = parent.getParent();
  }

  return null;
}

/**
 * ブロックが一連の動作（Sequence）の中に配置されているか判定する
 */
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

/**
 * ブロックが if または if_else の中に配置されているか判定する
 */
export function isInsideIf(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (current.type === 'jcreatepp_if' || current.type === 'jcreatepp_if_else') {
      return true;
    }
    current = current.getSurroundParent();
  }
  return false;
}

/**
 * Sequence 内の待機ブロックが、その同じ Sequence 内の if に入っているか判定する。
 * Sequence 自体が外側の if から開始されているケースは合法にする。
 */
export function isInsideIfWithinCurrentSequence(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (current.type === 'jcreatepp_sequence') {
      return false;
    }
    if (current.type === 'jcreatepp_if' || current.type === 'jcreatepp_if_else') {
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
