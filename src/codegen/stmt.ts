import type { MessageTarget, Stmt } from '../ir';
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
      return `{
  const __jpp_rot = $.getRotation();
  $.setRotation((__jpp_rot ? __jpp_rot.clone() : new Quaternion()).multiply(new Quaternion().setFromEulerAngles(new Vector3(${exprToJS(stmt.x)}, ${exprToJS(stmt.y)}, ${exprToJS(stmt.z)}))));
}`;

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

    case 'play_audio':
      return playAudioToJS(stmt);

    case 'set_subnode_text':
      return setSubnodeTextToJS(stmt);

    case 'set_component_enabled':
      return setComponentEnabledToJS(stmt);

    case 'set_flag':
      return setFlagToJS(stmt);

    case 'set_number_var':
      return `$.state[${stateKey('var.', stmt.name)}] = ${exprToJS(stmt.value)};`;

    case 'change_number_var':
      return `$.state[${stateKey('var.', stmt.name)}] = ($.state[${stateKey('var.', stmt.name)}] || 0) + (${exprToJS(stmt.delta)});`;

    case 'set_string_var':
      return `$.state[${stateKey('str.', stmt.name)}] = ${exprToJS(stmt.value)};`;

    case 'set_bool_var':
      return `$.state[${stateKey('bool.', stmt.name)}] = ${boolExprToJS(stmt.value)};`;

    case 'start_cooldown':
      return `$.state[${stateKey('__jpp_cd_', stmt.name)}] = Math.max(0, (${exprToJS(stmt.seconds)}));`;

    case 'send_message':
      return sendMessageToJS(stmt);

    case 'oscillate':
      return oscillateToJS(stmt);

    case 'if':
      return ifToJS(stmt);

    case 'if_edge':
      return ifEdgeToJS(stmt);

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

function sendMessageToJS(stmt: Extract<Stmt, { kind: 'send_message' }>): string {
  const id = safeId(stmt.blockId);
  const condition = stmt.condition ? boolExprToJS(stmt.condition) : 'true';
  const sentKey = `__jpp_send_once_${id}`;
  const body = indentMessageBody(messageTargetToJS(stmt.target, id, stmt.message, messageSendValueToJS(stmt.value)), 4);

  if (stmt.edgeOnce) {
    return `{
  const __jpp_send_cond_${id} = ${condition};
  if (__jpp_send_cond_${id} && !$.state["${sentKey}"]) {
${body}
    $.state["${sentKey}"] = true;
  }
  if (!__jpp_send_cond_${id}) {
    $.state["${sentKey}"] = false;
  }
}`;
  }

  return `{
  if (${condition}) {
${body}
  }
}`;
}

function messageTargetToJS(target: MessageTarget, id: string, message: string, value: string): string {
  switch (target.kind) {
    case 'near':
      return `const __jpp_send_pos_${id} = $.getPosition() || new Vector3(0,0,0);
const __jpp_send_items_${id} = $.getItemsNear(__jpp_send_pos_${id}, (${exprToJS(target.range)}));
for (const __jpp_send_item_${id} of __jpp_send_items_${id}) {
  __jpp_send_item_${id}.send(${jsString(message)}, ${value});
}`;
    case 'world_item':
      return `const __jpp_send_item_${id} = $.worldItemReference(${jsString(target.itemName)});
if (__jpp_send_item_${id} && __jpp_send_item_${id}.exists()) {
  __jpp_send_item_${id}.send(${jsString(message)}, ${value});
}`;
    case 'sender':
      return `if (sender && typeof sender.send === "function" && (typeof sender.exists !== "function" || sender.exists())) {
  sender.send(${jsString(message)}, ${value});
}`;
    case 'handle':
      return `const __jpp_send_handle_${id} = ${exprToJS(target.handle)};
if (__jpp_send_handle_${id} && typeof __jpp_send_handle_${id}.send === "function" && (typeof __jpp_send_handle_${id}.exists !== "function" || __jpp_send_handle_${id}.exists())) {
  __jpp_send_handle_${id}.send(${jsString(message)}, ${value});
}`;
  }
}

function indentMessageBody(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return code.split('\n').map((line) => `${pad}${line}`).join('\n');
}

function messageSendValueToJS(value: Extract<Stmt, { kind: 'send_message' }>['value']): string {
  if (!value) {
    return 'null';
  }

  if (value.valueType === 'boolean') {
    return boolExprToJS(value.value);
  }

  return exprToJS(value.value);
}

function playAudioToJS(stmt: Extract<Stmt, { kind: 'play_audio' }>): string {
  return `{
  const __jpp_audio = $.audio(${jsString(stmt.audioSetId)});
  if (__jpp_audio) {
    __jpp_audio.volume = Math.max(0, Math.min(2.5, (${exprToJS(stmt.volume)})));
    __jpp_audio.play();
  }
}`;
}

function setSubnodeTextToJS(stmt: Extract<Stmt, { kind: 'set_subnode_text' }>): string {
  if (stmt.componentType === 'TextView') {
    return `{
  const __jpp_node = $.subNode(${jsString(stmt.subNodeName)});
  if (__jpp_node && typeof __jpp_node.setText === "function") {
    __jpp_node.setText(String(${exprToJS(stmt.value)}));
  }
}`;
  }

  return `{
  const __jpp_node = $.subNode(${jsString(stmt.subNodeName)});
  const __jpp_text = __jpp_node && __jpp_node.getUnityComponent(${jsString(stmt.componentType)});
  if (__jpp_text) {
    __jpp_text.unityProp.text = String(${exprToJS(stmt.value)});
  }
}`;
}

function setComponentEnabledToJS(stmt: Extract<Stmt, { kind: 'set_component_enabled' }>): string {
  return `{
  const __jpp_node = $.subNode(${jsString(stmt.subNodeName)});
  const __jpp_component = __jpp_node && __jpp_node.getUnityComponent(${jsString(stmt.componentType)});
  if (__jpp_component) {
    __jpp_component.unityProp.enabled = ${boolExprToJS(stmt.enabled)};
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

function ifEdgeToJS(stmt: Extract<Stmt, { kind: 'if_edge' }>): string {
  const id = safeId(stmt.blockId);
  const condition = boolExprToJS(stmt.condition);
  const sentKey = `__jpp_edge_${id}`;
  const body = stmt.body.map((bodyStmt) => `    ${stmtToJS(bodyStmt).replace(/\n/g, '\n    ')}`).join('\n');

  return `{
  const __jpp_edge_cond_${id} = ${condition};
  if (__jpp_edge_cond_${id} && !$.state["${sentKey}"]) {
${body}
    $.state["${sentKey}"] = true;
  }
  if (!__jpp_edge_cond_${id}) {
    $.state["${sentKey}"] = false;
  }
}`;
}

function sequenceStarterToJS(stmt: Extract<Stmt, { kind: 'sequence' }>): string {
  const id = safeId(stmt.id);
  return `if (!$.state["__jpp_seq_active_${id}"]) {
  $.state["__jpp_seq_active_${id}"] = true;
  $.state["__jpp_seq_step_${id}"] = 0;
  $.state["__jpp_seq_time_${id}"] = 0;
}`;
}
