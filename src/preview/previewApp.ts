/**
 * 3D preview: runs the generated code (built with { trace: true }) on the src/sim mock and shows
 * it. This file wires the parts together; they live in
 *   scene.ts (three.js), editGizmo.ts (3D editing), panel.ts (state / log), rideControls.ts (keys).
 * Only reads simulator state; Blockly is changed only through onEdit (a finished gizmo drag).
 * Loaded lazily from src/index.ts the first time the preview tab is opened.
 */

import { Vector3 } from '../sim/math';
import { createRunner, type Runner } from '../sim/runner';
import type { VariableInfo } from '../variables';
import type { EditTarget, Xyz } from './blockEdit';
import { toThreePosition, toThreeQuaternion } from './coords';
import { createEditGizmo } from './editGizmo';
import { previewProblems, renderLogPanel, renderStatePanel } from './panel';
import { attachRideControls } from './rideControls';
import { createScene } from './scene';

export type Preview = {
  /** New generated code (trace build) or null when the workspace has errors / is empty. */
  setCode(code: string | null, reason?: string): void;
  /** Called when the tab becomes visible / hidden. */
  setVisible(visible: boolean): void;
  /** Variables of the current program (IR), shown in the state panel even before they are set. */
  setVariables(variables: VariableInfo[]): void;
  /** Block selected in Blockly that the 3D gizmo can edit (P4), or null. */
  setEditTarget(target: EditTarget | null): void;
};

export type PreviewOptions = {
  /** Block ids that ran recently (for highlighting). Called only when the set changes. */
  onActiveBlocks?: (blockIds: string[]) => void;
  /** Called once when a gizmo drag ends, with the new X/Y/Z for the block (Cluster coordinates). */
  onEdit?: (blockId: string, values: Xyz) => void;
};

const HIGHLIGHT_SECONDS = 0.3;
const MAX_LOG = 200;
const PLAYER_POSITION = new Vector3(0, 0, 2);

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
    <div class="pvRide" hidden>乗車中: W/S・↑↓ 前後　A/D・←→ 旋回　E/Q 上下（3D画面をクリックしてから操作）</div>
    <div class="pvView" tabindex="0"></div>
    <div class="pvNotice" hidden></div>
    <div class="pvState"></div>
    <div class="pvLog"></div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const viewEl = $<HTMLDivElement>('.pvView');
  const rideHint = $<HTMLDivElement>('.pvRide');
  const notice = $<HTMLDivElement>('.pvNotice');
  const timeEl = $<HTMLSpanElement>('.pvTime');
  const stateEl = $<HTMLDivElement>('.pvState');
  const logEl = $<HTMLDivElement>('.pvLog');
  const playBtn = $<HTMLButtonElement>('[data-act="play"]');
  const speedSel = $<HTMLSelectElement>('[data-act="speed"]');
  const rideBtn = $<HTMLButtonElement>('[data-ev="ride"]');
  const playerChk = $<HTMLInputElement>('[data-opt="player"]');

  // ── simulation state ──
  let code: string | null = null;
  let runner: Runner | null = null;
  let playing = false;
  let riding = false;
  let visible = false;
  let lastFrame = 0;
  let frameId = 0;
  let variables: VariableInfo[] = [];
  const traceTimes = new Map<string, number>();
  let lastActive = '';

  const view = createScene(viewEl);
  const edit = createEditGizmo({
    view,
    editEl: $<HTMLDivElement>('.pvEdit'),
    getRunner: () => runner,
    onDragStart: () => setPlaying(false),
    onEdit: options.onEdit,
  });
  const ride = attachRideControls(viewEl, () => runner, () => riding);

  function setPlaying(next: boolean) {
    playing = next;
    playBtn.textContent = playing ? '⏸ 停止' : '▶ 再生';
  }

  function setRiding(next: boolean) {
    riding = next;
    ride.reset();
    rideBtn.textContent = riding ? '降りる' : '乗る';
    rideHint.hidden = !riding;
  }

  function reset() {
    traceTimes.clear();
    edit.clearRuns();
    view.clearTrail();
    view.item.position.set(0, 0, 0);
    view.item.quaternion.identity();
    setRiding(false);
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
          // The trace call precedes the statement, so this is the transform before it runs.
          if (phase === 'run') edit.recordRun(id, runner.item.position, runner.item.rotation);
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
    view.virtualPlayer.visible = playerChk.checked;
    view.virtualPlayer.position.copy(toThreePosition(PLAYER_POSITION.clone().add(new Vector3(0, 0.8, 0))));
    if (!runner) return;
    runner.world.players.length = 0;
    if (playerChk.checked) runner.world.players.push(runner.createHandle('player', 'player1', PLAYER_POSITION.clone()));
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
        setRiding(!riding);
        runner.ride(riding);
        if (riding) viewEl.focus();
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
      setPlaying(!playing);
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

  function renderPanels() {
    if (!runner) {
      stateEl.innerHTML = '';
      logEl.innerHTML = '';
      return;
    }
    timeEl.textContent = `${runner.time.toFixed(2)} 秒`;
    renderStatePanel(stateEl, runner, variables);
    showNotice(previewProblems(runner).join('\n'));
    renderLogPanel(logEl, runner);
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
      view.item.position.copy(toThreePosition(runner.item.position));
      view.item.quaternion.copy(toThreeQuaternion(runner.item.rotation));
      view.pushTrail(view.item.position);
      reportActiveBlocks(runner.time);
      if (playing) renderPanels();
    }
    edit.update();
    view.render();
  }

  return {
    setCode(next, reason) {
      if (next !== code) {
        edit.codeChanged();
        code = next;
        reset();
      }
      if (!code) showNotice(reason || 'ブロックを配置するとプレビューできます');
    },
    setVariables(next) {
      variables = next;
      renderPanels();
    },
    setEditTarget(target) {
      edit.setTarget(target);
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
