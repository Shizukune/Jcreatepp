/**
 * Jcreate++ MVP Demo — メインエントリポイント
 *
 * ── 処理フロー ──
 * 1. Blockly ワークスペースを生成
 * 2. カスタムブロックを登録
 * 3. リアルタイム警告を changeListener で実行
 * 4. JS生成ボタン:
 *    a. workspaceToProgram() で IR (Program) に変換
 *    b. エラーがあればコードペインにエラー表示（生成中断）
 *    c. programToJS() で JS 文字列に変換
 * 5. JS保存 / workspace保存 / workspace読込
 */

import * as Blockly from 'blockly';
import { blocks } from './blocks/jcreatepp';
import { javascriptGenerator } from 'blockly/javascript';
import { workspaceToProgram } from './generators/jcreatepp';
import { programToJS } from './codegen';
import { validateWorkspace } from './validator';
import { save, load, saveToFile, loadFromFile } from './serialization';
import { toolbox } from './toolbox';
import './index.css';

// カスタムブロックを登録
Blockly.common.defineBlocks(blocks);

// DOM 要素の取得
const blocklyDiv = document.getElementById('blocklyDiv');
const codeEl = document.getElementById('generatedCode')?.querySelector('code');
const errorEl = document.getElementById('errorMessages');
const btnGenerate = document.getElementById('btnGenerate');
const btnDownloadJS = document.getElementById('btnDownloadJS');
const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');
const btnClear = document.getElementById('btnClear');

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

// ── JS生成 ──

let lastGeneratedCode = '';

const generateCode = () => {
  // 1. ブロック → IR 変換（エラー検出含む）
  const result = workspaceToProgram(ws as Blockly.Workspace, javascriptGenerator as any);

  // 2. エラーがあれば表示して中断
  if (result.errors.length > 0) {
    if (errorEl) {
      errorEl.textContent = result.errors.join('\n');
      errorEl.style.display = 'block';
    }
    if (codeEl) {
      codeEl.textContent = '// エラーがあるため生成できません';
    }
    lastGeneratedCode = '';
    return;
  }

  // エラーなし → エラー表示をクリア
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  // 3. IR → JS 変換
  const code = programToJS(result.program);
  lastGeneratedCode = code;

  if (codeEl) {
    codeEl.textContent = code;
  }
};

// ── ボタンイベント ──

btnGenerate?.addEventListener('click', generateCode);

btnDownloadJS?.addEventListener('click', () => {
  // 最新のコードを生成
  generateCode();

  if (!lastGeneratedCode) {
    alert('生成できるコードがありません');
    return;
  }

  const blob = new Blob([lastGeneratedCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = prompt('ファイル名を入力してください', 'main.js');
  if (!name) {
    URL.revokeObjectURL(url);
    return;
  }
  a.download = name.endsWith('.js') ? name : name + '.js';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

btnSave?.addEventListener('click', () => saveToFile(ws));
btnLoad?.addEventListener('click', () => loadFromFile(ws));

btnClear?.addEventListener('click', () => {
  if (confirm('ワークスペースのブロックをすべて消去しますか？（画面外の見えないブロックも削除されます）')) {
    ws.clear();
    window.localStorage?.removeItem('jcreatepp-workspace');
    generateCode();
  }
});

// デバッグ・テスト用にグローバルに公開
(window as any).Blockly = Blockly;
(window as any).workspace = ws;
(window as any).generateCode = generateCode;

// localStorage から復元
if (ws) {
  load(ws);

  // ワークスペース変更時: 自動保存 + リアルタイム警告 + コード生成
  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    if (e.isUiEvent) return;
    save(ws);
    validateWorkspace(ws);
    generateCode();
  });

  // 初回の警告チェック
  validateWorkspace(ws);
}
