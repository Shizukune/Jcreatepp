/**
 * Keyboard driving while riding (P8): keys on the focused 3D view -> onSteer /
 * onSteerAdditionalAxis. Key state and the Cluster input rules live in steerInput.ts.
 */

import type { Runner } from '../sim/runner';
import { SteerInput, type SteerChange } from './steerInput';

export type RideControls = {
  /** Release all keys and start from "nothing sent" (getting on / off, reset). */
  reset(): void;
};

export function attachRideControls(view: HTMLElement, getRunner: () => Runner | null, isRiding: () => boolean): RideControls {
  const input = new SteerInput();

  const send = (change: SteerChange) => {
    const runner = getRunner();
    if (!runner) return;
    if (change.steer) runner.steer(change.steer);
    if (change.axis !== undefined) runner.steerAdditionalAxis(change.axis);
  };

  view.addEventListener('keydown', (e) => {
    if (!isRiding() || !SteerInput.handles(e.code)) return;
    e.preventDefault(); // arrows would scroll the page
    send(input.press(e.code));
  });
  view.addEventListener('keyup', (e) => send(input.release(e.code)));
  // Losing focus (clicking elsewhere, switching windows or tabs) releases all keys,
  // so the vehicle never keeps driving with a key that was released elsewhere.
  const releaseAll = () => send(input.clear());
  view.addEventListener('blur', releaseAll);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
  view.addEventListener('pointerdown', () => view.focus());

  return {
    reset() {
      input.clear();
      input.resetSent();
    },
  };
}
