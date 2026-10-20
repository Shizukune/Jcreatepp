/**
 * Parts tab (B) of the 3D preview: part cards; the selected card shows its motion sample,
 * parameters and 「ブロックを追加」. Blockly is changed only through insertPart (one undo step).
 *
 * The sample uses the block demo renderer (one shared WebGL canvas), so only the selected card
 * plays, and only while the parts tab is on screen.
 */

import * as Blockly from 'blockly/core';
import { PARTS, defaultValues, type Part, type PartParam, type PartValues } from './catalog';
import { partDemo } from './demo';
import { channelLabel, conflictChannel, insertPart, partConflict } from './insert';

export type PartsPanel = {
  /** The tab became visible again: restart the sample of the selected card. */
  shown(): void;
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function createPartsPanel(root: HTMLElement, ws: Blockly.WorkspaceSvg, isVisible: () => boolean): PartsPanel {
  const groups = [['single', 'ひとつの動き'], ['set', 'ギミック一式']] as const;
  root.innerHTML = `
    <p class="pvMuted">部品を選ぶと動きの見本が出ます。「ブロックを追加」で、左のブロック画面に普通のブロックとして入ります（元に戻す: Ctrl+Z）。</p>
    ${groups.map(([size, label]) => `<h3>${label}</h3><div class="partsCards">${PARTS.filter((p) => p.size === size)
      .map((p) => `<button type="button" class="partsCard" data-part="${p.id}" aria-describedby="partsWhy-${p.id}">
        <span class="partsCardName">${esc(p.label)}</span>
        <span class="partsCardDesc">${esc(p.description)}</span>
        <span class="partsWhy" id="partsWhy-${p.id}"></span>
      </button>`).join('')}</div>`).join('')}
    <div class="partsDetail" hidden>
      <div class="demoFrame partsDemo" style="width:240px;height:150px"></div>
      <div class="partsParams"></div>
      <div class="partsRow"><button type="button" data-add>ブロックを追加</button></div>
      <div class="partsMsg" role="status"></div>
      <div class="partsMsg partsWarn"></div>
    </div>
  `;
  const detail = root.querySelector('.partsDetail') as HTMLDivElement;
  const demoFrame = root.querySelector('.partsDemo') as HTMLDivElement;
  const paramsEl = root.querySelector('.partsParams') as HTMLDivElement;
  const addBtn = root.querySelector('[data-add]') as HTMLButtonElement;
  const msg = root.querySelector('.partsMsg') as HTMLDivElement;
  const warn = root.querySelector('.partsWarn') as HTMLDivElement;

  let part: Part | null = null;
  let values: PartValues = {};
  let demoRun = 0;

  function paramInput(param: PartParam): HTMLElement {
    const label = document.createElement('label');
    label.textContent = param.label + ' ';
    let input: HTMLInputElement | HTMLSelectElement;
    if (param.kind === 'axis') {
      input = document.createElement('select');
      for (const a of ['X', 'Y', 'Z']) input.append(new Option(a, a));
    } else {
      input = document.createElement('input');
      input.type = 'number';
      input.min = String(param.min);
      input.max = String(param.max);
      input.step = String(param.step);
    }
    input.value = String(values[param.key]);
    input.addEventListener('change', () => {
      if (param.kind === 'axis') {
        values[param.key] = input.value;
        return;
      }
      const v = Number(input.value);
      const clamped = Number.isFinite(v) ? Math.min(param.max, Math.max(param.min, v)) : param.default;
      values[param.key] = clamped;
      input.value = String(clamped);
    });
    label.append(input);
    return label;
  }

  function playSample() {
    if (!part) return;
    const run = ++demoRun;
    const current = part;
    const alive = () => run === demoRun && part === current && isVisible() && !detail.hidden && demoFrame.isConnected;
    demoFrame.replaceChildren();
    demoFrame.classList.remove('demoUnavailable');
    import('../demos/demoRenderer')
      .then(({ playDemo }) => {
        if (alive()) playDemo(demoFrame, partDemo(current), alive, { playButton: true });
      })
      .catch((err) => {
        console.warn('part sample unavailable:', err);
        if (run === demoRun) {
          demoFrame.classList.add('demoUnavailable');
          demoFrame.textContent = '（この環境では見本を表示できません）';
        }
      });
  }

  function select(id: string) {
    part = PARTS.find((p) => p.id === id) ?? null;
    for (const c of root.querySelectorAll('[data-part]')) c.classList.toggle('pvSelected', c.getAttribute('data-part') === id);
    detail.hidden = !part;
    if (!part) return;
    values = defaultValues(part);
    paramsEl.replaceChildren(...part.params.map(paramInput));
    msg.textContent = '';
    refresh();
    playSample();
  }

  /** Marks parts that cannot be added now: one short line on the card, the full reason under the selected one. */
  function refresh() {
    for (const p of PARTS) {
      const channel = conflictChannel(ws, p);
      const card = root.querySelector(`[data-part="${p.id}"]`) as HTMLElement;
      card.classList.toggle('partsBlocked', channel !== null);
      (card.querySelector('.partsWhy') as HTMLElement).textContent = channel ? `今は追加できません（${channelLabel(channel)}がぶつかる）` : '';
    }
    warn.textContent = part ? partConflict(ws, part) ?? '' : '';
  }

  root.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('[data-part]');
    if (card) select(card.getAttribute('data-part')!);
  });

  // Kept enabled: pressing it when the part cannot be added explains why, next to the button.
  addBtn.addEventListener('click', () => {
    if (!part) return;
    const result = insertPart(ws, part, values);
    if (!result.ok) {
      msg.textContent = '';
      warn.textContent = result.reason;
      return;
    }
    const first = result.blockIds[0] && ws.getBlockById(result.blockIds[0]);
    if (first instanceof Blockly.BlockSvg) {
      // The pasted blocks may sit inside an existing event, so show that whole event block.
      const eventBlock = first.getRootBlock();
      ws.scrollBoundsIntoView(eventBlock.getBoundingRectangle(), 20);
      first.select();
    }
    msg.textContent = `「${part.label}」のブロックを追加しました（元に戻す: Ctrl+Z）`;
  });

  ws.addChangeListener((e: Blockly.Events.Abstract) => {
    if (!e.isUiEvent) refresh();
  });
  // Inner tab switches toggle `hidden` on the host: restart the sample when it shows again.
  new MutationObserver(() => {
    if (!root.hidden) playSample();
  }).observe(root, { attributes: true, attributeFilter: ['hidden'] });

  refresh();
  return { shown: playSample };
}
