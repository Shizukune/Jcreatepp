/**
 * Optional execution tracing for the 3D preview.
 *
 * When enabled (programToJS(program, { trace: true })), generated code calls
 * `__jpp_trace(blockId, phase)` so the preview can highlight running blocks.
 * Disabled by default: the code for Cluster must not change.
 */

import type { Stmt } from '../ir';
import { jsString } from './shared';

export type TracePhase = 'run' | 'wait' | 'tick';

let enabled = false;

/** Runs `fn` with tracing switched on or off; codegen is synchronous so a scoped flag is enough. */
export function withTrace<T>(on: boolean, fn: () => T): T {
  const previous = enabled;
  enabled = on;
  try {
    return fn();
  } finally {
    enabled = previous;
  }
}

/** Returns a trace call line (with trailing newline) or '' when tracing is off. */
export function traceLine(stmt: Stmt, phase: TracePhase): string {
  if (!enabled || !stmt.src) return '';
  return `__jpp_trace(${jsString(stmt.src.blockId)}, ${jsString(phase)});\n`;
}
