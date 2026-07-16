import type { Program, Stmt } from '../ir';

export type SequenceStmt = Extract<Stmt, { kind: 'sequence' }>;

export function jsString(value: string): string {
  return JSON.stringify(value);
}

export function stateKey(prefix: string, name: string): string {
  return jsString(prefix + name);
}

export function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '_');
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
