/**
 * Draws a block demo (three.js). Loaded with a dynamic import the first time a demo tooltip opens,
 * so three.js stays out of the main bundle.
 *
 * One WebGL renderer for all demos: its canvas is moved into whichever tooltip is showing.
 * The 3D preview has its own renderer, so at most two WebGL contexts exist.
 * The motion is recorded once per demo on the simulator (playback.ts), then replayed in a loop.
 */

import * as THREE from 'three';
import { Vector3 } from '../sim/math';
import { toThreePosition, toThreeQuaternion } from '../preview/coords';
import { createItemShape } from '../preview/itemShape';
import type { BlockDemo } from './catalog';
import { recordState, type Track } from './playback';

const DEMO_WIDTH = 240;
const DEMO_HEIGHT = 150;
/** How long "クリック" stays visible after an interact action. */
const CLICK_SHOW_SECONDS = 0.4;

type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  item: THREE.Group;
};

let stage: Stage | null = null;
let stopCurrent: (() => void) | null = null;
const tracks = new Map<string, Track>();

function getStage(): Stage {
  if (stage) return stage;
  // Throws when WebGL is not available; the tooltip then keeps its text only.
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(DEMO_WIDTH, DEMO_HEIGHT);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1b2a);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(5, 10, 3);
  scene.add(sun);
  scene.add(new THREE.GridHelper(20, 20, 0x3a5a7a, 0x1f3348));
  const camera = new THREE.PerspectiveCamera(45, DEMO_WIDTH / DEMO_HEIGHT, 0.1, 100);
  camera.position.copy(toThreePosition(new Vector3(2.4, 2.2, -3.4)));
  camera.lookAt(toThreePosition(new Vector3(0.6, 0.4, 0.4)));
  const { group } = createItemShape();
  scene.add(group);
  stage = { renderer, scene, camera, item: group };
  return stage;
}

function trackOf(demo: BlockDemo): Track {
  let track = tracks.get(demo.blockType);
  if (!track) {
    track = recordState(demo.workspace, demo.seconds, demo.actions);
    tracks.set(demo.blockType, track);
  }
  return track;
}

/**
 * Plays `demo` inside `frame` until `alive()` returns false (tooltip hidden or replaced).
 * Stops the demo that was playing before, if any.
 */
export function playDemo(
  frame: HTMLElement,
  demo: BlockDemo,
  alive: () => boolean,
  options: { forceMotion?: boolean; playButton?: boolean } = {},
): void {
  const { forceMotion = false, playButton = false } = options;
  stopCurrent?.();
  const { renderer, scene, camera, item } = getStage();
  const track = trackOf(demo);
  const clicks = (demo.actions ?? []).filter((a) => a.kind === 'interact').map((a) => a.at);

  const badge = document.createElement('span');
  badge.className = 'demoClick';
  badge.textContent = 'クリック';
  badge.hidden = true;
  frame.append(renderer.domElement, badge);

  // "Reduce motion": no loop, one still picture of how the demo ends. Where the frame can be
  // clicked (not in a tooltip, which closes when the pointer leaves the block), "▶ 見る" plays it.
  const still = !forceMotion && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) {
    const f = track.frames[track.frames.length - 1];
    item.position.copy(toThreePosition(f.position));
    item.quaternion.copy(toThreeQuaternion(f.rotation));
    renderer.render(scene, camera);
    const play = playButton ? document.createElement('button') : null;
    if (play) {
      play.type = 'button';
      play.className = 'demoPlay';
      play.textContent = '▶ 見る';
      play.addEventListener('click', () => {
        play.remove();
        if (alive()) playDemo(frame, demo, alive, { forceMotion: true, playButton });
      });
      frame.append(play);
    }
    stopCurrent = () => {
      play?.remove();
      badge.remove();
      stopCurrent = null;
    };
    return;
  }

  const start = performance.now();
  let frameId = 0;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frameId);
    badge.remove();
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;

  const draw = () => {
    if (stopped) return;
    if (!alive() || !frame.isConnected) {
      stop();
      return;
    }
    const t = ((performance.now() - start) / 1000) % demo.seconds;
    const f = track.frames[Math.min(track.frames.length - 1, Math.floor(t * track.fps))];
    item.position.copy(toThreePosition(f.position));
    item.quaternion.copy(toThreeQuaternion(f.rotation));
    badge.hidden = !clicks.some((at) => t >= at && t < at + CLICK_SHOW_SECONDS);
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(draw);
  };
  draw();
}
