/**
 * 3D preview: runs the generated code (built with { trace: true }) on the src/sim mock and shows
 * it. This file wires the parts together; they live in
 *   scene.ts (three.js), editGizmo.ts (3D editing), panel.ts (state / log), rideControls.ts (keys).
 * Only reads simulator state; Blockly is changed only through onEdit (a finished gizmo drag).
 * Loaded lazily from src/index.ts the first time the preview tab is opened.
 *
 * Layout: the 3D view on top with the playback bar laid over its bottom edge, then the buttons of
 * the events this program uses, then tabs (state / log / parts). Switching the inner tabs never
 * stops the simulation; only the hidden tabs stop updating their DOM. Hiding the whole preview
 * (setVisible(false)) stops the loop, as before.
 */

import { Vector3 } from '../sim/math';
import { createRunner, type Runner } from '../sim/runner';
import type { EditTarget, Xyz } from './blockEdit';
import { toThreePosition, toThreeQuaternion } from './coords';
import { createEditGizmo, type EditGizmo } from './editGizmo';
import { createLogPanel, createStatePanel, previewProblems, type StateSelection } from './panel';
import { hasAnyEvent, NO_PROGRAM_INFO, type PreviewProgramInfo } from './programInfo';
import { attachRideControls, type RideControls } from './rideControls';
import { createScene, type PreviewScene } from './scene';

export type PreviewTab = 'state' | 'log' | 'parts';

export type Preview = {
  /** New generated code (trace build) or null when the workspace has errors / is empty. */
  setCode(code: string | null, reason?: string): void;
  /** Called when the preview becomes visible / hidden (outer tab). */
  setVisible(visible: boolean): void;
  /** Events, sequences and variables of the current program (see programInfo.ts). */
  setProgramInfo(info: PreviewProgramInfo): void;
  /** Block selected in Blockly that the 3D gizmo can edit (P4), or null. */
  setEditTarget(target: EditTarget | null): void;
  showTab(tab: PreviewTab): void;
  /** Container of the parts tab (filled by src/parts/panel.ts). */
  partsHost: HTMLElement;
  /** True while the parts tab is on screen (demos stop when it is not). */
  isPartsVisible(): boolean;
};

export type PreviewOptions = {
  /** Block ids that ran recently (for highlighting). Called only when the set changes. */
  onActiveBlocks?: (blockIds: string[]) => void;
  /** Called once when a gizmo drag ends, with the new X/Y/Z for the block (Cluster coordinates). */
  onEdit?: (blockId: string, values: Xyz) => void;
  /** A state card was selected (null = cleared): highlight the blocks that use it. */
  onSelectState?: (selection: StateSelection | null) => void;
  /** Empty-state action: open a toolbox category. */
  onShowBlocks?: (category: 'variables' | 'events') => void;
  /** "3D を大きく" toggled: the host widens the pane and resizes Blockly. */
  onBigChange?: (big: boolean) => void;
  /** Initial state of "3D を大きく". */
  big?: boolean;
};

const HIGHLIGHT_SECONDS = 0.3;
/** Simulation frame of the preview (same as Runner.advance's default). */
const SIM_DT = 1 / 60;
const MAX_LOG = 200;
const PLAYER_POSITION = new Vector3(0, 0, 2);
const TAB_LABEL: Record<PreviewTab, string> = { state: '状態', log: 'ログ', parts: '部品' };

export function createPreview(root: HTMLElement, options: PreviewOptions = {}): Preview {
  root.innerHTML = `
    <div class="pvStage">
      <div class="pvView" tabindex="0" aria-label="3D プレビュー"></div>
      <div class="pvTop">
        <div class="pvTopLeft">
          <button type="button" data-act="parts" aria-label="部品を追加する（部品タブを開く）">⊕ 部品</button>
        </div>
        <div class="pvTopRight">
          <button type="button" data-act="player" aria-pressed="false" aria-label="アイテムの 2m 前にプレイヤーを置く">2m前にプレイヤー</button>
          <button type="button" data-act="big" aria-pressed="false" aria-label="3D を大きく表示する">3Dを大きく</button>
        </div>
        <div class="pvNotice" hidden></div>
        <div class="pvEdit" hidden></div>
        <div class="pvRide" hidden>乗車中: W/S・↑↓ 前後　A/D・←→ 旋回　E/Q 上下（3D画面をクリックしてから操作）</div>
      </div>
      <div class="pvBar">
        <button type="button" data-act="play" aria-label="再生">▶ 再生</button>
        <button type="button" data-act="step" aria-label="1フレーム進める">⏭</button>
        <button type="button" data-act="reset" aria-label="最初から（開始時を実行し直す）">⟲ リセット</button>
        <select data-act="speed" aria-label="速度">
          <option value="0.25">×0.25</option><option value="0.5">×0.5</option>
          <option value="1" selected>×1</option><option value="2">×2</option><option value="4">×4</option>
        </select>
        <span class="pvTime">0.00 秒</span>
      </div>
    </div>
    <div class="pvEvents" aria-label="このプログラムのイベント"></div>
    <div class="pvTabs" role="tablist">
      ${(Object.keys(TAB_LABEL) as PreviewTab[]).map((t) => `<button type="button" role="tab" data-tab="${t}" aria-controls="pvPanel-${t}">${TAB_LABEL[t]}</button>`).join('')}
    </div>
    <div class="pvPanel pvState" id="pvPanel-state" role="tabpanel" data-panel="state"></div>
    <div class="pvPanel pvLog" id="pvPanel-log" role="tabpanel" data-panel="log" hidden></div>
    <div class="pvPanel pvParts" id="pvPanel-parts" role="tabpanel" data-panel="parts" hidden></div>
  `;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const viewEl = $<HTMLDivElement>('.pvView');
  const rideHint = $<HTMLDivElement>('.pvRide');
  const notice = $<HTMLDivElement>('.pvNotice');
  const timeEl = $<HTMLSpanElement>('.pvTime');
  const eventsEl = $<HTMLDivElement>('.pvEvents');
  const playBtn = $<HTMLButtonElement>('[data-act="play"]');
  const speedSel = $<HTMLSelectElement>('[data-act="speed"]');
  const playerBtn = $<HTMLButtonElement>('[data-act="player"]');
  const bigBtn = $<HTMLButtonElement>('[data-act="big"]');
  const statePanel = createStatePanel($<HTMLDivElement>('[data-panel="state"]'), { onSelect: options.onSelectState, onShowBlocks: options.onShowBlocks });
  const logPanel = createLogPanel($<HTMLDivElement>('[data-panel="log"]'));
  const partsHost = $<HTMLDivElement>('[data-panel="parts"]');

  // ── simulation state ──
  let code: string | null = null;
  let runner: Runner | null = null;
  let playing = false;
  let riding = false;
  let visible = false;
  let lastFrame = 0;
  let frameId = 0;
  let info: PreviewProgramInfo = NO_PROGRAM_INFO;
  let tab: PreviewTab = 'state';
  let unread = 0;
  let unreadError = false;
  let playerOn = false;
  let big = !!options.big;
  const traceTimes = new Map<string, number>();
  let lastActive = '';
  /** Time not yet simulated (frames are simulated one by one so log entries get their own time). */
  let pending = 0;
  /** Latest runtime error of this run, kept apart from the log (clearing / trimming the log keeps the notice). */
  let lastError: string | null = null;

  // WebGL may be unavailable: the tabs (state, log, parts) still work, the 3D view shows why not.
  let view: PreviewScene | null = null;
  let edit: EditGizmo | null = null;
  let ride: RideControls | null = null;
  let sceneError = '';
  try {
    view = createScene(viewEl);
    edit = createEditGizmo({
      view,
      editEl: $<HTMLDivElement>('.pvEdit'),
      getRunner: () => runner,
      onDragStart: () => setPlaying(false),
      onEdit: options.onEdit,
    });
    ride = attachRideControls(viewEl, () => runner, () => riding);
  } catch (e) {
    sceneError = `この環境では 3D を表示できません（${(e as Error).message}）。状態・ログ・部品は使えます。`;
    viewEl.classList.add('pvViewUnavailable');
    viewEl.textContent = sceneError;
  }

  function setPlaying(next: boolean) {
    playing = next;
    playBtn.textContent = playing ? '⏸ 停止' : '▶ 再生';
    playBtn.setAttribute('aria-label', playing ? '停止' : '再生');
  }

  function setRiding(next: boolean) {
    riding = next;
    ride?.reset();
    const rideBtn = eventsEl.querySelector('[data-ev="ride"]');
    if (rideBtn) rideBtn.textContent = riding ? '降りる' : '乗る';
    rideHint.hidden = !riding;
  }

  function setBig(next: boolean) {
    big = next;
    root.classList.toggle('pvBig', big);
    bigBtn.setAttribute('aria-pressed', String(big));
    bigBtn.textContent = big ? '元の大きさ' : '3Dを大きく';
    bigBtn.setAttribute('aria-label', big ? '3D を元の大きさに戻す' : '3D を大きく表示する');
  }
  setBig(big);

  /** Runs a simulator operation and moves the log entries it produced into the log tab. */
  function withLog(fn: (r: Runner) => void) {
    if (!runner) return;
    const r = runner;
    const before = r.log.length;
    fn(r);
    const fresh = r.log.slice(before);
    for (const l of fresh) if (l.type === 'error') lastError = `${l.event}: ${l.message}`;
    const added = logPanel.add(fresh, r.time);
    if (tab !== 'log') {
      unread += added.length;
      if (added.some((s) => s.entry.type === 'error')) unreadError = true;
    }
    // The preview keeps its own stamped copy; keep the runner's log bounded during long playback.
    if (r.log.length > MAX_LOG) r.log.splice(0, r.log.length - MAX_LOG);
  }

  function reset() {
    traceTimes.clear();
    edit?.clearRuns();
    view?.clearTrail();
    view?.item.position.set(0, 0, 0);
    view?.item.quaternion.identity();
    setRiding(false);
    runner = null;
    timeEl.textContent = '0.00 秒';
    lastActive = '';
    statePanel.reset();
    logPanel.reset();
    pending = 0;
    lastError = null;
    unread = 0;
    unreadError = false;
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
          if (phase === 'run') edit?.recordRun(id, runner.item.position, runner.item.rotation);
        },
      });
      syncVirtualPlayer();
      withLog((r) => r.start());
    } catch (e) {
      showNotice(`プレビューを開始できません: ${(e as Error).message}`);
      runner = null;
    }
    renderPanels();
  }

  function syncVirtualPlayer() {
    playerBtn.setAttribute('aria-pressed', String(playerOn));
    playerBtn.classList.toggle('pvPressed', playerOn);
    if (view) {
      view.virtualPlayer.visible = playerOn;
      view.virtualPlayer.position.copy(toThreePosition(PLAYER_POSITION.clone().add(new Vector3(0, 0.8, 0))));
    }
    if (!runner) return;
    runner.world.players.length = 0;
    if (playerOn) runner.world.players.push(runner.createHandle('player', 'player1', PLAYER_POSITION.clone()));
  }

  function showNotice(text: string) {
    notice.textContent = text;
    notice.hidden = !text;
  }

  /** Same conversion as before: empty = no value, true / false, numbers, otherwise text. */
  function receiveValue(): unknown {
    const raw = (eventsEl.querySelector('[data-recv="value"]') as HTMLInputElement | null)?.value.trim() ?? '';
    return raw === '' ? null : raw === 'true' ? true : raw === 'false' ? false : isNaN(Number(raw)) ? raw : Number(raw);
  }

  /** Option values are indexes into the program's message names ("other" = typed name), so any name works. */
  function receiveName(): string {
    const sel = eventsEl.querySelector('[data-recv="name"]') as HTMLSelectElement | null;
    if (!sel) return '';
    if (sel.value === 'other') return (eventsEl.querySelector('[data-recv="other"]') as HTMLInputElement).value;
    return info.events.receives[Number(sel.value)] ?? '';
  }

  function fire(ev: string) {
    if (!runner) return;
    withLog((r) => {
      switch (ev) {
        case 'interact': r.interact(); break;
        case 'grab': r.grab(true); break;
        case 'release': r.grab(false); break;
        case 'collide': r.collide(); break;
        case 'ride':
          setRiding(!riding);
          r.ride(riding);
          if (riding) viewEl.focus();
          break;
        case 'receive':
          r.receive(receiveName(), receiveValue());
          break;
      }
    });
    renderPanels();
  }

  /** Buttons for the events this program uses; the rest are not shown. */
  let eventsKey = '';
  function renderEvents() {
    const ev = info.events;
    // Rebuild only when the events change, so a typed message name / value survives block edits.
    const key = JSON.stringify(ev);
    if (key === eventsKey) return;
    eventsKey = key;
    if (!hasAnyEvent(ev)) {
      eventsEl.innerHTML = `<span class="pvMuted">押して試すイベントはありません。開始時はプレビューの準備時・リセット時に、毎フレームは再生中に動きます。</span>
        <button type="button" data-show="events">イベントのブロックを見る</button>`;
      return;
    }
    const buttons: string[] = [];
    if (ev.interact) buttons.push('<button type="button" data-ev="interact">インタラクト</button>');
    if (ev.grab) buttons.push('<button type="button" data-ev="grab">持つ</button>');
    if (ev.release) buttons.push('<button type="button" data-ev="release">離す</button>');
    if (ev.collide) buttons.push('<button type="button" data-ev="collide">衝突</button>');
    if (ev.ride) buttons.push(`<button type="button" data-ev="ride">${riding ? '降りる' : '乗る'}</button>`);
    if (ev.receives.length > 0) {
      const opts = ev.receives.map((m, i) => `<option value="${i}">${escText(m)}</option>`).join('');
      buttons.push(`<span class="pvRecv">
        <select data-recv="name" aria-label="受け取るメッセージ名">${opts}<option value="other">その他（入力）</option></select>
        <input data-recv="other" aria-label="メッセージ名" placeholder="メッセージ名" hidden />
        <input data-recv="value" aria-label="一緒に送る値" placeholder="値" title="空 = 値なし／true・false = 真偽値／数字 = 数値／それ以外 = 文字（数字だけの文字は送れません）" />
        <button type="button" data-ev="receive">受信</button>
      </span>`);
    }
    eventsEl.innerHTML = `<span class="pvMuted">イベント:</span>${buttons.join('')}`;
  }

  eventsEl.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    if (t.getAttribute('data-recv') === 'name') {
      (eventsEl.querySelector('[data-recv="other"]') as HTMLInputElement).hidden = (t as HTMLSelectElement).value !== 'other';
    }
  });

  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!target || !root.contains(target)) return;
    const act = target.getAttribute('data-act');
    const ev = target.getAttribute('data-ev');
    const tabName = target.getAttribute('data-tab') as PreviewTab | null;
    const show = target.getAttribute('data-show');
    if (act === 'play') {
      setPlaying(!playing);
    } else if (act === 'step') {
      withLog((r) => r.update(SIM_DT));
      renderPanels();
    } else if (act === 'reset') {
      reset();
    } else if (act === 'player') {
      playerOn = !playerOn;
      syncVirtualPlayer();
    } else if (act === 'big') {
      setBig(!big);
      options.onBigChange?.(big);
    } else if (act === 'parts') {
      showTab('parts');
    } else if (tabName) {
      showTab(tabName);
    } else if (show && target.closest('.pvEvents')) {
      options.onShowBlocks?.(show as 'events');
    } else if (ev) {
      fire(ev);
    }
  });

  function showTab(next: PreviewTab) {
    tab = next;
    for (const b of root.querySelectorAll<HTMLButtonElement>('[data-tab]')) b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
    for (const p of root.querySelectorAll<HTMLElement>('[data-panel]')) p.hidden = p.getAttribute('data-panel') !== tab;
    if (tab === 'log') {
      unread = 0;
      unreadError = false;
    }
    renderPanels();
  }

  function renderTabs() {
    const logTab = root.querySelector('[data-tab="log"]') as HTMLButtonElement;
    const label = unread > 0 ? `ログ ${unread > 99 ? '99+' : unread}` : 'ログ';
    if (logTab.textContent !== label) logTab.textContent = label;
    logTab.classList.toggle('pvTabError', unreadError);
  }

  function renderPanels() {
    renderTabs();
    if (!runner) {
      statePanel.render(null, info);
      if (tab === 'log') logPanel.render();
      return;
    }
    timeEl.textContent = `${runner.time.toFixed(2)} 秒`;
    showNotice([sceneError, ...previewProblems(runner, lastError)].filter(Boolean).join('\n'));
    // Hidden tabs do not update their DOM; the simulation keeps running.
    if (tab === 'state') statePanel.render(runner, info);
    if (tab === 'log') logPanel.render();
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
      // One simulation frame at a time, so each log entry is stamped with the time it happened.
      pending += realDt * Number(speedSel.value);
      while (pending >= SIM_DT - 1e-9) {
        pending -= SIM_DT;
        withLog((r) => r.update(SIM_DT));
      }
    }
    if (runner) {
      if (view) {
        view.item.position.copy(toThreePosition(runner.item.position));
        view.item.quaternion.copy(toThreeQuaternion(runner.item.rotation));
        view.pushTrail(view.item.position);
      }
      reportActiveBlocks(runner.time);
      // While stopped, the state tab still refreshes so the "changed" mark goes away.
      renderPanels();
    }
    edit?.update();
    view?.render();
  }

  renderEvents();
  showTab('state');

  return {
    partsHost,
    isPartsVisible: () => visible && tab === 'parts',
    showTab,
    setCode(next, reason) {
      if (next !== code) {
        edit?.codeChanged();
        code = next;
        reset();
      }
      if (!code) showNotice(reason || 'ブロックを配置するとプレビューできます');
    },
    setProgramInfo(next) {
      info = next;
      renderEvents();
      renderPanels();
    },
    setEditTarget(target) {
      edit?.setTarget(target);
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

function escText(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function escAttr(s: string): string {
  return escText(s).replace(/"/g, '&quot;');
}
