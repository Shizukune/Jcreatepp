/**
 * Minimal Cluster Script compatible Vector3 / Quaternion for the simulator.
 *
 * Follows https://docs.cluster.mu/script/ semantics:
 * - most methods mutate `this` and return it; clone() returns a copy
 * - angles are in degrees, Euler order is ZXY (Unity compatible)
 * - Quaternion.multiply(q) sets this = this * q
 * DOM independent so the same code runs in tests and in the browser preview.
 */

const DEG = Math.PI / 180;

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x: number, y: number, z: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  add(v: Vector3): this {
    return this.set(this.x + v.x, this.y + v.y, this.z + v.z);
  }

  sub(v: Vector3): this {
    return this.set(this.x - v.x, this.y - v.y, this.z - v.z);
  }

  multiplyScalar(s: number): this {
    return this.set(this.x * s, this.y * s, this.z * s);
  }

  divideScalar(s: number): this {
    return this.set(this.x / s, this.y / s, this.z / s);
  }

  negate(): this {
    return this.multiplyScalar(-1);
  }

  dot(v: Vector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  lengthSq(): number {
    return this.dot(this);
  }

  length(): number {
    return Math.sqrt(this.lengthSq());
  }

  normalize(): this {
    const len = this.length();
    return len > 0 ? this.divideScalar(len) : this;
  }

  lerp(v: Vector3, a: number): this {
    return this.set(this.x + (v.x - this.x) * a, this.y + (v.y - this.y) * a, this.z + (v.z - this.z) * a);
  }

  /** v' = q * v * q^-1 */
  applyQuaternion(q: Quaternion): this {
    const { x, y, z } = this;
    const ix = q.w * x + q.y * z - q.z * y;
    const iy = q.w * y + q.z * x - q.x * z;
    const iz = q.w * z + q.x * y - q.y * x;
    const iw = -q.x * x - q.y * y - q.z * z;
    return this.set(
      ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x,
    );
  }

  equals(v: Vector3, eps = 1e-6): boolean {
    return Math.abs(this.x - v.x) < eps && Math.abs(this.y - v.y) < eps && Math.abs(this.z - v.z) < eps;
  }
}

export class Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  set(x: number, y: number, z: number, w: number): this {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  identity(): this {
    return this.set(0, 0, 0, 1);
  }

  /** this = this * q */
  multiply(q: Quaternion): this {
    const a = this;
    return this.set(
      a.w * q.x + a.x * q.w + a.y * q.z - a.z * q.y,
      a.w * q.y - a.x * q.z + a.y * q.w + a.z * q.x,
      a.w * q.z + a.x * q.y - a.y * q.x + a.z * q.w,
      a.w * q.w - a.x * q.x - a.y * q.y - a.z * q.z,
    );
  }

  setFromAxisAngle(axis: Vector3, degree: number): this {
    const n = axis.clone().normalize();
    const half = (degree * DEG) / 2;
    const s = Math.sin(half);
    return this.set(n.x * s, n.y * s, n.z * s, Math.cos(half));
  }

  /** Degrees, applied Z then X then Y: q = qY * qX * qZ */
  setFromEulerAngles(xOrV: number | Vector3, y?: number, z?: number): this {
    const v = typeof xOrV === 'number' ? new Vector3(xOrV, y ?? 0, z ?? 0) : xOrV;
    const qx = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), v.x);
    const qy = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), v.y);
    const qz = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), v.z);
    const r = qy.multiply(qx).multiply(qz);
    return this.set(r.x, r.y, r.z, r.w);
  }

  /** Inverse of setFromEulerAngles (ZXY), degrees in [0, 360) like Unity. */
  createEulerAngles(): Vector3 {
    const { x, y, z, w } = this;
    const sinX = Math.max(-1, Math.min(1, 2 * (w * x - y * z)));
    const ex = Math.asin(sinX);
    let ey: number;
    let ez: number;
    if (Math.abs(sinX) < 0.9999999) {
      ey = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
      ez = Math.atan2(2 * (w * z + x * y), 1 - 2 * (x * x + z * z));
    } else {
      ey = Math.atan2(-2 * (x * z - w * y), 1 - 2 * (y * y + z * z));
      ez = 0;
    }
    const wrap = (r: number) => ((r / DEG) % 360 + 360) % 360;
    return new Vector3(wrap(ex), wrap(ey), wrap(ez));
  }

  dot(q: Quaternion): number {
    return this.x * q.x + this.y * q.y + this.z * q.z + this.w * q.w;
  }

  length(): number {
    return Math.sqrt(this.dot(this));
  }

  normalize(): this {
    const len = this.length() || 1;
    return this.set(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  invert(): this {
    const d = this.dot(this) || 1;
    return this.set(-this.x / d, -this.y / d, -this.z / d, this.w / d);
  }

  slerp(q: Quaternion, a: number): this {
    let cos = this.dot(q);
    let to = q.clone();
    if (cos < 0) {
      cos = -cos;
      to = new Quaternion(-q.x, -q.y, -q.z, -q.w);
    }
    if (cos > 0.9995) {
      return this.set(
        this.x + (to.x - this.x) * a,
        this.y + (to.y - this.y) * a,
        this.z + (to.z - this.z) * a,
        this.w + (to.w - this.w) * a,
      ).normalize();
    }
    const theta = Math.acos(cos);
    const sin = Math.sin(theta);
    const s0 = Math.sin((1 - a) * theta) / sin;
    const s1 = Math.sin(a * theta) / sin;
    return this.set(this.x * s0 + to.x * s1, this.y * s0 + to.y * s1, this.z * s0 + to.z * s1, this.w * s0 + to.w * s1);
  }

  /** Same rotation (q and -q are equivalent). */
  equals(q: Quaternion, eps = 1e-6): boolean {
    return Math.abs(Math.abs(this.dot(q)) - 1) < eps;
  }
}
