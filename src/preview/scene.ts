/**
 * three.js scene of the 3D preview: camera, lights, grid, axes, the item, a virtual player and
 * the motion trail. Knows nothing about the simulation; positions are set by previewApp.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vector3 } from '../sim/math';
import { toThreePosition } from './coords';

const TRAIL_POINTS = 300;

export type PreviewScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** The item: a box with a cone on its Cluster forward (+Z). */
  item: THREE.Group;
  /** Shapes of the item, reused for the edit ghost. */
  itemParts: { box: THREE.Mesh; nose: THREE.Mesh };
  virtualPlayer: THREE.Mesh;
  pushTrail(p: THREE.Vector3): void;
  clearTrail(): void;
  /** Matches the canvas to its container and draws one frame. */
  render(): void;
};

export function createScene(view: HTMLElement): PreviewScene {
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
  scene.add(new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xa3d8f4 })));
  let trailCount = 0;

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

  function clearTrail() {
    trailCount = 0;
    trailGeometry.setDrawRange(0, 0);
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
    renderer,
    scene,
    camera,
    controls,
    item,
    itemParts: { box, nose },
    virtualPlayer,
    pushTrail,
    clearTrail,
    render() {
      resize();
      renderer.render(scene, camera);
    },
  };
}
