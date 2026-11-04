/**
 * Saving / loading the workspace (src/serialization.ts): data that cannot be read (broken JSON, unknown
 * block types) leaves the workspace as it was and Blockly's events on, so autosave, warnings and code
 * generation keep working. The browser parts (localStorage, confirm / alert, file input) are stubbed.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import { registerBlocks } from './harness';
import { b, onEvent, workspace } from './build';
import { load, loadFromFile } from '../src/serialization';

registerBlocks();

const g = globalThis as Record<string, unknown>;
const dialogs: string[] = [];
const storage = new Map<string, string>();
g.window = { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) } };
g.confirm = (m: string) => (dialogs.push(m), false);
g.alert = (m: string) => dialogs.push(m);

/** Makes loadFromFile's file dialog pick a file with this text (null: reading the file fails). */
function pickFile(text: string | null) {
  g.document = {
    createElement: () => {
      let onChange: () => void = () => undefined;
      return { files: [{}], addEventListener: (_: string, f: () => void) => (onChange = f), click: () => onChange() };
    },
  };
  g.FileReader = class {
    result = text;
    error = text === null ? new Error('the file is gone') : null;
    onload: () => void = () => undefined;
    onerror: () => void = () => undefined;
    readAsText() {
      if (text === null) this.onerror();
      else this.onload();
    }
  };
}

const good = workspace(onEvent('jcreatepp_on_interact', [b('jcreatepp_save_position')]));
const unknown = { blocks: { languageVersion: 0, blocks: [{ type: 'jcreatepp_future_block', id: 'f' }] } };
const typesIn = (ws: Blockly.Workspace) => ws.getAllBlocks(false).map((x) => x.type).sort();

test('load: saved blocks that can be read are restored', () => {
  storage.set('jcreatepp-workspace', JSON.stringify(good));
  const ws = new Blockly.Workspace();
  load(ws);
  assert.deepEqual(typesIn(ws), ['jcreatepp_on_interact', 'jcreatepp_save_position']);
  assert.equal(Blockly.Events.isEnabled(), true);
  ws.dispose();
});

for (const [name, text] of [
  ['unknown block types', JSON.stringify(unknown)],
  ['broken JSON', '{"blocks": '],
  ['not an object', '[1, 2]'],
] as const) {
  test(`load: ${name} start empty, keep events on, and offer the data as a file`, () => {
    storage.set('jcreatepp-workspace', text);
    dialogs.length = 0;
    const ws = new Blockly.Workspace();
    load(ws);
    assert.deepEqual(typesIn(ws), []);
    assert.equal(Blockly.Events.isEnabled(), true);
    assert.equal(Blockly.Events.getRecordUndo(), true, 'Undo still recorded');
    assert.equal(Blockly.Events.getGroup(), '');
    assert.equal(dialogs.length, 1);
    assert.match(dialogs[0], /読み込めなかった/);
    ws.dispose();
  });
}

test('open a file: a file that cannot be read keeps the current blocks; a good one loads and calls back', () => {
  const ws = new Blockly.Workspace();
  pickFile(JSON.stringify(good));
  let loaded = 0;
  loadFromFile(ws, () => loaded++);
  assert.equal(loaded, 1);
  assert.deepEqual(typesIn(ws), ['jcreatepp_on_interact', 'jcreatepp_save_position']);

  for (const text of [JSON.stringify(unknown), 'not json', null]) {
    dialogs.length = 0;
    pickFile(text);
    loadFromFile(ws, () => loaded++);
    assert.equal(loaded, 1, 'not called back');
    assert.deepEqual(typesIn(ws), ['jcreatepp_on_interact', 'jcreatepp_save_position'], 'current blocks kept');
    assert.equal(Blockly.Events.isEnabled(), true);
    assert.equal(Blockly.Events.getRecordUndo(), true, 'Undo still recorded');
    assert.equal(dialogs.length, 1);
  }
  ws.dispose();
});
