/**
 * Blocks that set the item's position / rotation (all of them, wherever they are placed).
 * Shared by parts (src/parts/insert.ts: a part may not fight existing blocks) and by the editor
 * warnings about moves that cannot be added up (src/validator.ts). Update it when adding a motion block;
 * codegen has the same list per IR statement (src/codegen/pose.ts).
 */

export type Channel = 'position' | 'rotation';

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

/** Blocks that put the item at a place / facing (instead of moving it from where it is). */
const SETS: Record<string, Channel[]> = {
  jcreatepp_set_position: ['position'],
  jcreatepp_load_position: ['position'],
  jcreatepp_set_rotation: ['rotation'],
};

/** Channels a block type writes (empty when it does not move the item). */
export function channelsWrittenBy(type: string): Channel[] {
  return WRITERS[type] ?? [];
}

export const CHANNEL_LABEL: Record<Channel, string> = { position: '位置', rotation: '角度' };

/**
 * Why this block's move cannot be added to other moves of the same channel, or null when it can
 * (the generated code adds moves up: src/codegen/pose.ts).
 *  - physics: "力を加える" moves the item by physics
 *  - chase:   the chase gimmick sets the facing again every frame
 *  - set:     a block in SETS ("位置 / 角度を〜にする", "保存した位置に戻る") in every frame sets it
 *             again every frame
 * `event` is the event block the block is in (null for a gimmick placed on its own).
 */
export function uncombinable(type: string, channel: Channel, event: string | null): 'physics' | 'chase' | 'set' | null {
  if (type === 'jcreatepp_add_force' && channel === 'position') return 'physics';
  if (type === 'jcreatepp_chase_template' && channel === 'rotation') return 'chase';
  if (event === 'jcreatepp_on_update' && (SETS[type] ?? []).includes(channel)) return 'set';
  return null;
}
