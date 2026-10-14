/**
 * Blockly side of 3D editing (P4): which block the gizmo edits, and writing values back.
 *
 * Only number literals (math_number) that are currently connected are written. Inputs with
 * variables / expressions, or with nothing connected, make the block read-only in 3D; we never
 * create or replace blocks. One drag = one Blockly event group = one undo step.
 * No DOM access, so it runs in tests on a headless workspace.
 */

import * as Blockly from 'blockly/core';

export type EditMode = 'position' | 'move' | 'local' | 'rotation' | 'turn' | 'width';

export type Xyz = { x: number; y: number; z: number };

export type EditTarget = {
  blockId: string;
  mode: EditMode;
  label: string;
  values: Xyz;
  editable: boolean;
  reason?: string;
  /** 'width' mode only: the oscillation axis (values.x holds the width). */
  axis?: 'X' | 'Y' | 'Z';
};

const SUPPORTED: Record<string, { mode: EditMode; label: string }> = {
  jcreatepp_set_position: { mode: 'position', label: '位置を〜にする' },
  jcreatepp_add_position: { mode: 'move', label: '位置を〜ずつ変える' },
  jcreatepp_smooth_move_by: { mode: 'move', label: '位置を〜だけ〜秒かけて動かす' },
  jcreatepp_move_local: { mode: 'local', label: '向いている方向に進む' },
  jcreatepp_smooth_move_local: { mode: 'local', label: '向いている方向に〜秒かけて進む' },
  jcreatepp_set_rotation: { mode: 'rotation', label: '角度を〜にする' },
  jcreatepp_add_rotation: { mode: 'turn', label: '角度を〜ずつ変える' },
  jcreatepp_smooth_rotate_by: { mode: 'turn', label: '角度を〜だけ〜秒かけて回す' },
  jcreatepp_oscillate: { mode: 'width', label: '往復する' },
};

const XYZ_INPUTS: ReadonlyArray<readonly [keyof Xyz, string]> = [
  ['x', 'X'],
  ['y', 'Y'],
  ['z', 'Z'],
];
const WIDTH_INPUTS: ReadonlyArray<readonly [keyof Xyz, string]> = [['x', 'WIDTH']];

function inputsFor(mode: EditMode) {
  return mode === 'width' ? WIDTH_INPUTS : XYZ_INPUTS;
}

/**
 * The selected block, or the supported block whose value input contains it (e.g. a number inside).
 * Only climbs through output (value) connections, never to a previous statement in the stack.
 */
export function getEditTarget(selected: Blockly.Block | null): EditTarget | null {
  let block = selected;
  while (block && !SUPPORTED[block.type]) {
    block = block.outputConnection ? block.getParent() : null;
  }
  if (!block) return null;

  const { mode, label } = SUPPORTED[block.type];
  const values: Xyz = { x: 0, y: 0, z: 0 };
  let editable = true;
  for (const [key, input] of inputsFor(mode)) {
    const target = block.getInputTargetBlock(input);
    if (target && target.type === 'math_number') {
      values[key] = Number(target.getFieldValue('NUM')) || 0;
    } else {
      editable = false;
    }
  }
  const axis = mode === 'width' ? (block.getFieldValue('AXIS') as 'X' | 'Y' | 'Z') : undefined;
  const reason = mode === 'width'
    ? '幅が数値以外（変数・計算・空欄）のため、3Dからは編集できません'
    : 'X / Y / Z のどれかに数値以外（変数・計算・空欄）があるため、3Dからは編集できません';
  return editable
    ? { blockId: block.id, mode, label, values, editable, axis }
    : { blockId: block.id, mode, label, values, editable, axis, reason };
}

/** Writes x/y/z into the block's connected number literals as one undo step. */
export function applyEdit(workspace: Blockly.Workspace, blockId: string, values: Xyz): boolean {
  const block = workspace.getBlockById(blockId);
  const target = block ? getEditTarget(block) : null;
  if (!block || !target || target.blockId !== blockId || !target.editable) return false;

  const digits = target.mode === 'rotation' || target.mode === 'turn' ? 1 : 2;
  Blockly.Events.setGroup(true);
  try {
    for (const [key, input] of inputsFor(target.mode)) {
      const numberBlock = block.getInputTargetBlock(input);
      if (numberBlock && numberBlock.type === 'math_number') {
        const value = target.mode === 'width' ? Math.abs(values[key]) : values[key];
        numberBlock.setFieldValue(String(round(value, digits)), 'NUM');
      }
    }
  } finally {
    Blockly.Events.setGroup(false);
  }
  return true;
}

/** Of the angles equivalent to `angle` (mod 360), the one closest to `reference`. */
export function nearestAngle(angle: number, reference: number): number {
  return angle + 360 * Math.round((reference - angle) / 360);
}

/**
 * Of the Euler angle triples (ZXY order) describing the same rotation as `e`, the one closest to
 * `reference`: (x, y, z) and (180 - x, y + 180, z + 180), each shifted by multiples of 360.
 */
export function nearestEuler(e: Xyz, reference: Xyz): Xyz {
  const candidates = [e, { x: 180 - e.x, y: e.y + 180, z: e.z + 180 }].map((c) => ({
    x: nearestAngle(c.x, reference.x),
    y: nearestAngle(c.y, reference.y),
    z: nearestAngle(c.z, reference.z),
  }));
  const distance = (c: Xyz) => Math.abs(c.x - reference.x) + Math.abs(c.y - reference.y) + Math.abs(c.z - reference.z);
  return distance(candidates[0]) <= distance(candidates[1]) ? candidates[0] : candidates[1];
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  const r = Math.round(value * f) / f;
  return Object.is(r, -0) ? 0 : r;
}
