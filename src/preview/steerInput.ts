/**
 * Keyboard -> Cluster ride input for the 3D preview (P8). Pure, so it is unit-tested.
 *
 * Matches the Cluster API: onSteer gets a Vector2 of length 0..1 and onSteerAdditionalAxis a
 * number in -1..1, each notified only when that input changes.
 */

const KEY_ACTIONS: Record<string, 'fwd' | 'back' | 'left' | 'right' | 'up' | 'down'> = {
  KeyW: 'fwd',
  ArrowUp: 'fwd',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyE: 'up',
  KeyQ: 'down',
};

export type SteerChange = { steer?: { x: number; y: number }; axis?: number };

export class SteerInput {
  /** Pressed key codes (not actions: W and ↑ can be held together). */
  private keys = new Set<string>();
  private lastSteer = '0,0';
  private lastAxis = 0;

  static handles(code: string): boolean {
    return code in KEY_ACTIONS;
  }

  press(code: string): SteerChange {
    if (SteerInput.handles(code)) this.keys.add(code);
    return this.changes();
  }

  release(code: string): SteerChange {
    this.keys.delete(code);
    return this.changes();
  }

  /** Releases everything (focus lost, got off, reset). */
  clear(): SteerChange {
    this.keys.clear();
    return this.changes();
  }

  /** Forget what was last sent, e.g. for a new simulation that has received nothing yet. */
  resetSent(): void {
    this.lastSteer = '0,0';
    this.lastAxis = 0;
  }

  private held(action: string): number {
    for (const code of this.keys) if (KEY_ACTIONS[code] === action) return 1;
    return 0;
  }

  /** Only the inputs that changed since the last call. */
  private changes(): SteerChange {
    const change: SteerChange = {};
    let x = this.held('right') - this.held('left');
    let y = this.held('fwd') - this.held('back');
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    const steerKey = `${x},${y}`;
    if (steerKey !== this.lastSteer) {
      this.lastSteer = steerKey;
      change.steer = { x, y };
    }
    const axis = this.held('up') - this.held('down');
    if (axis !== this.lastAxis) {
      this.lastAxis = axis;
      change.axis = axis;
    }
    return change;
  }
}
