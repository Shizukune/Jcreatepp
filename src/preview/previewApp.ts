/**
 * 3D preview (P1, read-only) + state panel (P2).
 *
 * Runs the generated code (built with { trace: true }) on the src/sim mock and draws the
 * item's transform with three.js. Only reads simulator state; it never edits Blockly.
 * Loaded lazily from src/index.ts the first time the preview tab is opened.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vector3 } from '../sim/math';
import { createRunner, type Runner } from '../sim/runner';
import type { LogEntry } from '../sim/clusterMock';
import { toThreePosition, toThreeQuaternion } from './coords';

export type Preview = {
  /** New generated code (trace build) or null when the workspace has errors / is empty. */
  setCode(code: string | null, reason?: string): void;
  /** Called when the tab becomes visible / hidden. */
  setVisible(visible: boolean): void;
};

export type PreviewOptions = {
  /** Block ids that ran recently (for highlighting). Called only when the set changes. */
  onActiveBlocks?: (blockIds: string[]) => void;
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
    <div class="pvView"></div>
    <div class="pvNotice" hidden></div>
    <div class="pvState"></div>
    <div class="pvLog"></div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const view = $<HTMLDivElement>('.pvView');
  const notice = $<HTMLDivElement>('.pvNotice');
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
  let trailCount = 0;

  // ── simulation ──
  let code: string | null = null;
  let runner: Runner | null = null;
  let playing = false;
  let riding = false;
  let visible = false;
  let lastFrame = 0;
  let frameId = 0;
  const traceTimes = new Map<string, number>();
  let lastActive = '';

  const playerHandlePosition = () => new Vector3(0, 0, 2);

  function reset() {
    traceTimes.clear();
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
        onTrace: (id) => {
          if (runner) traceTimes.set(id, runner.time);
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
    const groups: Record<string, string[]> = { 数値変数: [], 文字変数: [], 真偽値変数: [], フラグ: [], クールダウン: [], 一連の動作: [] };
    const state = runner.$.state as Record<string, unknown>;
    for (const key of Object.keys(state).sort()) {
      const v = state[key];
      const show = (label: string, name: string, value: string) => groups[label].push(`<tr><td>${esc(name)}</td><td>${esc(value)}</td></tr>`);
      if (key.startsWith('var.')) show('数値変数', key.slice(4), String(v));
      else if (key.startsWith('str.')) show('文字変数', key.slice(4), JSON.stringify(v));
      else if (key.startsWith('bool.')) show('真偽値変数', key.slice(5), String(!!v));
      else if (key.startsWith('__jpp_flag_')) show('フラグ', key.slice(11), String(!!v));
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
        code = next;
        reset();
      }
      if (!code) showNotice(reason || 'ブロックを配置するとプレビューできます');
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
