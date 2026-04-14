/**
 * Jcreate++ カスタムブロック定義
 * イベント系: 開始時, 毎フレーム, インタラクト時
 * 動作系: 移動, 回転
 */

import * as Blockly from 'blockly/core';

// ── イベントブロック ──

const onStart = {
  type: 'jcreatepp_on_start',
  message0: '開始時 %1 %2',
  args0: [
    {
      type: 'input_dummy',
    },
    {
      type: 'input_statement',
      name: 'DO',
    },
  ],
  colour: 45,
  tooltip: 'アイテムが空間に現れたとき、1回だけ実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart',
};

const onUpdate = {
  type: 'jcreatepp_on_update',
  message0: '毎フレーム %1 %2',
  args0: [
    {
      type: 'input_dummy',
    },
    {
      type: 'input_statement',
      name: 'DO',
    },
  ],
  colour: 45,
  tooltip: 'フレームごとに繰り返し実行されます（deltaTime 付き）',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate',
};

const onInteract = {
  type: 'jcreatepp_on_interact',
  message0: 'インタラクト時 %1 %2',
  args0: [
    {
      type: 'input_dummy',
    },
    {
      type: 'input_statement',
      name: 'DO',
    },
  ],
  colour: 45,
  tooltip: 'プレイヤーがアイテムに「使う」動作をしたときに実行されます',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract',
};

// ── 動作ブロック ──

const moveObject = {
  type: 'jcreatepp_move',
  message0: '移動  x: %1  y: %2  z: %3',
  args0: [
    {
      type: 'input_value',
      name: 'X',
      check: 'Number',
    },
    {
      type: 'input_value',
      name: 'Y',
      check: 'Number',
    },
    {
      type: 'input_value',
      name: 'Z',
      check: 'Number',
    },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムを指定座標に移動します',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setposition',
};

const rotateObject = {
  type: 'jcreatepp_rotate',
  message0: '回転  角度: %1',
  args0: [
    {
      type: 'input_value',
      name: 'ANGLE',
      check: 'Number',
    },
  ],
  inputsInline: true,
  previousStatement: null,
  nextStatement: null,
  colour: 210,
  tooltip: 'アイテムを指定角度で回転します',
  helpUrl: 'https://docs.cluster.mu/script/interfaces/ClusterScript.html#setrotation',
};

// ブロック定義をエクスポート
export const blocks = Blockly.common.createBlockDefinitionsFromJsonArray([
  onStart,
  onUpdate,
  onInteract,
  moveObject,
  rotateObject,
]);
