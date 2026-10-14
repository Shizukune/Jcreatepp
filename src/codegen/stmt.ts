import type { Expr, MessageTarget, Stmt } from '../ir';
import { atLeastJS, boolExprToJS, decimalNormalized, exprToJS, settledNumberToJS } from './expr';
import { axisVector, jsString, safeId, smoothRotateKeys, smoothTransitionKeys, variableKeyJS } from './shared';
import { traceLine } from './trace';
import { describeStmt } from './describe';
import { bare } from './format';

/** A statement: a Japanese comment naming the block, then its code. */
export function stmtToJS(stmt: Stmt): string {
  const comment = describeStmt(stmt);
  return traceLine(stmt, 'run') + (comment ? `// ${comment}\n` : '') + stmtToJSCore(stmt);
}

/** Statements in a block body, indented by `spaces`. */
export function bodyToJS(stmts: Stmt[], spaces: number): string {
  const pad = ' '.repeat(spaces);
  return stmts.map((s) => stmtToJS(s).replace(/^(?=.)/gm, pad)).join('\n');
}

const vec = (x: Expr, y: Expr, z: Expr) => `new Vector3(${bare(exprToJS(x))}, ${bare(exprToJS(y))}, ${bare(exprToJS(z))})`;
const euler = (x: Expr, y: Expr, z: Expr) => `new Quaternion().setFromEulerAngles(${vec(x, y, z)})`;

function stmtToJSCore(stmt: Stmt): string {
  switch (stmt.kind) {
    case 'set_position':
      return `$.setPosition(${vec(stmt.x, stmt.y, stmt.z)});`;

    case 'move_by':
      return `$.setPosition(($.getPosition() || new Vector3(0, 0, 0)).add(${vec(stmt.x, stmt.y, stmt.z)}));`;

    case 'smooth_move_by':
    case 'smooth_move_local':
      return smoothMoveStarterToJS(stmt);

    case 'move_local':
      return `{
  const rot = $.getRotation() || new Quaternion();
  const pos = $.getPosition() || new Vector3(0, 0, 0);
  $.setPosition(pos.add(${vec(stmt.x, stmt.y, stmt.z)}.applyQuaternion(rot)));
}`;

    case 'set_rotation':
      return `$.setRotation(${euler(stmt.x, stmt.y, stmt.z)});`;

    case 'rotate_by':
      return `{
  const rot = $.getRotation();
  $.setRotation((rot ? rot.clone() : new Quaternion()).multiply(${euler(stmt.x, stmt.y, stmt.z)}));
}`;

    case 'smooth_rotate_by':
      return smoothRotateStarterToJS(stmt);

    case 'random_warp':
      return `{
  const pos = $.getPosition() || new Vector3(0, 0, 0);
  $.setPosition(new Vector3(pos.x + (Math.random() * 2 - 1) * ${exprToJS(stmt.rangeX)}, pos.y, pos.z + (Math.random() * 2 - 1) * ${exprToJS(stmt.rangeZ)}));
}`;

    case 'save_position':
      return `$.state["__jpp_saved_position"] = $.getPosition() || new Vector3(0, 0, 0);`;

    case 'load_position':
      return `if ($.state["__jpp_saved_position"]) {
  $.setPosition($.state["__jpp_saved_position"]);
}`;

    case 'add_force':
      return `$.addImpulsiveForce(${vec(stmt.dirX, stmt.dirY, stmt.dirZ)}.normalize().multiplyScalar(${bare(exprToJS(stmt.power))}));`;

    case 'continuous_rotation':
      return `$.setRotation(($.getRotation() || new Quaternion()).multiply(new Quaternion().setFromAxisAngle(${axisVector(stmt.axis)}, ${exprToJS(stmt.speed)} * deltaTime)));`;

    case 'timed_random_warp':
      return timedRandomWarpToJS(stmt);

    case 'timed_move_return':
      return timedMoveReturnToJS(stmt);

    case 'set_move_speed':
      return `player.setMoveSpeedRate(${bare(exprToJS(stmt.rate))});`;

    case 'set_jump_speed':
      return `player.setJumpSpeedRate(${bare(exprToJS(stmt.rate))});`;

    case 'play_audio':
      return playAudioToJS(stmt);

    case 'set_subnode_text':
      return setSubnodeTextToJS(stmt);

    case 'set_component_enabled':
      return setComponentEnabledToJS(stmt);

    case 'set_flag':
      return setFlagToJS(stmt);

    case 'set_number_var':
      return `$.state[${variableKeyJS('number', stmt.name)}] = ${bare(settledNumberToJS(stmt.value))};`;

    case 'change_number_var': {
      const key = variableKeyJS('number', stmt.name);
      return `$.state[${key}] = ${decimalNormalized(`($.state[${key}] || 0) + ${exprToJS(stmt.delta)}`)};`;
    }

    case 'set_string_var':
      return `$.state[${variableKeyJS('string', stmt.name)}] = ${bare(exprToJS(stmt.value))};`;

    case 'set_bool_var':
      return `$.state[${variableKeyJS('bool', stmt.name)}] = ${bare(boolExprToJS(stmt.value))};`;

    case 'start_cooldown':
      return `$.state[${variableKeyJS('cooldown', stmt.name)}] = ${bare(atLeastSettled(0, stmt.seconds))};`;

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

/** Math.max(min, value) where value is stored (arithmetic normalized); folded for literals. */
function atLeastSettled(min: number, expr: Expr): string {
  return expr.kind === 'binary' ? `Math.max(${min}, ${bare(settledNumberToJS(expr))})` : atLeastJS(min, expr);
}

function smoothMoveStarterToJS(stmt: Extract<Stmt, { kind: 'smooth_move_by' | 'smooth_move_local' }>): string {
  const id = safeId(stmt.blockId);
  const keys = smoothTransitionKeys('move', id);
  // Local moves are converted to world space once, with the facing at the start of the move.
  const facing = stmt.kind === 'smooth_move_local' ? '.applyQuaternion($.getRotation() || new Quaternion())' : '';
  return `{
  // 動き始め: 始点と終点を覚えて、毎フレームの処理で少しずつ動かす
  const from = $.getPosition() || new Vector3(0, 0, 0);
  const to = from.clone().add(${vec(stmt.x, stmt.y, stmt.z)}${facing});
  $.state[${keys.active}] = true;
  $.state[${keys.elapsed}] = 0;
  $.state[${keys.duration}] = ${bare(atLeastJS(0.001, stmt.duration))};
  $.state[${keys.fromX}] = from.x;
  $.state[${keys.fromY}] = from.y;
  $.state[${keys.fromZ}] = from.z;
  $.state[${keys.toX}] = to.x;
  $.state[${keys.toY}] = to.y;
  $.state[${keys.toZ}] = to.z;
}`;
}

function smoothRotateStarterToJS(stmt: Extract<Stmt, { kind: 'smooth_rotate_by' }>): string {
  const id = safeId(stmt.blockId);
  const keys = smoothRotateKeys(id);
  return `{
  // 回り始め: 今の向きと回す量を覚えて、毎フレームの処理で少しずつ回す
  const from = $.getRotation() || new Quaternion();
  $.state[${keys.active}] = true;
  $.state[${keys.elapsed}] = 0;
  $.state[${keys.duration}] = ${bare(atLeastJS(0.001, stmt.duration))};
  $.state[${keys.fromQx}] = from.x;
  $.state[${keys.fromQy}] = from.y;
  $.state[${keys.fromQz}] = from.z;
  $.state[${keys.fromQw}] = from.w;
  $.state[${keys.deltaX}] = ${bare(exprToJS(stmt.x))};
  $.state[${keys.deltaY}] = ${bare(exprToJS(stmt.y))};
  $.state[${keys.deltaZ}] = ${bare(exprToJS(stmt.z))};
}`;
}

function sendMessageToJS(stmt: Extract<Stmt, { kind: 'send_message' }>): string {
  const id = safeId(stmt.blockId);
  const condition = stmt.condition ? bare(boolExprToJS(stmt.condition)) : 'true';
  const sentKey = jsString(`__jpp_send_once_${id}`);
  const send = messageTargetToJS(stmt.target, stmt.message, messageSendValueToJS(stmt.value));

  if (stmt.edgeOnce) {
    return `{
  // 条件が false から true になったときだけ送る
  const canSend = ${condition};
  if (canSend && !$.state[${sentKey}]) {
${indent(send, 4)}
    $.state[${sentKey}] = true;
  }
  if (!canSend) {
    $.state[${sentKey}] = false;
  }
}`;
  }

  if (condition === 'true') {
    return `{\n${indent(send, 2)}\n}`;
  }
  return `if (${condition}) {\n${indent(send, 2)}\n}`;
}

function messageTargetToJS(target: MessageTarget, message: string, value: string): string {
  switch (target.kind) {
    case 'near':
      return `const items = $.getItemsNear($.getPosition() || new Vector3(0, 0, 0), ${bare(exprToJS(target.range))});
for (const item of items) {
  item.send(${jsString(message)}, ${value});
}`;
    case 'world_item':
      return `const target = $.worldItemReference(${jsString(target.itemName)});
if (target && target.exists()) {
  target.send(${jsString(message)}, ${value});
}`;
    case 'sender':
      return `if (sender && typeof sender.send === "function" && (typeof sender.exists !== "function" || sender.exists())) {
  sender.send(${jsString(message)}, ${value});
}`;
    case 'handle':
      return `const target = ${bare(exprToJS(target.handle))};
if (target && typeof target.send === "function" && (typeof target.exists !== "function" || target.exists())) {
  target.send(${jsString(message)}, ${value});
}`;
  }
}

function indent(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return code.split('\n').map((line) => `${pad}${line}`).join('\n');
}

function messageSendValueToJS(value: Extract<Stmt, { kind: 'send_message' }>['value']): string {
  if (!value) {
    return 'null';
  }

  if (value.valueType === 'boolean') {
    return bare(boolExprToJS(value.value));
  }

  // "string" mode may receive number blocks; send them as text. Text expressions stay as-is.
  if (value.valueType === 'string' && !isTextExpr(value.value)) {
    return `String(${bare(settledNumberToJS(value.value))})`;
  }

  return bare(settledNumberToJS(value.value));
}

function isTextExpr(expr: Expr): boolean {
  return expr.kind === 'string_literal' || expr.kind === 'string_var' || (expr.kind === 'message_value' && expr.valueType === 'string');
}

/** Volume clamped to 0..2.5 (Cluster's range); folded when the volume is a literal. */
function volumeJS(expr: Expr): string {
  if (expr.kind === 'number_literal') return String(Math.max(0, Math.min(2.5, expr.value)));
  return `Math.max(0, Math.min(2.5, ${bare(exprToJS(expr))}))`;
}

function playAudioToJS(stmt: Extract<Stmt, { kind: 'play_audio' }>): string {
  return `{
  const audio = $.audio(${jsString(stmt.audioSetId)});
  if (audio) {
    audio.volume = ${volumeJS(stmt.volume)};
    audio.play();
  }
}`;
}

function setSubnodeTextToJS(stmt: Extract<Stmt, { kind: 'set_subnode_text' }>): string {
  const text = `String(${bare(settledNumberToJS(stmt.value))})`;
  if (stmt.componentType === 'TextView') {
    return `{
  const node = $.subNode(${jsString(stmt.subNodeName)});
  if (node && typeof node.setText === "function") {
    node.setText(${text});
  }
}`;
  }

  return `{
  const node = $.subNode(${jsString(stmt.subNodeName)});
  const textComponent = node && node.getUnityComponent(${jsString(stmt.componentType)});
  if (textComponent) {
    textComponent.unityProp.text = ${text};
  }
}`;
}

function setComponentEnabledToJS(stmt: Extract<Stmt, { kind: 'set_component_enabled' }>): string {
  return `{
  const node = $.subNode(${jsString(stmt.subNodeName)});
  const component = node && node.getUnityComponent(${jsString(stmt.componentType)});
  if (component) {
    component.unityProp.enabled = ${bare(boolExprToJS(stmt.enabled))};
  }
}`;
}

function timedRandomWarpToJS(stmt: Extract<Stmt, { kind: 'timed_random_warp' }>): string {
  const timerKey = jsString(`__jpp_timed_warp_time_${safeId(stmt.blockId)}`);
  return `{
  $.state[${timerKey}] = ($.state[${timerKey}] || 0) + deltaTime;
  if ($.state[${timerKey}] >= ${exprToJS(stmt.interval)}) {
    const pos = $.getPosition() || new Vector3(0, 0, 0);
    const range = ${bare(exprToJS(stmt.range))};
    $.setPosition(new Vector3(
      pos.x + (Math.random() * 2 - 1) * range,
      pos.y,
      pos.z + (Math.random() * 2 - 1) * range
    ));
    $.state[${timerKey}] = 0;
  }
}`;
}

function timedMoveReturnToJS(stmt: Extract<Stmt, { kind: 'timed_move_return' }>): string {
  const id = safeId(stmt.blockId);
  const activeKey = jsString(`__jpp_move_return_active_${id}`);
  const timeKey = jsString(`__jpp_move_return_time_${id}`);
  const startKey = jsString(`__jpp_move_return_pos_${id}`);
  return `{
  if (!$.state[${activeKey}]) {
    // 動き始めの位置を覚える
    $.state[${activeKey}] = true;
    $.state[${timeKey}] = 0;
    $.state[${startKey}] = $.getPosition() || new Vector3(0, 0, 0);
  }
  $.state[${timeKey}] = ($.state[${timeKey}] || 0) + deltaTime;
  if ($.state[${timeKey}] < ${exprToJS(stmt.duration)}) {
    const dir = ${vec(stmt.dirX, stmt.dirY, stmt.dirZ)};
    if (dir.length() > 0) {
      const pos = $.getPosition() || new Vector3(0, 0, 0);
      $.setPosition(pos.add(dir.normalize().multiplyScalar(${exprToJS(stmt.speed)} * deltaTime)));
    }
  } else {
    // 時間が来たら元の位置に戻る
    if ($.state[${startKey}]) {
      $.setPosition($.state[${startKey}]);
    }
    $.state[${activeKey}] = false;
    $.state[${timeKey}] = 0;
  }
}`;
}

function setFlagToJS(stmt: Extract<Stmt, { kind: 'set_flag' }>): string {
  const key = variableKeyJS('bool', stmt.name);
  if (stmt.operation === 'true') {
    return `$.state[${key}] = true;`;
  }

  if (stmt.operation === 'false') {
    return `$.state[${key}] = false;`;
  }

  return `$.state[${key}] = !$.state[${key}];`;
}

function oscillateToJS(stmt: Extract<Stmt, { kind: 'oscillate' }>): string {
  const id = safeId(stmt.blockId);
  const originKey = jsString(`__jpp_osc_init_pos_${id}`);
  const timeKey = jsString(`__jpp_osc_time_${id}`);
  const along = (axis: 'X' | 'Y' | 'Z') => (stmt.axis === axis ? 'offset' : '0');

  return `{
  if (!$.state[${originKey}]) {
    // 最初の位置を往復の中心として覚える
    $.state[${originKey}] = $.getPosition() || new Vector3(0, 0, 0);
    $.state[${timeKey}] = 0;
  }
  $.state[${timeKey}] += deltaTime * ${exprToJS(stmt.speed)};
  const origin = $.state[${originKey}];
  const offset = Math.sin($.state[${timeKey}]) * ${exprToJS(stmt.width)};
  $.setPosition(new Vector3(
    origin.x + ${along('X')},
    origin.y + ${along('Y')},
    origin.z + ${along('Z')}
  ));
}`;
}

function ifToJS(stmt: Extract<Stmt, { kind: 'if' }>): string {
  let code = `if (${bare(boolExprToJS(stmt.condition))}) {\n${bodyToJS(stmt.thenBody, 2)}\n}`;
  if (stmt.elseBody) {
    code += ` else {\n${bodyToJS(stmt.elseBody, 2)}\n}`;
  }
  return code;
}

function ifEdgeToJS(stmt: Extract<Stmt, { kind: 'if_edge' }>): string {
  const firedKey = jsString(`__jpp_edge_${safeId(stmt.blockId)}`);
  return `{
  const condition = ${bare(boolExprToJS(stmt.condition))};
  if (condition && !$.state[${firedKey}]) {
${bodyToJS(stmt.body, 4)}
    $.state[${firedKey}] = true;
  }
  if (!condition) {
    $.state[${firedKey}] = false;
  }
}`;
}

function sequenceStarterToJS(stmt: Extract<Stmt, { kind: 'sequence' }>): string {
  const id = safeId(stmt.id);
  // Each run of the sequence starts fresh: "only once" latches inside it are cleared,
  // otherwise a condition that stayed true would never fire again on the next run.
  const latchResets = sequenceLatchKeys(stmt.body).map((key) => `\n  $.state[${jsString(key)}] = false;`).join('');
  return `if (!$.state["__jpp_seq_active_${id}"]) {
  $.state["__jpp_seq_active_${id}"] = true;
  $.state["__jpp_seq_step_${id}"] = 0;
  $.state["__jpp_seq_time_${id}"] = 0;${latchResets}
}`;
}

function sequenceLatchKeys(stmts: Stmt[]): string[] {
  const keys: string[] = [];
  for (const s of stmts) {
    if (s.kind === 'if_edge') {
      keys.push(`__jpp_edge_${safeId(s.blockId)}`);
      keys.push(...sequenceLatchKeys(s.body));
    } else if (s.kind === 'send_message' && s.edgeOnce) {
      keys.push(`__jpp_send_once_${safeId(s.blockId)}`);
    } else if (s.kind === 'if') {
      keys.push(...sequenceLatchKeys(s.thenBody), ...sequenceLatchKeys(s.elseBody ?? []));
    } else if (s.kind === 'run_for_seconds') {
      keys.push(...sequenceLatchKeys(s.body));
    }
  }
  return keys;
}
