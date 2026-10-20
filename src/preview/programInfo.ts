/**
 * What the 3D preview needs to know about the current program, besides the code: which events can
 * be tried, display names of the sequences, and the variables. Pure (IR in, data out); unit-tested.
 */

import type { Program, Stmt } from '../ir';
import { safeId } from '../codegen/shared';
import type { VariableInfo } from '../variables';

/** Event buttons the program reacts to (only these are shown). */
export type PreviewEvents = {
  interact: boolean;
  grab: boolean;
  release: boolean;
  collide: boolean;
  ride: boolean;
  /** Message names of the receive events, in order of appearance, without duplicates. */
  receives: string[];
};

export type SequenceInfo = {
  /** Same transformation as the generated state keys (`__jpp_seq_active_<key>`). */
  key: string;
  blockId: string;
  /** 「一連の動作（インタラクト時）」 */
  label: string;
  /** Steps directly inside the sequence (what 「ステップ n」 counts). */
  steps: number;
};

export type PreviewProgramInfo = {
  variables: VariableInfo[];
  events: PreviewEvents;
  sequences: SequenceInfo[];
};

export const NO_PROGRAM_INFO: PreviewProgramInfo = {
  variables: [],
  events: { interact: false, grab: false, release: false, collide: false, ride: false, receives: [] },
  sequences: [],
};

export function previewEvents(program: Program): PreviewEvents {
  return {
    interact: !!program.onInteract,
    grab: !!program.onGrabStart,
    release: !!program.onGrabEnd,
    collide: !!program.onCollide,
    ride: !!program.rideTemplate,
    receives: [...new Set((program.onReceives ?? []).map((r) => r.message))],
  };
}

/** Sequences in the order they appear, named after the event they are in. */
export function describeSequences(program: Program): SequenceInfo[] {
  const handlers: { label: string; body: Stmt[] | undefined }[] = [
    { label: '開始時', body: program.onStart?.body },
    { label: '毎フレーム', body: program.onUpdate?.body },
    { label: 'インタラクト時', body: program.onInteract?.body },
    { label: '衝突したとき', body: program.onCollide?.body },
    { label: '持ったとき', body: program.onGrabStart?.body },
    { label: '離したとき', body: program.onGrabEnd?.body },
    ...(program.onReceives ?? []).map((r) => ({ label: `「${r.message}」を受け取ったとき`, body: r.handler.body })),
  ];

  const found: { label: string; seq: Extract<Stmt, { kind: 'sequence' }> }[] = [];
  const walk = (stmts: Stmt[] | undefined, label: string) => {
    for (const s of stmts ?? []) {
      if (s.kind === 'sequence') {
        found.push({ label, seq: s });
        walk(s.body, label);
      } else if (s.kind === 'if') {
        walk(s.thenBody, label);
        walk(s.elseBody, label);
      } else if (s.kind === 'if_edge' || s.kind === 'run_for_seconds') {
        walk(s.body, label);
      }
    }
  };
  for (const h of handlers) walk(h.body, h.label);

  const perLabel = new Map<string, number>();
  for (const f of found) perLabel.set(f.label, (perLabel.get(f.label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return found.map(({ label, seq }) => {
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    const suffix = (perLabel.get(label) ?? 0) > 1 ? `・${n}つ目` : '';
    return { key: safeId(seq.id), blockId: seq.id, label: `一連の動作（${label}${suffix}）`, steps: seq.body.length };
  });
}

export function previewProgramInfo(program: Program | null): PreviewProgramInfo {
  if (!program) return NO_PROGRAM_INFO;
  return { variables: program.variables ?? [], events: previewEvents(program), sequences: describeSequences(program) };
}

export function hasAnyEvent(events: PreviewEvents): boolean {
  return events.interact || events.grab || events.release || events.collide || events.ride || events.receives.length > 0;
}
