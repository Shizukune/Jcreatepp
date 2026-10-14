/**
 * State and log panels of the 3D preview (HTML). Row contents come from stateRows.ts.
 */

import type { LogEntry } from '../sim/clusterMock';
import type { Runner } from '../sim/runner';
import type { VariableInfo } from '../variables';
import { buildStateRows } from './stateRows';

export function renderStatePanel(stateEl: HTMLElement, runner: Runner, variables: VariableInfo[]): void {
  const groups = new Map<string, string[]>();
  for (const row of buildStateRows(variables, runner.$.state as Record<string, unknown>)) {
    const note = row.note ? `<td class="pvNote">${esc(row.note)}</td>` : '<td></td>';
    const rows = groups.get(row.group) ?? [];
    rows.push(`<tr><td>${esc(row.name)}</td><td>${esc(row.value)}</td>${note}</tr>`);
    groups.set(row.group, rows);
  }
  stateEl.innerHTML = [...groups.entries()]
    .map(([label, rows]) => `<h3>${esc(label)}</h3><table>${rows.join('')}</table>`)
    .join('') || '<p class="pvEmpty">変数・フラグはまだありません</p>';
}

export function renderLogPanel(logEl: HTMLElement, runner: Runner): void {
  logEl.innerHTML = '<h3>ログ</h3>' + runner.log.slice(-12).reverse().map((l) => `<div>${esc(formatLog(l))}</div>`).join('');
}

/** Things the preview could not reproduce, and the latest runtime error. */
export function previewProblems(runner: Runner): string[] {
  return [
    ...[...runner.unsupported].map((name) => `プレビュー未対応: ${name}`),
    ...runner.errors().slice(-1).map((m) => `実行時エラー: ${m}`),
  ];
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function formatLog(l: LogEntry): string {
  switch (l.type) {
    case 'send': return `送信 → ${l.target}「${l.message}」${l.arg === null || l.arg === undefined ? '' : ` 値=${JSON.stringify(l.arg)}`}`;
    case 'audio': return `音「${l.id}」音量 ${l.volume}`;
    case 'text': return `文字 ${l.subNode}(${l.component}) = ${l.text}`;
    case 'enabled': return `${l.subNode}(${l.component}) を ${l.enabled ? '有効' : '無効'}`;
    case 'force': return `力を加える (${l.force.x.toFixed(1)}, ${l.force.y.toFixed(1)}, ${l.force.z.toFixed(1)}) ※物理は再現しません`;
    case 'player': return `プレイヤー ${l.method}(${l.value})`;
    case 'error': return `エラー[${l.event}] ${l.message}`;
  }
}
