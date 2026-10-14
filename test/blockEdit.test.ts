/**
 * P4: writing 3D gizmo edits back to Blockly (src/preview/blockEdit.ts) on a headless workspace.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as Blockly from 'blockly/core';
import { applyEdit, getEditTarget, nearestAngle, nearestEuler } from '../src/preview/blockEdit';
import { Quaternion, Vector3 } from '../src/sim/math';
import { b, num, onEvent, workspace, xyz } from './build';
import { generateReport, loadWorkspace } from './harness';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(extra?: object) {
  const ws = loadWorkspace(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_set_position', { id: 'pos', inputs: xyz(1, 2, 3) }),
    b('jcreatepp_set_rotation', { id: 'rot', inputs: xyz(0, 350, 0) }),
    b('jcreatepp_add_position', { id: 'move', inputs: { X: b('jcreatepp_number_var', { fields: { VAR_NAME: 'dx' } }), Y: num(0), Z: num(0) } }),
    ...(extra ? [extra as any] : []),
  ])));
  return ws;
}

test('getEditTarget: supported block with numbers is editable', () => {
  const ws = setup();
  const t = getEditTarget(ws.getBlockById('pos'));
  assert.deepEqual(t && { mode: t.mode, values: t.values, editable: t.editable }, { mode: 'position', values: { x: 1, y: 2, z: 3 }, editable: true });
});

test('getEditTarget: a selected number inside resolves to its block; unsupported blocks give null', () => {
  const ws = setup();
  const numberInside = ws.getBlockById('pos')!.getInputTargetBlock('Y');
  assert.equal(getEditTarget(numberInside)?.blockId, 'pos');
  assert.equal(getEditTarget(ws.getTopBlocks(false)[0]), null, 'event block itself is not editable');
});

test('getEditTarget: an expression in any axis makes the block read-only', () => {
  const t = getEditTarget(setup().getBlockById('move'));
  assert.equal(t?.editable, false);
  assert.match(t?.reason ?? '', /数値以外/);
});

test('applyEdit writes the numbers and changes the generated code', () => {
  const ws = setup();
  assert.equal(applyEdit(ws, 'pos', { x: 4.567, y: -0.001, z: 6 }), true);
  assert.deepEqual(getEditTarget(ws.getBlockById('pos'))?.values, { x: 4.57, y: 0, z: 6 });
  assert.match(generateReport(ws), /new Vector3\(4\.57, 0, 6\)/);
});

test('applyEdit refuses read-only blocks and leaves expressions untouched', () => {
  const ws = setup();
  assert.equal(applyEdit(ws, 'move', { x: 9, y: 9, z: 9 }), false);
  const move = ws.getBlockById('move')!;
  assert.equal(move.getInputTargetBlock('X')?.type, 'jcreatepp_number_var');
  assert.equal(move.getInputTargetBlock('Y')?.getFieldValue('NUM'), 0);
});

test('one drag (three axes) is a single undo step', async () => {
  const ws = setup();
  await tick();
  ws.clearUndo();
  applyEdit(ws, 'pos', { x: 7, y: 8, z: 9 });
  await tick();
  ws.undo(false);
  await tick();
  assert.deepEqual(getEditTarget(ws.getBlockById('pos'))?.values, { x: 1, y: 2, z: 3 });
  ws.undo(true);
  await tick();
  assert.deepEqual(getEditTarget(ws.getBlockById('pos'))?.values, { x: 7, y: 8, z: 9 });
});

test('edited values survive save / load', () => {
  const ws = setup();
  applyEdit(ws, 'rot', { x: 0, y: 10, z: 0 });
  const reloaded = loadWorkspace(Blockly.serialization.workspaces.save(ws));
  assert.deepEqual(getEditTarget(reloaded.getBlockById('rot'))?.values, { x: 0, y: 10, z: 0 });
});

test('turn and width modes: targets and write-back', () => {
  const ws = loadWorkspace(workspace(
    onEvent('jcreatepp_on_interact', [b('jcreatepp_add_rotation', { id: 'turn', inputs: xyz(0, 30, 0) })]),
    onEvent('jcreatepp_on_update', [b('jcreatepp_oscillate', { id: 'osc', fields: { AXIS: 'Y' }, inputs: { WIDTH: num(2), SPEED: num(1) } })]),
  ));
  assert.deepEqual(getEditTarget(ws.getBlockById('turn'))?.mode, 'turn');
  const osc = getEditTarget(ws.getBlockById('osc'));
  assert.deepEqual(osc && { mode: osc.mode, axis: osc.axis, width: osc.values.x, editable: osc.editable }, { mode: 'width', axis: 'Y', width: 2, editable: true });
  assert.equal(applyEdit(ws, 'osc', { x: -3.456, y: 0, z: 0 }), true);
  assert.equal(ws.getBlockById('osc')!.getInputTargetBlock('WIDTH')!.getFieldValue('NUM'), 3.46, 'width is positive');
  assert.equal(ws.getBlockById('osc')!.getInputTargetBlock('SPEED')!.getFieldValue('NUM'), 1, 'speed untouched');
  assert.equal(applyEdit(ws, 'turn', { x: 0, y: 92.34, z: 0 }), true);
  assert.deepEqual(getEditTarget(ws.getBlockById('turn'))?.values, { x: 0, y: 92.3, z: 0 });
});

test('getEditTarget does not climb from a following statement to the previous move block', () => {
  const ws = loadWorkspace(workspace(onEvent('jcreatepp_on_start', [
    b('jcreatepp_add_position', { id: 'move', inputs: xyz(1, 0, 0) }),
    b('jcreatepp_save_position', { id: 'after' }),
  ])));
  assert.equal(getEditTarget(ws.getBlockById('after')), null);
});

test('nearestEuler picks the equivalent ZXY triple closest to the original values', () => {
  const ref = { x: 100, y: 20, z: 30 };
  const e = new Quaternion().setFromEulerAngles(new Vector3(100, 21, 30)).createEulerAngles();
  const r = nearestEuler({ x: e.x, y: e.y, z: e.z }, ref);
  assert.ok(Math.abs(r.x - 100) < 1e-6 && Math.abs(r.y - 21) < 1e-6 && Math.abs(r.z - 30) < 1e-6, JSON.stringify(r));
  // Same rotation either way.
  assert.ok(new Quaternion().setFromEulerAngles(new Vector3(r.x, r.y, r.z)).equals(new Quaternion().setFromEulerAngles(new Vector3(100, 21, 30))));
  // Turns beyond 360 are kept near the original.
  const turned = nearestEuler({ x: 0, y: 10, z: 0 }, { x: 0, y: 365, z: 0 });
  assert.equal(turned.y, 370);
});

test('nearestAngle keeps the angle closest to the original value', () => {
  assert.equal(nearestAngle(350, -10), -10);
  assert.equal(nearestAngle(10, 370), 370);
  assert.equal(nearestAngle(90, 90), 90);
  assert.equal(nearestAngle(270, -80), -90);
});
