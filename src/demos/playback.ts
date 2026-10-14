/**
 * Headless playback of a block workspace: blocks (save format) → IR → generated code → src/sim.
 * Shared by the block demos (A) and the parts palette (B). No DOM; runs in tests and the browser.
 * Blocks must already be registered (src/index.ts in the app, test/harness.ts in tests).
 */

import * as Blockly from 'blockly/core';
import { javascriptGenerator } from 'blockly/javascript';
import { workspaceToProgram } from '../generators/jcreatepp';
import { programToJS } from '../codegen';
import type { Program } from '../ir';
import type { Quaternion, Vector3 } from '../sim/math';
import { createRunner } from '../sim/runner';

/** Something done to the item during playback (like the preview's event buttons). */
export type PlaybackAction =
  | { at: number; kind: 'interact' }
  | { at: number; kind: 'receive'; message: string };

export type Track = {
  fps: number;
  frames: { position: Vector3; rotation: Quaternion }[];
  /** Runtime errors in the generated code. */
  errors: string[];
  /** `$` members the simulator does not reproduce (no-ops); see src/sim/clusterMock.ts. */
  unsupported: string[];
};

/** Converts a workspace state on a throwaway headless workspace. */
export function convertState(state: object): { program: Program; errors: string[] } {
  const ws = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(state, ws);
    const { program, errors } = workspaceToProgram(ws, javascriptGenerator as unknown as Blockly.CodeGenerator);
    return { program, errors };
  } finally {
    ws.dispose();
  }
}

/** Runs generated code for `seconds` and samples the item's transform `fps` times per second. */
export function recordCode(code: string, seconds: number, actions: PlaybackAction[] = [], fps = 30): Track {
  const runner = createRunner(code);
  const pending = [...actions].sort((a, b) => a.at - b.at);
  const dt = 1 / fps;
  const frames: Track['frames'] = [];
  runner.start();
  const count = Math.round(seconds * fps);
  for (let i = 0; i < count; i++) {
    while (pending.length > 0 && pending[0].at <= runner.time + 1e-9) {
      const action = pending.shift()!;
      if (action.kind === 'interact') runner.interact();
      else runner.receive(action.message);
    }
    frames.push({ position: runner.item.position.clone(), rotation: runner.item.rotation.clone() });
    runner.update(dt);
  }
  return { fps, frames, errors: runner.errors(), unsupported: [...runner.unsupported] };
}

/** Blocks → code → track. Throws when the blocks do not convert (demos and parts must always convert). */
export function recordState(state: object, seconds: number, actions: PlaybackAction[] = [], fps = 30): Track {
  const { program, errors } = convertState(state);
  if (errors.length > 0) throw new Error(`conversion errors:\n${errors.join('\n')}`);
  return recordCode(programToJS(program), seconds, actions, fps);
}
