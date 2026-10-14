/**
 * Tiny builder for Blockly workspace JSON used by behavior tests.
 * b('type', { fields, inputs: { NAME: block }, stmts: { NAME: [blocks] } })
 */

type Block = { type: string; id: string; fields?: Record<string, unknown>; inputs?: Record<string, { block: Block }>; next?: { block: Block }; x?: number; y?: number };

let seq = 0;

export function b(
  type: string,
  opts: { fields?: Record<string, unknown>; inputs?: Record<string, Block>; stmts?: Record<string, Block[]>; id?: string } = {},
): Block {
  const block: Block = { type, id: opts.id ?? `t${++seq}` };
  if (opts.fields) block.fields = opts.fields;
  const inputs: Record<string, { block: Block }> = {};
  for (const [name, value] of Object.entries(opts.inputs ?? {})) inputs[name] = { block: value };
  for (const [name, list] of Object.entries(opts.stmts ?? {})) {
    for (let i = list.length - 1; i > 0; i--) list[i - 1].next = { block: list[i] };
    if (list.length > 0) inputs[name] = { block: list[0] };
  }
  if (Object.keys(inputs).length > 0) block.inputs = inputs;
  return block;
}

export const num = (value: number) => b('math_number', { fields: { NUM: value } });
export const xyz = (x: number, y: number, z: number) => ({ X: num(x), Y: num(y), Z: num(z) });
export const bool = (value: boolean) => b('jcreatepp_bool_literal', { fields: { VALUE: String(value) } });
export const onEvent = (type: string, body: Block[], fields?: Record<string, unknown>) => b(type, { fields, stmts: { DO: body } });

export function workspace(...tops: Block[]): object {
  return { blocks: { languageVersion: 0, blocks: tops.map((t, i) => ({ ...t, x: 0, y: i * 200 })) } };
}
