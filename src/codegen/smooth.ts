/**
 * "〜秒かけて動かす / 回す": the start (where the block is), and the per-frame step.
 *
 * The state is kept per block (keys from the block id) as whole Vector3 / Quaternion values:
 *   move:   active, elapsed, duration, from (position), to (position)
 *   rotate: active, elapsed, duration, from (rotation), delta (Euler angles, applied like rotate_by)
 * The prefixes are new (older scripts used per-component keys), so state left by an older version of
 * the script is never read as this format.
 *
 * A smooth block placed directly in a sequence is run by the sequence itself, so the sequence waits for it
 * (sequence.ts); everywhere else the program's onUpdate moves it on (smoothUpdatesToJS).
 */

import type { Expr, Handler, Program, Stmt } from '../ir';
import { atLeastJS, exprToJS } from './expr';
import { bare } from './format';
import { describeStmt } from './describe';
import { traceLine } from './trace';
import { jsString, safeId } from './shared';
import { placeAt, positionNow, rotationNow, turnTo, usesPose } from './pose';

export type SmoothMoveStmt = Extract<Stmt, { kind: 'smooth_move_by' | 'smooth_move_local' }>;
export type SmoothRotateStmt = Extract<Stmt, { kind: 'smooth_rotate_by' }>;
export type SmoothStmt = SmoothMoveStmt | SmoothRotateStmt;

export function isSmooth(stmt: Stmt): stmt is SmoothStmt {
  return stmt.kind === 'smooth_move_by' || stmt.kind === 'smooth_move_local' || stmt.kind === 'smooth_rotate_by';
}

type Keys = { active: string; elapsed: string; duration: string; from: string; to: string };

/** Quoted $.state keys of one smooth block (`to` is the end position, or the rotation's Euler delta). */
function keysOf(stmt: SmoothStmt): Keys {
  const prefix = stmt.kind === 'smooth_rotate_by' ? `__jpp_smooth_rot_${safeId(stmt.blockId)}` : `__jpp_smooth_pos_${safeId(stmt.blockId)}`;
  const key = (name: string) => jsString(`${prefix}_${name}`);
  return {
    active: key('active'),
    elapsed: key('elapsed'),
    duration: key('duration'),
    from: key('from'),
    to: stmt.kind === 'smooth_rotate_by' ? key('delta') : key('to'),
  };
}

/** The $.state key that says whether the block is moving (for the sequence step). */
export function smoothActiveKey(stmt: SmoothStmt): string {
  return keysOf(stmt).active;
}

const vec = (x: Expr, y: Expr, z: Expr) => `new Vector3(${bare(exprToJS(x))}, ${bare(exprToJS(y))}, ${bare(exprToJS(z))})`;

/** Starts the block: remembers where it starts, what to do and for how long (statements, no braces). */
export function smoothStartLines(stmt: SmoothStmt): string[] {
  const k = keysOf(stmt);
  const head = [
    `$.state[${k.active}] = true;`,
    `$.state[${k.elapsed}] = 0;`,
    `$.state[${k.duration}] = ${bare(atLeastJS(0.001, stmt.duration))};`,
  ];
  if (stmt.kind === 'smooth_rotate_by') {
    return [
      '// 回り始め: 今の向きと回す量を覚えて、毎フレーム少しずつ回す',
      ...head,
      `$.state[${k.from}] = ${bare(rotationNow())};`,
      `$.state[${k.to}] = ${vec(stmt.x, stmt.y, stmt.z)};`,
    ];
  }
  // Local moves are turned into world space once, with the facing at the start of the move.
  const facing = stmt.kind === 'smooth_move_local' ? `.applyQuaternion(${bare(rotationNow())})` : '';
  return [
    '// 動き始め: 始点と終点を覚えて、毎フレーム少しずつ動かす',
    `const from = ${bare(positionNow())};`,
    ...head,
    `$.state[${k.from}] = from;`,
    `$.state[${k.to}] = from.clone().add(${vec(stmt.x, stmt.y, stmt.z)}${facing});`,
  ];
}

/**
 * One frame of the block, spending `time` seconds: defines `duration`, `elapsed` (after this frame)
 * and, when asked or needed, `before` (elapsed before this frame). Statements, no braces.
 */
export function smoothStepLines(stmt: SmoothStmt, time: string, needBefore: boolean): string[] {
  const k = keysOf(stmt);
  const composed = usesPose(stmt.kind === 'smooth_rotate_by' ? 'rotation' : 'position');
  const lines = [`const duration = $.state[${k.duration}];`];
  if (composed || needBefore) {
    lines.push(`const before = $.state[${k.elapsed}];`, `const elapsed = Math.min(duration, before + ${time});`);
  } else {
    lines.push(`const elapsed = Math.min(duration, $.state[${k.elapsed}] + ${time});`);
  }
  lines.push(`$.state[${k.elapsed}] = elapsed;`);

  if (stmt.kind === 'smooth_rotate_by') {
    lines.push(`const delta = $.state[${k.to}];`);
    if (composed) {
      return lines.concat([
        '// 前のフレームまでに回した分を戻してから、今のフレームまでの分を回す（ほかの回転と足し合わせるため）',
        'const undo = new Quaternion().setFromEulerAngles(delta.clone().multiplyScalar(before / duration)).invert();',
        'const redo = new Quaternion().setFromEulerAngles(delta.clone().multiplyScalar(elapsed / duration));',
        turnTo(`${rotationNow()}.multiply(undo).multiply(redo)`),
      ]);
    }
    return lines.concat([
      `const from = $.state[${k.from}];`,
      '// 「角度を〜だけ変える」と同じ回し方で、回す量を 経った時間の割合（0〜1）だけ進める',
      'const turned = new Quaternion().setFromEulerAngles(delta.clone().multiplyScalar(elapsed / duration));',
      turnTo('from.clone().multiply(turned)'),
    ]);
  }

  lines.push(`const from = $.state[${k.from}];`, `const to = $.state[${k.to}];`);
  if (composed) {
    return lines.concat([
      '// 前のフレームから進んだ割合の分だけ動かす（ほかの動きと足し合わせるため）',
      'const move = to.clone().sub(from).multiplyScalar((elapsed - before) / duration);',
      placeAt(`${positionNow()}.add(move)`),
    ]);
  }
  return lines.concat([
    '// 始点から終点へ、経った時間の割合（0〜1）だけ進める。最後はちょうど終点に置く',
    placeAt('elapsed < duration ? from.clone().lerp(to, elapsed / duration) : to'),
  ]);
}

/** Smooth blocks the onUpdate moves on: all of them except those placed directly in a sequence. */
function freeSmoothBlocks(program: Program): SmoothStmt[] {
  const found: SmoothStmt[] = [];
  const visit = (stmt: Stmt) => {
    if (isSmooth(stmt)) {
      found.push(stmt);
      return;
    }
    switch (stmt.kind) {
      case 'if':
        stmt.thenBody.forEach(visit);
        stmt.elseBody?.forEach(visit);
        break;
      case 'if_edge':
      case 'run_for_seconds':
        stmt.body.forEach(visit);
        break;
      case 'sequence':
        // The sequence runs its own smooth steps (and waits for them).
        stmt.body.filter((s) => !isSmooth(s)).forEach(visit);
        break;
    }
  };
  const handlers: (Handler | undefined)[] = [
    program.onStart,
    program.onUpdate,
    program.onInteract,
    program.onCollide,
    program.onGrabStart,
    program.onGrabEnd,
    ...(program.onReceives ?? []).map((r) => r.handler),
  ];
  for (const handler of handlers) handler?.body.forEach(visit);
  // Moves first, then rotations (as before).
  return [...found.filter((s) => s.kind !== 'smooth_rotate_by'), ...found.filter((s) => s.kind === 'smooth_rotate_by')];
}

/** The onUpdate part that moves on every smooth block that is running (one `if` per block), or ''. */
export function smoothUpdatesToJS(program: Program): string {
  return freeSmoothBlocks(program)
    .map((stmt) => {
      const k = keysOf(stmt);
      const trace = traceLine(stmt, 'tick').trimEnd();
      const body = [
        ...(trace ? [trace] : []),
        ...smoothStepLines(stmt, 'deltaTime', false),
        'if (elapsed >= duration) {',
        `  $.state[${k.active}] = false;`,
        '}',
      ];
      return [`// 「${describeStmt(stmt)}」の途中の動き`, `if ($.state[${k.active}]) {`, ...body.map((line) => `  ${line}`), '}'].join('\n');
    })
    .join('\n\n');
}
