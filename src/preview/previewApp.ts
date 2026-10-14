/**
 * 3D preview (P1, read-only) + state panel (P2).
 *
 * Runs the generated code (built with { trace: true }) on the src/sim mock and draws the
 * item's transform with three.js. Only reads simulator state; it never edits Blockly.
 * Loaded lazily from src/index.ts the first time the preview tab is opened.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Quaternion, Vector3 } from '../sim/math';
import { createRunner, type Runner } from '../sim/runner';
import type { LogEntry } from '../sim/clusterMock';
import { fromThreePosition, fromThreeQuaternion, toThreePosition, toThreeQuaternion } from './coords';
import { nearestEuler, type EditTarget, type Xyz } from './blockEdit';
import { safeId } from '../codegen/shared';

export type Preview = {
  /** New generated code (trace build) or null when the workspace has errors / is empty. */
  setCode(code: string | null, reason?: string): void;
  /** Called when the tab becomes visible / hidden. */
  setVisible(visible: boolean): void;
  /** Block selected in Blockly that the 3D gizmo can edit (P4), or null. */
  setEditTarget(target: EditTarget | null): void;
};

export type PreviewOptions = {
  /** Block ids that ran recently (for highlighting). Called only when the set changes. */
  onActiveBlocks?: (blockIds: string[]) => void;
  /** Called once when a gizmo drag ends, with the new X/Y/Z for the block (Cluster coordinates). */
  onEdit?: (blockId: string, values: Xyz) => void;
};

const TRAIL_POINTS = 300;
const HIGHLIGHT_SECONDS = 0.3;
const MAX_LOG = 200;

export function createPreview(root: HTMLElement, options: PreviewOptions = {}): Preview {
  root.innerHTML = `
    <div class="pvControls">
      <button data-act="play" title="再生/一時停止">▶ 再生</button>
      <button data-act="step" title="1フレーム進める">⏭</button>
      <button data-act="reset" title="最初から（開始時を実行し直す）">⟲ リセット</button>
      <select data-act="speed" title="速度">
        <option value="0.25">×0.25</option><option value="0.5">×0.5</option>
        <option value="1" selected>×1</option><option value="2">×2</option><option value="4">×4</option>
      </select>
      <span class="pvTime">0.00 秒</span>
    </div>
    <div class="pvEvents">
      <button data-ev="interact">インタラクト</button>
      <button data-ev="grab">持つ</button>
      <button data-ev="release">離す</button>
      <button data-ev="collide">衝突</button>
      <button data-ev="ride">乗る</button>
      <span class="pvRecv">
        <input data-recv="name" placeholder="メッセージ名" value="open" />
        <input data-recv="value" placeholder="値(空=なし)" />
        <button data-ev="receive">受信</button>
      </span>
      <label class="pvCheck"><input type="checkbox" data-opt="player" /> 2m前にプレイヤー</label>
    </div>
    <div class="pvEdit" hidden></div>
    <div class="pvView"></div>
    <div class="pvNotice" hidden></div>
    <div class="pvState"></div>
    <div class="pvLog"></div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const view = $<HTMLDivElement>('.pvView');
  const notice = $<HTMLDivElement>('.pvNotice');
  const editEl = $<HTMLDivElement>('.pvEdit');
  const timeEl = $<HTMLSpanElement>('.pvTime');
  const stateEl = $<HTMLDivElement>('.pvState');
  const logEl = $<HTMLDivElement>('.pvLog');
  const playBtn = $<HTMLButtonElement>('[data-act="play"]');
  const speedSel = $<HTMLSelectElement>('[data-act="speed"]');
  const rideBtn = $<HTMLButtonElement>('[data-ev="ride"]');
  const playerChk = $<HTMLInputElement>('[data-opt="player"]');

  // ── three.js scene ──
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  view.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1b2a);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camera.position.set(6, 5, 8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.5, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 3);
  scene.add(sun);
  scene.add(new THREE.GridHelper(40, 40, 0x3a5a7a, 0x1f3348));
  // Cluster axes: +X red, +Y green, +Z blue (drawn at three's -Z).
  const axes = new THREE.Group();
  const axis = (dir: Vector3, color: number) =>
    axes.add(new THREE.ArrowHelper(toThreePosition(dir).normalize(), new THREE.Vector3(), 1.5, color, 0.2, 0.1));
  axis(new Vector3(1, 0, 0), 0xff5555);
  axis(new Vector3(0, 1, 0), 0x55ff55);
  axis(new Vector3(0, 0, 1), 0x5599ff);
  scene.add(axes);

  // The item: a box with a cone on its Cluster forward (+Z).
  const item = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe94560 }));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
  nose.position.copy(toThreePosition(new Vector3(0, 0, 0.72)));
  nose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toThreePosition(new Vector3(0, 0, 1)));
  item.add(box, nose);
  scene.add(item);

  const virtualPlayer = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1, 4, 12), new THREE.MeshStandardMaterial({ color: 0x55c2ff }));
  virtualPlayer.visible = false;
  scene.add(virtualPlayer);

  const trailPositions = new Float32Array(TRAIL_POINTS * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xa3d8f4 }));
  scene.add(trail);

  // ── 3D editing (P4): ghost of the selected block's result + gizmo ──
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: 0x55ffcc, transparent: true, opacity: 0.35, depthWrite: false });
  const ghost = new THREE.Group();
  const ghostNose = new THREE.Mesh(nose.geometry, ghostMaterial);
  ghostNose.position.copy(nose.position);
  ghostNose.quaternion.copy(nose.quaternion);
  ghost.add(new THREE.Mesh(box.geometry, ghostMaterial), ghostNose);
  ghost.visible = false;
  scene.add(ghost);
  const moveLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: 0x55ffcc, dashSize: 0.2, gapSize: 0.1 }));
  moveLine.visible = false;
  scene.add(moveLine);
  const gizmo = new TransformControls(camera, renderer.domElement);
  gizmo.setSpace('world');
  scene.add(gizmo.getHelper());
  let editTarget: EditTarget | null = null;
  let dragging = false;
  let dragBasis = new Vector3();
  // Set when the edited block / code changes mid-drag: the drag result is then discarded.
  let dragCancelled = false;
  // Item position right before each block last ran ("run" trace), used as the basis for moves.
  const runBasis = new Map<string, Vector3>();
  const runBasisRot = new Map<string, Quaternion>();
  let dragBasisRot = new Quaternion();
  let trailCount = 0;

  // ── simulation ──
  let code: string | null = null;
  let runner: Runner | null = null;
  let playing = false;
  let riding = false;
  let visible = false;
  let lastFrame = 0;
  let frameId = 0;

  gizmo.addEventListener('dragging-changed', (e) => {
    dragging = !!e.value;
    controls.enabled = !dragging;
    if (dragging) {
      // Edit against a fixed basis: stop the simulation and freeze where the block starts from.
      playing = false;
      playBtn.textContent = '▶ 再生';
      dragCancelled = false;
      if (editTarget) {
        dragBasis = basisFor(editTarget);
        dragBasisRot = rotationBasisFor(editTarget);
      }
    } else {
      commitEdit();
    }
  });

  /** Where the target block starts from: its last pre-execution position, else the current one. */
  function basisFor(t: EditTarget): Vector3 {
    if (t.mode === 'width') return oscillationOrigin(t);
    return runBasis.get(t.blockId)?.clone() ?? currentPosition();
  }

  /** The rotation the target block starts from (for relative turns). */
  function rotationBasisFor(t: EditTarget): Quaternion {
    return runBasisRot.get(t.blockId)?.clone() ?? (runner ? runner.item.rotation.clone() : new Quaternion());
  }

  /** "往復する" swings around the position stored when it first ran. */
  function oscillationOrigin(t: EditTarget): Vector3 {
    const stored = runner?.$.state[`__jpp_osc_init_pos_${safeId(t.blockId)}`];
    return stored instanceof Vector3 ? stored.clone() : currentPosition();
  }

  /** Relative modes need the block to have run once to know their real starting point. */
  function hasRunBasis(t: EditTarget): boolean {
    if (t.mode === 'width') return runner?.$.state[`__jpp_osc_init_pos_${safeId(t.blockId)}`] instanceof Vector3;
    if (t.mode === 'move' || t.mode === 'local' || t.mode === 'turn') return runBasis.has(t.blockId);
    return true;
  }

  function axisVector(axis: 'X' | 'Y' | 'Z' | undefined): Vector3 {
    return axis === 'Y' ? new Vector3(0, 1, 0) : axis === 'Z' ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  }

  function currentPosition(): Vector3 {
    return runner ? runner.item.position.clone() : new Vector3();
  }

  function updateGhost() {
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

  function setLine(from: Vector3, to: Vector3) {
    const attr = moveLine.geometry.attributes.position as THREE.BufferAttribute;
    const a = toThreePosition(from);
    const b = toThreePosition(to);
    attr.setXYZ(0, a.x, a.y, a.z);
    attr.setXYZ(1, b.x, b.y, b.z);
    attr.needsUpdate = true;
    moveLine.computeLineDistances();
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

  function commitEdit() {
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
  const traceTimes = new Map<string, number>();
  let lastActive = '';

  const playerHandlePosition = () => new Vector3(0, 0, 2);

  function reset() {
    traceTimes.clear();
    runBasis.clear();
    runBasisRot.clear();
    trailCount = 0;
    trailGeometry.setDrawRange(0, 0);
    item.position.set(0, 0, 0);
    item.quaternion.identity();
    riding = false;
    rideBtn.textContent = '乗る';
    runner = null;
    timeEl.textContent = '0.00 秒';
    lastActive = '';
    options.onActiveBlocks?.([]);
    if (!code) {
      renderPanels();
      return;
    }
    try {
      runner = createRunner(code, {
        onTrace: (id, phase) => {
          if (!runner) return;
          traceTimes.set(id, runner.time);
          // The trace call precedes the statement, so this is the position before it runs.
          if (phase === 'run') {
            runBasis.set(id, runner.item.position.clone());
            runBasisRot.set(id, runner.item.rotation.clone());
          }
        },
      });
      syncVirtualPlayer();
      runner.start();
    } catch (e) {
      showNotice(`プレビューを開始できません: ${(e as Error).message}`);
      runner = null;
    }
    renderPanels();
  }

  function syncVirtualPlayer() {
    if (!runner) return;
    runner.world.players.length = 0;
    if (playerChk.checked) runner.world.players.push(runner.createHandle('player', 'player1', playerHandlePosition()));
    virtualPlayer.visible = playerChk.checked;
    virtualPlayer.position.copy(toThreePosition(playerHandlePosition().add(new Vector3(0, 0.8, 0))));
  }

  function showNotice(text: string) {
    notice.textContent = text;
    notice.hidden = !text;
  }

  function fire(ev: string) {
    if (!runner) return;
    switch (ev) {
      case 'interact': runner.interact(); break;
      case 'grab': runner.grab(true); break;
      case 'release': runner.grab(false); break;
      case 'collide': runner.collide(); break;
      case 'ride':
        riding = !riding;
        runner.ride(riding);
        if (riding) runner.steer({ x: 0, y: 1 });
        rideBtn.textContent = riding ? '降りる' : '乗る';
        break;
      case 'receive': {
        const name = (root.querySelector('[data-recv="name"]') as HTMLInputElement).value;
        const raw = (root.querySelector('[data-recv="value"]') as HTMLInputElement).value.trim();
        const value = raw === '' ? null : raw === 'true' ? true : raw === 'false' ? false : isNaN(Number(raw)) ? raw : Number(raw);
        runner.receive(name, value);
        break;
      }
    }
    renderPanels();
  }

  root.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const act = target.getAttribute('data-act');
    const ev = target.getAttribute('data-ev');
    if (act === 'play') {
      playing = !playing;
      playBtn.textContent = playing ? '⏸ 停止' : '▶ 再生';
    } else if (act === 'step') {
      runner?.update(1 / 60);
      renderPanels();
    } else if (act === 'reset') {
      reset();
    } else if (ev) {
      fire(ev);
    }
  });
  playerChk.addEventListener('change', syncVirtualPlayer);

  // ── panels (P2) ──
  function renderPanels() {
    if (!runner) {
      stateEl.innerHTML = '';
      logEl.innerHTML = '';
      return;
    }
    timeEl.textContent = `${runner.time.toFixed(2)} 秒`;
    const groups: Record<string, string[]> = { 数値変数: [], 文字変数: [], 真偽値変数・フラグ: [], クールダウン: [], 一連の動作: [] };
    const state = runner.$.state as Record<string, unknown>;
    for (const key of Object.keys(state).sort()) {
      const v = state[key];
      const show = (label: string, name: string, value: string) => groups[label].push(`<tr><td>${esc(name)}</td><td>${esc(value)}</td></tr>`);
      if (key.startsWith('var.')) show('数値変数', key.slice(4), String(v));
      else if (key.startsWith('str.')) show('文字変数', key.slice(4), JSON.stringify(v));
      else if (key.startsWith('bool.')) show('真偽値変数・フラグ', key.slice(5), String(!!v));
      else if (key.startsWith('__jpp_cd_')) show('クールダウン', key.slice(9), `残り ${Number(v).toFixed(2)} 秒`);
      else if (key.startsWith('__jpp_seq_active_')) {
        const id = key.slice(17);
        show('一連の動作', id, v ? `実行中（ステップ ${Number(state[`__jpp_seq_step_${id}`] ?? 0) + 1}）` : '停止');
      }
    }
    stateEl.innerHTML = Object.entries(groups)
      .filter(([, rows]) => rows.length > 0)
      .map(([label, rows]) => `<h3>${label}</h3><table>${rows.join('')}</table>`)
      .join('') || '<p class="pvEmpty">変数・フラグはまだありません</p>';

    const problems = [
      ...[...runner.unsupported].map((name) => `プレビュー未対応: ${name}`),
      ...runner.errors().slice(-1).map((m) => `実行時エラー: ${m}`),
    ];
    showNotice(problems.join('\n'));
    logEl.innerHTML = '<h3>ログ</h3>' + runner.log.slice(-12).reverse().map((l) => `<div>${esc(formatLog(l))}</div>`).join('');
  }

  // ── render loop ──
  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    const realDt = Math.min(0.1, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    if (runner && playing) {
      runner.advance(realDt * Number(speedSel.value));
      // The preview only shows recent entries; keep memory bounded during long playback.
      if (runner.log.length > MAX_LOG) runner.log.splice(0, runner.log.length - MAX_LOG);
    }
    if (runner) {
      item.position.copy(toThreePosition(runner.item.position));
      item.quaternion.copy(toThreeQuaternion(runner.item.rotation));
      pushTrail(item.position);
      reportActiveBlocks(runner.time);
      if (playing) renderPanels();
    }
    if (editTarget) updateGhost();
    resize();
    renderer.render(scene, camera);
  }

  function pushTrail(p: THREE.Vector3) {
    const last = trailCount > 0 ? (trailCount - 1) * 3 : -1;
    if (last >= 0 && Math.abs(trailPositions[last] - p.x) + Math.abs(trailPositions[last + 1] - p.y) + Math.abs(trailPositions[last + 2] - p.z) < 1e-4) return;
    if (trailCount === TRAIL_POINTS) {
      trailPositions.copyWithin(0, 3);
      trailCount--;
    }
    trailPositions.set([p.x, p.y, p.z], trailCount * 3);
    trailCount++;
    trailGeometry.setDrawRange(0, trailCount);
    trailGeometry.attributes.position.needsUpdate = true;
  }

  function reportActiveBlocks(time: number) {
    if (!options.onActiveBlocks) return;
    const ids = [...traceTimes.entries()].filter(([, t]) => time - t <= HIGHLIGHT_SECONDS).map(([id]) => id).sort();
    const key = ids.join(',');
    if (key !== lastActive) {
      lastActive = key;
      options.onActiveBlocks(ids);
    }
  }

  function resize() {
    const w = view.clientWidth;
    const h = view.clientHeight;
    if (w === 0 || h === 0) return;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  return {
    setCode(next, reason) {
      if (next !== code) {
        if (dragging) dragCancelled = true;
        code = next;
        reset();
      }
      if (!code) showNotice(reason || 'ブロックを配置するとプレビューできます');
    },
    setEditTarget(target) {
      if (dragging) {
        // Keep the gizmo stable, but never write a drag result into a different / changed block.
        if (!target || !editTarget || target.blockId !== editTarget.blockId || target.mode !== editTarget.mode || !target.editable) {
          dragCancelled = true;
        }
        return;
      }
      editTarget = target;
      updateGhost();
    },
    setVisible(v) {
      if (v === visible) return;
      visible = v;
      if (v) {
        // Restart the loop without a time jump for the hidden period.
        lastFrame = performance.now();
        frameId = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(frameId);
        lastActive = '';
        options.onActiveBlocks?.([]);
      }
    },
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function formatLog(l: LogEntry): string {
  switch (l.type) {
    case 'send': return `送信 → ${l.target}「${l.message}」${l.arg === null || l.arg === undefined ? '' : ` 値=${JSON.stringify(l.arg)}`}`;
    case 'audio': return `音「${l.id}」音量 ${l.volume}`;
    case 'text': return `文字 ${l.subNode}(${l.component}) = ${l.text}`;
    case 'enabled': return `${l.subNode}(${l.component}) を ${l.enabled ? '有効' : '無効'}`;
    case 'force': return `力を加える (${l.force.x.toFixed(1)}, ${l.force.y.toFixed(1)}, ${l.force.z.toFixed(1)}) ※物理は再現しません`;
    case 'player': return `プレイヤー ${l.method}(${l.value})`;
    case 'error': return `エラー[${l.event}] ${l.message}`;
  }
}
