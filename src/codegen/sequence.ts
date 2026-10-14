import { atLeastJS, boolExprToJS } from './expr';
import { bodyToJS, stmtToJS } from './stmt';
import { safeId, type SequenceStmt } from './shared';
import { traceLine } from './trace';
import { describeStmt } from './describe';
import { bare, commentText } from './format';

/**
 * A sequence runs inside onUpdate as a small state machine: each frame it continues from the
 * current step, runs steps that finish immediately, and stops at a waiting step until it is done.
 */
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
      caseBody = `// ${describeStmt(stmt)}
let time = ($.state["${timeVar}"] || 0) + budget;
const seconds = ${bare(atLeastJS(0, stmt.seconds))};
if (time >= seconds - 1e-6) {
  // 待ち終わり: 余った時間は次のステップに回す
  budget = Math.max(0, time - seconds);
  $.state["${timeVar}"] = 0;
  step++;
} else {
  // まだ待つ: 続きは次のフレーム
  $.state["${timeVar}"] = time;
  budget = 0;
  yielded = true;
}`;
    } else if (stmt.kind === 'wait_until') {
      caseBody = `// ${describeStmt(stmt)}
if (${bare(boolExprToJS(stmt.condition))}) {
  step++;
} else {
  yielded = true;
}`;
    } else if (stmt.kind === 'run_for_seconds') {
      // Runs the body on every frame that overlaps [0, seconds), then carries the excess time over.
      caseBody = `// ${describeStmt(stmt)}
const start = $.state["${timeVar}"] || 0;
const time = start + budget;
const seconds = ${bare(atLeastJS(0, stmt.seconds))};
if (budget > 0 && start < seconds) {
${bodyToJS(stmt.body, 2)}
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
        // 最後まで進んだので終わる（次に始めるときは最初から）
        $.state["${activeVar}"] = false;
        step = 0;
        $.state["${stepVar}"] = 0;
        $.state["${timeVar}"] = 0;
        yielded = true;
        break;
      }`);

  return `// 一連の動作（ブロック ${commentText(seq.id)}）: 実行中なら、今のステップから続きを進める
if ($.state["${activeVar}"]) {
  let step = $.state["${stepVar}"] || 0;
  let budget = deltaTime; // このフレームで使える時間（待つステップが使う）
  let yielded = false; // true になったら、続きは次のフレーム
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
