/**
 * P9 groundwork: machine-readable Unity setup (src/unitySetup.ts).
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { numberLiteral, stringLiteral, type Program } from '../src/ir';
import { buildUnitySetup, CRAFT_ITEM_SCRIPT_MAX_BYTES, describeScriptSize, scriptByteLength } from '../src/unitySetup';
import { programToJS } from '../src/codegen/program';
import { convertState } from './harness';

const fixtureDir = path.resolve(__dirname, '../../test/fixtures');

test('scriptByteLength counts UTF-8 bytes like CCK', () => {
  assert.equal(scriptByteLength('abc'), 3);
  assert.equal(scriptByteLength('// 開始'), 9);
});

test('a script with no special needs only requires Item and ScriptableItem', () => {
  const setup = buildUnitySetup({ onStart: { body: [] } }, '');
  assert.deepEqual(setup.components, ['Item', 'ScriptableItem']);
  assert.deepEqual(setup.craftItemBlockers, []);
  assert.equal(setup.format, 'jcreatepp.unity-setup');
});

test('requirements map to CCK components and ID lists without duplicates', () => {
  const program: Program = {
    onInteract: {
      body: [
        { kind: 'play_audio', audioSetId: 'bell', volume: numberLiteral(1) },
        { kind: 'play_audio', audioSetId: 'bell', volume: numberLiteral(0.5) },
        { kind: 'move_by', x: numberLiteral(0), y: numberLiteral(1), z: numberLiteral(0) },
        { kind: 'send_message', target: { kind: 'world_item', itemName: 'door' }, message: 'open', blockId: 'b1' },
        { kind: 'set_subnode_text', subNodeName: 'Label', componentType: 'TextView', value: stringLiteral('hi') },
      ],
    },
  };
  const setup = buildUnitySetup(program, '');
  assert.deepEqual(setup.components, ['Item', 'ScriptableItem', 'MovableItem', 'ItemAudioSetList', 'WorldItemReferenceList']);
  assert.deepEqual(setup.audioSetIds, ['bell']);
  assert.deepEqual(setup.worldItemReferenceIds, ['door']);
  assert.deepEqual(setup.subNodes, [{ name: 'Label', componentType: 'TextView' }]);
  assert.equal(setup.craftItemBlockers.length, 1, 'world item reference is world-only');
  assert.ok(setup.checks.some((c) => c.includes('インタラクト')));
});

test('ride and grab add the components their events need', () => {
  const ride = buildUnitySetup({
    rideTemplate: { forwardSpeed: numberLiteral(1), upDownSpeed: numberLiteral(1), turnSpeed: numberLiteral(1), forward: 'z' },
  }, '');
  assert.deepEqual(ride.components, ['Item', 'ScriptableItem', 'MovableItem', 'RidableItem']);

  const grab = buildUnitySetup({ onGrabStart: { body: [] } }, '');
  assert.deepEqual(grab.components, ['Item', 'ScriptableItem', 'MovableItem', 'GrabbableItem']);

  const both = buildUnitySetup({ rideTemplate: { forwardSpeed: numberLiteral(1), upDownSpeed: numberLiteral(1), turnSpeed: numberLiteral(1), forward: 'z' }, onGrabEnd: { body: [] } }, '');
  assert.ok(both.craftItemBlockers.some((b) => b.includes('併用不可')));
});

test('uGUI / TextMeshPro text is flagged for craft items, TextView is not', () => {
  const setup = buildUnitySetup({
    onStart: { body: [{ kind: 'set_subnode_text', subNodeName: 'Score', componentType: 'TextMeshPro', value: stringLiteral('0') }] },
  }, '');
  assert.equal(setup.craftItemBlockers.length, 1);
});

test('script size over the craft item limit is reported', () => {
  const big = 'a'.repeat(CRAFT_ITEM_SCRIPT_MAX_BYTES + 1);
  assert.equal(buildUnitySetup({}, big).craftItemBlockers.length, 1);
  assert.equal(buildUnitySetup({}, 'a'.repeat(CRAFT_ITEM_SCRIPT_MAX_BYTES)).craftItemBlockers.length, 0);
});

test('every fixture produces a setup and stays under the craft item size limit', () => {
  for (const file of fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json') && f !== 'errors.json')) {
    const { program } = convertState(JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8')));
    if (!program) continue;
    const setup = buildUnitySetup(program, programToJS(program));
    assert.ok(setup.components.includes('ScriptableItem'), file);
    assert.ok(setup.script.bytes < CRAFT_ITEM_SCRIPT_MAX_BYTES, `${file}: ${setup.script.bytes} bytes`);
  }
});

test('random warp and load position need MovableItem (they call $.setPosition)', () => {
  const warp = buildUnitySetup({ onInteract: { body: [{ kind: 'random_warp', rangeX: numberLiteral(1), rangeZ: numberLiteral(1) }] } }, '');
  assert.ok(warp.components.includes('MovableItem'));
  const load = buildUnitySetup({ onInteract: { body: [{ kind: 'load_position' }] } }, '');
  assert.ok(load.components.includes('MovableItem'));
});

test('every fixture: code that moves the item requires MovableItem, audio / references / sub nodes match the code', () => {
  for (const file of fs.readdirSync(fixtureDir).filter((f) => f.endsWith('.json'))) {
    const { program } = convertState(JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8')));
    if (!program) continue;
    const code = programToJS(program);
    const setup = buildUnitySetup(program, code);
    const movesItem = /\$\.(setPosition|setRotation|addImpulsiveForce|addForce)\(/.test(code);
    assert.equal(setup.components.includes('MovableItem'), movesItem, `${file}: MovableItem`);
    for (const [, id] of code.matchAll(/\$\.audio\("([^"]*)"\)/g)) {
      assert.ok(setup.audioSetIds.includes(id), `${file}: audio ${id}`);
    }
    for (const [, id] of code.matchAll(/\$\.worldItemReference\("([^"]*)"\)/g)) {
      assert.ok(setup.worldItemReferenceIds.includes(id), `${file}: reference ${id}`);
    }
    for (const [, name] of code.matchAll(/\$\.subNode\("([^"]*)"\)/g)) {
      assert.ok(setup.subNodes.some((n) => n.name === name), `${file}: sub node ${name}`);
    }
  }
});

test('size note: under and over the craft item limit', () => {
  const under = describeScriptSize(6849);
  assert.equal(under.overCraftItemLimit, false);
  assert.ok(under.text.includes('6,849 / 20,000'));
  const over = describeScriptSize(20001);
  assert.equal(over.overCraftItemLimit, true);
  assert.ok(over.text.includes('20,001'));
  assert.equal(describeScriptSize(20000).overCraftItemLimit, false);
});
