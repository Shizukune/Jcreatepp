/**
 * The item's position / rotation as the script last set them ("remembered pose").
 *
 * Cluster's getPosition / getRotation return where the item is while it is still moving (it is
 * synced and interpolated over the network), not the value just given to setPosition / setRotation.
 * So two blocks that each "read, add, set" in the same frame lose all but the last one's change.
 * When more than one block moves the same thing (position or rotation), the generated code
 * reads and writes a copy kept in $.state instead, so their changes add up.
 *
 * Something else may move the item too (a hand, physics). The script also keeps where the item was
 * when it last moved it; while the item is on that way to the remembered pose (as interpolation shows
 * it), the remembered pose is used, and once it is off that way (more than 5 cm / 3 degrees from the
 * nearest point) the item's own transform is used again (helpers.ts). When the getters already show
 * the new pose (preview, tests), or once a read sees the item arrived, the way shrinks to the pose.
 * Known limit on Cluster: an outside move that leaves the item on the way of the last move (within
 * 5 cm / 3 degrees), before any read saw it arrive, looks like the item still on its way.
 *
 * Programs where only one block moves each thing are generated exactly as before.
 */

import type { Handler, Program, Stmt } from '../ir';
import { useHelper } from './helpers';

export type PoseChannel = 'position' | 'rotation';

/** $.state keys of the remembered pose (also used by helpers.ts). */
export const POSE_KEYS: Record<PoseChannel, string> = {
  position: '__jpp_pose_position',
  rotation: '__jpp_pose_rotation',
};

/** What each statement writes. add_force moves the item by physics: it is counted but never composed. */
function channelsOf(stmt: Stmt): PoseChannel[] {
  switch (stmt.kind) {
    case 'set_position':
    case 'move_by':
    case 'smooth_move_by':
    case 'move_local':
    case 'smooth_move_local':
    case 'random_warp':
    case 'load_position':
    case 'add_force':
    case 'oscillate':
    case 'timed_random_warp':
    case 'timed_move_return':
      return ['position'];
    case 'set_rotation':
    case 'rotate_by':
    case 'smooth_rotate_by':
    case 'continuous_rotation':
      return ['rotation'];
    default:
      return [];
  }
}

/** Every statement of the program, nested bodies included. */
export function allStatements(program: Program): Stmt[] {
  const out: Stmt[] = [];
  const visit = (stmt: Stmt) => {
    out.push(stmt);
    switch (stmt.kind) {
      case 'if':
        stmt.thenBody.forEach(visit);
        stmt.elseBody?.forEach(visit);
        break;
      case 'if_edge':
      case 'sequence':
      case 'run_for_seconds':
        stmt.body.forEach(visit);
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
  return out;
}

/** Which channels the program composes through the remembered pose. */
export function poseChannels(program: Program): Record<PoseChannel, boolean> {
  const count: Record<PoseChannel, number> = { position: 0, rotation: 0 };
  let physics = false;
  for (const stmt of allStatements(program)) {
    for (const channel of channelsOf(stmt)) count[channel]++;
    if (stmt.kind === 'add_force') physics = true;
  }
  // The ride and chase gimmicks move and turn the item every frame.
  for (const template of [program.rideTemplate, program.chaseTemplate]) {
    if (template) {
      count.position++;
      count.rotation++;
    }
  }
  return {
    // Physics owns the position of an item pushed by force; a remembered position would fight it.
    position: count.position >= 2 && !physics,
    rotation: count.rotation >= 2,
  };
}

let active: Record<PoseChannel, boolean> = { position: false, rotation: false };

/** Runs codegen for `program` with its remembered-pose channels switched on. */
export function withPose<T>(program: Program, fn: () => T): T {
  const previous = active;
  active = poseChannels(program);
  try {
    return fn();
  } finally {
    active = previous;
  }
}

/** Whether the channel is composed through the remembered pose in the program being generated. */
export function usesPose(channel: PoseChannel): boolean {
  return active[channel];
}

// The helpers come in pairs (read / write); using one emits both, so the explanation is always there.
const positionHelpers = () => (useHelper('placeItem'), useHelper('itemPosition'));
const rotationHelpers = () => (useHelper('turnItem'), useHelper('itemRotation'));

/** The item's position to start from: the remembered one when composing, else $.getPosition(). */
export function positionNow(): string {
  return usesPose('position') ? `${positionHelpers()}()` : '($.getPosition() || new Vector3(0, 0, 0))';
}

/** The item's rotation to start from: the remembered one when composing, else $.getRotation(). */
export function rotationNow(): string {
  return usesPose('rotation') ? `${rotationHelpers()}()` : '($.getRotation() || new Quaternion())';
}

/** Statement that moves the item to `vector` (and remembers it when composing). */
export function placeAt(vector: string): string {
  if (!usesPose('position')) return `$.setPosition(${vector});`;
  positionHelpers();
  return `placeItem(${vector});`;
}

/** Statement that turns the item to `quaternion` (and remembers it when composing). */
export function turnTo(quaternion: string): string {
  if (!usesPose('rotation')) return `$.setRotation(${quaternion});`;
  rotationHelpers();
  return `turnItem(${quaternion});`;
}

/** Statement that forgets the remembered pose (the next move starts from where the item really is). */
export function forgetPose(): string[] {
  return (['position', 'rotation'] as PoseChannel[]).filter(usesPose).map((c) => `$.state["${POSE_KEYS[c]}"] = null;`);
}
