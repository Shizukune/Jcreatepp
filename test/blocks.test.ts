/**
 * Every custom block type must be creatable and survive a save/load round-trip.
 * Guards saved-workspace compatibility when block definitions change.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import { blocks } from '../src/blocks/jcreatepp';
import { registerBlocks, saveWorkspace, loadWorkspace } from './harness';

test('all custom block types round-trip through save/load', () => {
  registerBlocks();
  const types = Object.keys(blocks);
  assert.ok(types.length > 0);

  for (const type of types) {
    const ws = new Blockly.Workspace();
    ws.newBlock(type);
    const saved = saveWorkspace(ws);
    const reloaded = loadWorkspace(saved);
    const topTypes = reloaded.getTopBlocks(false).map((b) => b.type);
    assert.deepEqual(topTypes, [type], `round-trip failed for ${type}`);
    assert.deepEqual(saveWorkspace(reloaded), saved, `serialized form changed for ${type}`);
  }
});
