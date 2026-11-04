/**
 * Jcreate++ - workspace の保存・読込
 * - localStorage への自動保存（既存機能踏襲）
 * - JSON ファイルとしてのダウンロード保存
 * - JSON ファイルからの読み込み復元
 *
 * 読み込みは、まず画面に出さない一時的なワークスペースで読めるか確かめてから、本番に入れる。
 * 読めないデータ（壊れた JSON、新しい版で作ったブロックなど）で、途中まで読んだ状態や、
 * Blockly のイベントが止まったまま（自動保存・警告・コード生成が動かない）にならないようにするため。
 */

import * as Blockly from 'blockly/core';

const storageKey = 'jcreatepp-workspace';

/**
 * Runs `work` with Blockly events off. Events, the event group and undo recording are put back
 * whatever happens (Blockly's loader changes the last two and does not restore them when it throws).
 */
function withEventsOff<T>(work: () => T): T {
  const group = Blockly.Events.getGroup();
  const recordUndo = Blockly.Events.getRecordUndo();
  Blockly.Events.disable();
  try {
    return work();
  } finally {
    Blockly.Events.enable();
    Blockly.Events.setGroup(group || false);
    Blockly.Events.setRecordUndo(recordUndo);
  }
}

/** Why `data` cannot be loaded into a workspace; null when it can. Uses a throwaway workspace. */
function loadProblem(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Jcreate++ のブロックのファイルの形ではありません';
  const probe = new Blockly.Workspace();
  try {
    withEventsOff(() => Blockly.serialization.workspaces.load(data as object, probe, undefined));
    return null;
  } catch (e) {
    return (e as Error).message || String(e);
  } finally {
    probe.dispose();
  }
}

/** Loads `data` into `workspace` with events off (see withEventsOff). */
function loadInto(data: object, workspace: Blockly.Workspace) {
  withEventsOff(() => Blockly.serialization.workspaces.load(data, workspace, undefined));
}

/** Offers the data that could not be read as a file, so it is not lost (the next autosave replaces it). */
function offerDownload(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // すぐに消すと Firefox などでダウンロードが不安定になることがある
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * ワークスペースの状態を localStorage に保存する
 */
export const save = function (workspace: Blockly.Workspace) {
  const data = Blockly.serialization.workspaces.save(workspace);
  window.localStorage?.setItem(storageKey, JSON.stringify(data));
};

/**
 * localStorage からワークスペースの状態を復元する。
 * 読めないときは空のまま始め、読めなかったデータを .json として保存できるようにする。
 */
export const load = function (workspace: Blockly.Workspace) {
  let text: string | null = null;
  try {
    text = window.localStorage?.getItem(storageKey) ?? null;
  } catch {
    return; // localStorage が使えない（プライベートモードなど）
  }
  if (!text) return;

  let data: unknown = null;
  let problem: string | null;
  try {
    data = JSON.parse(text);
    problem = loadProblem(data);
  } catch (e) {
    problem = (e as Error).message;
  }
  if (problem === null) {
    loadInto(data as object, workspace);
    return;
  }

  console.error('[load] saved blocks could not be read:', problem);
  if (confirm(`前回のブロックを読み込めなかったので、空の状態で始めます。\n（${problem}）\n\n読み込めなかったブロックを .json ファイルとして保存しますか？\n（新しい版の Jcreate++ で作ったブロックなら、そちらで「ブロックを開く」と開けることがあります）`)) {
    offerDownload(text, 'jcreateplus_unreadable.json');
  }
};

/**
 * ワークスペースを JSON ファイルとしてダウンロードする
 */
export const saveToFile = function (workspace: Blockly.Workspace, filename = 'jcreateplus_workspace.json') {
  const data = Blockly.serialization.workspaces.save(workspace);
  offerDownload(JSON.stringify(data, null, 2), filename);
};

/**
 * JSON ファイルからワークスペースを復元する。
 * 読めないファイルなら、今のブロックはそのまま残す。読み込めたら onLoaded を呼ぶ
 * （イベントを止めて読むので、自動保存・警告・コード生成はここから動かす）。
 */
export const loadFromFile = function (workspace: Blockly.Workspace, onLoaded?: () => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let data: unknown;
      try {
        data = JSON.parse(reader.result as string);
      } catch (e) {
        alert('ファイルを読み込めませんでした（JSON の形になっていません）: ' + (e as Error).message);
        return;
      }
      const problem = loadProblem(data);
      if (problem !== null) {
        alert('このファイルは開けません。今のブロックはそのままです。\n（' + problem + '）\n\n新しい版の Jcreate++ で作ったブロックかもしれません。');
        return;
      }
      try {
        loadInto(data as object, workspace);
      } catch (e) {
        alert('ファイルの読み込みに失敗しました: ' + (e as Error).message);
        return;
      }
      onLoaded?.();
    };
    reader.onerror = () => {
      alert('ファイルを読み込めませんでした。今のブロックはそのままです。' + (reader.error ? '\n（' + reader.error.message + '）' : ''));
    };
    reader.readAsText(file);
  });

  input.click();
};
