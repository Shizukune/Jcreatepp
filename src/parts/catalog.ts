/**
 * Parts (B): ready-made behaviors that are added to the workspace as ordinary blocks.
 *
 * Two layers per part:
 *  - meaning: parameters, what the part writes (position / rotation), the names it needs.
 *    This layer does not depend on Blockly, so a 3D editor / Unity side could reuse it.
 *  - expand(): the Blockly block JSON (save format) for given parameter values and names.
 * After insertion the blocks are not linked to the part any more (v1).
 */

import { block, num, type BlockJson } from '../demos/blockJson';
import type { VariableKind } from '../variables';

export type Channel = 'position' | 'rotation';

export type PartParam =
  | { key: string; label: string; kind: 'number'; default: number; min: number; max: number; step: number }
  | { key: string; label: string; kind: 'axis'; default: 'X' | 'Y' | 'Z' };

export type PartValues = Record<string, number | string>;

export type PartExpansion = {
  /** Statements to put into an event. Unique events are reused; receive events are always new. */
  events: { eventType: string; eventFields?: BlockJson['fields']; body: BlockJson[] }[];
};

export type Part = {
  id: string;
  label: string;
  description: string;
  /** 'single' = about one block (B1), 'set' = a group of blocks that makes a gimmick (B2). */
  size: 'single' | 'set';
  params: PartParam[];
  /** Transform channels the part changes. Two writers of one channel would fight, so this is checked. */
  writes: Channel[];
  /** Variables the part needs; the actual names are chosen to avoid names already in use. */
  names: { key: string; kind: VariableKind; base: string }[];
  expand(values: PartValues, names: Record<string, string>): PartExpansion;
};

const n = (values: PartValues, key: string) => Number(values[key]);
const axis = (values: PartValues, key: string) => String(values[key]);

export const PARTS: Part[] = [
  {
    id: 'spin',
    label: '回り続ける',
    description: '毎フレーム、決めた軸のまわりを回り続けます。',
    size: 'single',
    params: [
      { key: 'axis', label: '軸', kind: 'axis', default: 'Y' },
      { key: 'speed', label: '速さ（度/秒）', kind: 'number', default: 90, min: -720, max: 720, step: 10 },
    ],
    writes: ['rotation'],
    names: [],
    expand: (v) => ({
      events: [{ eventType: 'jcreatepp_on_update', body: [block('jcreatepp_continuous_rotation', { AXIS: axis(v, 'axis') }, { SPEED: num(n(v, 'speed')) })] }],
    }),
  },
  {
    id: 'bob',
    label: '往復する',
    description: '今の位置を中心に、決めた方向へ行ったり来たりします。',
    size: 'single',
    params: [
      { key: 'axis', label: '方向', kind: 'axis', default: 'Y' },
      { key: 'width', label: '幅（m）', kind: 'number', default: 1, min: 0, max: 20, step: 0.5 },
      { key: 'speed', label: '速さ', kind: 'number', default: 1, min: 0, max: 10, step: 0.5 },
    ],
    writes: ['position'],
    names: [],
    expand: (v) => ({
      events: [{
        eventType: 'jcreatepp_on_update',
        body: [block('jcreatepp_oscillate', { AXIS: axis(v, 'axis') }, { WIDTH: num(n(v, 'width')), SPEED: num(n(v, 'speed')) })],
      }],
    }),
  },
  {
    id: 'touch_turn',
    label: '触ると回る',
    description: 'クリック（インタラクト）すると、その時の向きから決めた角度だけ滑らかに回ります。回っている途中でクリックすると、その向きから回し直します。',
    size: 'single',
    params: [
      { key: 'angle', label: '角度（度）', kind: 'number', default: 90, min: -360, max: 360, step: 15 },
      { key: 'seconds', label: '秒数', kind: 'number', default: 1, min: 0, max: 10, step: 0.5 },
    ],
    writes: ['rotation'],
    names: [],
    expand: (v) => ({
      events: [{
        eventType: 'jcreatepp_on_interact',
        body: [block('jcreatepp_smooth_rotate_by', undefined, { X: num(0), Y: num(n(v, 'angle')), Z: num(0), DURATION: num(n(v, 'seconds')) })],
      }],
    }),
  },
  {
    id: 'door',
    label: 'ドア（開け閉め）',
    description: 'クリックすると開き、もう一度クリックすると閉じます。動いている間のクリックは無視します。',
    size: 'set',
    params: [
      { key: 'angle', label: '開く角度（度）', kind: 'number', default: 90, min: -180, max: 180, step: 15 },
      { key: 'seconds', label: '秒数', kind: 'number', default: 1, min: 0.1, max: 10, step: 0.5 },
    ],
    writes: ['rotation'],
    names: [
      { key: 'open', kind: 'bool', base: 'ドアが開いている' },
      { key: 'moving', kind: 'cooldown', base: 'ドアが動いている' },
    ],
    expand: (v, names) => {
      const angle = n(v, 'angle');
      const seconds = n(v, 'seconds');
      const turn = (y: number) => block('jcreatepp_smooth_rotate_by', undefined, { X: num(0), Y: num(y), Z: num(0), DURATION: num(seconds) });
      const toggle = block('jcreatepp_if_else', undefined, { CONDITION: block('jcreatepp_flag', { FLAG_NAME: names.open }) });
      toggle.inputs!.DO = { block: { ...turn(-angle), next: { block: block('jcreatepp_set_flag', { FLAG_NAME: names.open, OPERATION: 'false' }) } } };
      toggle.inputs!.ELSE = { block: { ...turn(angle), next: { block: block('jcreatepp_set_flag', { FLAG_NAME: names.open, OPERATION: 'true' }) } } };
      const notMoving = block('jcreatepp_not', undefined, { BOOL: block('jcreatepp_cooldown_active', { COOLDOWN_NAME: names.moving }) });
      const guard = block('jcreatepp_if', undefined, { CONDITION: notMoving });
      guard.inputs!.DO = {
        block: { ...block('jcreatepp_start_cooldown', { COOLDOWN_NAME: names.moving }, { SECONDS: num(seconds) }), next: { block: toggle } },
      };
      return { events: [{ eventType: 'jcreatepp_on_interact', body: [guard] }] };
    },
  },
];

export function defaultValues(part: Part): PartValues {
  return Object.fromEntries(part.params.map((p) => [p.key, p.default]));
}
