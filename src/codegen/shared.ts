import type { Program, Stmt } from '../ir';
import { variableStateKey, type VariableKind } from '../variables';

export type SequenceStmt = Extract<Stmt, { kind: 'sequence' }>;

export function jsString(value: string): string {
  return JSON.stringify(value);
}

/** Quoted $.state key of a user variable (the naming rule lives in src/variables.ts). */
export function variableKeyJS(kind: VariableKind, name: string): string {
  return jsString(variableStateKey(kind, name));
}

/**
 * Block id -> identifier-safe text for state keys and JS names. Injective: every character other
 * than [a-zA-Z0-9] (including "_") becomes "_<hex code>_", so "a-b" and "a+b" never collide.
 * Alphanumeric ids are unchanged.
 */
export function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
}

export function smoothTransitionKeys(kind: 'move' | 'rotate', id: string): Record<
  'active' | 'elapsed' | 'duration' | 'fromX' | 'fromY' | 'fromZ' | 'toX' | 'toY' | 'toZ',
  string
> {
  const prefix = `__jpp_smooth_${kind}_${id}`;
  return {
    active: jsString(`${prefix}_active`),
    elapsed: jsString(`${prefix}_elapsed`),
    duration: jsString(`${prefix}_duration`),
    fromX: jsString(`${prefix}_from_x`),
    fromY: jsString(`${prefix}_from_y`),
    fromZ: jsString(`${prefix}_from_z`),
    toX: jsString(`${prefix}_to_x`),
    toY: jsString(`${prefix}_to_y`),
    toZ: jsString(`${prefix}_to_z`),
  };
}

/**
 * Smooth rotation state: start rotation (quaternion) and the Euler delta applied locally,
 * so the final rotation matches "rotate_by" (current * euler(delta)).
 * Uses its own prefix so state left by the older Euler-based format is never read.
 */
export function smoothRotateKeys(id: string): Record<
  'active' | 'elapsed' | 'duration' | 'fromQx' | 'fromQy' | 'fromQz' | 'fromQw' | 'deltaX' | 'deltaY' | 'deltaZ',
  string
> {
  const prefix = `__jpp_smooth_rotq_${id}`;
  return {
    active: jsString(`${prefix}_active`),
    elapsed: jsString(`${prefix}_elapsed`),
    duration: jsString(`${prefix}_duration`),
    fromQx: jsString(`${prefix}_from_qx`),
    fromQy: jsString(`${prefix}_from_qy`),
    fromQz: jsString(`${prefix}_from_qz`),
    fromQw: jsString(`${prefix}_from_qw`),
    deltaX: jsString(`${prefix}_delta_x`),
    deltaY: jsString(`${prefix}_delta_y`),
    deltaZ: jsString(`${prefix}_delta_z`),
  };
}

export function indent(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return code.replace(/^/gm, pad);
}

export function axisVector(axis: 'X' | 'Y' | 'Z'): string {
  switch (axis) {
    case 'X':
      return 'new Vector3(1, 0, 0)';
    case 'Y':
      return 'new Vector3(0, 1, 0)';
    case 'Z':
      return 'new Vector3(0, 0, 1)';
  }
}

function extractSequences(stmts: Stmt[]): SequenceStmt[] {
  let sequences: SequenceStmt[] = [];

  for (const stmt of stmts) {
    if (stmt.kind === 'sequence') {
      sequences.push(stmt);
    } else if (stmt.kind === 'if') {
      sequences = sequences.concat(extractSequences(stmt.thenBody));
      if (stmt.elseBody) {
        sequences = sequences.concat(extractSequences(stmt.elseBody));
      }
    } else if (stmt.kind === 'if_edge') {
      sequences = sequences.concat(extractSequences(stmt.body));
    }
  }

  return sequences;
}

export function getAllSequences(program: Program): SequenceStmt[] {
  let sequences: SequenceStmt[] = [];

  if (program.onStart) sequences = sequences.concat(extractSequences(program.onStart.body));
  if (program.onUpdate) sequences = sequences.concat(extractSequences(program.onUpdate.body));
  if (program.onInteract) sequences = sequences.concat(extractSequences(program.onInteract.body));
  if (program.onCollide) sequences = sequences.concat(extractSequences(program.onCollide.body));
  if (program.onGrabStart) sequences = sequences.concat(extractSequences(program.onGrabStart.body));
  if (program.onGrabEnd) sequences = sequences.concat(extractSequences(program.onGrabEnd.body));

  if (program.onReceives) {
    for (const receive of program.onReceives) {
      sequences = sequences.concat(extractSequences(receive.handler.body));
    }
  }

  return sequences;
}
