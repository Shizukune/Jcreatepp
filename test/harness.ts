/**
 * Headless Blockly harness for tests.
 * Mirrors the block/generator registration in src/index.ts without touching the DOM UI.
 */

import * as Blockly from 'blockly/core';
import * as libraryBlocks from 'blockly/blocks';
import { javascriptGenerator, Order } from 'blockly/javascript';
import { blocks } from '../src/blocks/jcreatepp';
import { workspaceToProgram } from '../src/generators/jcreatepp';
import { programToJS } from '../src/codegen';
import { collectUnityRequirements, formatUnityRequirements } from '../src/unityRequirements';

let registered = false;

export function registerBlocks(): void {
  if (registered) return;
  registered = true;
  Blockly.common.defineBlocks(libraryBlocks);
  Blockly.common.defineBlocks(blocks);

  // Same dummy generators as src/index.ts
  const dummyGen = () => '';
  const dummyValueGen = (): [string, number] => ['0', Order.ATOMIC];
  Object.keys(blocks).forEach((type) => {
    const def = (blocks as any)[type];
    javascriptGenerator.forBlock[type] = def.output !== undefined ? dummyValueGen : dummyGen;
  });
}

export function loadWorkspace(state: object): Blockly.Workspace {
  registerBlocks();
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(state, ws);
  return ws;
}

export function saveWorkspace(ws: Blockly.Workspace): object {
  return Blockly.serialization.workspaces.save(ws);
}

function convert(ws: Blockly.Workspace) {
  const log = console.log;
  console.log = () => {}; // workspaceToProgram logs top blocks
  try {
    return workspaceToProgram(ws, javascriptGenerator as any);
  } finally {
    console.log = log;
  }
}

/** Full conversion result (program, errors, warnings) for a workspace state. */
export function convertState(state: object) {
  return convert(loadWorkspace(state));
}

/** Conversion errors for a workspace state (empty when it converts cleanly). */
export function conversionErrors(state: object): string[] {
  return convert(loadWorkspace(state)).errors;
}

/** Blockly workspace state -> generated code. Throws if conversion reports errors. */
export function generateCode(state: object, options: { trace?: boolean } = {}): string {
  const result = convert(loadWorkspace(state));
  if (result.errors.length > 0) throw new Error(`conversion errors:\n${result.errors.join('\n')}`);
  return programToJS(result.program, options);
}

/** Runs the same pipeline as generateCode() in src/index.ts and renders a stable text report. */
export function generateReport(ws: Blockly.Workspace): string {
  const result = convert(ws);

  const sections: string[] = [];
  sections.push('// ==== errors ====', ...result.errors);
  sections.push('// ==== warnings ====', ...result.warnings);
  if (result.errors.length === 0) {
    sections.push('// ==== unity requirements ====', formatUnityRequirements(collectUnityRequirements(result.program)));
    sections.push('// ==== code ====', programToJS(result.program));
  }
  return sections.join('\n').replace(/\r\n/g, '\n').trimEnd() + '\n';
}
