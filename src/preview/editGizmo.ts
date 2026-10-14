/**
 * 3D editing (P4): a ghost of the selected block's result plus a move / rotate gizmo.
 * On drag end, the new X / Y / Z (Cluster coordinates) is reported once through onEdit.
 *
 * Relative blocks start from where the item was right before the block last ran, recorded from
 * "run" traces via recordRun(); until then the current position / rotation is used provisionally.
 */

import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Quaternion, Vector3 } from '../sim/math';
import type { Runner } from '../sim/runner';
import { safeId } from '../codegen/shared';
import { fromThreePosition, fromThreeQuaternion, toThreePosition, toThreeQuaternion } from './coords';
import { nearestEuler, type EditTarget, type Xyz } from './blockEdit';
import type { PreviewScene } from './scene';

export type EditGizmo = {
  /** New target from Blockly. During a drag, a different / changed target cancels the drag. */
  setTarget(target: EditTarget | null): void;
  /** The program changed: a drag in progress must not be written back. */
  codeChanged(): void;
  /** Called from "run" traces with the item's transform right before the block runs. */
  recordRun(blockId: string, position: Vector3, rotation: Quaternion): void;
  clearRuns(): void;
  /** Per frame: follow the item and the latest starting points. */
  update(): void;
};

export function createEditGizmo(options: {
  view: PreviewScene;
  editEl: HTMLElement;
  getRunner: () => Runner | null;
  /** Drag started: the preview stops playback so the starting point stays fixed. */
  onDragStart: () => void;
  onEdit?: (blockId: string, values: Xyz) => void;
}): EditGizmo {
  const { view, editEl, getRunner } = options;
  const { scene, camera, renderer, controls, item, itemParts } = view;

  const ghostMaterial = new THREE.MeshStandardMaterial({ color: 0x55ffcc, transparent: true, opacity: 0.35, depthWrite: false });
  const ghost = new THREE.Group();
  const ghostNose = new THREE.Mesh(itemParts.nose.geometry, ghostMaterial);
  ghostNose.position.copy(itemParts.nose.position);
  ghostNose.quaternion.copy(itemParts.nose.quaternion);
  ghost.add(new THREE.Mesh(itemParts.box.geometry, ghostMaterial), ghostNose);
  ghost.visible = false;
  scene.add(ghost);
  const moveLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: 0x55ffcc, dashSize: 0.2, gapSize: 0.1 }),
  );
  moveLine.visible = false;
  scene.add(moveLine);
  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSpace('world');
  scene.add(gizmo.getHelper());

  let editTarget: EditTarget | null = null;
  let dragging = false;
  // Set when the edited block / code changes mid-drag: the drag result is then discarded.
  let dragCancelled = false;
  let dragBasis = new Vector3();
  let dragBasisRot = new Quaternion();
  const runBasis = new Map<string, Vector3>();
  const runBasisRot = new Map<string, Quaternion>();

  gizmo.addEventListener('dragging-changed', (e) => {
    dragging = !!e.value;
    controls.enabled = !dragging;
    if (dragging) {
      options.onDragStart();
      dragCancelled = false;
      if (editTarget) {
        dragBasis = basisFor(editTarget);
        dragBasisRot = rotationBasisFor(editTarget);
      }
    } else {
      commit();
    }
  });

  function currentPosition(): Vector3 {
    const runner = getRunner();
    return runner ? runner.item.position.clone() : new Vector3();
  }

  /** Where the target block starts from: its last pre-execution position, else the current one. */
  function basisFor(t: EditTarget): Vector3 {
    if (t.mode === 'width') return oscillationOrigin(t);
    return runBasis.get(t.blockId)?.clone() ?? currentPosition();
  }

  /** The rotation the target block starts from (for relative turns and local moves). */
  function rotationBasisFor(t: EditTarget): Quaternion {
    const runner = getRunner();
    return runBasisRot.get(t.blockId)?.clone() ?? (runner ? runner.item.rotation.clone() : new Quaternion());
  }

  function storedOscillationOrigin(t: EditTarget): unknown {
    return getRunner()?.$.state[`__jpp_osc_init_pos_${safeId(t.blockId)}`];
  }

  /** "往復する" swings around the position stored when it first ran. */
  function oscillationOrigin(t: EditTarget): Vector3 {
    const stored = storedOscillationOrigin(t);
    return stored instanceof Vector3 ? stored.clone() : currentPosition();
  }

  /** Relative modes need the block to have run once to know their real starting point. */
  function hasRunBasis(t: EditTarget): boolean {
    if (t.mode === 'width') return storedOscillationOrigin(t) instanceof Vector3;
    if (t.mode === 'move' || t.mode === 'local' || t.mode === 'turn') return runBasis.has(t.blockId);
    return true;
  }

  function axisVector(axis: 'X' | 'Y' | 'Z' | undefined): Vector3 {
    return axis === 'Y' ? new Vector3(0, 1, 0) : axis === 'Z' ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  }

  function setLine(from: Vector3, to: Vector3) {
    const attr = moveLine.geometry.attributes.position as THREE.BufferAttribute;
    const a = toThreePosition(from);
    const b = toThreePosition(to);
    attr.setXYZ(0, a.x, a.y, a.z);
    attr.setXYZ(1, b.x, b.y, b.z);
    attr.needsUpdate = true;
    moveLine.computeLineDistances();
  }

  function update() {
    const t = editTarget;
    ghost.visible = !!t;
    moveLine.visible = !!t && (t.mode === 'move' || t.mode === 'local' || t.mode === 'width');
    editEl.hidden = !t;
    if (!t) {
      gizmo.detach();
      return;
    }
    const rotating = t.mode === 'rotation' || t.mode === 'turn';
    editEl.textContent = (t.editable
      ? `3D編集: 「${t.label}」 — 緑の箱を${rotating ? '回転' : 'ドラッグ'}すると数値が変わります`
      : `3D編集: 「${t.label}」 — ${t.reason}`) +
      (hasRunBasis(t) ? '' : '\n※まだ実行されていないため、今の位置・向きを仮の起点として表示しています（再生すると実際の起点になります）');
    if (dragging) {
      if (t.mode === 'move' || t.mode === 'local') setLine(dragBasis, fromThreePosition(ghost.position));
      if (t.mode === 'width') {
        const half = fromThreePosition(ghost.position).sub(dragBasis);
        setLine(dragBasis.clone().sub(half), dragBasis.clone().add(half));
      }
      return;
    }
    const v = new Vector3(t.values.x, t.values.y, t.values.z);
    if (t.mode === 'position') {
      ghost.position.copy(toThreePosition(v));
      ghost.quaternion.copy(item.quaternion);
    } else if (t.mode === 'move') {
      const basis = basisFor(t);
      const end = basis.clone().add(v);
      ghost.position.copy(toThreePosition(end));
      ghost.quaternion.copy(item.quaternion);
      setLine(basis, end);
    } else if (t.mode === 'local') {
      // Same as the generated code: the offset is turned by the facing before the move.
      const basis = basisFor(t);
      const end = basis.clone().add(v.clone().applyQuaternion(rotationBasisFor(t)));
      ghost.position.copy(toThreePosition(end));
      ghost.quaternion.copy(item.quaternion);
      setLine(basis, end);
    } else if (t.mode === 'rotation') {
      ghost.position.copy(item.position);
      ghost.quaternion.copy(toThreeQuaternion(new Quaternion().setFromEulerAngles(v)));
    } else if (t.mode === 'turn') {
      // Same as the generated code: start rotation * euler(delta).
      ghost.position.copy(item.position);
      ghost.quaternion.copy(toThreeQuaternion(rotationBasisFor(t).multiply(new Quaternion().setFromEulerAngles(v))));
    } else {
      // Width: ghost at one end of the swing, line across the whole swing.
      const origin = oscillationOrigin(t);
      const half = axisVector(t.axis).multiplyScalar(t.values.x);
      ghost.position.copy(toThreePosition(origin.clone().add(half)));
      ghost.quaternion.copy(item.quaternion);
      setLine(origin.clone().sub(half), origin.clone().add(half));
    }
    if (t.editable) {
      if (gizmo.object !== ghost) gizmo.attach(ghost);
      gizmo.setMode(rotating ? 'rotate' : 'translate');
      // Width is a single number: only offer the oscillation axis.
      gizmo.showX = t.mode !== 'width' || t.axis === 'X';
      gizmo.showY = t.mode !== 'width' || t.axis === 'Y';
      gizmo.showZ = t.mode !== 'width' || t.axis === 'Z';
    } else {
      gizmo.detach();
    }
  }

  /**
   * Euler angles for q near the old values. If the rotation did not really change, keep the old
   * values exactly: an equivalent triple would end at the same pose but animate differently.
   */
  function keepIfSameRotation(q: Quaternion, old: Xyz): Xyz {
    if (q.equals(new Quaternion().setFromEulerAngles(new Vector3(old.x, old.y, old.z)), 1e-5)) return old;
    const e = q.createEulerAngles();
    return nearestEuler({ x: e.x, y: e.y, z: e.z }, old);
  }

  function commit() {
    const t = editTarget;
    if (!t || !t.editable || !options.onEdit || dragCancelled) return;
    let values: Xyz;
    if (t.mode === 'position') {
      const p = fromThreePosition(ghost.position);
      values = { x: p.x, y: p.y, z: p.z };
    } else if (t.mode === 'move') {
      const d = fromThreePosition(ghost.position).sub(dragBasis);
      values = { x: d.x, y: d.y, z: d.z };
    } else if (t.mode === 'local') {
      // World offset back into the block's right / up / forward.
      const d = fromThreePosition(ghost.position).sub(dragBasis).applyQuaternion(dragBasisRot.clone().invert());
      values = { x: d.x, y: d.y, z: d.z };
    } else if (t.mode === 'rotation') {
      values = keepIfSameRotation(fromThreeQuaternion(ghost.quaternion), t.values);
    } else if (t.mode === 'turn') {
      // delta = start^-1 * result, as Euler angles near the old values.
      values = keepIfSameRotation(dragBasisRot.clone().invert().multiply(fromThreeQuaternion(ghost.quaternion)), t.values);
    } else {
      const offset = fromThreePosition(ghost.position).sub(dragBasis);
      values = { x: Math.abs(offset.dot(axisVector(t.axis))), y: 0, z: 0 };
    }
    options.onEdit(t.blockId, values);
  }

  return {
    setTarget(target) {
      if (dragging) {
        // Keep the gizmo stable, but never write a drag result into a different / changed block.
        if (!target || !editTarget || target.blockId !== editTarget.blockId || target.mode !== editTarget.mode || !target.editable) {
          dragCancelled = true;
        }
        return;
      }
      editTarget = target;
      update();
    },
    codeChanged() {
      if (dragging) dragCancelled = true;
    },
    recordRun(blockId, position, rotation) {
      runBasis.set(blockId, position.clone());
      runBasisRot.set(blockId, rotation.clone());
    },
    clearRuns() {
      runBasis.clear();
      runBasisRot.clear();
    },
    update() {
      if (editTarget) update();
    },
  };
}
