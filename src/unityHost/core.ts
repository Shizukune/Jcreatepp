/**
 * Entry point of the Unity editor's block core (unity/Jcreatepp/Editor/Core). Bundled on its own by
 * webpack.unity.config.js into one script exposing the global `JcreateppCore`, which Unity runs in
 * Jint. It is the Web editor's own pipeline without the screen: headless Blockly reads the saved
 * workspace (.json), then the same converter, validator, codegen, Unity setup and parts run on it,
 * so Unity gets exactly what the Web editor would show.
 *
 * Contract for the C# side (CoreHost.cs):
 * - Arguments and results are numbers, strings, booleans, arrays and plain objects only.
 * - Functions do not use `this`; they never throw. A refused input returns { ok: false, error }.
 * - Every call works on a throwaway headless workspace with Blockly events off. If Blockly itself
 *   throws in the middle, its internal state cannot be trusted any more: the result has
 *   broken: true and every later call is refused; make a new engine.
 * - Inputs are checked before Blockly sees them (size, block count, nesting depth, known types).
 */

import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { blocks } from '../blocks/jcreatepp';
import { isEventBlock } from '../blocks/context';
import { workspaceToProgram } from '../generators/jcreatepp';
import { programToJS } from '../codegen';
import { collectWarnings } from '../validator';
import { buildUnitySetup, describeScriptSize, scriptByteLength } from '../unitySetup';
import { PARTS, defaultValues, paramValue, type PartValues } from '../parts/catalog';
import { insertPart } from '../parts/insert';

declare const __JCREATEPP_VERSION__: string;
declare const __BLOCKLY_VERSION__: string;

/** Version of this contract (bump when a function or result changes shape). */
const CORE_FORMAT = 1;
const MAX_JSON_CHARS = 5_000_000;
const MAX_BLOCKS = 5_000;
/** Blocks inside blocks (inputs and next both count). Blockly reads them recursively. */
const MAX_DEPTH = 150;
/** Inputs and next links (a block has at most a handful; this stops huge malformed files early). */
const MAX_CONNECTIONS = 50_000;

// Jint has no console; Blockly warns through it (for example about unknown fields).
const g = globalThis as { console?: unknown };
if (typeof g.console === 'undefined') {
  const quiet = () => undefined;
  g.console = { log: quiet, info: quiet, warn: quiet, error: quiet, debug: quiet };
}

export type CoreWarning = {
  text: string;
  blockId: string;
  blockType: string;
  /** The event block the warned block is in (or the block itself when it is an event); '' when outside any event. */
  eventId: string;
  eventType: string;
  /** Message name of a receive event; '' otherwise. */
  eventMessage: string;
};

export type ConvertResult = {
  ok: boolean;
  error: string;
  /** true after Blockly threw inside: this engine must be replaced. */
  broken: boolean;
  errors: string[];
  warnings: CoreWarning[];
  /** '' when there are conversion errors. */
  code: string;
  /** UnitySetup (src/unitySetup.ts) as JSON; '' when there is no code. */
  setupJson: string;
  size: { bytes: number; text: string; overLimit: boolean };
  variables: { kind: string; name: string; stateKey: string }[];
};

export type AddPartResult = { ok: boolean; error: string; broken: boolean; json: string };

let registered = false;
let brokenReason = '';

function register(): void {
  if (registered) return;
  registered = true;
  Blockly.common.defineBlocks(libraryBlocks);
  Blockly.common.defineBlocks(blocks);
  // Same dummy generators as src/index.ts: the converter only needs them to exist.
  const dummyGen = () => '';
  const dummyValueGen = (): [string, number] => ['0', Order.ATOMIC];
  for (const type of Object.keys(blocks)) {
    const def = (blocks as Record<string, { output?: unknown }>)[type];
    javascriptGenerator.forBlock[type] = def.output !== undefined ? dummyValueGen : dummyGen;
  }
}

function emptyConvert(error: string, broken = false): ConvertResult {
  return { ok: false, error, broken, errors: [], warnings: [], code: '', setupJson: '', size: { bytes: 0, text: '', overLimit: false }, variables: [] };
}

const message = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/**
 * Checks a saved workspace before Blockly reads it. Returns the parsed state, or why it is refused.
 * Walks without recursion: blocks, their inputs (block and shadow) and next.
 */
function checkState(json: string): { state: object } | { error: string } {
  if (typeof json !== 'string') return { error: 'ブロックのファイルが文字列ではありません。' };
  if (json.length > MAX_JSON_CHARS) return { error: `ブロックのファイルが大きすぎます（${MAX_JSON_CHARS.toLocaleString('en-US')} 文字まで）。` };
  let state: unknown;
  try {
    state = JSON.parse(json);
  } catch {
    return { error: 'ブロックのファイルを読めません（JSON の形になっていません）。' };
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { error: 'ブロックのファイルの形が違います。' };
  const top = (state as { blocks?: unknown }).blocks;
  if (top === undefined) return { state };
  const roots = top && typeof top === 'object' ? (top as { blocks?: unknown }).blocks : undefined;
  if (!Array.isArray(roots)) return { error: 'ブロックのファイルの形が違います（blocks.blocks がありません）。' };

  const unknown = new Set<string>();
  let count = 0;
  let connectionCount = 0;
  const stack: { block: unknown; depth: number }[] = roots.map((block) => ({ block, depth: 1 }));
  while (stack.length > 0) {
    const { block, depth } = stack.pop()!;
    if (!block || typeof block !== 'object') return { error: 'ブロックのファイルの形が違います（ブロックが壊れています）。' };
    const b = block as { type?: unknown; inputs?: unknown; next?: unknown };
    if (typeof b.type !== 'string') return { error: 'ブロックのファイルの形が違います（種類の無いブロックがあります）。' };
    if (!Blockly.Blocks[b.type]) unknown.add(b.type);
    if (++count > MAX_BLOCKS) return { error: `ブロックが多すぎます（${MAX_BLOCKS.toLocaleString('en-US')} 個まで）。` };
    if (depth > MAX_DEPTH) return { error: `ブロックのつながりが深すぎます（${MAX_DEPTH} 段まで）。` };
    // One by one (no spread: a block with very many inputs would exceed the argument limit).
    const connections: unknown[] = [];
    if (b.inputs && typeof b.inputs === 'object') {
      for (const name in b.inputs as Record<string, unknown>) {
        if (Object.prototype.hasOwnProperty.call(b.inputs, name)) connections.push((b.inputs as Record<string, unknown>)[name]);
      }
    }
    if (b.next !== undefined) connections.push(b.next);
    for (const c of connections) {
      if (++connectionCount > MAX_CONNECTIONS) return { error: `ブロックのつながりが多すぎます（${MAX_CONNECTIONS.toLocaleString('en-US')} 個まで）。` };
      if (!c || typeof c !== 'object') return { error: 'ブロックのファイルの形が違います（つながりが壊れています）。' };
      const { block: child, shadow } = c as { block?: unknown; shadow?: unknown };
      if (child !== undefined) stack.push({ block: child, depth: depth + 1 });
      if (shadow !== undefined) stack.push({ block: shadow, depth: depth + 1 });
    }
  }
  if (unknown.size > 0) {
    return { error: `知らない種類のブロックがあります: ${[...unknown].sort().join(', ')}。Web 版の Jcreate++ の方が新しいかもしれません。Unity 拡張を更新してください。` };
  }
  return { state };
}

/**
 * Runs `work` on a fresh headless workspace loaded with `state`, with Blockly events off.
 * Events, the event group and undo recording are put back whatever happens; if Blockly throws,
 * the engine is marked broken (Blockly does not restore all of its own state on an exception).
 */
function withWorkspace<T>(state: object, work: (ws: Blockly.Workspace) => T, onBroken: (reason: string) => T): T {
  if (brokenReason) return onBroken(brokenReason);
  register();
  const group = Blockly.Events.getGroup();
  const recordUndo = Blockly.Events.getRecordUndo();
  Blockly.Events.disable();
  try {
    const ws = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(state, ws);
      return work(ws);
    } finally {
      ws.dispose();
    }
  } catch (e) {
    brokenReason = `ブロックの処理中に問題が起きました（${message(e)}）。Unity 拡張を開き直してください。`;
    return onBroken(brokenReason);
  } finally {
    Blockly.Events.enable();
    Blockly.Events.setGroup(group || false);
    Blockly.Events.setRecordUndo(recordUndo);
  }
}

function eventOf(block: Blockly.Block): Blockly.Block | null {
  for (let b: Blockly.Block | null = block; b; b = b.getParent()) {
    if (isEventBlock(b.type)) return b;
  }
  return null;
}

export function version(): { format: number; jcreatepp: string; blockly: string; blockTypes: string[] } {
  register();
  return { format: CORE_FORMAT, jcreatepp: __JCREATEPP_VERSION__, blockly: __BLOCKLY_VERSION__, blockTypes: Object.keys(Blockly.Blocks).sort() };
}

/** Saved workspace (.json text) → what the Web editor shows for it. */
export function convert(json: string): ConvertResult {
  register();
  const checked = checkState(json);
  if ('error' in checked) return emptyConvert(checked.error);
  return withWorkspace(
    checked.state,
    (ws) => {
      const { program, errors } = workspaceToProgram(ws, javascriptGenerator as unknown as Blockly.CodeGenerator);
      const warnings: CoreWarning[] = [];
      for (const [block, text] of collectWarnings(ws)) {
        if (!text) continue;
        const ev = eventOf(block);
        warnings.push({
          text,
          blockId: block.id,
          blockType: block.type,
          eventId: ev?.id ?? '',
          eventType: ev?.type ?? '',
          eventMessage: ev?.type === 'jcreatepp_on_receive' ? String(ev.getFieldValue('MESSAGE') ?? '') : '',
        });
      }
      const code = errors.length === 0 ? programToJS(program) : '';
      const bytes = code ? scriptByteLength(code) : 0;
      const size = describeScriptSize(bytes);
      return {
        ok: true,
        error: '',
        broken: false,
        errors: [...errors],
        warnings,
        code,
        setupJson: code ? JSON.stringify(buildUnitySetup(program, code)) : '',
        size: { bytes, text: code ? size.text : '', overLimit: code ? size.overCraftItemLimit : false },
        variables: (program.variables ?? []).map((v) => ({ kind: v.kind, name: v.name, stateKey: v.stateKey })),
      };
    },
    (reason) => emptyConvert(reason, true),
  );
}

/** The parts that can be added (src/parts/catalog.ts), without the functions. */
export function parts(): { id: string; label: string; description: string; size: string; params: object[] }[] {
  return PARTS.map((p) => ({ id: p.id, label: p.label, description: p.description, size: p.size, params: p.params.map((param) => ({ ...param })) }));
}

/**
 * Adds a part to a saved workspace like the Web parts tab does. `valuesJson` is a JSON object of
 * parameter values ('' or missing keys = defaults; out-of-range numbers are clamped like the form).
 * Returns the new workspace as .json text, or why the part cannot be added.
 */
export function addPart(json: string, partId: string, valuesJson: string): AddPartResult {
  register();
  const fail = (error: string, broken = false): AddPartResult => ({ ok: false, error, broken, json: '' });
  const part = PARTS.find((p) => p.id === partId);
  if (!part) return fail(`知らない部品です: ${partId}`);
  let raw: unknown = {};
  if (valuesJson) {
    try {
      raw = JSON.parse(valuesJson);
    } catch {
      return fail('部品の値を読めません（JSON の形になっていません）。');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('部品の値の形が違います。');
  }
  const values: PartValues = defaultValues(part);
  for (const param of part.params) {
    const given = (raw as Record<string, unknown>)[param.key];
    if (given !== undefined) values[param.key] = paramValue(param, given);
  }

  const checked = checkState(json);
  if ('error' in checked) return fail(checked.error);
  return withWorkspace(
    checked.state,
    (ws) => {
      const result = insertPart(ws, part, values);
      if (!result.ok) return fail(result.reason);
      const out = JSON.stringify(Blockly.serialization.workspaces.save(ws));
      const after = checkState(out);
      if ('error' in after) return fail(`部品を足すと大きくなりすぎます: ${after.error}`);
      return { ok: true, error: '', broken: false, json: out };
    },
    (reason) => fail(reason, true),
  );
}
