/**
 * Jcreate++ コード生成 (IR → JS)
 *
 * IR (Program) を Cluster Script 互換の JS コードに変換する。
 * Cluster API の具体的な書き方はこのファイルに閉じ込める。
 *
 * ── 出力規則 ──
 * - 出力順は固定: onStart → onUpdate → onInteract
 * - インデント: 2 spaces
 * - 1命令1行
 * - 空イベントもそのまま出力する
 *
 * ── Cluster API 参照 ──
 * - $.onStart:      https://docs.cluster.mu/script/interfaces/ClusterScript.html#onstart
 * - $.onUpdate:     https://docs.cluster.mu/script/interfaces/ClusterScript.html#onupdate
 * - $.onInteract:   https://docs.cluster.mu/script/interfaces/ClusterScript.html#oninteract
 * - $.setPosition:  Vector3 を受け取る
 * - $.setRotation:  Quaternion を受け取る
 * - Vector3:        new Vector3(x, y, z)
 * - Quaternion:     new Quaternion().setFromEulerAngles(new Vector3(x, y, z))
 */

import type { Program, Handler, Stmt, Expr } from './ir';

type SequenceStmt = Extract<Stmt, { kind: 'sequence' }>;

// ── ヘルパー ──
function jsString(value: string): string {
  return JSON.stringify(value);
}

function stateKey(prefix: string, name: string): string {
  return jsString(prefix + name);
}

function axisVector(axis: 'X' | 'Y' | 'Z'): string {
  switch (axis) {
    case 'X':
      return 'new Vector3(1, 0, 0)';
    case 'Y':
      return 'new Vector3(0, 1, 0)';
    case 'Z':
      return 'new Vector3(0, 0, 1)';
  }
}

// ── ヘルパー: Sequence抽出 ──
function extractSequences(stmts: Stmt[]): SequenceStmt[] {
  let seqs: SequenceStmt[] = [];
  for (const stmt of stmts) {
    if (stmt.kind === 'sequence') {
      seqs.push(stmt);
    } else if (stmt.kind === 'if') {
      seqs = seqs.concat(extractSequences(stmt.thenBody));
      if (stmt.elseBody) {
        seqs = seqs.concat(extractSequences(stmt.elseBody));
      }
    }
  }
  return seqs;
}

function getAllSequences(program: Program): SequenceStmt[] {
  let seqs: SequenceStmt[] = [];
  if (program.onStart) seqs = seqs.concat(extractSequences(program.onStart.body));
  if (program.onUpdate) seqs = seqs.concat(extractSequences(program.onUpdate.body));
  if (program.onInteract) seqs = seqs.concat(extractSequences(program.onInteract.body));
  if (program.onGrabStart) seqs = seqs.concat(extractSequences(program.onGrabStart.body));
  if (program.onGrabEnd) seqs = seqs.concat(extractSequences(program.onGrabEnd.body));
  if (program.onReceives) {
    for (const recv of program.onReceives) {
      seqs = seqs.concat(extractSequences(recv.handler.body));
    }
  }
  return seqs;
}

// ── メイン ──

/**
 * Program (IR) を Cluster Script 互換の JS 文字列に変換する。
 * 出力順は固定: onStart → onUpdate → onInteract
 */
export function programToJS(program: Program): string {
  const parts: string[] = [];
  const allSequences = getAllSequences(program);

  if (program.onStart) {
    parts.push(handlerToJS('onStart', program.onStart));
  }

  // onUpdate の生成（Sequenceのステートマシン実行ロジック、Rideテンプレート、Oscillateを注入する）
  let updateBodyLines: string[] = [];
  if (program.onUpdate) {
    updateBodyLines = program.onUpdate.body.map((stmt) => '  ' + stmtToJS(stmt).replace(/\n/g, '\n  '));
  }
  
  if (allSequences.length > 0) {
    for (const seq of allSequences) {
      updateBodyLines.push('  ' + generateSequenceStateMachine(seq).replace(/\n/g, '\n  '));
    }
  }

  if (program.rideTemplate) {
    const fwd = exprToJS(program.rideTemplate.forwardSpeed);
    const upd = exprToJS(program.rideTemplate.upDownSpeed);
    const trn = exprToJS(program.rideTemplate.turnSpeed);
    
    parts.push(`$.onRide((isGetOn, player) => {\n  if (isGetOn) {\n    $.state["__jpp_ride_active"] = true;\n  } else {\n    $.state["__jpp_ride_active"] = false;\n    $.state["__jpp_ride_fwd"] = 0;\n    $.state["__jpp_ride_upd"] = 0;\n    $.state["__jpp_ride_trn"] = 0;\n  }\n});\n`);
    parts.push(`$.onSteer((input, player) => {\n  if ($.state["__jpp_ride_active"]) {\n    $.state["__jpp_ride_fwd"] = input.y * (${fwd});\n    $.state["__jpp_ride_trn"] = input.x * (${trn});\n  }\n});\n`);
    parts.push(`$.onSteerAdditionalAxis((input, player) => {\n  if ($.state["__jpp_ride_active"]) {\n    $.state["__jpp_ride_upd"] = input * (${upd});\n  }\n});\n`);
    
    updateBodyLines.push(`  if ($.state["__jpp_ride_active"]) {
    const pos = $.getPosition() || new Vector3(0,0,0);
    const rot = $.getRotation() || new Quaternion();
    const trnAmount = ($.state["__jpp_ride_trn"] || 0) * deltaTime;
    const nextRot = rot.clone().multiply(new Quaternion().setFromEulerAngles(new Vector3(0, trnAmount, 0)));
    
    const direction = nextRot.clone().createEulerAngles();
    const forwardRadian = ((direction.y + 270) % 360) * Math.PI / 180;
    const fwdAmount = $.state["__jpp_ride_fwd"] || 0;
    const forwardVec = new Vector3(
      Math.sin(forwardRadian) * fwdAmount * deltaTime,
      0,
      Math.cos(forwardRadian) * fwdAmount * deltaTime
    );
    const upVec = new Vector3(0, 1, 0).multiplyScalar(($.state["__jpp_ride_upd"] || 0) * deltaTime);
    
    $.setPosition(pos.clone().add(forwardVec).add(upVec));
    $.setRotation(nextRot);
  }`);
  }

  if (program.chaseTemplate) {
    const moveSpeed = exprToJS(program.chaseTemplate.moveSpeed);
    const maxDistance = exprToJS(program.chaseTemplate.maxDistance);
    const minDistance = exprToJS(program.chaseTemplate.minDistance);

    updateBodyLines.push(`  {
    const __jpp_chase_pos = $.getPosition() || new Vector3(0,0,0);
    const __jpp_chase_players = $.getPlayersNear(__jpp_chase_pos, (${maxDistance}));
    let __jpp_chase_target = null;
    let __jpp_chase_distance = Infinity;
    for (const __jpp_chase_player of __jpp_chase_players) {
      const __jpp_chase_player_pos = __jpp_chase_player.getPosition();
      if (!__jpp_chase_player_pos) continue;
      const __jpp_chase_dist = __jpp_chase_player_pos.clone().sub(__jpp_chase_pos).length();
      if (__jpp_chase_dist < __jpp_chase_distance) {
        __jpp_chase_distance = __jpp_chase_dist;
        __jpp_chase_target = __jpp_chase_player;
      }
    }
    if (__jpp_chase_target && __jpp_chase_target.exists()) {
      const __jpp_chase_target_pos = __jpp_chase_target.getPosition();
      if (__jpp_chase_target_pos) {
        const __jpp_chase_dir = __jpp_chase_target_pos.clone().sub(__jpp_chase_pos);
        const __jpp_chase_len = __jpp_chase_dir.length();
        if (__jpp_chase_len > 0) {
          const __jpp_chase_angle = Math.atan2(__jpp_chase_dir.x, __jpp_chase_dir.z) * 180 / Math.PI;
          $.setRotation(new Quaternion().setFromEulerAngles(new Vector3(0, __jpp_chase_angle, 0)));
          if (__jpp_chase_len > (${minDistance})) {
            $.setPosition(__jpp_chase_pos.add(__jpp_chase_dir.normalize().multiplyScalar((${moveSpeed}) * deltaTime)));
          }
        }
      }
    }
  }`);
  }

  if (updateBodyLines.length > 0) {
    parts.push(`$.onUpdate((deltaTime) => {\n${updateBodyLines.join('\n')}\n});\n`);
  }

  if (program.onInteract) {
    parts.push(handlerToJS('onInteract', program.onInteract));
  }

  if (program.onGrabStart || program.onGrabEnd) {
    let grabCode = `$.onGrab((isGrab, isLeftHand, player) => {\n`;
    if (program.onGrabStart) {
      grabCode += `  if (isGrab) {\n`;
      grabCode += program.onGrabStart.body.map((stmt) => '    ' + stmtToJS(stmt).replace(/\n/g, '\n    ')).join('\n') + '\n';
      grabCode += `  }\n`;
    }
    if (program.onGrabEnd) {
      grabCode += `  if (!isGrab) {\n`;
      grabCode += program.onGrabEnd.body.map((stmt) => '    ' + stmtToJS(stmt).replace(/\n/g, '\n    ')).join('\n') + '\n';
      grabCode += `  }\n`;
    }
    grabCode += `});\n`;
    parts.push(grabCode);
  }

  if (program.onReceives && program.onReceives.length > 0) {
    // groupByMessage
    const groups = new Map<string, Handler[]>();
    for (const recv of program.onReceives) {
      if (!groups.has(recv.message)) {
        groups.set(recv.message, []);
      }
      groups.get(recv.message)!.push(recv.handler);
    }

    const lines: string[] = [];
    for (const [message, handlers] of groups) {
      lines.push(`  if (msg === ${jsString(message)}) {`);
      for (const handler of handlers) {
        for (const stmt of handler.body) {
          lines.push('    ' + stmtToJS(stmt).replace(/\n/g, '\n    '));
        }
      }
      lines.push('  }');
    }
    parts.push(`$.onReceive((msg, arg, sender) => {\n${lines.join('\n')}\n}, { item: true, player: true });\n`);
  }

  if (parts.length === 0) {
    return '// ブロックが配置されていません';
  }

  return parts.join('\n');
}

// ── Sequence ステートマシン生成 ──
function generateSequenceStateMachine(seq: SequenceStmt): string {
  const id = seq.id.replace(/[^a-zA-Z0-9]/g, '_');
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
    } else {
      // 即時実行ステートメント
      caseBody = `${stmtToJS(stmt)}\nstep++;`;
    }

    cases.push(`      case ${i}: {\n${caseBody.split('\n').map(l => '        ' + l).join('\n')}\n        break;\n      }`);
  }

  // 終了ケース
  cases.push(`      case ${seq.body.length}: {
        $.state["${activeVar}"] = false;
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
  
  // guard 超過時の異常系ハンドリング (フリーズ防止)
  if (guard >= MAX_SYNC_STEPS_PER_TICK) {
    // 1フレームで処理しきれない異常なループまたは重すぎる処理が発生したため中断
    // 次のフレームで続きから再開させる
  }
  
  $.state["${stepVar}"] = step;
}`;
}

// ── ハンドラ ──

/** イベント名ごとのコールバック引数 */
const EVENT_PARAMS: Record<string, string> = {
  onStart: '',
  onUpdate: 'deltaTime',
  onInteract: 'player',
};

function handlerToJS(event: string, handler: Handler): string {
  const params = EVENT_PARAMS[event] ?? '';
  const bodyLines = handler.body.map((stmt) => '  ' + stmtToJS(stmt));
  const body = bodyLines.join('\n');

  return `$.${event}((${params}) => {\n${body}\n});\n`;
}

// ── ステートメント ──

function stmtToJS(stmt: Stmt): string {
  switch (stmt.kind) {
    case 'set_position':
      return `$.setPosition(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)}));`;

    case 'move_by':
      return `$.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)})));`;

    case 'set_rotation':
      return `$.setRotation(new Quaternion().setFromEulerAngles(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)})));`;

    case 'rotate_by':
      return `$.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromEulerAngles(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)}))));`;

    case 'random_warp':
      return `{\n  const __jpp_pos = $.getPosition() || new Vector3(0,0,0);\n  $.setPosition(new Vector3(__jpp_pos.x + (Math.random()*2-1)*(${exprToJS(stmt.rangeX)}), __jpp_pos.y, __jpp_pos.z + (Math.random()*2-1)*(${exprToJS(stmt.rangeZ)})));\n}`;

    case 'save_position':
      return `$.state["__jpp_saved_position"] = $.getPosition() || new Vector3(0,0,0);`;

    case 'load_position':
      return `if ($.state["__jpp_saved_position"]) {\n  $.setPosition($.state["__jpp_saved_position"]);\n}`;

    case 'add_force':
      return `$.addImpulsiveForce(new Vector3(${exprToJS(stmt.dirX)}, ${exprToJS(stmt.dirY)}, ${exprToJS(stmt.dirZ)}).normalize().multiplyScalar(${exprToJS(stmt.power)}));`;

    case 'continuous_rotation':
      return `$.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(${axisVector(stmt.axis)}, (${exprToJS(stmt.speed)}) * deltaTime)));`;

    case 'timed_random_warp': {
      const id = stmt.blockId.replace(/[^a-zA-Z0-9]/g, '_');
      return `{
  const __jpp_timer_key_${id} = "__jpp_timed_warp_time_${id}";
  $.state[__jpp_timer_key_${id}] = ($.state[__jpp_timer_key_${id}] || 0) + deltaTime;
  if ($.state[__jpp_timer_key_${id}] >= (${exprToJS(stmt.interval)})) {
    const __jpp_pos_${id} = $.getPosition() || new Vector3(0,0,0);
    const __jpp_range_${id} = (${exprToJS(stmt.range)});
    $.setPosition(new Vector3(
      __jpp_pos_${id}.x + (Math.random() * 2 - 1) * __jpp_range_${id},
      __jpp_pos_${id}.y,
      __jpp_pos_${id}.z + (Math.random() * 2 - 1) * __jpp_range_${id}
    ));
    $.state[__jpp_timer_key_${id}] = 0;
  }
}`;
    }

    case 'timed_move_return': {
      const id = stmt.blockId.replace(/[^a-zA-Z0-9]/g, '_');
      return `{
  const __jpp_active_key_${id} = "__jpp_move_return_active_${id}";
  const __jpp_time_key_${id} = "__jpp_move_return_time_${id}";
  const __jpp_pos_key_${id} = "__jpp_move_return_pos_${id}";
  if (!$.state[__jpp_active_key_${id}]) {
    $.state[__jpp_active_key_${id}] = true;
    $.state[__jpp_time_key_${id}] = 0;
    $.state[__jpp_pos_key_${id}] = $.getPosition() || new Vector3(0,0,0);
  }
  $.state[__jpp_time_key_${id}] = ($.state[__jpp_time_key_${id}] || 0) + deltaTime;
  if ($.state[__jpp_time_key_${id}] < (${exprToJS(stmt.duration)})) {
    const __jpp_dir_${id} = new Vector3(${exprToJS(stmt.dirX)}, ${exprToJS(stmt.dirY)}, ${exprToJS(stmt.dirZ)});
    if (__jpp_dir_${id}.length() > 0) {
      const __jpp_pos_${id} = $.getPosition() || new Vector3(0,0,0);
      $.setPosition(__jpp_pos_${id}.add(__jpp_dir_${id}.normalize().multiplyScalar((${exprToJS(stmt.speed)}) * deltaTime)));
    }
  } else {
    if ($.state[__jpp_pos_key_${id}]) {
      $.setPosition($.state[__jpp_pos_key_${id}]);
    }
    $.state[__jpp_active_key_${id}] = false;
    $.state[__jpp_time_key_${id}] = 0;
  }
}`;
    }

    case 'set_move_speed':
      return `player.setMoveSpeedRate(${exprToJS(stmt.rate)});`;

    case 'set_jump_speed':
      return `player.setJumpSpeedRate(${exprToJS(stmt.rate)});`;

    case 'set_flag': {
      if (stmt.operation === 'true') {
        return `$.state[${stateKey('__jpp_flag_', stmt.name)}] = true;`;
      } else if (stmt.operation === 'false') {
        return `$.state[${stateKey('__jpp_flag_', stmt.name)}] = false;`;
      } else {
        return `$.state[${stateKey('__jpp_flag_', stmt.name)}] = !$.state[${stateKey('__jpp_flag_', stmt.name)}];`;
      }
    }

    case 'oscillate': {
      const id = stmt.blockId.replace(/[^a-zA-Z0-9]/g, '_');
      const axisKey = stmt.axis === 'X' ? 'x' : stmt.axis === 'Y' ? 'y' : 'z';
      return `if (!$.state["__jpp_osc_init_pos_${id}"]) {
  $.state["__jpp_osc_init_pos_${id}"] = $.getPosition() || new Vector3(0,0,0);
  $.state["__jpp_osc_time_${id}"] = 0;
}
$.state["__jpp_osc_time_${id}"] += deltaTime * (${exprToJS(stmt.speed)});
const __jpp_osc_pos_${id} = $.state["__jpp_osc_init_pos_${id}"];
const __jpp_osc_offset_${id} = Math.sin($.state["__jpp_osc_time_${id}"]) * (${exprToJS(stmt.width)});
$.setPosition(new Vector3(
  __jpp_osc_pos_${id}.x + ${stmt.axis === 'X' ? `__jpp_osc_offset_${id}` : '0'},
  __jpp_osc_pos_${id}.y + ${stmt.axis === 'Y' ? `__jpp_osc_offset_${id}` : '0'},
  __jpp_osc_pos_${id}.z + ${stmt.axis === 'Z' ? `__jpp_osc_offset_${id}` : '0'}
));`;
    }

    case 'if': {
      const condCode = boolExprToJS(stmt.condition);
      const thenBodyJS = stmt.thenBody.map((s) => '  ' + stmtToJS(s).replace(/\n/g, '\n  ')).join('\n');
      
      let out = `if (${condCode}) {\n${thenBodyJS}\n}`;
      if (stmt.elseBody) {
        const elseBodyJS = stmt.elseBody.map((s) => '  ' + stmtToJS(s).replace(/\n/g, '\n  ')).join('\n');
        out += ` else {\n${elseBodyJS}\n}`;
      }
      return out;
    }

    case 'sequence': {
      const id = stmt.id.replace(/[^a-zA-Z0-9]/g, '_');
      return `if (!$.state["__jpp_seq_active_${id}"]) {\n  $.state["__jpp_seq_active_${id}"] = true;\n  $.state["__jpp_seq_step_${id}"] = 0;\n  $.state["__jpp_seq_time_${id}"] = 0;\n}`;
    }

    case 'wait_seconds':
    case 'wait_until':
      return `// error: wait stmt should be generated inside state machine`;

    default: {
      // 将来の Stmt 追加時にコンパイルエラーで検出するための exhaustive check
      const _exhaustive: never = stmt;
      return `// unknown stmt: ${(_exhaustive as any).kind}`;
    }
  }
}

// ── 式 ──

function exprToJS(expr: Expr): string {
  switch (expr.kind) {
    case 'raw':
      return expr.code;
    case 'number_literal':
      return String(expr.value);
    case 'delta_time':
      return 'deltaTime';
    case 'player_ref':
      return 'player';
  }
}

function boolExprToJS(expr: import('./ir').BoolExpr): string {
  switch (expr.kind) {
    case 'raw_bool':
      return expr.code;
    case 'compare':
      return `(${exprToJS(expr.left)} ${expr.operator === 'EQ' ? '===' : expr.operator === 'NEQ' ? '!==' : expr.operator === 'LT' ? '<' : expr.operator === 'LTE' ? '<=' : expr.operator === 'GT' ? '>' : '>='} ${exprToJS(expr.right)})`;
    case 'not':
      return `!(${boolExprToJS(expr.expr)})`;
    case 'and':
      return `(${boolExprToJS(expr.left)} && ${boolExprToJS(expr.right)})`;
    case 'or':
      return `(${boolExprToJS(expr.left)} || ${boolExprToJS(expr.right)})`;
    case 'flag':
      return `!!$.state[${stateKey('__jpp_flag_', expr.name)}]`;
    default:
      return 'false';
  }
}
