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
 */

import * as Blockly from 'blockly/core';

// イベントブロック type 一覧
const EVENT_BLOCK_TYPES = [
  'jcreatepp_on_start',
  'jcreatepp_on_update',
  'jcreatepp_on_interact',
];

// 動作ブロック type 一覧
const ACTION_BLOCK_TYPES = [
  'jcreatepp_set_position',
  'jcreatepp_add_position',
  'jcreatepp_set_rotation',
  'jcreatepp_add_rotation',
];

/** ブロック type → 日本語ラベル */
function eventLabel(type: string): string {
  switch (type) {
    case 'jcreatepp_on_start': return '開始時';
    case 'jcreatepp_on_update': return '毎フレーム';
    case 'jcreatepp_on_interact': return 'インタラクト時';
    default: return type;
  }
}

/**
 * ワークスペースの全ブロックを走査し、リアルタイム警告を更新する。
 * workspace.addChangeListener() から呼び出す。
 */
export function validateWorkspace(workspace: Blockly.Workspace): void {
  const allBlocks = workspace.getAllBlocks(false);

  // 1. 同種イベントブロックの重複検出
  const eventBlocksByType: Record<string, Blockly.Block[]> = {};

  for (const block of allBlocks) {
    if (EVENT_BLOCK_TYPES.includes(block.type)) {
      if (!eventBlocksByType[block.type]) {
        eventBlocksByType[block.type] = [];
      }
      eventBlocksByType[block.type].push(block);
    }
  }

  // イベントブロックの警告を更新
  for (const type of EVENT_BLOCK_TYPES) {
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

  // 2. 動作ブロックがイベント外にある検出
  for (const block of allBlocks) {
    if (ACTION_BLOCK_TYPES.includes(block.type)) {
      if (!isInsideEvent(block)) {
        block.setWarningText(
          'このブロックはイベントブロックの中に配置してください。\n（開始時 / 毎フレーム / インタラクト時）',
        );
      } else {
        block.setWarningText(null);
      }
    }
  }
}

/**
 * ブロックがイベントブロックの中にあるかどうかを判定する。
 * parent チェインを辿ってイベントブロックに到達すれば true。
 */
function isInsideEvent(block: Blockly.Block): boolean {
  let current: Blockly.Block | null = block.getSurroundParent();
  while (current) {
    if (EVENT_BLOCK_TYPES.includes(current.type)) {
      return true;
    }
    current = current.getSurroundParent();
  }
  return false;
}
