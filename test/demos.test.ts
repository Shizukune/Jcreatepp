/**
 * Block demos (src/demos): every demo converts, runs on the simulator without errors or
 * unsupported APIs, and really shows what it declares.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BLOCK_DEMOS } from '../src/demos/catalog';
import { recordState, type Track } from '../src/demos/playback';
import { toolbox } from '../src/toolbox';
import { registerBlocks } from './harness';

registerBlocks();

function moved(track: Track): boolean {
  const first = track.frames[0].position;
  return track.frames.some((f) => f.position.clone().sub(first).length() > 0.1);
}

function turned(track: Track): boolean {
  const q0 = track.frames[0].rotation;
  return track.frames.some((f) => {
    const q = f.rotation;
    const dot = Math.abs(q.x * q0.x + q.y * q0.y + q.z * q0.z + q.w * q0.w);
    return dot < Math.cos((1 * Math.PI) / 180 / 2);
  });
}

function toolboxTypes(node: unknown, out = new Set<string>()): Set<string> {
  if (node && typeof node === 'object') {
    const n = node as { kind?: string; type?: string; contents?: unknown[] };
    if (n.kind === 'block' && n.type) out.add(n.type);
    n.contents?.forEach((c) => toolboxTypes(c, out));
  }
  return out;
}

function containsType(state: unknown, type: string): boolean {
  return JSON.stringify(state).includes(`"type":"${type}"`);
}

for (const demo of BLOCK_DEMOS) {
  test(`demo ${demo.blockType}: converts, runs cleanly and shows ${demo.reproduces.join(' + ')}`, () => {
    assert.ok(containsType(demo.workspace, demo.blockType), 'the demo uses its own block');
    const track = recordState(demo.workspace, demo.seconds, demo.actions);
    assert.deepEqual(track.errors, []);
    assert.deepEqual(track.unsupported, []);
    assert.equal(track.frames.length, Math.round(demo.seconds * track.fps));
    if (demo.reproduces.includes('position')) assert.ok(moved(track), 'position changes');
    if (demo.reproduces.includes('rotation')) assert.ok(turned(track), 'rotation changes');
  });
}

test('demos: one per block type, all of them in the toolbox', () => {
  const types = BLOCK_DEMOS.map((d) => d.blockType);
  assert.equal(new Set(types).size, types.length);
  const inToolbox = toolboxTypes(toolbox);
  for (const type of types) assert.ok(inToolbox.has(type), type);
});
