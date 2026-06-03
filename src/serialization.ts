/**
 * Jcreate++ - workspace の保存・読込
 * - localStorage への自動保存（既存機能踏襲）
 * - JSON ファイルとしてのダウンロード保存
 * - JSON ファイルからの読み込み復元
 */

import * as Blockly from 'blockly/core';

const storageKey = 'jcreatepp-workspace';

/**
 * ワークスペースの状態を localStorage に保存する
 */
export const save = function (workspace: Blockly.Workspace) {
  const data = Blockly.serialization.workspaces.save(workspace);
  window.localStorage?.setItem(storageKey, JSON.stringify(data));
};

/**
 * localStorage からワークスペースの状態を復元する
 */
export const load = function (workspace: Blockly.Workspace) {
  const data = window.localStorage?.getItem(storageKey);
  if (!data) return;

  Blockly.Events.disable();
  Blockly.serialization.workspaces.load(
    JSON.parse(data),
    workspace,
    undefined,
  );
  Blockly.Events.enable();
};

/**
 * ワークスペースを JSON ファイルとしてダウンロードする
 */
export const saveToFile = function (workspace: Blockly.Workspace) {
  const data = Blockly.serialization.workspaces.save(workspace);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], {type: 'application/json'});
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'jcreateplus_workspace.json';
  document.body.appendChild(a); 
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
};

/**
 * JSON ファイルからワークスペースを復元する
 */
export const loadFromFile = function (workspace: Blockly.Workspace) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        Blockly.Events.disable();
        Blockly.serialization.workspaces.load(data, workspace, undefined);
        Blockly.Events.enable();
      } catch (e) {
        alert('ファイルの読み込みに失敗しました: ' + (e as Error).message);
      }
    };
    reader.readAsText(file);
  });

  input.click();
};
