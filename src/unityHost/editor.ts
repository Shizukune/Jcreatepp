/**
 * What the Unity block editor (unity/Jcreatepp/Editor/Blocks) needs from Blockly besides converting:
 * the palette (src/toolbox.ts, each starting block as Blockly saves it) and the shape of each block
 * (inputs, fields, connections, colour). core.ts runs these on its throwaway headless workspace and
 * exports them; the same contract applies (plain values, never throws, broken when Blockly throws).
 */

import * as Blockly from 'blockly/core';
import { toolbox } from '../toolbox';

type Check = string[] | null;

export type FieldShape = {
  name: string;
  /** label / dropdown / number / text / checkbox; other = an editable field the Unity editor cannot edit (kept as saved). */
  kind: string;
  text: string;
  value?: string | number;
  options?: [string, string][];
  min?: number | null;
  max?: number | null;
  precision?: number | null;
};

export type BlockShape = {
  type: string;
  colour: string;
  output: boolean;
  outputCheck: Check;
  previous: boolean;
  previousCheck: Check;
  next: boolean;
  nextCheck: Check;
  inline: boolean;
  hat: string;
  tooltip: string;
  inputs: { kind: string; name: string; check: Check; visible: boolean; fields: FieldShape[] }[];
};

export type PaletteItem =
  | { kind: 'label'; text: string }
  | { kind: 'button'; text: string; callbackKey: string }
  | { kind: 'block'; type: string; template: object };

export type Palette = {
  categories: { name: string; colour: string; items: PaletteItem[] }[];
  /** Every block type in the palette and every Jcreate++ block type: the shapes the editor needs. */
  types: string[];
};

/**
 * Jint has no DOM. Blockly keeps an XML copy of every shadow block next to its JSON state (only XML
 * export reads it), so loading any input with a shadow (math_number in X, Y, Z, ...) threw
 * 'createElementNS of undefined'. A minimal element is enough for writing that copy. Installed only
 * when Blockly cannot make an element (Jint); the Web editor and Node keep their own.
 */
export function provideMinimalDom(): void {
  try {
    Blockly.utils.xml.createElement('probe');
    return;
  } catch {
    // no document: install the minimal one below
  }
  class FakeNode {
    nodeName: string;
    tagName: string;
    nodeType: number;
    textContent: string;
    id = '';
    childNodes: FakeNode[] = [];
    attributeValues: Record<string, string> = {};
    constructor(name: string, text?: string) {
      this.nodeName = name;
      this.tagName = name;
      this.nodeType = text === undefined ? 1 : 3;
      this.textContent = text ?? '';
    }
    setAttribute(k: string, v: unknown) {
      this.attributeValues[k] = String(v);
    }
    getAttribute(k: string) {
      return Object.prototype.hasOwnProperty.call(this.attributeValues, k) ? this.attributeValues[k] : null;
    }
    hasAttribute(k: string) {
      return Object.prototype.hasOwnProperty.call(this.attributeValues, k);
    }
    removeAttribute(k: string) {
      delete this.attributeValues[k];
    }
    hasAttributes() {
      return this.id !== '' || Object.keys(this.attributeValues).length > 0;
    }
    hasChildNodes() {
      return this.childNodes.length > 0;
    }
    appendChild(c: FakeNode) {
      this.childNodes.push(c);
      return c;
    }
    removeChild(c: FakeNode) {
      const i = this.childNodes.indexOf(c);
      if (i >= 0) this.childNodes.splice(i, 1);
      return c;
    }
    insertBefore(c: FakeNode, ref: FakeNode) {
      const i = this.childNodes.indexOf(ref);
      if (i < 0) this.childNodes.push(c);
      else this.childNodes.splice(i, 0, c);
      return c;
    }
    cloneNode(deep: boolean): FakeNode {
      const copy = new FakeNode(this.nodeName, this.nodeType === 3 ? this.textContent : undefined);
      copy.textContent = this.textContent;
      copy.id = this.id;
      copy.attributeValues = { ...this.attributeValues };
      if (deep) copy.childNodes = this.childNodes.map((c) => c.cloneNode(true));
      return copy;
    }
    get firstChild() {
      return this.childNodes[0] ?? null;
    }
    get children() {
      return this.childNodes.filter((c) => c.nodeType === 1);
    }
  }
  // XML text is never read or written here; these only have to exist (Blockly constructs them).
  class NoXmlText {
    parseFromString(): never {
      throw new Error('XML の読み込みには対応していません。');
    }
    serializeToString(): never {
      throw new Error('XML の書き出しには対応していません。');
    }
  }
  Blockly.utils.xml.injectDependencies({
    document: {
      createElementNS: (_ns: string, name: string) => new FakeNode(name),
      createElement: (name: string) => new FakeNode(name),
      createTextNode: (text: string) => new FakeNode('#text', String(text)),
    } as unknown as Document,
    DOMParser: NoXmlText as unknown as typeof DOMParser,
    XMLSerializer: NoXmlText as unknown as typeof XMLSerializer,
  });
}

function textOf(t: unknown): string {
  if (typeof t === 'string') return t;
  if (t && typeof (t as { alt?: unknown }).alt === 'string') return (t as { alt: string }).alt;
  return t === null || t === undefined ? '' : String(t);
}

function checkOf(connection: Blockly.Connection | null): Check {
  if (!connection) return null;
  const c = connection.getCheck();
  return c ? c.slice() : null;
}

const numberOrNull = (n: unknown) => (typeof n === 'number' && isFinite(n) ? n : null);

function describeField(field: Blockly.Field): FieldShape {
  const f: FieldShape = { name: field.name || '', kind: 'label', text: textOf(field.getText()) };
  if (field instanceof Blockly.FieldDropdown) {
    f.kind = 'dropdown';
    f.value = String(field.getValue());
    f.options = [];
    for (const option of field.getOptions(false)) {
      if (Array.isArray(option)) f.options.push([textOf(option[0]), String(option[1])]);
    }
  } else if (field instanceof Blockly.FieldNumber) {
    f.kind = 'number';
    f.value = Number(field.getValue());
    f.min = numberOrNull(field.getMin());
    f.max = numberOrNull(field.getMax());
    f.precision = numberOrNull(field.getPrecision());
  } else if (field instanceof Blockly.FieldTextInput) {
    f.kind = 'text';
    f.value = String(field.getValue());
  } else if (field instanceof Blockly.FieldCheckbox) {
    f.kind = 'checkbox';
    f.value = String(field.getValue());
  } else if (field.EDITABLE && field.name) {
    // A field this editor cannot edit (colour, variable, ...): shown as text, its value kept as saved.
    f.kind = 'other';
  }
  return f;
}

function tooltipOf(block: Blockly.Block): string {
  try {
    let t: unknown = block.tooltip;
    while (typeof t === 'function') t = (t as (this: Blockly.Block) => unknown).call(block);
    // Blockly's own blocks name messages (%{BKY_...}) that the core does not load.
    return typeof t === 'string' && !t.includes('%{BKY_') ? t : '';
  } catch {
    return '';
  }
}

/** Blockly's own blocks name a style instead of a colour; the Web editor uses the default (Classic) theme. */
function colourOf(block: Blockly.Block): string {
  const style = block.getStyleName();
  const styles = Blockly.Themes.Classic.blockStyles as Record<string, { colourPrimary?: string }>;
  if (style && styles[style]) return String(styles[style].colourPrimary);
  return String(block.getColour());
}

function describeBlock(block: Blockly.Block): BlockShape {
  return {
    type: block.type,
    colour: colourOf(block),
    output: !!block.outputConnection,
    outputCheck: checkOf(block.outputConnection),
    previous: !!block.previousConnection,
    previousCheck: checkOf(block.previousConnection),
    next: !!block.nextConnection,
    nextCheck: checkOf(block.nextConnection),
    inline: !!block.getInputsInline(),
    hat: typeof block.hat === 'string' ? block.hat : '',
    tooltip: tooltipOf(block),
    inputs: block.inputList.map((input) => ({
      kind:
        input instanceof Blockly.inputs.StatementInput
          ? 'statement'
          : input instanceof Blockly.inputs.ValueInput
            ? 'value'
            : input instanceof Blockly.inputs.EndRowInput
              ? 'endrow'
              : 'dummy',
      name: input.name || '',
      check: checkOf(input.connection),
      visible: input.isVisible(),
      fields: input.fieldRow.filter((field) => field.isVisible()).map(describeField),
    })),
  };
}

type SavedState = { type?: unknown; id?: string; inputs?: Record<string, { block?: SavedState; shadow?: SavedState }>; next?: { block?: SavedState; shadow?: SavedState } };

/** Every block in a saved state, nested ones included. */
function eachBlock(state: SavedState | undefined, visit: (s: SavedState) => void): void {
  if (!state || typeof state !== 'object') return;
  visit(state);
  for (const name in state.inputs ?? {}) {
    eachBlock(state.inputs![name].block, visit);
    eachBlock(state.inputs![name].shadow, visit);
  }
  eachBlock(state.next?.block, visit);
  eachBlock(state.next?.shadow, visit);
}

/** Category colours are hues ('45') in toolbox.ts; the editor draws #rrggbb. */
function hueColour(colour: string): string {
  const n = Number(colour);
  return colour !== '' && !isNaN(n) ? Blockly.utils.colour.hueToHex(n) : colour;
}

/** The Web editor's palette (src/toolbox.ts), read on a headless workspace. */
export function paletteOn(ws: Blockly.Workspace): Palette {
  const categories: Palette['categories'] = [];
  const types: string[] = [];
  for (const c of toolbox.contents as { kind: string; name?: string; colour?: string; contents?: Record<string, unknown>[] }[]) {
    if (c.kind !== 'category') continue;
    const items: PaletteItem[] = [];
    for (const item of c.contents ?? []) {
      if (item.kind === 'label') items.push({ kind: 'label', text: String(item.text ?? '') });
      else if (item.kind === 'button') items.push({ kind: 'button', text: String(item.text ?? ''), callbackKey: String(item.callbackKey ?? '') });
      else if (item.kind === 'block' && typeof item.type === 'string' && Blockly.Blocks[item.type]) {
        const { kind: _kind, ...state } = item;
        const block = Blockly.serialization.blocks.append(state as unknown as Blockly.serialization.blocks.State, ws, { recordUndo: false });
        const saved = Blockly.serialization.blocks.save(block, { addCoordinates: false, addNextBlocks: true }) as SavedState;
        block.dispose(false);
        eachBlock(saved, (s) => {
          if (typeof s.type === 'string' && !types.includes(s.type)) types.push(s.type);
          // The editor gives every block it places a new id; without them the palette is the same every time.
          delete s.id;
        });
        items.push({ kind: 'block', type: item.type, template: saved });
      }
    }
    categories.push({ name: String(c.name ?? ''), colour: hueColour(String(c.colour ?? '')), items });
  }
  for (const type of Object.keys(Blockly.Blocks).sort()) {
    if (type.startsWith('jcreatepp_') && !types.includes(type)) types.push(type);
  }
  // The shapes come from shapesOn(), a few at a time (all at once is close to one call's time limit).
  return { categories, types };
}

/** The shapes of the given block types; unknown names are listed, not an error. */
export function shapesOn(ws: Blockly.Workspace, types: unknown[]): { shapes: Record<string, BlockShape>; unknown: string[] } {
  const shapes: Record<string, BlockShape> = {};
  const unknown: string[] = [];
  for (const type of types) {
    if (typeof type === 'string' && shapes[type]) continue;
    if (typeof type !== 'string' || !Blockly.Blocks[type]) {
      unknown.push(String(type));
      continue;
    }
    const block = ws.newBlock(type);
    shapes[type] = describeBlock(block);
    block.dispose(false);
  }
  return { shapes, unknown };
}
