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
import { describeScriptSize, scriptByteLength } from './unitySetup';
import { validateWorkspace } from './validator';
import { save, load, saveToFile, loadFromFile } from './serialization';
import { toolbox } from './toolbox';
import type { Program } from './ir';
import type { Preview } from './preview/previewApp';
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
const scriptSizeEl = document.getElementById('scriptSize');
const scriptFileNameInput = document.getElementById('scriptFileName') as HTMLInputElement | null;
const workspaceFileNameInput = document.getElementById('workspaceFileName') as HTMLInputElement | null;
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

// ── 3D プレビュー（タブを初めて開いたときに読み込む） ──

let lastProgram: Program | null = null;
let previewReason = '';
let preview: Preview | null = null;
let previewLoading = false;
const codePane = document.getElementById('codePane');
const codeView = document.getElementById('codeView');
const previewView = document.getElementById('previewView');
const tabCode = document.getElementById('tabCode');
const tabPreview = document.getElementById('tabPreview');

function updatePreview() {
  if (!preview) return;
  // The preview runs a trace build; the code shown / downloaded above is never traced.
  preview.setCode(lastProgram ? programToJS(lastProgram, { trace: true }) : null, previewReason);
  preview.setVariables(lastProgram?.variables ?? []);
}

function highlightBlocks(ids: string[]) {
  try {
    ws.highlightBlock(null);
    for (const id of ids) {
      if (ws.getBlockById(id)) ws.highlightBlock(id, true);
    }
  } catch (err) {
    console.error('highlightBlocks error:', err);
  }
}

let currentTab: 'code' | 'preview' = 'code';
let blockEdit: typeof import('./preview/blockEdit') | null = null;

// Last block selected in Blockly. Kept while focus moves to the 3D view (Blockly deselects on
// focus loss), so the gizmo stays after a drag; replaced when another block is selected.
let editBlockId: string | null = null;

/** Forgets the edited block (workspace cleared / replaced: block ids may be reused by a loaded file). */
function resetEditTarget() {
  editBlockId = null;
  preview?.setEditTarget(null);
}

/** Tells the preview which selected block (if any) its 3D gizmo should edit. */
function updateEditTarget() {
  if (!preview || !blockEdit) return;
  const selected = Blockly.getSelected();
  if (selected instanceof Blockly.BlockSvg) editBlockId = selected.id;
  const block = editBlockId ? ws.getBlockById(editBlockId) : null;
  preview.setEditTarget(blockEdit.getEditTarget(block));
}

// Selection is a UI event, so it needs its own listener (the main one skips UI events).
ws.addChangeListener(() => updateEditTarget());

async function showTab(tab: 'code' | 'preview') {
  currentTab = tab;
  const isPreview = tab === 'preview';
  if (codeView) codeView.hidden = isPreview;
  if (previewView) previewView.hidden = !isPreview;
  tabCode?.setAttribute('aria-selected', String(!isPreview));
  tabPreview?.setAttribute('aria-selected', String(isPreview));
  codePane?.classList.toggle('previewMode', isPreview);
  Blockly.svgResize(ws);

  if (isPreview && !preview && !previewLoading && previewView) {
    previewLoading = true;
    try {
      const { createPreview } = await import('./preview/previewApp');
      preview = createPreview(previewView, {
        onActiveBlocks: highlightBlocks,
        onEdit: (blockId, values) => {
          // Writes the numbers as one undo step; the change listener then regenerates the preview.
          if (!blockEdit?.applyEdit(ws, blockId, values)) console.warn('3D edit was not applied:', blockId);
        },
      });
      blockEdit = await import('./preview/blockEdit');
      updateEditTarget();
      // After a page load nothing has been generated yet; generate so the preview has a program.
      generateCode();
      updatePreview();
    } catch (err) {
      console.error('preview load error:', err);
      previewView.textContent = '3Dプレビューを読み込めませんでした: ' + (err as Error).message;
    } finally {
      previewLoading = false;
    }
  }
  // The tab may have changed while the preview module was loading.
  preview?.setVisible(currentTab === 'preview');
}

tabCode?.addEventListener('click', () => void showTab('code'));
tabPreview?.addEventListener('click', () => void showTab('preview'));

function normalizeDownloadFilename(input: string | null, fallbackBaseName: string, extension: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return `${fallbackBaseName}${extension}`;

  const withoutExtension = raw.replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'i'), '');
  const safeBaseName = withoutExtension
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);

  return `${safeBaseName || fallbackBaseName}${extension}`;
}

function downloadTextFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // 即座に削除すると Firefox などでダウンロードが不安定になる場合がある
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/** 生成コードの大きさ（クラフトアイテムの上限との比較）を表示する */
function showScriptSize(code: string) {
  if (!scriptSizeEl) return;
  const size = describeScriptSize(scriptByteLength(code));
  scriptSizeEl.textContent = size.text;
  scriptSizeEl.classList.toggle('over', size.overCraftItemLimit);
  scriptSizeEl.style.display = 'block';
}

function hideScriptSize() {
  if (!scriptSizeEl) return;
  scriptSizeEl.textContent = '';
  scriptSizeEl.style.display = 'none';
}

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
  hideScriptSize();
  lastGeneratedCode = '';
  lastProgram = null;
  previewReason = 'ブロックを配置するとプレビューできます';
  updatePreview();
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
    lastProgram = result.errors.length > 0 ? null : result.program;
    previewReason = result.errors.length > 0 ? 'エラーがあるためプレビューできません（「生成コード」タブを確認してください）' : '';
    updatePreview();

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
      hideScriptSize();
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
    showScriptSize(code);
  } catch (err) {
    console.error('generateCode error:', err);
    hideScriptSize();
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

    const filename = normalizeDownloadFilename(scriptFileNameInput?.value ?? '', 'jcreateplus_script', '.js');
    if (scriptFileNameInput) scriptFileNameInput.value = filename;

    downloadTextFile(lastGeneratedCode, filename, 'application/javascript; charset=utf-8');
    console.log(`[btnDownloadJS] download triggered: ${filename}`);
  } catch (e) {
    console.error('[btnDownloadJS] failed:', e);
    alert('JS保存に失敗しました: ' + (e as Error).message);
  }
});

// workspace保存ボタン: Blockly ワークスペースの JSON データをダウンロードする
btnSave?.addEventListener('click', () => {
  console.log('[btnSave] clicked');
  try {
    const filename = normalizeDownloadFilename(workspaceFileNameInput?.value ?? '', 'jcreateplus_workspace', '.json');
    if (workspaceFileNameInput) workspaceFileNameInput.value = filename;

    saveToFile(ws, filename);
    console.log(`[btnSave] download triggered: ${filename}`);
  } catch (e) {
    console.error('[btnSave] failed:', e);
    alert('workspace保存に失敗しました: ' + (e as Error).message);
  }
});

// workspace読込ボタン
btnLoad?.addEventListener('click', () => {
  console.log('[btnLoad] clicked');
  try {
    resetEditTarget();
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
    resetEditTarget();
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
