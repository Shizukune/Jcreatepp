/**
 * Jcreate++ カスタムブロック定義
 *
 * イベント系 (top-level only, hat 形状):
 *   - 開始時   → $.onStart
 *   - 毎フレーム → $.onUpdate
 *   - インタラクト時 → $.onInteract
 *
 * 動作系 (位置設定 / 回転設定):
 *   - 移動 (move)   = 位置設定系 → $.setPosition
 *   - 回転 (rotate) = 回転設定系 → $.setRotation
 *
 * Cluster Script Reference:
 *   https://docs.cluster.mu/script/interfaces/ClusterScript.html
 */

import * as Blockly from 'blockly/core';

// ── イベントブロック ──
// hat 形状: previousStatement / nextStatement なし → 他のブロックの中に入れられない
// 同種イベントの重複禁止は validator.ts で検出する

const onStart = {
  type: 'jcreatepp_on_start',
  message0: '開始時 %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'アイテムが空間に現れたとき、1回だけ実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart',
  hat: 'cap',
};

const onUpdate = {
  type: 'jcreatepp_on_update',
  message0: '毎フレーム %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'フレームごとに繰り返し実行されます（deltaTime 付き）',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate',
  hat: 'cap',
};

const onInteract = {
  type: 'jcreatepp_on_interact',
  message0: 'インタラクト時 %1 %2',
  args0: [
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' },
  ],
  colour: 45,
  tooltip: 'プレイヤーがアイテムに「使う」動作をしたときに実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract',
  hat: 'cap',
};

// ── 動作ブロック ──
// previousStatement / nextStatement あり → イベントの body に接続可能

const setPositionBlock = {
  type: 'jcreatepp_set_position',
  message0: '位置を x: %1 y: %2 z: %3 にする',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムを指定した絶対座標に移動します',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const addPositionBlock = {
  type: 'jcreatepp_add_position',
  message0: '位置を x: %1 y: %2 z: %3 ずつ変える',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在の位置から、指定した座標分だけ相対的に移動します',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const setRotationBlock = {
  type: 'jcreatepp_set_rotation',
  message0: '角度を x: %1 y: %2 z: %3 にする',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムの角度を指定した絶対角度にします',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

const addRotationBlock = {
  type: 'jcreatepp_add_rotation',
  message0: '角度を x: %1 y: %2 z: %3 ずつ変える',
  args0: [
    { type: 'input_value', name: 'X', check: 'Number' },
    { type: 'input_value', name: 'Y', check: 'Number' },
    { type: 'input_value', name: 'Z', check: 'Number' },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: '現在の角度から、指定した角度分だけ回転させます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

// ── 制御ブロック ──

const ifBlock = {
  type: 'jcreatepp_if',
  message0: 'もし %1 なら %2 %3',
  args0: [
    { type: 'input_value', name: 'CONDITION', check: 'Boolean' },
    { type: 'input_dummy' },
    { type: 'input_statement', name: 'DO' }
  ],
  previousStatement: null,
  nextStatement: null,
  colour: 120,
  tooltip: '条件が true のときだけ中身を実行します',
  helpUrl: '',
};

// ── 条件ブロック ──

const compareBlock = {
  type: 'jcreatepp_compare',
  message0: '%1 %2 %3',
  args0: [
    { type: 'input_value', name: 'A', check: 'Number' },
    {
      type: 'field_dropdown',
      name: 'OP',
      options: [
        ['=', 'EQ'],
        ['!=', 'NEQ'],
        ['<', 'LT'],
        ['<=', 'LTE'],
        ['>', 'GT'],
        ['>=', 'GTE']
      ]
    },
    { type: 'input_value', name: 'B', check: 'Number' }
  ],
  output: 'Boolean',
  colour: 210,
  inputsInline: true,
  tooltip: '2つの値を比較して真偽値を返します',
  helpUrl: '',
};

// ブロック定義をエクスポート
export const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
  onStart,
  onUpdate,
  onInteract,
  setPositionBlock,
  addPositionBlock,
  setRotationBlock,
  addRotationBlock,
  ifBlock,
  compareBlock,
]);
