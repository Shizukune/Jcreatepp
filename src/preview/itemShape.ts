/**
 * The item as drawn in the 3D views: a box with a cone on its Cluster forward (+Z).
 * Shared by the 3D preview (scene.ts) and the block demos (src/demos/demoRenderer.ts).
 */

import * as THREE from 'three';
import { Vector3 } from '../sim/math';
import { toThreePosition } from './coords';

export function createItemShape(): { group: THREE.Group; box: THREE.Mesh; nose: THREE.Mesh } {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xe94560 }));
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
  nose.position.copy(toThreePosition(new Vector3(0, 0, 0.72)));
  nose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), toThreePosition(new Vector3(0, 0, 1)));
  group.add(box, nose);
  return { group, box, nose };
}
