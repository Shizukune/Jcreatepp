import { boolExprToJS, exprToJS } from './expr';
import { stmtToJS } from './stmt';
import { safeId, type SequenceStmt } from './shared';
import { traceLine } from './trace';

export function generateSequenceStateMachine(seq: SequenceStmt): string {
  const id = safeId(seq.id);
  const activeVar = `__jpp_seq_active_${id}`;
  const stepVar = `__jpp_seq_step_${id}`;
  const timeVar = `__jpp_seq_time_${id}`;

  const cases: string[] = [];
  for (let i = 0; i < seq.body.length; i++) {
    const stmt = seq.body[i];
    let caseBody = '';

    if (stmt.kind === 'wait_seconds') {
      // Spend this frame's remaining time once; carry any excess over to the next step.
      caseBody = `let time = ($.state["${timeVar}"] || 0) + budget;
const seconds = ${exprToJS(stmt.seconds)};
if (time >= seconds - 1e-6) {
  budget = Math.max(0, time - seconds);
  $.state["${timeVar}"] = 0;
  step++;
} else {
  $.state["${timeVar}"] = time;
  budget = 0;
  yielded = true;
}`;
    } else if (stmt.kind === 'wait_until') {
      caseBody = `if (${boolExprToJS(stmt.condition)}) {
  step++;
} else {
  yielded = true;
}`;
    } else if (stmt.kind === 'run_for_seconds') {
      const body = stmt.body.map((bodyStmt) => stmtToJS(bodyStmt)).join('\n');
      // Runs the body on every frame that overlaps [0, seconds), then carries the excess time over.
      caseBody = `const start = $.state["${timeVar}"] || 0;
const time = start + budget;
const seconds = ${exprToJS(stmt.seconds)};
if (start < seconds - 1e-6) {
${body.split('\n').map((line) => `  ${line}`).join('\n')}
}
if (time < seconds - 1e-6) {
  $.state["${timeVar}"] = time;
  budget = 0;
  yielded = true;
} else {
  budget = Math.max(0, time - seconds);
  $.state["${timeVar}"] = 0;
  step++;
}`;
    } else {
      caseBody = `${stmtToJS(stmt)}\nstep++;`;
    }

    // Waiting steps are not emitted through stmtToJS, so trace them here.
    if (stmt.kind === 'wait_seconds' || stmt.kind === 'wait_until' || stmt.kind === 'run_for_seconds') {
      caseBody = traceLine(stmt, 'wait') + caseBody;
    }

    cases.push(`      case ${i}: {\n${caseBody.split('\n').map((line) => `        ${line}`).join('\n')}\n        break;\n      }`);
  }

  cases.push(`      case ${seq.body.length}: {
        $.state["${activeVar}"] = false;
        step = 0;
        $.state["${stepVar}"] = 0;
        $.state["${timeVar}"] = 0;
        yielded = true;
        break;
      }`);

  return `if ($.state["${activeVar}"]) {
  let step = $.state["${stepVar}"] || 0;
  let budget = deltaTime; // this frame's time, consumed by waiting steps
  let yielded = false;
  let guard = 0;
  const MAX_SYNC_STEPS_PER_TICK = 100;

  while (!yielded && guard < MAX_SYNC_STEPS_PER_TICK) {
    guard++;
    switch (step) {
${cases.join('\n')}
      default: {
        yielded = true;
        break;
      }
    }
  }

  $.state["${stepVar}"] = step;
}`;
}
