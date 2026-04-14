/**
 * Jcreate++ MVP Demo - メインエントリポイント
 */

import * as Blockly from 'blockly';
import {blocks} from './blocks/jcreatepp';
import {forBlock} from './generators/jcreatepp';
import {javascriptGenerator} from 'blockly/javascript';
import {save, load, saveToFile, loadFromFile} from './serialization';
import {toolbox} from './toolbox';
import './index.css';

// カスタムブロックとジェネレーターを登録
Blockly.common.defineBlocks(blocks);
Object.assign(javascriptGenerator.forBlock, forBlock);

// DOM 要素の取得
const blocklyDiv = document.getElementById('blocklyDiv');
const codeEl = document.getElementById('generatedCode')?.querySelector('code');
const btnGenerate = document.getElementById('btnGenerate');
const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');

if (!blocklyDiv) {
  throw new Error("div with id 'blocklyDiv' not found");
}

// Blockly ワークスペースを生成
const ws = Blockly.inject(blocklyDiv, {
  toolbox,
  grid: {
    spacing: 20,
    length: 3,
    colour: '#2a2a4a',
    snap: true,
  },
  zoom: {
    controls: true,
    wheel: true,
    startScale: 1.0,
    maxScale: 3,
    minScale: 0.3,
    scaleSpeed: 1.2,
  },
  trashcan: true,
});

// JS生成
const generateCode = () => {
  const code = javascriptGenerator.workspaceToCode(ws as Blockly.Workspace);
  if (codeEl) {
    codeEl.textContent = code || '// ブロックが配置されていません';
  }
};

// ボタンイベント
btnGenerate?.addEventListener('click', generateCode);
btnSave?.addEventListener('click', () => saveToFile(ws));
btnLoad?.addEventListener('click', () => loadFromFile(ws));

// デバッグ・テスト用にグローバルに公開
(window as any).Blockly = Blockly;
(window as any).workspace = ws;
(window as any).generateCode = generateCode;

// localStorage から復元
if (ws) {
  load(ws);

  // ワークスペース変更時に localStorage へ自動保存
  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.isUiEvent) return;
    save(ws);
  });
}
