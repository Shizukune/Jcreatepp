/**
 * Parts palette (B) shown above the 3D preview: pick a part, set its parameters, add it as blocks.
 * Loaded together with the 3D preview. Blockly is changed only through insertPart (one undo step).
 */

import * as Blockly from 'blockly/core';
import { PARTS, defaultValues, type Part, type PartParam, type PartValues } from './catalog';
import { insertPart, partConflict } from './insert';

export function createPartsPanel(root: HTMLElement, ws: Blockly.WorkspaceSvg): void {
  root.innerHTML = `
    <details class="partsBox" open>
      <summary>部品を追加（ブロックが自動で入ります）</summary>
      <div class="partsRow">
        <select data-part title="部品"></select>
        <button data-add>追加</button>
      </div>
      <div class="partsDesc"></div>
      <div class="partsParams"></div>
      <div class="partsMsg" role="status"></div>
      <div class="partsMsg partsWarn"></div>
    </details>
  `;
  const select = root.querySelector('[data-part]') as HTMLSelectElement;
  const addBtn = root.querySelector('[data-add]') as HTMLButtonElement;
  const desc = root.querySelector('.partsDesc') as HTMLDivElement;
  const paramsEl = root.querySelector('.partsParams') as HTMLDivElement;
  const msg = root.querySelector('.partsMsg') as HTMLDivElement;
  const warn = root.querySelector('.partsWarn') as HTMLDivElement;

  for (const [size, label] of [['single', 'ひとつの動き'], ['set', 'ギミック一式']] as const) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const part of PARTS.filter((p) => p.size === size)) group.append(new Option(part.label, part.id));
    select.append(group);
  }

  let part: Part = PARTS[0];
  let values: PartValues = defaultValues(part);

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

  function showPart() {
    part = PARTS.find((p) => p.id === select.value) ?? PARTS[0];
    values = defaultValues(part);
    desc.textContent = part.description;
    paramsEl.replaceChildren(...part.params.map(paramInput));
    msg.textContent = '';
    refresh();
  }

  /** Disables 追加 (with the reason) when the part would fight existing blocks. */
  function refresh() {
    const conflict = partConflict(ws, part);
    addBtn.disabled = conflict !== null;
    warn.textContent = conflict ?? '';
  }

  select.addEventListener('change', showPart);
  addBtn.addEventListener('click', () => {
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
  showPart();
}
