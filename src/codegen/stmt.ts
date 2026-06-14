import type { Stmt } from '../ir';
import { boolExprToJS, exprToJS } from './expr';
import { axisVector, jsString, safeId, stateKey } from './shared';

export function stmtToJS(stmt: Stmt): string {
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
      return `{
  const __jpp_pos = $.getPosition() || new Vector3(0,0,0);
  $.setPosition(new Vector3(__jpp_pos.x + (Math.random()*2-1)*(${exprToJS(stmt.rangeX)}), __jpp_pos.y, __jpp_pos.z + (Math.random()*2-1)*(${exprToJS(stmt.rangeZ)})));
}`;

    case 'save_position':
      return `$.state["__jpp_saved_position"] = $.getPosition() || new Vector3(0,0,0);`;

    case 'load_position':
      return `if ($.state["__jpp_saved_position"]) {
  $.setPosition($.state["__jpp_saved_position"]);
}`;

    case 'add_force':
      return `$.addImpulsiveForce(new Vector3(${exprToJS(stmt.dirX)}, ${exprToJS(stmt.dirY)}, ${exprToJS(stmt.dirZ)}).normalize().multiplyScalar(${exprToJS(stmt.power)}));`;

    case 'continuous_rotation':
      return `$.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(${axisVector(stmt.axis)}, (${exprToJS(stmt.speed)}) * deltaTime)));`;

    case 'timed_random_warp':
      return timedRandomWarpToJS(stmt);

    case 'timed_move_return':
      return timedMoveReturnToJS(stmt);

    case 'set_move_speed':
      return `player.setMoveSpeedRate(${exprToJS(stmt.rate)});`;

    case 'set_jump_speed':
      return `player.setJumpSpeedRate(${exprToJS(stmt.rate)});`;

    case 'set_flag':
      return setFlagToJS(stmt);

    case 'set_number_var':
      return `$.state[${stateKey('var.', stmt.name)}] = ${exprToJS(stmt.value)};`;

    case 'change_number_var':
      return `$.state[${stateKey('var.', stmt.name)}] = ($.state[${stateKey('var.', stmt.name)}] || 0) + (${exprToJS(stmt.delta)});`;

    case 'send_message_near_once':
      return sendMessageNearOnceToJS(stmt);

    case 'send_message_to_item_once':
      return sendMessageToItemOnceToJS(stmt);

    case 'reply_message_once':
      return replyMessageOnceToJS(stmt);

    case 'oscillate':
      return oscillateToJS(stmt);

    case 'if':
      return ifToJS(stmt);

    case 'sequence':
      return sequenceStarterToJS(stmt);

    case 'wait_seconds':
    case 'wait_until':
    case 'run_for_seconds':
      return `// error: wait stmt should be generated inside state machine`;

    default: {
      const exhaustive: never = stmt;
      return `// unknown stmt: ${(exhaustive as any).kind}`;
    }
  }
}

function sendMessageNearOnceToJS(stmt: Extract<Stmt, { kind: 'send_message_near_once' }>): string {
  const id = safeId(stmt.blockId);
  const sentKey = `__jpp_send_once_${id}`;
  return `{
  const __jpp_send_cond_${id} = ${boolExprToJS(stmt.condition)};
  if (__jpp_send_cond_${id} && !$.state["${sentKey}"]) {
    const __jpp_send_pos_${id} = $.getPosition() || new Vector3(0,0,0);
    const __jpp_send_items_${id} = $.getItemsNear(__jpp_send_pos_${id}, (${exprToJS(stmt.range)}));
    for (const __jpp_send_item_${id} of __jpp_send_items_${id}) {
      __jpp_send_item_${id}.send(${JSON.stringify(stmt.message)}, null);
    }
    $.state["${sentKey}"] = true;
  }
  if (!__jpp_send_cond_${id}) {
    $.state["${sentKey}"] = false;
  }
}`;
}

function sendMessageToItemOnceToJS(stmt: Extract<Stmt, { kind: 'send_message_to_item_once' }>): string {
  const id = safeId(stmt.blockId);
  const sentKey = `__jpp_send_item_once_${id}`;
  return `{
  const __jpp_send_cond_${id} = ${boolExprToJS(stmt.condition)};
  if (__jpp_send_cond_${id} && !$.state["${sentKey}"]) {
    const __jpp_send_item_${id} = $.worldItemReference(${jsString(stmt.itemName)});
    if (__jpp_send_item_${id} && __jpp_send_item_${id}.exists()) {
      __jpp_send_item_${id}.send(${jsString(stmt.message)}, null);
    }
    $.state["${sentKey}"] = true;
  }
  if (!__jpp_send_cond_${id}) {
    $.state["${sentKey}"] = false;
  }
}`;
}

function replyMessageOnceToJS(stmt: Extract<Stmt, { kind: 'reply_message_once' }>): string {
  const id = safeId(stmt.blockId);
  const sentKey = `__jpp_reply_once_${id}`;
  return `{
  const __jpp_reply_cond_${id} = ${boolExprToJS(stmt.condition)};
  if (__jpp_reply_cond_${id} && !$.state["${sentKey}"]) {
    if (sender && typeof sender.send === "function") {
      sender.send(${jsString(stmt.message)}, null);
    }
    $.state["${sentKey}"] = true;
  }
  if (!__jpp_reply_cond_${id}) {
    $.state["${sentKey}"] = false;
  }
}`;
}

function timedRandomWarpToJS(stmt: Extract<Stmt, { kind: 'timed_random_warp' }>): string {
  const id = safeId(stmt.blockId);
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

function timedMoveReturnToJS(stmt: Extract<Stmt, { kind: 'timed_move_return' }>): string {
  const id = safeId(stmt.blockId);
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

function setFlagToJS(stmt: Extract<Stmt, { kind: 'set_flag' }>): string {
  if (stmt.operation === 'true') {
    return `$.state[${stateKey('__jpp_flag_', stmt.name)}] = true;`;
  }

  if (stmt.operation === 'false') {
    return `$.state[${stateKey('__jpp_flag_', stmt.name)}] = false;`;
  }

  return `$.state[${stateKey('__jpp_flag_', stmt.name)}] = !$.state[${stateKey('__jpp_flag_', stmt.name)}];`;
}

function oscillateToJS(stmt: Extract<Stmt, { kind: 'oscillate' }>): string {
  const id = safeId(stmt.blockId);

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

function ifToJS(stmt: Extract<Stmt, { kind: 'if' }>): string {
  const condition = boolExprToJS(stmt.condition);
  const thenBody = stmt.thenBody.map((bodyStmt) => `  ${stmtToJS(bodyStmt).replace(/\n/g, '\n  ')}`).join('\n');
  let code = `if (${condition}) {\n${thenBody}\n}`;

  if (stmt.elseBody) {
    const elseBody = stmt.elseBody.map((bodyStmt) => `  ${stmtToJS(bodyStmt).replace(/\n/g, '\n  ')}`).join('\n');
    code += ` else {\n${elseBody}\n}`;
  }

  return code;
}

function sequenceStarterToJS(stmt: Extract<Stmt, { kind: 'sequence' }>): string {
  const id = safeId(stmt.id);
  return `if (!$.state["__jpp_seq_active_${id}"]) {
  $.state["__jpp_seq_active_${id}"] = true;
  $.state["__jpp_seq_step_${id}"] = 0;
  $.state["__jpp_seq_time_${id}"] = 0;
}`;
}
