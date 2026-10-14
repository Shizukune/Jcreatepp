/**
 * Block demos (A): a tiny program per toolbox block, played in the block's tooltip.
 * Each demo declares what it reproduces; test/demos.test.ts checks that it really does.
 */

import { block, event, num, workspaceState, type BlockJson } from './blockJson';
import type { PlaybackAction } from './playback';

export type BlockDemo = {
  blockType: string;
  /** One line under the animation. */
  caption: string;
  workspace: object;
  /** Loop length in seconds. */
  seconds: number;
  actions?: PlaybackAction[];
  /** What the animation shows (checked by tests: these must change during the demo). */
  reproduces: ('position' | 'rotation')[];
};

const xyz = (x: number, y: number, z: number): Record<string, BlockJson> => ({ X: num(x), Y: num(y), Z: num(z) });
const CLICK: PlaybackAction[] = [{ at: 0.5, kind: 'interact' }];

function demo(blockType: string, caption: string, top: BlockJson[], seconds: number, reproduces: BlockDemo['reproduces'], actions?: PlaybackAction[]): BlockDemo {
  return { blockType, caption, workspace: workspaceState(top), seconds, reproduces, actions };
}

export const BLOCK_DEMOS: BlockDemo[] = [
  demo('jcreatepp_set_position', 'クリックすると、その位置へ一瞬で移動', [
    event('jcreatepp_on_interact', [block('jcreatepp_set_position', undefined, xyz(1.5, 1, 0))]),
  ], 2, ['position'], CLICK),
  demo('jcreatepp_add_position', '毎フレーム少しずつ動き続ける', [
    event('jcreatepp_on_update', [block('jcreatepp_add_position', undefined, xyz(0.02, 0, 0))]),
  ], 3, ['position']),
  demo('jcreatepp_smooth_move_by', 'クリックすると、1秒かけて上へ', [
    event('jcreatepp_on_interact', [block('jcreatepp_smooth_move_by', undefined, { ...xyz(0, 1, 0), DURATION: num(1) })]),
  ], 2.5, ['position'], CLICK),
  demo('jcreatepp_move_local', '向いている方向（黄色い先端）へ進み続ける', [
    event('jcreatepp_on_start', [block('jcreatepp_set_rotation', undefined, xyz(0, 45, 0))]),
    event('jcreatepp_on_update', [block('jcreatepp_move_local', undefined, xyz(0, 0, 0.03))]),
  ], 3, ['position']),
  demo('jcreatepp_smooth_move_local', 'クリックすると、向いている方向へ1.5秒かけて進む', [
    event('jcreatepp_on_start', [block('jcreatepp_set_rotation', undefined, xyz(0, -45, 0))]),
    event('jcreatepp_on_interact', [block('jcreatepp_smooth_move_local', undefined, { ...xyz(0, 0, 2), DURATION: num(1.5) })]),
  ], 3, ['position'], CLICK),
  demo('jcreatepp_set_rotation', 'クリックすると、その角度に一瞬でなる', [
    event('jcreatepp_on_interact', [block('jcreatepp_set_rotation', undefined, xyz(0, 90, 0))]),
  ], 2, ['rotation'], CLICK),
  demo('jcreatepp_add_rotation', '毎フレーム少しずつ回り続ける', [
    event('jcreatepp_on_update', [block('jcreatepp_add_rotation', undefined, xyz(0, 2, 0))]),
  ], 3, ['rotation']),
  demo('jcreatepp_smooth_rotate_by', 'クリックすると、1秒かけて90°回る', [
    event('jcreatepp_on_interact', [block('jcreatepp_smooth_rotate_by', undefined, { ...xyz(0, 90, 0), DURATION: num(1) })]),
  ], 2.5, ['rotation'], CLICK),
  demo('jcreatepp_continuous_rotation', 'Y軸のまわりを1秒に90°で回り続ける', [
    event('jcreatepp_on_update', [block('jcreatepp_continuous_rotation', { AXIS: 'Y' }, { SPEED: num(90) })]),
  ], 4, ['rotation']),
  demo('jcreatepp_oscillate', '左右に行ったり来たりする', [
    event('jcreatepp_on_update', [block('jcreatepp_oscillate', { AXIS: 'X' }, { WIDTH: num(1), SPEED: num(1) })]),
  ], 4, ['position']),
];

export function findDemo(blockType: string): BlockDemo | undefined {
  return BLOCK_DEMOS.find((d) => d.blockType === blockType);
}
