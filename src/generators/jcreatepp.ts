/**
 * Jcreate++ ブロック → IR 変換
 *
 * Blockly ワークスペースのブロック構造を IR (Program) に変換する。
 * JS コードの直接組み立ては行わない（codegen.ts の責務）。
 *
 * ── 処理フロー ──
 * 1. ワークスペースのトップレベルブロックを走査
 * 2. イベントブロックごとに Handler を構築
 * 3. statement チェインを走査して Stmt[] に変換
 * 4. 重複検出とエラーを errors に蓄積
 * 5. 文脈つき値ブロックの文脈違反を検出
 * 6. Program + errors + warnings を返す
 */

import * as Blockly from 'blockly/core';
import { Order } from 'blockly/javascript';
import type { Program, Handler, Stmt, Expr, BoolExpr, MessageSendValue, MessageTarget, RaycastTarget, TextComponentType, UnityComponentType } from '../ir';
import { raw, numberLiteral, stringLiteral, deltaTime, playerRef, collisionHandle, numberVar, stringVar, binary, randomNumber, playersNearCount, cooldownRemaining, messageValue, not, and, or } from '../ir';
import {
  BLOCK_CONTEXT_RULES,
  isEventBlock,
  isContextAllowed,
  eventLabel,
  valueBlockLabel,
  UNIQUE_EVENT_BLOCK_TYPES,
  type EventContext,
} from '../blocks/context';
import { findEventContext } from '../validator';

// ── 変換結果 ──

export type ConvertResult = {
  program: Program;
  errors: string[];
  warnings: string[];
};

// ── メイン変換関数 ──

/**
 * Blockly ワークスペースを走査し、IR (Program) に変換する。
 * エラー・警告も同時に収集する。
 */
export function workspaceToProgram(
  workspace: Blockly.Workspace,
  generator: Blockly.CodeGenerator,
): ConvertResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const program: Program = {};

  // ジェネレータを初期化（valueToCode() を呼ぶ前に必須）
  generator.init(workspace);

  const eventCounts: Record<string, number> = {};
  let rideTemplateCount = 0;
  let chaseTemplateCount = 0;

  const topBlocks = workspace.getTopBlocks(true);
  console.log('topBlocks:', topBlocks.map(b => b.type + '(' + b.id + ')'));

  for (const block of topBlocks) {
    const type = block.type;

    if (type === 'jcreatepp_on_receive') {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!message.trim()) {
        errors.push('「メッセージを受け取ったとき」のメッセージ名を入力してください。');
        continue;
      }
      const handler = blockToHandler(block, type as EventContext, generator, errors);
      program.onReceives ??= [];
      program.onReceives.push({ message, handler });
      continue;
    }

    if (isEventBlock(type)) {
      // 重複カウント（jcreatepp_on_receive は重複可能なのでそれ以外）
      if (UNIQUE_EVENT_BLOCK_TYPES.includes(type as EventContext)) {
        eventCounts[type] = (eventCounts[type] || 0) + 1;

        if (eventCounts[type] > 1) {
          errors.push(`${blockLabel(type)} が複数あります。同種イベントは1つまでです。`);
          continue; // 2個目以降は無視
        }
      }

      const handler = blockToHandler(block, type, generator, errors);
      assignHandler(program, type, handler);
    } else if (type === 'jcreatepp_ride_template') {
      rideTemplateCount++;
      if (rideTemplateCount > 1) {
        errors.push('「乗り物ギミック」はワークスペースに1つまでです。');
        continue;
      }
      const forwardSpeed = resolveValueExpr(block, 'FORWARD_SPEED', null as any, generator, errors, false);
      const upDownSpeed = resolveValueExpr(block, 'UP_DOWN_SPEED', null as any, generator, errors, false);
      const turnSpeed = resolveValueExpr(block, 'TURN_SPEED', null as any, generator, errors, false);
      program.rideTemplate = { forwardSpeed, upDownSpeed, turnSpeed };
    } else if (type === 'jcreatepp_chase_template') {
      chaseTemplateCount++;
      if (chaseTemplateCount > 1) {
        errors.push('「追いかけるギミック」はワークスペースに1つまでです。');
        continue;
      }
      const moveSpeed = resolveValueExpr(block, 'MOVE_SPEED', null as any, generator, errors, false);
      const maxDistance = resolveValueExpr(block, 'MAX_DISTANCE', null as any, generator, errors, false);
      const minDistance = resolveValueExpr(block, 'MIN_DISTANCE', null as any, generator, errors, false);
      program.chaseTemplate = { moveSpeed, maxDistance, minDistance };
    } else {
      // 動作ブロックなど、イベント・テンプレート以外がトップレベルにある場合はエラー
      // （※条件・数値ブロックなどは孤立していてもジェネレータは無視するか、接続されていないエラーになるが、ここでは動作ブロックを明示的に弾く意図）
      if (block.previousConnection || block.nextConnection) {
        errors.push(`「${blockLabel(type)}」がイベントブロックの外にあります。イベントブロックの中に配置してください。`);
      }
    }
  }

  return { program, errors, warnings };
}

// ── ハンドラ変換 ──

function blockToHandler(
  eventBlock: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
): Handler {
  const body: Stmt[] = [];

  // statement チェインを走査
  let stmtBlock = eventBlock.getInputTargetBlock('DO');
  while (stmtBlock) {
    const stmt = blockToStmt(stmtBlock, eventType, generator, errors, false);
    if (stmt) {
      body.push(stmt);
    }
    stmtBlock = stmtBlock.getNextBlock();
  }

  return { body };
}

// ── ステートメント変換 ──

function blockToStmt(
  block: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean = false,
  inIf: boolean = false,
): Stmt | null {
  switch (block.type) {
    case 'jcreatepp_set_position': {
      const x = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const y = resolveValueExpr(block, 'Y', eventType, generator, errors, inSequence);
      const z = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      return { kind: 'set_position', x, y, z };
    }

    case 'jcreatepp_add_position': {
      const x = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const y = resolveValueExpr(block, 'Y', eventType, generator, errors, inSequence);
      const z = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      return { kind: 'move_by', x, y, z };
    }

    case 'jcreatepp_set_rotation': {
      const x = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const y = resolveValueExpr(block, 'Y', eventType, generator, errors, inSequence);
      const z = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      return { kind: 'set_rotation', x, y, z };
    }

    case 'jcreatepp_add_rotation': {
      const x = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const y = resolveValueExpr(block, 'Y', eventType, generator, errors, inSequence);
      const z = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      return { kind: 'rotate_by', x, y, z };
    }

    case 'jcreatepp_random_warp': {
      const rangeX = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const rangeZ = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      return { kind: 'random_warp', rangeX, rangeZ };
    }

    case 'jcreatepp_save_position': {
      return { kind: 'save_position' };
    }

    case 'jcreatepp_load_position': {
      return { kind: 'load_position' };
    }

    case 'jcreatepp_add_force': {
      const power = resolveValueExpr(block, 'POWER', eventType, generator, errors, inSequence);
      const dirX = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const dirY = resolveValueExpr(block, 'Y', eventType, generator, errors, inSequence);
      const dirZ = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      return { kind: 'add_force', power, dirX, dirY, dirZ };
    }

    case 'jcreatepp_continuous_rotation': {
      if (eventType !== 'jcreatepp_on_update') {
        errors.push(`「${blockLabel(block.type)}」は「毎フレーム」の中でしか使えません。`);
        return null;
      }
      const axis = block.getFieldValue('AXIS') as 'X' | 'Y' | 'Z';
      const speed = resolveValueExpr(block, 'SPEED', eventType, generator, errors, inSequence);
      return { kind: 'continuous_rotation', axis, speed };
    }

    case 'jcreatepp_timed_random_warp': {
      if (eventType !== 'jcreatepp_on_update') {
        errors.push(`「${blockLabel(block.type)}」は「毎フレーム」の中でしか使えません。`);
        return null;
      }
      const interval = resolveValueExpr(block, 'INTERVAL', eventType, generator, errors, inSequence);
      const range = resolveValueExpr(block, 'RANGE', eventType, generator, errors, inSequence);
      return { kind: 'timed_random_warp', interval, range, blockId: block.id };
    }

    case 'jcreatepp_timed_move_return': {
      if (eventType !== 'jcreatepp_on_update') {
        errors.push(`「${blockLabel(block.type)}」は「毎フレーム」の中でしか使えません。`);
        return null;
      }
      const dirX = resolveValueExpr(block, 'X', eventType, generator, errors, inSequence);
      const dirY = resolveValueExpr(block, 'Y', eventType, generator, errors, inSequence);
      const dirZ = resolveValueExpr(block, 'Z', eventType, generator, errors, inSequence);
      const speed = resolveValueExpr(block, 'SPEED', eventType, generator, errors, inSequence);
      const duration = resolveValueExpr(block, 'DURATION', eventType, generator, errors, inSequence);
      return { kind: 'timed_move_return', dirX, dirY, dirZ, speed, duration, blockId: block.id };
    }

    case 'jcreatepp_set_move_speed': {
      if (!isPlayerEventContext(eventType)) {
        errors.push(`「${blockLabel(block.type)}」は「インタラクト時」「持ったとき」「離したとき」の中でしか使えません。`);
        return null;
      }
      if (inSequence) {
        errors.push(`「${blockLabel(block.type)}」は「一連の動作」の中では使えません。プレイヤーがあるイベント直下で使ってください。`);
        return null;
      }
      const rate = resolveValueExpr(block, 'RATE', eventType, generator, errors, inSequence);
      return { kind: 'set_move_speed', rate };
    }

    case 'jcreatepp_set_jump_speed': {
      if (!isPlayerEventContext(eventType)) {
        errors.push(`「${blockLabel(block.type)}」は「インタラクト時」「持ったとき」「離したとき」の中でしか使えません。`);
        return null;
      }
      if (inSequence) {
        errors.push(`「${blockLabel(block.type)}」は「一連の動作」の中では使えません。プレイヤーがあるイベント直下で使ってください。`);
        return null;
      }
      const rate = resolveValueExpr(block, 'RATE', eventType, generator, errors, inSequence);
      return { kind: 'set_jump_speed', rate };
    }

    case 'jcreatepp_play_audio': {
      const audioSetId = block.getFieldValue('AUDIO_ID') || '';
      if (!audioSetId.trim()) {
        errors.push('音のIDを入力してください。');
        return null;
      }
      const volume = resolveValueExpr(block, 'VOLUME', eventType, generator, errors, inSequence);
      return { kind: 'play_audio', audioSetId, volume };
    }

    case 'jcreatepp_set_subnode_text': {
      const subNodeName = block.getFieldValue('SUBNODE_NAME') || '';
      if (!subNodeName.trim()) {
        errors.push('文字を変えるサブノード名を入力してください。');
        return null;
      }
      const componentType = block.getFieldValue('COMPONENT') as TextComponentType;
      const valueBlock = block.getInputTargetBlock('TEXT');
      const value = valueBlock ? blockToStringExpr(valueBlock, eventType, generator, errors, inSequence) : stringLiteral('');
      if (valueBlock) validateValueBlockContext(valueBlock, eventType, errors, inSequence);
      return { kind: 'set_subnode_text', subNodeName, componentType, value };
    }

    case 'jcreatepp_set_component_enabled': {
      const subNodeName = block.getFieldValue('SUBNODE_NAME') || '';
      if (!subNodeName.trim()) {
        errors.push('切り替えるサブノード名を入力してください。');
        return null;
      }
      const componentType = block.getFieldValue('COMPONENT') as UnityComponentType;
      const enabled = conditionFromNamedInput(block, 'ENABLED', eventType, generator, errors, inSequence);
      return { kind: 'set_component_enabled', subNodeName, componentType, enabled };
    }

    case 'jcreatepp_set_flag': {
      const name = block.getFieldValue('FLAG_NAME') || '';
      const operation = block.getFieldValue('OPERATION') as 'true' | 'false' | 'toggle';
      return { kind: 'set_flag', name, operation };
    }

    case 'jcreatepp_set_number_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!name.trim()) {
        errors.push('数値変数名を入力してください。');
        return null;
      }
      if (isReservedNumberVarName(name)) {
        errors.push('jpp / __jpp_ から始まる数値変数名は使用できません。');
        return null;
      }
      const value = resolveValueExpr(block, 'VALUE', eventType, generator, errors, inSequence);
      return { kind: 'set_number_var', name, value };
    }

    case 'jcreatepp_change_number_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!name.trim()) {
        errors.push('数値変数名を入力してください。');
        return null;
      }
      if (isReservedNumberVarName(name)) {
        errors.push('jpp / __jpp_ から始まる数値変数名は使用できません。');
        return null;
      }
      const delta = resolveValueExpr(block, 'DELTA', eventType, generator, errors, inSequence);
      return { kind: 'change_number_var', name, delta };
    }

    case 'jcreatepp_set_string_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!validateUserStateName(name, '文字変数名', errors)) return null;
      const valueBlock = block.getInputTargetBlock('VALUE');
      const value = valueBlock ? blockToStringExpr(valueBlock, eventType, generator, errors, inSequence) : stringLiteral('');
      if (valueBlock) validateValueBlockContext(valueBlock, eventType, errors, inSequence);
      return { kind: 'set_string_var', name, value };
    }

    case 'jcreatepp_set_bool_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!validateUserStateName(name, '真偽値変数名', errors)) return null;
      const valueBlock = block.getInputTargetBlock('VALUE');
      const value = valueBlock ? blockToBoolExpr(valueBlock, eventType, generator, errors, inSequence) : { kind: 'raw_bool', code: 'false' } as BoolExpr;
      if (valueBlock) validateValueBlockContext(valueBlock, eventType, errors, inSequence);
      return { kind: 'set_bool_var', name, value };
    }

    case 'jcreatepp_start_cooldown': {
      const name = block.getFieldValue('COOLDOWN_NAME') || '';
      if (!name.trim()) {
        errors.push('クールダウン名を入力してください。');
        return null;
      }
      if (isReservedSystemName(name)) {
        errors.push('jpp / __jpp_ から始まるクールダウン名は使用できません。');
        return null;
      }
      const seconds = resolveValueExpr(block, 'SECONDS', eventType, generator, errors, inSequence);
      return { kind: 'start_cooldown', name, seconds };
    }

    case 'jcreatepp_oscillate': {
      if (eventType !== 'jcreatepp_on_update') {
        errors.push(`「${blockLabel(block.type)}」は「毎フレーム」の中でしか使えません。`);
        return null;
      }
      const axis = block.getFieldValue('AXIS') as 'X' | 'Y' | 'Z';
      const width = resolveValueExpr(block, 'WIDTH', eventType, generator, errors, inSequence);
      const speed = resolveValueExpr(block, 'SPEED', eventType, generator, errors, inSequence);
      return { kind: 'oscillate', axis, width, speed, blockId: block.id };
    }

    case 'jcreatepp_if':
    case 'jcreatepp_if_else': {
      const conditionBlock = block.getInputTargetBlock('CONDITION');
      let condition: BoolExpr;
      if (conditionBlock) {
        validateValueBlockContext(conditionBlock, eventType, errors, inSequence);
        condition = blockToBoolExpr(conditionBlock, eventType, generator, errors, inSequence);
      } else {
        condition = { kind: 'raw_bool', code: 'false' };
      }

      const thenBody: Stmt[] = [];
      let thenBlock = block.getInputTargetBlock('DO');
      while (thenBlock) {
        const stmt = blockToStmt(thenBlock, eventType, generator, errors, inSequence, true);
        if (stmt) thenBody.push(stmt);
        thenBlock = thenBlock.getNextBlock();
      }

      const elseBody: Stmt[] = [];
      if (block.type === 'jcreatepp_if_else') {
        let elseBlock = block.getInputTargetBlock('ELSE');
        while (elseBlock) {
          const stmt = blockToStmt(elseBlock, eventType, generator, errors, inSequence, true);
          if (stmt) elseBody.push(stmt);
          elseBlock = elseBlock.getNextBlock();
        }
      }

      return { kind: 'if', condition, thenBody, elseBody: block.type === 'jcreatepp_if_else' ? elseBody : undefined };
    }

    case 'jcreatepp_if_edge': {
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      const body: Stmt[] = [];
      let stmtBlock = block.getInputTargetBlock('DO');
      while (stmtBlock) {
        const stmt = blockToStmt(stmtBlock, eventType, generator, errors, inSequence, true);
        if (stmt) body.push(stmt);
        stmtBlock = stmtBlock.getNextBlock();
      }
      return { kind: 'if_edge', condition, body, blockId: block.id };
    }

    case 'jcreatepp_sequence': {
      if (eventType === 'jcreatepp_on_update') {
        errors.push(`「${blockLabel(block.type)}」ブロックは「毎フレーム」の中には置けません。「開始時」または「インタラクト時」で使用してください。`);
        return null;
      }
      if (inSequence) {
        errors.push(`「${blockLabel(block.type)}」ブロックの中に、さらに「一連の動作」を入れることはできません（ネスト禁止）。`);
        return null;
      }
      const body: Stmt[] = [];
      let stmtBlock = block.getInputTargetBlock('DO');
      while (stmtBlock) {
        // Sequence body is advanced later by the onUpdate runner. If the sequence
        // itself is started from inside an if, waits inside the sequence body are
        // still valid sequence steps, not immediate waits inside that if branch.
        const stmt = blockToStmt(stmtBlock, eventType, generator, errors, true, false); // inSequence = true
        if (stmt) body.push(stmt);
        stmtBlock = stmtBlock.getNextBlock();
      }
      return { kind: 'sequence', id: block.id, body };
    }

    case 'jcreatepp_wait_seconds': {
      if (!inSequence) {
        errors.push(`「${blockLabel(block.type)}」は「一連の動作（完了まで待つ）」ブロックの中でしか使えません。`);
        return null;
      }
      if (inIf) {
        errors.push(`「${blockLabel(block.type)}」は「もし〜なら」などの条件分岐の中には置けません。`);
        return null;
      }
      const seconds = resolveValueExpr(block, 'SECONDS', eventType, generator, errors, inSequence);
      return { kind: 'wait_seconds', seconds };
    }

    case 'jcreatepp_wait_until': {
      if (!inSequence) {
        errors.push(`「${blockLabel(block.type)}」は「一連の動作（完了まで待つ）」ブロックの中でしか使えません。`);
        return null;
      }
      if (inIf) {
        errors.push(`「${blockLabel(block.type)}」は「もし〜なら」などの条件分岐の中には置けません。`);
        return null;
      }
      const conditionBlock = block.getInputTargetBlock('CONDITION');
      let condition: BoolExpr;
      if (conditionBlock) {
        validateValueBlockContext(conditionBlock, eventType, errors, inSequence);
        condition = blockToBoolExpr(conditionBlock, eventType, generator, errors, inSequence);
      } else {
        condition = { kind: 'raw_bool', code: 'false' };
      }
      return { kind: 'wait_until', condition };
    }

    case 'jcreatepp_run_for_seconds': {
      if (!inSequence) {
        errors.push('「N秒間、毎フレーム実行する」は「一連の動作」の中でしか使えません。');
        return null;
      }
      if (inIf) {
        errors.push('「N秒間、毎フレーム実行する」は「もし」などの条件分岐の中には置けません。');
        return null;
      }
      const seconds = resolveValueExpr(block, 'SECONDS', eventType, generator, errors, inSequence);
      const body: Stmt[] = [];
      let stmtBlock = block.getInputTargetBlock('DO');
      while (stmtBlock) {
        const stmt = blockToStmt(stmtBlock, eventType, generator, errors, true, true);
        if (stmt) body.push(stmt);
        stmtBlock = stmtBlock.getNextBlock();
      }
      return { kind: 'run_for_seconds', seconds, body };
    }

    case 'jcreatepp_send_message_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!message.trim()) {
        errors.push('送信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      const range = resolveValueExpr(block, 'RANGE', eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'near', range }, message, block.id, condition);
    }

    case 'jcreatepp_send_message_value_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!message.trim()) {
        errors.push('送信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      const range = resolveValueExpr(block, 'RANGE', eventType, generator, errors, inSequence);
      const value = messageSendValueFromBlock(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'near', range }, message, block.id, condition, value);
    }

    case 'jcreatepp_send_message_to_item_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      const itemName = block.getFieldValue('ITEM_NAME') || '';
      if (!itemName.trim()) {
        errors.push('送信先アイテムの参照名を入力してください。');
        return null;
      }
      if (!message.trim()) {
        errors.push('送信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'world_item', itemName }, message, block.id, condition);
    }

    case 'jcreatepp_send_message_value_to_item_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      const itemName = block.getFieldValue('ITEM_NAME') || '';
      if (!itemName.trim()) {
        errors.push('送信先アイテムの参照名を入力してください。');
        return null;
      }
      if (!message.trim()) {
        errors.push('送信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      const value = messageSendValueFromBlock(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'world_item', itemName }, message, block.id, condition, value);
    }

    case 'jcreatepp_reply_message_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      if (eventType !== 'jcreatepp_on_receive') {
        errors.push('「送ってきた相手に返す」は「メッセージを受け取ったとき」の中でのみ使えます。');
        return null;
      }
      if (inSequence) {
        errors.push('「送ってきた相手に返す」は「一連の動作」の中では使えません。受信した瞬間の処理として置いてください。');
        return null;
      }
      if (!message.trim()) {
        errors.push('返信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'sender' }, message, block.id, condition, undefined, false);
    }

    case 'jcreatepp_reply_message_value_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      if (eventType !== 'jcreatepp_on_receive') {
        errors.push('「送ってきた相手に返す」は「メッセージを受け取ったとき」の中でのみ使えます。');
        return null;
      }
      if (inSequence) {
        errors.push('「送ってきた相手に返す」は一連の動作の中では使えません。受信した瞬間の処理として置いてください。');
        return null;
      }
      if (!message.trim()) {
        errors.push('返信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      const value = messageSendValueFromBlock(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'sender' }, message, block.id, condition, value, false);
    }

    case 'jcreatepp_send_message_to_collision_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!ensureCollideContext(eventType, errors) || !message.trim()) {
        if (!message.trim()) errors.push('送信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'handle', handle: collisionHandle() }, message, block.id, condition);
    }

    case 'jcreatepp_send_message_value_to_collision_once': {
      const message = block.getFieldValue('MESSAGE') || '';
      if (!ensureCollideContext(eventType, errors) || !message.trim()) {
        if (!message.trim()) errors.push('送信するメッセージ名を入力してください。');
        return null;
      }
      const condition = conditionFromInput(block, eventType, generator, errors, inSequence);
      const value = messageSendValueFromBlock(block, eventType, generator, errors, inSequence);
      return sendMessageStmt({ kind: 'handle', handle: collisionHandle() }, message, block.id, condition, value);
    }

    default:
      if (block.type === 'jcreatepp_compare' || block.type === 'jcreatepp_not' || block.type === 'jcreatepp_and' || block.type === 'jcreatepp_or') {
        errors.push(`「${blockLabel(block.type)}」は単独で置くことはできません。`);
        return null;
      }
      errors.push(`未対応のブロック: ${block.type}`);
      return null;
  }
}

// ── Expr 変換 ──

/**
 * value input に接続されたブロックを型付き Expr に変換する。
 * 文脈チェックも同時に行う。
 */
function resolveValueExpr(
  parentBlock: Blockly.Block,
  inputName: string,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean = false,
): Expr {
  const valueBlock = parentBlock.getInputTargetBlock(inputName);

  if (!valueBlock) {
    // 接続なし → デフォルト 0
    return numberLiteral(0);
  }

  // 文脈チェック
  validateValueBlockContext(valueBlock, eventType, errors, inSequence);

  return blockToExpr(valueBlock, eventType, generator, errors, inSequence);
}

/**
 * 値ブロックを IR Expr に変換する。
 */
function blockToExpr(
  block: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean = false,
): Expr {
  switch (block.type) {
    case 'math_number': {
      const value = Number(block.getFieldValue('NUM')) || 0;
      return numberLiteral(value);
    }

    case 'jcreatepp_string_literal':
      return stringLiteral(block.getFieldValue('TEXT') || '');

    case 'jcreatepp_delta_time':
      return deltaTime();

    case 'jcreatepp_player':
      return playerRef();

    case 'jcreatepp_number_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!name.trim()) {
        errors.push('数値変数名を入力してください。');
        return numberLiteral(0);
      }
      if (isReservedNumberVarName(name)) {
        errors.push('jpp / __jpp_ から始まる数値変数名は使用できません。');
        return numberLiteral(0);
      }
      return numberVar(name);
    }

    case 'jcreatepp_string_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!validateUserStateName(name, '文字変数名', errors)) return stringLiteral('');
      return stringVar(name);
    }

    case 'jcreatepp_collision_target': {
      if (!ensureCollideContext(eventType, errors)) return raw('null');
      return collisionHandle();
    }

    case 'jcreatepp_arithmetic': {
      const opRaw = block.getFieldValue('OP');
      const validOps = new Set(['ADD', 'SUB', 'MUL', 'DIV']);
      const operator = (validOps.has(opRaw) ? opRaw : 'ADD') as 'ADD' | 'SUB' | 'MUL' | 'DIV';
      const left = resolveValueExpr(block, 'A', eventType, generator, errors, inSequence);
      const right = resolveValueExpr(block, 'B', eventType, generator, errors, inSequence);
      return binary(operator, left, right);
    }

    case 'jcreatepp_random_number': {
      const modeRaw = block.getFieldValue('MODE');
      const mode = modeRaw === 'integer' ? 'integer' : 'float';
      const min = resolveValueExpr(block, 'MIN', eventType, generator, errors, inSequence);
      const max = resolveValueExpr(block, 'MAX', eventType, generator, errors, inSequence);
      return randomNumber(min, max, mode);
    }

    case 'jcreatepp_players_near_count': {
      const range = resolveValueExpr(block, 'RANGE', eventType, generator, errors, inSequence);
      return playersNearCount(range);
    }

    case 'jcreatepp_cooldown_remaining': {
      const name = block.getFieldValue('COOLDOWN_NAME') || '';
      if (!name.trim()) {
        errors.push('クールダウン名を入力してください。');
        return numberLiteral(0);
      }
      if (isReservedSystemName(name)) {
        errors.push('jpp / __jpp_ から始まるクールダウン名は使用できません。');
        return numberLiteral(0);
      }
      return cooldownRemaining(name);
    }

    case 'jcreatepp_message_value_number':
      return messageValue('number');

    case 'jcreatepp_message_value_string':
      return messageValue('string');

    default: {
      // フォールバック: valueToCode で JS 文字列を取得
      // 親ブロックから valueToCode を呼ぶ必要があるため、raw でラップ
      const parent = block.getParent();
      if (parent) {
        // 親の input を見つけてそこから valueToCode
        for (const input of parent.inputList) {
          if (input.connection && input.connection.targetBlock() === block) {
            const code = generator.valueToCode(parent, input.name, Order.NONE) || '0';
            return raw(code);
          }
        }
      }
      return raw('0');
    }
  }
}

/**
 * 条件ブロックを BoolExpr に変換する。
 */
function blockToBoolExpr(
  block: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean = false,
): BoolExpr {
  switch (block.type) {
    case 'jcreatepp_compare': {
      const opRaw = block.getFieldValue('OP');
      const validOps = new Set(['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE']);
      const operator = (validOps.has(opRaw) ? opRaw : 'EQ') as 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE';
      const left = resolveValueExpr(block, 'A', eventType, generator, errors, inSequence);
      const right = resolveValueExpr(block, 'B', eventType, generator, errors, inSequence);
      return { kind: 'compare', operator, left, right };
    }

    case 'jcreatepp_not': {
      const targetBlock = block.getInputTargetBlock('BOOL');
      if (!targetBlock) {
        return { kind: 'raw_bool', code: 'false' };
      }
      return not(blockToBoolExpr(targetBlock, eventType, generator, errors, inSequence));
    }

    case 'jcreatepp_and': {
      const blockA = block.getInputTargetBlock('A');
      const blockB = block.getInputTargetBlock('B');
      const exprA = blockA ? blockToBoolExpr(blockA, eventType, generator, errors, inSequence) : { kind: 'raw_bool', code: 'false' } as BoolExpr;
      const exprB = blockB ? blockToBoolExpr(blockB, eventType, generator, errors, inSequence) : { kind: 'raw_bool', code: 'false' } as BoolExpr;
      return and(exprA, exprB);
    }

    case 'jcreatepp_or': {
      const blockA = block.getInputTargetBlock('A');
      const blockB = block.getInputTargetBlock('B');
      const exprA = blockA ? blockToBoolExpr(blockA, eventType, generator, errors, inSequence) : { kind: 'raw_bool', code: 'false' } as BoolExpr;
      const exprB = blockB ? blockToBoolExpr(blockB, eventType, generator, errors, inSequence) : { kind: 'raw_bool', code: 'false' } as BoolExpr;
      return or(exprA, exprB);
    }

    case 'jcreatepp_flag': {
      const name = block.getFieldValue('FLAG_NAME') || '';
      return { kind: 'flag', name };
    }

    case 'jcreatepp_cooldown_active': {
      const name = block.getFieldValue('COOLDOWN_NAME') || '';
      if (!name.trim()) {
        errors.push('クールダウン名を入力してください。');
        return { kind: 'raw_bool', code: 'false' };
      }
      if (isReservedSystemName(name)) {
        errors.push('jpp / __jpp_ から始まるクールダウン名は使用できません。');
        return { kind: 'raw_bool', code: 'false' };
      }
      return { kind: 'cooldown_active', name };
    }

    case 'jcreatepp_bool_var': {
      const name = block.getFieldValue('VAR_NAME') || '';
      if (!validateUserStateName(name, '真偽値変数名', errors)) {
        return { kind: 'raw_bool', code: 'false' };
      }
      return { kind: 'bool_var', name };
    }

    case 'jcreatepp_bool_literal':
      return { kind: 'bool_literal', value: block.getFieldValue('VALUE') === 'true' };

    case 'jcreatepp_message_value_boolean':
      return { kind: 'message_value_bool' };

    case 'jcreatepp_players_near': {
      const range = resolveValueExpr(block, 'RANGE', eventType, generator, errors, inSequence);
      return { kind: 'players_near', range };
    }

    case 'jcreatepp_raycast_forward': {
      const distance = resolveValueExpr(block, 'DISTANCE', eventType, generator, errors, inSequence);
      const target = block.getFieldValue('TARGET') as RaycastTarget;
      return { kind: 'raycast_forward', distance, target };
    }

    default:
      // 未知のブロックが繋がっている場合
      errors.push(`条件として使えないブロックが接続されています: ${block.type}`);
      return { kind: 'raw_bool', code: 'false' };
  }
}

function conditionFromInput(
  block: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean,
): BoolExpr {
  return conditionFromNamedInput(block, 'CONDITION', eventType, generator, errors, inSequence);
}

function conditionFromNamedInput(
  block: Blockly.Block,
  inputName: string,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean,
): BoolExpr {
  const conditionBlock = block.getInputTargetBlock(inputName);
  if (!conditionBlock) {
    return { kind: 'raw_bool', code: 'false' };
  }
  validateValueBlockContext(conditionBlock, eventType, errors, inSequence);
  return blockToBoolExpr(conditionBlock, eventType, generator, errors, inSequence);
}

function messageSendValueFromBlock(
  block: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean,
): MessageSendValue {
  const valueTypeRaw = block.getFieldValue('VALUE_TYPE');
  const valueType = valueTypeRaw === 'string' || valueTypeRaw === 'boolean' || valueTypeRaw === 'handle' ? valueTypeRaw : 'number';

  if (valueType === 'string') {
    const valueBlock = block.getInputTargetBlock('VALUE');
    if (!valueBlock) {
      return { valueType: 'string', value: stringLiteral(block.getFieldValue('TEXT_VALUE') || '') };
    }
    validateValueBlockContext(valueBlock, eventType, errors, inSequence);
    return { valueType: 'string', value: blockToStringExpr(valueBlock, eventType, generator, errors, inSequence) };
  }

  const valueBlock = block.getInputTargetBlock('VALUE');
  if (valueType === 'boolean') {
    if (valueBlock) {
      validateValueBlockContext(valueBlock, eventType, errors, inSequence);
      return { valueType: 'boolean', value: blockToBoolExpr(valueBlock, eventType, generator, errors, inSequence) };
    }
    return { valueType: 'boolean', value: { kind: 'raw_bool', code: 'false' } };
  }

  if (valueType === 'handle') {
    if (valueBlock) {
      validateValueBlockContext(valueBlock, eventType, errors, inSequence);
      return { valueType: 'handle', value: blockToHandleExpr(valueBlock, eventType, errors) };
    }
    return { valueType: 'handle', value: raw('null') };
  }

  if (valueBlock) {
    validateValueBlockContext(valueBlock, eventType, errors, inSequence);
  }
  return {
    valueType: 'number',
    value: valueBlock ? blockToExpr(valueBlock, eventType, generator, errors, inSequence) : numberLiteral(0),
  };
}

function sendMessageStmt(
  target: MessageTarget,
  message: string,
  blockId: string,
  condition?: BoolExpr,
  value?: MessageSendValue,
  edgeOnce: boolean = true,
): Stmt {
  return { kind: 'send_message', target, message, condition, value, edgeOnce, blockId };
}

function blockToHandleExpr(
  block: Blockly.Block,
  eventType: EventContext,
  errors: string[],
): Expr {
  if (block.type === 'jcreatepp_collision_target') {
    if (!ensureCollideContext(eventType, errors)) return raw('null');
    return collisionHandle();
  }
  errors.push(`ハンドル値として使えないブロックが接続されています: ${block.type}`);
  return raw('null');
}

function blockToStringExpr(
  block: Blockly.Block,
  eventType: EventContext,
  generator: Blockly.CodeGenerator,
  errors: string[],
  inSequence: boolean,
): Expr {
  switch (block.type) {
    case 'jcreatepp_string_literal':
    case 'jcreatepp_message_value_string':
    case 'jcreatepp_string_var':
      return blockToExpr(block, eventType, generator, errors, inSequence);
    default:
      errors.push(`文字値として使えないブロックが接続されています: ${block.type}`);
      return stringLiteral('');
  }
}

/**
 * 値ブロックの文脈チェック。違反があれば errors に追加する。
 * ネストされた値ブロック（compare の A/B 入力など）も再帰的にチェックする。
 */
function validateValueBlockContext(
  block: Blockly.Block,
  eventType: EventContext,
  errors: string[],
  inSequence: boolean = false,
): void {
  const rules = BLOCK_CONTEXT_RULES[block.type];
  if (rules !== undefined && rules.length > 0) {
    if (!isContextAllowed(block.type, eventType)) {
      const allowedNames = rules.map(r => `「${eventLabel(r)}」`).join(' / ');
      errors.push(
        `「${valueBlockLabel(block.type)}」は${allowedNames}の中でのみ使えます。`
      );
    }
  }

  // Sequence 内での player 使用禁止
  if (block.type === 'jcreatepp_player' && inSequence) {
    errors.push(`「プレイヤー」は Sequence（一連の動作）の中では使えません。プレイヤー値はインタラクト直下の即時処理でのみ使用できます。`);
  }

  // 再帰: このブロックの value input に接続された子ブロックもチェック
  if (
    inSequence &&
    (
      block.type === 'jcreatepp_message_value_number' ||
      block.type === 'jcreatepp_message_value_string' ||
      block.type === 'jcreatepp_message_value_boolean'
    )
  ) {
    errors.push('受け取った値は一連の動作の中では使えません。受信した瞬間の処理として使ってください。');
  }

  for (const input of block.inputList) {
    if (input.connection && input.connection.targetBlock()) {
      const child = input.connection.targetBlock();
      if (child) {
        validateValueBlockContext(child, eventType, errors, inSequence);
      }
    }
  }
}

// ── ヘルパー ──

function assignHandler(program: Program, type: EventContext, handler: Handler): void {
  switch (type) {
    case 'jcreatepp_on_start':
      program.onStart = handler;
      break;
    case 'jcreatepp_on_update':
      program.onUpdate = handler;
      break;
    case 'jcreatepp_on_interact':
      program.onInteract = handler;
      break;
    case 'jcreatepp_on_collide':
      program.onCollide = handler;
      break;
    case 'jcreatepp_on_grab_start':
      program.onGrabStart = handler;
      break;
    case 'jcreatepp_on_grab_end':
      program.onGrabEnd = handler;
      break;
  }
}

function isPlayerEventContext(type: EventContext): boolean {
  return type === 'jcreatepp_on_interact' || type === 'jcreatepp_on_grab_start' || type === 'jcreatepp_on_grab_end';
}

function isReservedNumberVarName(name: string): boolean {
  return name.startsWith('__jpp_') || name.startsWith('jpp.');
}

function isReservedSystemName(name: string): boolean {
  return name.startsWith('__jpp_') || name.startsWith('jpp.');
}

function validateUserStateName(name: string, label: string, errors: string[]): boolean {
  if (!name.trim()) {
    errors.push(`${label}を入力してください。`);
    return false;
  }
  if (isReservedSystemName(name)) {
    errors.push(`${label}に jpp. / __jpp_ から始まる名前は使えません。`);
    return false;
  }
  return true;
}

function ensureCollideContext(eventType: EventContext, errors: string[]): boolean {
  if (eventType !== 'jcreatepp_on_collide') {
    errors.push('衝突相手は「衝突したとき」の中でのみ使えます。');
    return false;
  }
  return true;
}

/** ブロック type → 日本語ラベル */
function blockLabel(type: string): string {
  switch (type) {
    case 'jcreatepp_on_start': return '「開始時」';
    case 'jcreatepp_on_update': return '「毎フレーム」';
    case 'jcreatepp_on_interact': return '「インタラクト時」';
    case 'jcreatepp_on_collide': return '「衝突したとき」';
    case 'jcreatepp_on_grab_start': return '「持ったとき」';
    case 'jcreatepp_on_grab_end': return '「離したとき」';
    case 'jcreatepp_on_receive': return '「メッセージを受け取ったとき」';
    case 'jcreatepp_set_position': return '「位置を〜にする」';
    case 'jcreatepp_add_position': return '「位置を〜ずつ変える」';
    case 'jcreatepp_set_rotation': return '「角度を〜にする」';
    case 'jcreatepp_add_rotation': return '「角度を〜ずつ変える」';
    case 'jcreatepp_continuous_rotation': return '「回転し続ける」';
    case 'jcreatepp_timed_random_warp': return '「一定間隔でランダムワープ」';
    case 'jcreatepp_timed_move_return': return '「一定時間移動して戻る」';
    case 'jcreatepp_set_move_speed': return '「プレイヤーの移動速度倍率を変える」';
    case 'jcreatepp_set_jump_speed': return '「プレイヤーのジャンプ速度倍率を変える」';
    case 'jcreatepp_if': return '「もし〜なら」';
    case 'jcreatepp_if_else': return '「もし〜なら、でなければ」';
    case 'jcreatepp_sequence': return '「一連の動作（完了まで待つ）」';
    case 'jcreatepp_wait_seconds': return '「〜秒待つ」';
    case 'jcreatepp_wait_until': return '「〜まで待つ」';
    case 'jcreatepp_run_for_seconds': return '「N秒間、毎フレーム実行する」';
    case 'jcreatepp_compare': return '「比較条件」';
    case 'jcreatepp_not': return '「〜ではない」';
    case 'jcreatepp_and': return '「かつ」';
    case 'jcreatepp_or': return '「または」';
    case 'jcreatepp_delta_time': return '「経過時間」';
    case 'jcreatepp_player': return '「プレイヤー」';
    default: return type;
  }
}
