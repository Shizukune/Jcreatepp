/**
 * The motion sample of a part card: the part expanded with its default values into an empty
 * workspace, played like a block demo (src/demos). No DOM.
 */

import { event, workspaceState } from '../demos/blockJson';
import type { BlockDemo } from '../demos/catalog';
import { defaultValues, type Part } from './catalog';

export function partDemo(part: Part): BlockDemo {
  const names = Object.fromEntries(part.names.map((n) => [n.key, n.base]));
  const expansion = part.expand(defaultValues(part), names);
  return {
    // Demo tracks are cached by this key, next to the block demos'.
    blockType: `part:${part.id}`,
    caption: part.label,
    workspace: workspaceState(expansion.events.map((ev) => event(ev.eventType, ev.body, ev.eventFields))),
    seconds: part.demo.seconds,
    actions: (part.demo.clicks ?? []).map((at) => ({ at, kind: 'interact' as const })),
    reproduces: part.writes,
  };
}
