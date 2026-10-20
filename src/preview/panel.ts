/**
 * State and log tabs of the 3D preview (HTML). Row contents come from stateRows.ts.
 * Cards are keyed by $.state key and only the text that changed is rewritten, so playing does not
 * rebuild the DOM every frame. No animation: a changed card gets a static mark for a moment.
 */

import type { LogEntry } from '../sim/clusterMock';
import type { Runner } from '../sim/runner';
import type { VariableKind } from '../variables';
import type { PreviewProgramInfo } from './programInfo';
import { buildStateRows, changedKeys, type StateRow } from './stateRows';

/** How long (real time) a changed card keeps its mark. */
const CHANGED_MS = 600;
export const LOG_SHOWN = 50;
const LOG_KEPT = 200;

export type StateSelection = { kind: VariableKind | 'sequence'; name: string; blockId?: string };

export type StatePanelOptions = {
  /** A card was clicked (null = selection cleared). */
  onSelect?: (selection: StateSelection | null) => void;
  /** Empty state action: open this toolbox category. */
  onShowBlocks?: (category: 'variables' | 'events') => void;
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const fmt = (n: number) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);

export function createStatePanel(el: HTMLElement, options: StatePanelOptions = {}) {
  // null = nothing built yet (an empty program has an empty signature, which must still be built).
  let structure: string | null = null;
  let previous = new Map<string, unknown>();
  const changedAt = new Map<string, number>();
  const cooldownMax = new Map<string, number>();
  let selectedKey: string | null = null;
  let rowsByKey = new Map<string, StateRow>();

  el.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const show = target.closest('[data-show]')?.getAttribute('data-show');
    if (show) {
      options.onShowBlocks?.(show as 'variables' | 'events');
      return;
    }
    const card = target.closest('[data-key]') as HTMLElement | null;
    if (!card) return;
    const key = card.getAttribute('data-key')!;
    selectedKey = selectedKey === key ? null : key;
    for (const c of el.querySelectorAll('[data-key]')) c.classList.toggle('pvSelected', c.getAttribute('data-key') === selectedKey);
    const row = selectedKey ? rowsByKey.get(selectedKey) : undefined;
    options.onSelect?.(row ? { kind: row.kind, name: row.name, blockId: row.sequence?.blockId } : null);
  });

  function noteHtml(row: StateRow): string {
    switch (row.noteKind) {
      case 'never-set': return `<span class="pvBadge pvWarnBadge" title="${esc(row.note!)}">⚠ どこでも設定されていません</span>`;
      case 'default': return `<span class="pvBadge" title="${esc(row.note!)}">初期値</span>`;
      case 'not-listed': return `<span class="pvBadge" title="${esc(row.note!)}">一覧にない値</span>`;
      default: return '';
    }
  }

  function cardHtml(row: StateRow): string {
    return `<button type="button" class="pvCard${row.kind === 'sequence' ? ' pvCardWide' : ''}" data-key="${esc(row.key)}">
      <span class="pvCardName" data-name></span>
      <span class="pvCardValue" data-v></span>
      ${row.kind === 'cooldown' || row.kind === 'sequence' ? '<span class="pvMeter"><span data-bar></span></span>' : ''}
      <span data-note></span>
    </button>`;
  }

  function updateCard(card: HTMLElement, row: StateRow, now: number) {
    // Name and note change without rebuilding the card (first assignment, a sequence moved to another event).
    const nameEl = card.querySelector('[data-name]') as HTMLElement;
    if (nameEl.textContent !== row.name) {
      nameEl.textContent = row.name;
      card.title = `${row.name}（押すと、使っているブロックに印が付きます）`;
    }
    const noteEl = card.querySelector('[data-note]') as HTMLElement;
    const note = noteHtml(row);
    if (noteEl.innerHTML !== note) noteEl.innerHTML = note;
    const valueEl = card.querySelector('[data-v]') as HTMLElement;
    let text = row.value;
    let pill: string | null = null;
    if (row.kind === 'bool') pill = row.raw ? 'ON' : 'OFF';
    if (row.kind === 'cooldown') text = Number(row.raw) > 0 ? `残り ${Number(row.raw).toFixed(2)} 秒` : '待機なし';
    const html = pill ? `<span class="pvPill ${row.raw ? 'pvOn' : ''}">${pill}</span>` : esc(text);
    if (valueEl.innerHTML !== html) valueEl.innerHTML = html;

    const bar = card.querySelector('[data-bar]') as HTMLElement | null;
    if (bar) {
      let ratio = 0;
      if (row.kind === 'cooldown') {
        // The start length is not known; the largest value seen this run is the denominator.
        const v = Number(row.raw);
        const max = Math.max(cooldownMax.get(row.key) ?? 0, v);
        cooldownMax.set(row.key, max);
        ratio = max > 0 ? v / max : 0;
      } else if (row.sequence && row.sequence.status === 'running' && row.sequence.steps > 0) {
        ratio = Math.min(1, (row.sequence.step - 1) / row.sequence.steps);
      }
      const width = `${Math.round(ratio * 100)}%`;
      if (bar.style.width !== width) bar.style.width = width;
    }
    card.classList.toggle('pvChanged', now - (changedAt.get(row.key) ?? -Infinity) < CHANGED_MS);
  }

  return {
    render(runner: Runner | null, info: PreviewProgramInfo, now = performance.now()) {
      if (!runner) {
        el.innerHTML = '';
        structure = null;
        return;
      }
      const rows = buildStateRows(info.variables, runner.$.state as Record<string, unknown>, info.sequences);
      for (const key of changedKeys(previous, rows)) changedAt.set(key, now);
      previous = new Map(rows.map((r) => [r.key, r.raw]));
      rowsByKey = new Map(rows.map((r) => [r.key, r]));

      const sig = rows.map((r) => `${r.group}|${r.key}`).join('\n');
      if (sig !== structure) {
        structure = sig;
        const groups = new Map<string, StateRow[]>();
        for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
        el.innerHTML = `<div class="pvItemLine" data-item></div>` + ([...groups.entries()]
          .map(([label, gr]) => `<h3>${esc(label)}</h3><div class="pvCards">${gr.map(cardHtml).join('')}</div>`)
          .join('') || `<p class="pvEmpty">変数のブロックを置くと、ここに値が出ます。 <button type="button" data-show="variables">変数のブロックを見る</button></p>`);
        if (selectedKey && !rowsByKey.has(selectedKey)) {
          selectedKey = null;
          options.onSelect?.(null);
        }
        for (const c of el.querySelectorAll('[data-key]')) c.classList.toggle('pvSelected', c.getAttribute('data-key') === selectedKey);
      }

      // Cluster coordinates (before the Z flip used for drawing): metres and degrees.
      const p = runner.item.position;
      const r = runner.item.rotation.createEulerAngles();
      const itemLine = el.querySelector('[data-item]') as HTMLElement;
      const itemText = `アイテム　位置 (${fmt(p.x)}, ${fmt(p.y)}, ${fmt(p.z)}) m　角度 (${fmt(r.x)}, ${fmt(r.y)}, ${fmt(r.z)})°`;
      if (itemLine.textContent !== itemText) itemLine.textContent = itemText;
      itemLine.title = '角度は 0〜360° の表し方に直しています（何周回ったかは表せません）';

      for (const card of el.querySelectorAll<HTMLElement>('[data-key]')) {
        const row = rowsByKey.get(card.getAttribute('data-key')!);
        if (row) updateCard(card, row, now);
      }
    },
    /** New run (reset / new code): forget what was seen before. */
    reset() {
      previous = new Map();
      changedAt.clear();
      cooldownMax.clear();
    },
  };
}

export type StampedLog = { n: number; time: number; entry: LogEntry };

/** The preview's own log: entries stamped with the simulation time when they were recorded. */
export function createLogPanel(el: HTMLElement) {
  let entries: StampedLog[] = [];
  let next = 1;
  let rendered = -1;

  el.innerHTML = `<div class="pvLogHead"><button type="button" data-clear>ログを消す</button></div><div class="pvLogList" data-list></div>`;
  const list = el.querySelector('[data-list]') as HTMLElement;
  (el.querySelector('[data-clear]') as HTMLButtonElement).addEventListener('click', () => {
    entries = [];
    rendered = -1;
    render();
  });

  function render() {
    const last = entries.length ? entries[entries.length - 1].n : 0;
    if (last === rendered) return;
    rendered = last;
    list.innerHTML = entries.length === 0
      ? '<p class="pvEmpty">まだ何も起きていません。▶ で再生するか、イベントのボタンを押してください。</p>'
      : entries.slice(-LOG_SHOWN).reverse()
        .map((s) => `<div class="pvLogRow pvLog-${s.entry.type}"><span class="pvLogTime">${s.time.toFixed(2)} 秒</span>${esc(formatLog(s.entry))}</div>`)
        .join('');
  }

  return {
    /** Records new runtime log entries at simulation time `time`. Returns how many were added. */
    add(newEntries: LogEntry[], time: number): StampedLog[] {
      const stamped = newEntries.map((entry) => ({ n: next++, time, entry }));
      entries.push(...stamped);
      if (entries.length > LOG_KEPT) entries.splice(0, entries.length - LOG_KEPT);
      return stamped;
    },
    render,
    reset() {
      entries = [];
      rendered = -1;
      render();
    },
  };
}

/** Things the preview could not reproduce, and the latest runtime error of this run. */
export function previewProblems(runner: Runner, lastError: string | null): string[] {
  return [
    ...[...runner.unsupported].map((name) => `プレビュー未対応: ${name}`),
    ...(lastError ? [`実行時エラー: ${lastError}`] : []),
  ];
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
