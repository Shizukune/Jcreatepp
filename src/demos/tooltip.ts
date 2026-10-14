/**
 * Block tooltips with a moving demo (A). Blockly's custom tooltip replaces the whole tooltip
 * rendering, so the plain text tooltip is drawn here too (same wrapping as Blockly's default).
 *
 * The demo is shown only for blocks in the toolbox flyout that have a demo (src/demos/catalog.ts).
 * The frame has a fixed size, so the tooltip does not change size when the 3D view arrives.
 * Blockly has no "tooltip hidden" callback: the renderer checks `alive()` every frame.
 */

import * as Blockly from 'blockly/core';
import { findDemo } from './catalog';

const DEMO_WIDTH = 240;
const DEMO_HEIGHT = 150;

let generation = 0;

export function installDemoTooltips(): void {
  Blockly.Tooltip.setCustomTooltip((div, element) => {
    const current = ++generation;
    div.textContent = '';

    const block = element instanceof Blockly.BlockSvg ? element : null;
    const demo = block && block.isInFlyout ? findDemo(block.type) : undefined;

    let frame: HTMLDivElement | null = null;
    if (demo) {
      frame = document.createElement('div');
      frame.className = 'demoFrame';
      frame.style.width = `${DEMO_WIDTH}px`;
      frame.style.height = `${DEMO_HEIGHT}px`;
      const caption = document.createElement('div');
      caption.className = 'demoCaption';
      caption.textContent = `▶ ${demo.caption}`;
      div.append(frame, caption);
    }

    const tip = Blockly.utils.string.wrap(Blockly.Tooltip.getTooltipOfObject(element), Blockly.Tooltip.LIMIT);
    for (const line of tip.split('\n')) {
      const lineDiv = document.createElement('div');
      lineDiv.textContent = line;
      div.appendChild(lineDiv);
    }

    if (demo && frame && block) {
      const target = frame;
      const alive = () => current === generation && Blockly.Tooltip.isVisible() && target.isConnected && !block.isDisposed();
      import('./demoRenderer')
        .then(({ playDemo }) => {
          if (alive()) playDemo(target, demo, alive);
        })
        .catch((err) => {
          console.warn('block demo unavailable:', err);
          if (current === generation) {
            target.classList.add('demoUnavailable');
            target.textContent = '（この環境では動きを表示できません）';
          }
        });
    }
  });
}
