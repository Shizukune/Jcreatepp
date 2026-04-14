/**
 * Jcreate++ コード生成ロジック
 * Cluster Script Reference に基づいた JS コード生成
 *
 * 参照:
 * - $.onStart: https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart
 *   → callback: () => void （引数なし）
 * - $.onUpdate: https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate
 *   → callback: (deltaTime: number) => void
 * - $.onInteract: https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract
 *   → callback: (player: PlayerHandle) => void
 * - $.setPosition: Vector3 を受け取る
 * - $.setRotation: Quaternion を受け取る
 */

import {Order} from 'blockly/javascript';
import * as Blockly from 'blockly/core';

export const forBlock = Object.create(null);

// ── イベントブロック ──

forBlock['jcreatepp_on_start'] = function (
  block: Blockly.Block,
  generator: Blockly.CodeGenerator,
) {
  const statements = generator.statementToCode(block, 'DO');
  const code = `$.onStart(() => {\n${statements}});\n\n`;
  return code;
};

forBlock['jcreatepp_on_update'] = function (
  block: Blockly.Block,
  generator: Blockly.CodeGenerator,
) {
  const statements = generator.statementToCode(block, 'DO');
  const code = `$.onUpdate((deltaTime) => {\n${statements}});\n\n`;
  return code;
};

forBlock['jcreatepp_on_interact'] = function (
  block: Blockly.Block,
  generator: Blockly.CodeGenerator,
) {
  const statements = generator.statementToCode(block, 'DO');
  const code = `$.onInteract((player) => {\n${statements}});\n\n`;
  return code;
};

// ── 動作ブロック ──

forBlock['jcreatepp_move'] = function (
  block: Blockly.Block,
  generator: Blockly.CodeGenerator,
) {
  const x = generator.valueToCode(block, 'X', Order.NONE) || '0';
  const y = generator.valueToCode(block, 'Y', Order.NONE) || '0';
  const z = generator.valueToCode(block, 'Z', Order.NONE) || '0';
  // 将来的に $.setPosition(new Vector3(x, y, z)) に差し替え可能
  const code = `$.setPosition(new Vector3(${x}, ${y}, ${z}));\n`;
  return code;
};

forBlock['jcreatepp_rotate'] = function (
  block: Blockly.Block,
  generator: Blockly.CodeGenerator,
) {
  const angle = generator.valueToCode(block, 'ANGLE', Order.NONE) || '0';
  // 将来的に $.setRotation(new Quaternion().setFromEulerAngles(0, angle, 0)) に差し替え可能
  const code = `$.setRotation(new Quaternion().setFromEulerAngles(0, ${angle}, 0));\n`;
  return code;
};
