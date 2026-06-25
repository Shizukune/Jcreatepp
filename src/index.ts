/**
 * Jcreate++ — メインエントリポイント
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

import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import * as Ja from 'blockly/msg/ja';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { workspaceToProgram } from './generators/jcreatepp';
import { programToJS } from './codegen';
import { collectUnityRequirements, formatUnityRequirements } from './unityRequirements';
import { validateWorkspace } from './validator';
import { save, load, saveToFile, loadFromFile } from './serialization';
import { toolbox } from './toolbox';
import './index.css';

// 言語設定
Blockly.setLocale(Ja);

// 基本ブロック（math_number等）を登録
Blockly.common.defineBlocks(libraryBlocks);

// カスタムブロックを登録
import { blocks } from './blocks/jcreatepp';
Blockly.common.defineBlocks(blocks);

// ジェネレータにダミーを登録（IRへ変換するため、JSの直接生成はしないが、定義がないとエラーになる）
const dummyGen = () => '';
const dummyValueGen = (): [string, number] => ['0', Order.ATOMIC];

// 全てのカスタムブロックに対してダミージェネレータを登録
Object.keys(blocks).forEach(type => {
  const def = (blocks as any)[type];
  if (def.output !== undefined) {
    javascriptGenerator.forBlock[type] = dummyValueGen;
  } else {
    javascriptGenerator.forBlock[type] = dummyGen;
  }
});

// DOM 要素の取得
const blocklyDiv = document.getElementById('blocklyDiv');
const codeEl = document.getElementById('generatedCode')?.querySelector('code');
const errorEl = document.getElementById('errorMessages');
const unityRequirementsEl = document.getElementById('unityRequirements');
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
let isGenerating = false; // 再入ガード

/** 出力ペインをクリアする */
function clearOutputPane() {
  if (codeEl) {
    codeEl.textContent = '// ブロックを配置して「JS生成」を押してください';
  }
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }
  if (unityRequirementsEl) {
    unityRequirementsEl.textContent = '';
    unityRequirementsEl.style.display = 'none';
  }
  lastGeneratedCode = '';
}

const generateCode = () => {
  // 再入防止
  if (isGenerating) return;
  isGenerating = true;

  try {
    // ワークスペースが空の場合は即座にクリアして返す
    const topBlocks = ws.getTopBlocks(false);
    if (topBlocks.length === 0) {
      clearOutputPane();
      return;
    }

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
      if (unityRequirementsEl) {
        unityRequirementsEl.textContent = '';
        unityRequirementsEl.style.display = 'none';
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

    const requirementText = formatUnityRequirements(collectUnityRequirements(result.program));
    if (unityRequirementsEl) {
      unityRequirementsEl.textContent = requirementText;
      unityRequirementsEl.style.display = requirementText ? 'block' : 'none';
    }

    if (codeEl) {
      codeEl.textContent = code;
    }
  } catch (err) {
    console.error('generateCode error:', err);
    if (codeEl) {
      codeEl.textContent = '// 内部エラーが発生しました。コンソールを確認してください。';
    }
    lastGeneratedCode = '';
  } finally {
    isGenerating = false;
  }
};

// ── ボタンイベント ──

// JS生成ボタン
btnGenerate?.addEventListener('click', () => {
  console.log('[btnGenerate] clicked');
  generateCode();
});

// JS保存ボタン: 生成された JavaScript コードを .js ファイルとしてダウンロードする
btnDownloadJS?.addEventListener('click', () => {
  console.log('[btnDownloadJS] clicked');
  try {
    // 保存時に最新のコードを再生成
    generateCode();

    if (!lastGeneratedCode) {
      alert('生成できるコードがありません。\nブロックを配置してから「JS保存」を押してください。');
      return;
    }

    // JS コードを Blob にして保存
    const blob = new Blob([lastGeneratedCode], { type: 'application/javascript; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jcreateplus_script.js';
    document.body.appendChild(a);
    a.click();
    // 即座に削除すると Firefox で問題になる場合があるので setTimeout
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    console.log('[btnDownloadJS] download triggered: jcreateplus_script.js');
  } catch (e) {
    console.error('[btnDownloadJS] failed:', e);
    alert('JS保存に失敗しました: ' + (e as Error).message);
  }
});

// workspace保存ボタン: Blockly ワークスペースの JSON データをダウンロードする
btnSave?.addEventListener('click', () => {
  console.log('[btnSave] clicked');
  try {
    saveToFile(ws);
    console.log('[btnSave] download triggered: jcreateplus_workspace.json');
  } catch (e) {
    console.error('[btnSave] failed:', e);
    alert('workspace保存に失敗しました: ' + (e as Error).message);
  }
});

// workspace読込ボタン
btnLoad?.addEventListener('click', () => {
  console.log('[btnLoad] clicked');
  try {
    loadFromFile(ws);
  } catch (e) {
    console.error('[btnLoad] failed:', e);
    alert('workspace読込に失敗しました: ' + (e as Error).message);
  }
});

// すべてクリアボタン
btnClear?.addEventListener('click', () => {
  console.log('[btnClear] clicked');
  if (!confirm('ワークスペースのブロックをすべて消去しますか？\n（画面外の見えないブロックも削除されます）')) {
    return;
  }

  try {
    // イベントを一時的に無効化してクリア（ChangeListener の再入を防ぐ）
    Blockly.Events.disable();
    ws.clear();
    Blockly.Events.enable();

    // localStorage の保存データも消す
    try {
      window.localStorage?.removeItem('jcreatepp-workspace');
    } catch (_) {
      // localStorage アクセスに失敗しても無視
    }

    // 出力ペインをリセット
    clearOutputPane();
    console.log('[btnClear] workspace cleared');
  } catch (e) {
    // 万が一エラーが出ても Events は必ず有効に戻す
    Blockly.Events.enable();
    console.error('[btnClear] failed:', e);
    alert('クリアに失敗しました: ' + (e as Error).message);
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
    try {
      save(ws);
    } catch (err) {
      console.error('ChangeListener save error:', err);
    }
    try {
      validateWorkspace(ws);
    } catch (err) {
      console.error('ChangeListener validate error:', err);
    }
    try {
      generateCode();
    } catch (err) {
      console.error('ChangeListener generateCode error:', err);
    }
  });

  // 初回の警告チェック
  try {
    validateWorkspace(ws);
  } catch (err) {
    console.error('Initial validateWorkspace error:', err);
  }
}
