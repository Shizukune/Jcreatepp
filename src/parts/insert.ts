/**
 * Adding a part (src/parts/catalog.ts) to a Blockly workspace. No DOM: works on headless workspaces.
 *
 * Order of work:
 *  1. refuse when the part would fight existing blocks over position / rotation
 *  2. choose variable names that are not in use yet (per kind, like $.state keys)
 *  3. try the result on a throwaway copy of the workspace; refuse when it adds conversion errors
 *  4. add the blocks to the real workspace as one undo step
 */

import * as Blockly from 'blockly/core';
import { blockVariableAccess } from '../blocks/variableBlocks';
import { blockLabel } from '../blocks/placement';
import { UNIQUE_EVENT_BLOCK_TYPES } from '../blocks/context';
import { chain, type BlockJson } from '../demos/blockJson';
import { convertState } from '../demos/playback';
import type { VariableKind } from '../variables';
import type { Channel, Part, PartExpansion, PartValues } from './catalog';

/** Blocks that set the item's position / rotation (all of them, wherever they are placed). */
const WRITERS: Record<string, Channel[]> = {
  jcreatepp_set_position: ['position'],
  jcreatepp_add_position: ['position'],
  jcreatepp_smooth_move_by: ['position'],
  jcreatepp_move_local: ['position'],
  jcreatepp_smooth_move_local: ['position'],
  jcreatepp_random_warp: ['position'],
  jcreatepp_load_position: ['position'],
  jcreatepp_add_force: ['position'],
  jcreatepp_oscillate: ['position'],
  jcreatepp_timed_random_warp: ['position'],
  jcreatepp_timed_move_return: ['position'],
  jcreatepp_set_rotation: ['rotation'],
  jcreatepp_add_rotation: ['rotation'],
  jcreatepp_smooth_rotate_by: ['rotation'],
  jcreatepp_continuous_rotation: ['rotation'],
  jcreatepp_ride_template: ['position', 'rotation'],
  jcreatepp_chase_template: ['position', 'rotation'],
};

/** Channels a block type writes (empty when it does not move the item). */
export function channelsWrittenBy(type: string): Channel[] {
  return WRITERS[type] ?? [];
}

const CHANNEL_LABEL: Record<Channel, string> = { position: '位置', rotation: '角度' };

/** Event blocks that may appear only once (same list as the converter); parts add into the existing one. */
const UNIQUE_EVENTS = new Set<string>(UNIQUE_EVENT_BLOCK_TYPES);

export type InsertResult = { ok: true; blockIds: string[] } | { ok: false; reason: string };

/** Why the part cannot be added to this workspace (or null when it can). */
export function partConflict(ws: Blockly.Workspace, part: Part): string | null {
  for (const channel of part.writes) {
    const labels = new Set<string>();
    for (const b of ws.getAllBlocks(false)) {
      if (WRITERS[b.type]?.includes(channel)) labels.add(blockLabel(b.type));
    }
    if (labels.size > 0) {
      const list = [...labels].map((l) => `「${l}」`).join('');
      return `${list}がもう${CHANNEL_LABEL[channel]}を動かしています。「${part.label}」も${CHANNEL_LABEL[channel]}を動かすので、動きがぶつかります（今は追加できません）。`;
    }
  }
  return null;
}

/** Names in use per variable kind (flags and boolean variables share the 'bool' kind). */
export function usedNames(ws: Blockly.Workspace): Map<VariableKind, Set<string>> {
  const used = new Map<VariableKind, Set<string>>();
  for (const b of ws.getAllBlocks(false)) {
    const access = blockVariableAccess(b.type, (name) => b.getFieldValue(name));
    if (!access) continue;
    if (!used.has(access.kind)) used.set(access.kind, new Set());
    used.get(access.kind)!.add(access.name);
  }
  return used;
}

export function allocateNames(ws: Blockly.Workspace, part: Part): Record<string, string> {
  const used = usedNames(ws);
  const names: Record<string, string> = {};
  for (const need of part.names) {
    const taken = used.get(need.kind) ?? new Set<string>();
    let name = need.base;
    for (let i = 2; taken.has(name); i++) name = `${need.base}${i}`;
    taken.add(name);
    used.set(need.kind, taken);
    names[need.key] = name;
  }
  return names;
}

function bottomOfWorkspace(ws: Blockly.Workspace): number {
  let bottom = 0;
  for (const b of ws.getTopBlocks(false)) {
    const height = b instanceof Blockly.BlockSvg ? b.getHeightWidth().height : 120;
    bottom = Math.max(bottom, b.getRelativeToSurfaceXY().y + height);
  }
  return bottom;
}

/** Adds the expansion; returns the ids of the blocks it created (top block of each pasted chain). */
function applyExpansion(ws: Blockly.Workspace, expansion: PartExpansion, recordUndo: boolean): string[] {
  const ids: string[] = [];
  let y = bottomOfWorkspace(ws) + 40;
  for (const ev of expansion.events) {
    const body = chain(ev.body);
    const existing = UNIQUE_EVENTS.has(ev.eventType) ? ws.getTopBlocks(true).find((b) => b.type === ev.eventType) : undefined;
    if (existing && body) {
      const pasted = Blockly.serialization.blocks.append(body, ws, { recordUndo });
      const input = existing.getInput('DO')?.connection;
      if (!input || !pasted.previousConnection) throw new Error(`cannot connect into ${ev.eventType}`);
      let last = input.targetBlock();
      while (last?.getNextBlock()) last = last.getNextBlock();
      if (last?.nextConnection) last.nextConnection.connect(pasted.previousConnection);
      else input.connect(pasted.previousConnection);
      ids.push(pasted.id);
    } else if (!existing) {
      const json: BlockJson = { type: ev.eventType, x: 40, y };
      if (ev.eventFields) json.fields = { ...ev.eventFields };
      if (body) json.inputs = { DO: { block: body } };
      const created = Blockly.serialization.blocks.append(json, ws, { recordUndo });
      ids.push(created.id);
      y += 200;
    }
  }
  return ids;
}

function countErrors(errors: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of errors) counts.set(e, (counts.get(e) ?? 0) + 1);
  return counts;
}

/** Adds `part` with `values` to `ws` as one undo step, or explains why it cannot. */
export function insertPart(ws: Blockly.Workspace, part: Part, values: PartValues): InsertResult {
  const conflict = partConflict(ws, part);
  if (conflict) return { ok: false, reason: conflict };

  const names = allocateNames(ws, part);
  const expansion = part.expand(values, names);

  // Try it on a copy first, so a failure never leaves half a part behind.
  const state = Blockly.serialization.workspaces.save(ws);
  const before = countErrors(convertState(state).errors);
  const scratch = new Blockly.Workspace();
  let added: string[];
  try {
    Blockly.serialization.workspaces.load(state, scratch);
    applyExpansion(scratch, expansion, false);
    const scratchState = Blockly.serialization.workspaces.save(scratch);
    // Compare counts per message: the same message twice means the part added an error too.
    const after = countErrors(convertState(scratchState).errors);
    added = [...after].filter(([message, count]) => count > (before.get(message) ?? 0)).map(([message]) => message);
  } finally {
    scratch.dispose();
  }
  if (added.length > 0) return { ok: false, reason: `追加するとエラーになります: ${added.join(' / ')}` };

  const previousGroup = Blockly.Events.getGroup();
  Blockly.Events.setGroup(true);
  try {
    return { ok: true, blockIds: applyExpansion(ws, expansion, true) };
  } finally {
    Blockly.Events.setGroup(previousGroup || false);
  }
}
