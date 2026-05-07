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
 * 5. Program + errors + warnings を返す
 */

import * as Blockly from 'blockly/core';
import { Order } from 'blockly/javascript';
import type { Program, Handler, Stmt, BoolExpr } from '../ir';
import { raw } from '../ir';

// ── イベントブロック type 一覧 ──
const EVENT_BLOCK_TYPES = [
  'jcreatepp_on_start',
  'jcreatepp_on_update',
  'jcreatepp_on_interact',
] as const;

type EventBlockType = typeof EVENT_BLOCK_TYPES[number];

function isEventBlock(type: string): type is EventBlockType {
  return EVENT_BLOCK_TYPES.includes(type as EventBlockType);
}

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

  const topBlocks = workspace.getTopBlocks(true);
  console.log('topBlocks:', topBlocks.map(b => b.type + '(' + b.id + ')'));

  for (const block of topBlocks) {
    const type = block.type;

    if (isEventBlock(type)) {
      // 重複カウント
      eventCounts[type] = (eventCounts[type] || 0) + 1;

      if (eventCounts[type] > 1) {
        errors.push(`${blockLabel(type)} が複数あります。同種イベントは1つまでです。`);
        continue; // 2個目以降は無視
      }

      const handler = blockToHandler(block, generator, errors);
      assignHandler(program, type, handler);
    } else {
      // 動作ブロックがトップレベルにある場合
      if (
        block.type === 'jcreatepp_set_position' ||
        block.type === 'jcreatepp_add_position' ||
        block.type === 'jcreatepp_set_rotation' ||
        block.type === 'jcreatepp_add_rotation'
      ) {
        errors.push(`「${blockLabel(type)}」がイベントブロックの外にあります。イベントブロックの中に配置してください。`);
      }
    }
  }

  return { program, errors, warnings };
}

// ── ハンドラ変換 ──

function blockToHandler(
  eventBlock: Blockly.Block,
  generator: Blockly.CodeGenerator,
  errors: string[],
): Handler {
  const body: Stmt[] = [];

  // statement チェインを走査
  let stmtBlock = eventBlock.getInputTargetBlock('DO');
  while (stmtBlock) {
    const stmt = blockToStmt(stmtBlock, generator, errors);
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
  generator: Blockly.CodeGenerator,
  errors: string[],
): Stmt | null {
  switch (block.type) {
    case 'jcreatepp_set_position': {
      const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
      const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
      const z = generator.valueToCode(block, 'Z', Order.NONE) || '0';
      return { kind: 'set_position', x: raw(x), y: raw(y), z: raw(z) };
    }

    case 'jcreatepp_add_position': {
      const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
      const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
      const z = generator.valueToCode(block, 'Z', Order.NONE) || '0';
      return { kind: 'add_position', x: raw(x), y: raw(y), z: raw(z) };
    }

    case 'jcreatepp_set_rotation': {
      const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
      const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
      const z = generator.valueToCode(block, 'Z', Order.NONE) || '0';
      return { kind: 'set_rotation', x: raw(x), y: raw(y), z: raw(z) };
    }

    case 'jcreatepp_add_rotation': {
      const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
      const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
      const z = generator.valueToCode(block, 'Z', Order.NONE) || '0';
      return { kind: 'add_rotation', x: raw(x), y: raw(y), z: raw(z) };
    }

    case 'jcreatepp_if': {
      // 制御ブロック
      // CONDITION が繋がっていない場合は null になるため 'false' をデフォルトにする
      const conditionCode = generator.valueToCode(block, 'CONDITION', Order.NONE) || 'false';
      const condition: BoolExpr = { kind: 'raw_bool', code: conditionCode };
      
      const thenBody: Stmt[] = [];
      let thenBlock = block.getInputTargetBlock('DO');
      while (thenBlock) {
        const stmt = blockToStmt(thenBlock, generator, errors);
        if (stmt) thenBody.push(stmt);
        thenBlock = thenBlock.getNextBlock();
      }

      return { kind: 'if', condition, thenBody };
    }

    default:
      // 未対応ブロックなら
      // ただし Expr系ブロック (compare) が Stmt の場所に置かれた場合は無視するべきか？
      if (block.type === 'jcreatepp_compare') {
        // 値を返すブロックは Statement として実行できない
        errors.push(`「${blockLabel(block.type)}」は単独で置くことはできません。`);
        return null;
      }
      // 将来: if / wait / send_signal 等をここに追加
      errors.push(`未対応のブロック: ${block.type}`);
      return null;
  }
}

// ── Expr 変換 ──
// 現状は javascriptGenerator.valueToCode に任せているため、
// 独自の Expr 生成を行う場合はここに関数を定義する。
// 今回の compare ブロックは javascriptGenerator.forBlock ではなく、
// 本来ならここで自前変換するべきだが、valueToCode が generator 内の定義を要求するため、
// src/index.ts のダミージェネレータではなく、ここで本物の JS コードを返すように
// javascriptGenerator に登録するか、valueToCode をオーバーライドする必要がある。
// Jcreate++ の設計上、generator(javascriptGenerator) に直接定義を注入する方が Blockly 標準に沿う。
// そのため、ここはIR変換とは別に generator の定義として実装する方が早い。

// ── ヘルパー ──

function assignHandler(program: Program, type: EventBlockType, handler: Handler): void {
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
  }
}

/** ブロック type → 日本語ラベル */
function blockLabel(type: string): string {
  switch (type) {
    case 'jcreatepp_on_start': return '「開始時」';
    case 'jcreatepp_on_update': return '「毎フレーム」';
    case 'jcreatepp_on_interact': return '「インタラクト時」';
    case 'jcreatepp_set_position': return '「位置を〜にする」';
    case 'jcreatepp_add_position': return '「位置を〜ずつ変える」';
    case 'jcreatepp_set_rotation': return '「角度を〜にする」';
    case 'jcreatepp_add_rotation': return '「角度を〜ずつ変える」';
    case 'jcreatepp_if': return '「もし〜なら」';
    case 'jcreatepp_compare': return '「比較条件」';
    default: return type;
  }
}
