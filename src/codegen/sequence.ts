import { boolExprToJS, exprToJS } from './expr';
import { stmtToJS } from './stmt';
import { safeId, type SequenceStmt } from './shared';

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
      caseBody = `let time = ($.state["${timeVar}"] || 0) + deltaTime;
$.state["${timeVar}"] = time;
if (time >= ${exprToJS(stmt.seconds)}) {
  $.state["${timeVar}"] = 0;
  step++;
} else {
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
      caseBody = `let time = ($.state["${timeVar}"] || 0) + deltaTime;
$.state["${timeVar}"] = time;
if (time <= ${exprToJS(stmt.seconds)}) {
${body.split('\n').map((line) => `  ${line}`).join('\n')}
  yielded = true;
} else {
  $.state["${timeVar}"] = 0;
  step++;
}`;
    } else {
      caseBody = `${stmtToJS(stmt)}\nstep++;`;
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
