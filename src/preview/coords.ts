/**
 * Cluster (Unity, left-handed, Y up) <-> three.js (right-handed, Y up) conversion.
 * The only place that knows about the handedness difference.
 *
 * Mirror S = diag(1, 1, -1): positions/directions map as S·v and rotations as S·R·S,
 * which for a quaternion (x, y, z, w) is (-x, -y, z, w). Both directions are the same map.
 */

import * as THREE from 'three';
import type { Quaternion, Vector3 } from '../sim/math';

export function toThreePosition(v: Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(v.x, v.y, -v.z);
}

export function toThreeQuaternion(q: Quaternion, out = new THREE.Quaternion()): THREE.Quaternion {
  return out.set(-q.x, -q.y, q.z, q.w);
}
