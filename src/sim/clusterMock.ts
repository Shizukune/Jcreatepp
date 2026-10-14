/**
 * Minimal Cluster Script `$` mock for running Jcreate++ generated code.
 *
 * Scope (P0): the APIs referenced by src/codegen. Physics, avatars and multi-item
 * worlds are not simulated; side effects are recorded in `log` instead.
 * Unknown `$` members are recorded in `unsupported` and behave as no-ops.
 *
 * Simplification: setPosition / setRotation take effect immediately and getPosition /
 * getRotation return them. On Cluster, the getters may return the interpolated (moving)
 * transform rather than the value just set, so code that reads right after writing can
 * behave differently in-world.
 */

import { Quaternion, Vector3 } from './math';

export type LogEntry =
  | { type: 'send'; target: string; message: string; arg: unknown }
  | { type: 'audio'; id: string; volume: number }
  | { type: 'text'; subNode: string; component: string; text: string }
  | { type: 'enabled'; subNode: string; component: string; enabled: boolean }
  | { type: 'force'; force: Vector3 }
  | { type: 'player'; method: string; value: number }
  | { type: 'error'; event: string; message: string };

export type Handle = {
  type: 'player' | 'item';
  name: string;
  position: Vector3;
  exists(): boolean;
  getPosition(): Vector3;
  send(message: string, arg: unknown): void;
  setMoveSpeedRate(rate: number): void;
  setJumpSpeedRate(rate: number): void;
};

export type Handlers = {
  start?: () => void;
  update?: (deltaTime: number) => void;
  interact?: (player: Handle) => void;
  collide?: (collision: { handle: Handle | null }) => void;
  grab?: (isGrab: boolean, isLeftHand: boolean, player: Handle) => void;
  receive?: (message: string, arg: unknown, sender: Handle | null) => void;
  ride?: (isGetOn: boolean, player: Handle) => void;
  steer?: (input: { x: number; y: number }, player: Handle) => void;
  steerAdditionalAxis?: (input: number, player: Handle) => void;
};

export type ClusterMock = {
  $: any;
  handlers: Handlers;
  log: LogEntry[];
  unsupported: Set<string>;
  /** Current transform of this item (Cluster coordinates). */
  item: { position: Vector3; rotation: Quaternion };
  /** Virtual players / items that near / raycast / reference queries can see. */
  world: { players: Handle[]; items: Handle[] };
  createHandle(type: 'player' | 'item', name: string, position?: Vector3): Handle;
};

/** Deep-copies values stored in $.state so later mutations of the source do not leak in. */
function copyStateValue(value: unknown): unknown {
  if (value instanceof Vector3 || value instanceof Quaternion) return value.clone();
  return value;
}

export function createClusterMock(options: { position?: Vector3; rotation?: Quaternion } = {}): ClusterMock {
  const handlers: Handlers = {};
  const log: LogEntry[] = [];
  const unsupported = new Set<string>();
  const item = {
    position: options.position?.clone() ?? new Vector3(),
    rotation: options.rotation?.clone() ?? new Quaternion(),
  };
  const world = { players: [] as Handle[], items: [] as Handle[] };

  const createHandle = (type: 'player' | 'item', name: string, position = new Vector3()): Handle => ({
    type,
    name,
    position: position.clone(),
    exists: () => true,
    getPosition() {
      return this.position.clone();
    },
    send(message, arg) {
      log.push({ type: 'send', target: `${type}:${name}`, message, arg: copyStateValue(arg) });
    },
    setMoveSpeedRate(rate) {
      log.push({ type: 'player', method: 'setMoveSpeedRate', value: rate });
    },
    setJumpSpeedRate(rate) {
      log.push({ type: 'player', method: 'setJumpSpeedRate', value: rate });
    },
  });

  const state = new Proxy({} as Record<string, unknown>, {
    set(target, key, value) {
      target[key as string] = copyStateValue(value);
      return true;
    },
    get(target, key) {
      return copyStateValue(target[key as string]);
    },
  });

  const near = (list: Handle[], center: Vector3, radius: number) =>
    list.filter((h) => h.position.clone().sub(center).length() <= radius);

  const api: Record<string, unknown> = {
    state,
    onStart: (f: Handlers['start']) => (handlers.start = f),
    onUpdate: (f: Handlers['update']) => (handlers.update = f),
    onInteract: (f: Handlers['interact']) => (handlers.interact = f),
    onCollide: (f: Handlers['collide']) => (handlers.collide = f),
    onGrab: (f: Handlers['grab']) => (handlers.grab = f),
    onReceive: (f: Handlers['receive']) => (handlers.receive = f),
    onRide: (f: Handlers['ride']) => (handlers.ride = f),
    onSteer: (f: Handlers['steer']) => (handlers.steer = f),
    onSteerAdditionalAxis: (f: Handlers['steerAdditionalAxis']) => (handlers.steerAdditionalAxis = f),

    getPosition: () => item.position.clone(),
    setPosition: (v: Vector3) => (item.position = v.clone()),
    getRotation: () => item.rotation.clone(),
    setRotation: (q: Quaternion) => (item.rotation = q.clone()),

    getPlayersNear: (center: Vector3, radius: number) => near(world.players, center, radius),
    getItemsNear: (center: Vector3, radius: number) => near(world.items, center, radius),
    worldItemReference: (name: string) => world.items.find((h) => h.name === name) ?? createHandle('item', name),
    raycast: (origin: Vector3, direction: Vector3, maxDistance: number) => {
      const dir = direction.clone().normalize();
      let best: { handle: Handle; distance: number } | null = null;
      for (const h of [...world.players, ...world.items]) {
        const to = h.position.clone().sub(origin);
        const along = to.dot(dir);
        const off = to.clone().sub(dir.clone().multiplyScalar(along)).length();
        if (along >= 0 && along <= maxDistance && off <= 0.5 && (!best || along < best.distance)) {
          best = { handle: h, distance: along };
        }
      }
      return best ? { handle: best.handle, hit: { point: origin.clone().add(dir.multiplyScalar(best.distance)) } } : null;
    },

    addImpulsiveForce: (force: Vector3) => log.push({ type: 'force', force: force.clone() }),
    audio: (id: string) => ({
      volume: 1,
      play() {
        log.push({ type: 'audio', id, volume: this.volume });
      },
    }),
    subNode: (name: string) => ({
      setText: (text: string) => log.push({ type: 'text', subNode: name, component: 'TextView', text: String(text) }),
      getUnityComponent: (component: string) => {
        const unityProp = {};
        Object.defineProperty(unityProp, 'text', {
          set: (text: unknown) => log.push({ type: 'text', subNode: name, component, text: String(text) }),
        });
        Object.defineProperty(unityProp, 'enabled', {
          set: (enabled: unknown) => log.push({ type: 'enabled', subNode: name, component, enabled: !!enabled }),
        });
        return { unityProp };
      },
    }),
  };

  const $ = new Proxy(api, {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        unsupported.add(`$.${key}`);
        return () => undefined;
      }
      return target[key as string];
    },
  });

  return { $, handlers, log, unsupported, item, world, createHandle };
}
