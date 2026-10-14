/**
 * Small builders for Blockly's block JSON (the save format), used by demos and parts.
 * No block ids: Blockly assigns them, so pasted blocks never collide with existing ones.
 */

export type BlockJson = {
  type: string;
  fields?: Record<string, string | number>;
  inputs?: Record<string, { block: BlockJson }>;
  next?: { block: BlockJson };
  x?: number;
  y?: number;
};

export function block(type: string, fields?: BlockJson['fields'], inputs?: Record<string, BlockJson>): BlockJson {
  const json: BlockJson = { type };
  if (fields) json.fields = { ...fields };
  if (inputs) json.inputs = Object.fromEntries(Object.entries(inputs).map(([name, b]) => [name, { block: b }]));
  return json;
}

export function num(value: number): BlockJson {
  return block('math_number', { NUM: value });
}

/** Links statement blocks with `next` (copies; the inputs are not modified). Returns undefined for []. */
export function chain(blocks: BlockJson[]): BlockJson | undefined {
  let head: BlockJson | undefined;
  for (let i = blocks.length - 1; i >= 0; i--) {
    head = head ? { ...blocks[i], next: { block: head } } : { ...blocks[i] };
  }
  return head;
}

/** An event block (input DO) holding `body`. */
export function event(type: string, body: BlockJson[], fields?: BlockJson['fields']): BlockJson {
  const json = block(type, fields);
  const head = chain(body);
  if (head) json.inputs = { DO: { block: head } };
  return json;
}

/** A workspace state (as saved by the app) with the given top blocks stacked vertically. */
export function workspaceState(topBlocks: BlockJson[]): object {
  return {
    blocks: {
      languageVersion: 0,
      blocks: topBlocks.map((b, i) => ({ ...b, x: b.x ?? 0, y: b.y ?? i * 160 })),
    },
  };
}
