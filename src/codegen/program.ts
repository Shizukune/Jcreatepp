import type { Handler, Program } from '../ir';
import { exprToJS } from './expr';
import type { Stmt } from '../ir';
import { generateSequenceStateMachine } from './sequence';
import { getAllSequences, indent, jsString, safeId, smoothRotateKeys, smoothTransitionKeys } from './shared';
import { bodyToJS } from './stmt';
import { traceLine, withTrace } from './trace';
import { withHelpers } from './helpers';
import { describeStmt } from './describe';
import { bare, commentText } from './format';

export type CodegenOptions = {
  /** Emit __jpp_trace() calls for the 3D preview. Never use for code sent to Cluster. */
  trace?: boolean;
};

export function programToJS(program: Program, options: CodegenOptions = {}): string {
  return withTrace(options.trace === true, () => withHelpers(() => programToJSCore(program)));
}

/** `// ── 見出し ──` line above each event. */
const heading = (title: string) => `// ── ${title} ──`;

function programToJSCore(program: Program): string {
  const parts: string[] = [];
  const allSequences = getAllSequences(program);

  if (program.onStart) {
    parts.push(handlerToJS('開始時', 'onStart', '', program.onStart));
  }

  const updateSections: string[] = [];
  if (program.onUpdate && program.onUpdate.body.length > 0) {
    updateSections.push(bodyToJS(program.onUpdate.body, 2));
  }

  for (const sequence of allSequences) {
    updateSections.push(indent(generateSequenceStateMachine(sequence), 2));
  }

  const smoothMoves = getSmoothMoveBlocks(program);
  if (smoothMoves.length > 0) {
    updateSections.push(indent(smoothMoveUpdateToJS(smoothMoves), 2));
  }

  const smoothRotations = getSmoothRotateBlocks(program);
  if (smoothRotations.length > 0) {
    updateSections.push(indent(smoothRotateUpdateToJS(smoothRotations), 2));
  }

  const cooldownNames = getCooldownNames(program);
  if (cooldownNames.length > 0) {
    updateSections.push(indent(cooldownTickToJS(cooldownNames), 2));
  }

  if (program.rideTemplate) {
    parts.push(rideInputHandlersToJS(program));
    updateSections.push(indent(rideUpdateToJS(program), 2));
  }

  if (program.chaseTemplate) {
    updateSections.push(indent(chaseUpdateToJS(program), 2));
  }

  if (updateSections.length > 0) {
    parts.push(`${heading('毎フレーム')}\n$.onUpdate((deltaTime) => {\n${updateSections.join('\n\n')}\n});\n`);
  }

  if (program.onInteract) {
    parts.push(handlerToJS('インタラクト時', 'onInteract', 'player', program.onInteract));
  }

  if (program.onCollide) {
    parts.push(handlerToJS('衝突したとき', 'onCollide', 'collision', program.onCollide));
  }

  if (program.onGrabStart || program.onGrabEnd) {
    parts.push(grabHandlerToJS(program));
  }

  if (program.onReceives && program.onReceives.length > 0) {
    parts.push(receiveHandlersToJS(program));
  }

  if (parts.length === 0) {
    return '// ブロックが配置されていません';
  }

  return parts.join('\n');
}

type SmoothMoveStmt = Extract<Stmt, { kind: 'smooth_move_by' | 'smooth_move_local' }>;
type SmoothRotateStmt = Extract<Stmt, { kind: 'smooth_rotate_by' }>;

/** Reads a number from $.state, or the fallback when it was never set. */
const READ_NUMBER = 'const read = (key, fallback) => (typeof $.state[key] === "number" ? $.state[key] : fallback);';

function smoothMoveUpdateToJS(stmts: SmoothMoveStmt[]): string {
  const lines = stmts.map((stmt) => {
    const keys = smoothTransitionKeys('move', safeId(stmt.blockId));
    return `// 「${describeStmt(stmt)}」の途中の動き
if ($.state[${keys.active}]) {
  ${traceLine(stmt, 'tick')}${READ_NUMBER}
  const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
  const duration = Math.max(0.001, read(${keys.duration}, 0.001));
  const current = $.getPosition() || new Vector3(0, 0, 0);
  const fromX = read(${keys.fromX}, current.x);
  const fromY = read(${keys.fromY}, current.y);
  const fromZ = read(${keys.fromZ}, current.z);
  const toX = read(${keys.toX}, fromX);
  const toY = read(${keys.toY}, fromY);
  const toZ = read(${keys.toZ}, fromZ);
  const elapsed = Math.min(duration, read(${keys.elapsed}, 0) + delta);
  const t = elapsed / duration; // 0（始点）〜 1（終点）
  $.setPosition(new Vector3(
    fromX + (toX - fromX) * t,
    fromY + (toY - fromY) * t,
    fromZ + (toZ - fromZ) * t
  ));
  $.state[${keys.elapsed}] = elapsed;
  if (elapsed >= duration) {
    $.state[${keys.active}] = false;
    $.setPosition(new Vector3(toX, toY, toZ));
  }
}`;
  });
  return lines.join('\n');
}

function getSmoothMoveBlocks(program: Program): SmoothMoveStmt[] {
  const stmts: SmoothMoveStmt[] = [];

  const visitStmt = (stmt: Stmt) => {
    switch (stmt.kind) {
      case 'smooth_move_by':
      case 'smooth_move_local':
        stmts.push(stmt);
        break;
      case 'if':
        stmt.thenBody.forEach(visitStmt);
        stmt.elseBody?.forEach(visitStmt);
        break;
      case 'if_edge':
        stmt.body.forEach(visitStmt);
        break;
      case 'sequence':
        stmt.body.forEach(visitStmt);
        break;
      case 'run_for_seconds':
        stmt.body.forEach(visitStmt);
        break;
    }
  };

  const visitHandler = (handler?: Handler) => {
    handler?.body.forEach(visitStmt);
  };

  visitHandler(program.onStart);
  visitHandler(program.onUpdate);
  visitHandler(program.onInteract);
  visitHandler(program.onCollide);
  visitHandler(program.onGrabStart);
  visitHandler(program.onGrabEnd);
  program.onReceives?.forEach((receive) => visitHandler(receive.handler));

  return stmts;
}

function smoothRotateUpdateToJS(stmts: SmoothRotateStmt[]): string {
  const lines = stmts.map((stmt) => {
    const keys = smoothRotateKeys(safeId(stmt.blockId));
    return `// 「${describeStmt(stmt)}」の途中の動き
if ($.state[${keys.active}]) {
  ${traceLine(stmt, 'tick')}${READ_NUMBER}
  const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
  const duration = Math.max(0.001, read(${keys.duration}, 0.001));
  const from = new Quaternion(read(${keys.fromQx}, 0), read(${keys.fromQy}, 0), read(${keys.fromQz}, 0), read(${keys.fromQw}, 1));
  const elapsed = Math.min(duration, read(${keys.elapsed}, 0) + delta);
  const t = elapsed / duration; // 0（始め）〜 1（終わり）
  // 「角度を〜ずつ変える」と同じ回し方で、回す量を t の割合だけ進める
  const step = new Vector3(read(${keys.deltaX}, 0) * t, read(${keys.deltaY}, 0) * t, read(${keys.deltaZ}, 0) * t);
  $.setRotation(from.multiply(new Quaternion().setFromEulerAngles(step)));
  $.state[${keys.elapsed}] = elapsed;
  if (elapsed >= duration) {
    $.state[${keys.active}] = false;
  }
}`;
  });
  return lines.join('\n');
}

function getSmoothRotateBlocks(program: Program): SmoothRotateStmt[] {
  const stmts: SmoothRotateStmt[] = [];

  const visitStmt = (stmt: Stmt) => {
    switch (stmt.kind) {
      case 'smooth_rotate_by':
        stmts.push(stmt);
        break;
      case 'if':
        stmt.thenBody.forEach(visitStmt);
        stmt.elseBody?.forEach(visitStmt);
        break;
      case 'if_edge':
        stmt.body.forEach(visitStmt);
        break;
      case 'sequence':
        stmt.body.forEach(visitStmt);
        break;
      case 'run_for_seconds':
        stmt.body.forEach(visitStmt);
        break;
    }
  };

  const visitHandler = (handler?: Handler) => {
    handler?.body.forEach(visitStmt);
  };

  visitHandler(program.onStart);
  visitHandler(program.onUpdate);
  visitHandler(program.onInteract);
  visitHandler(program.onCollide);
  visitHandler(program.onGrabStart);
  visitHandler(program.onGrabEnd);
  program.onReceives?.forEach((receive) => visitHandler(receive.handler));

  return stmts;
}

function handlerToJS(title: string, event: string, params: string, handler: Handler): string {
  return `${heading(title)}\n$.${event}((${params}) => {\n${bodyToJS(handler.body, 2)}\n});\n`;
}

function cooldownTickToJS(names: string[]): string {
  const keys = names.map((name) => jsString(`__jpp_cd_${name}`)).join(', ');
  return `// クールダウンの残り秒数を減らす
{
  const delta = typeof deltaTime === "number" ? Math.max(0, deltaTime) : 0; // このフレームの経過時間
  for (const key of [${keys}]) {
    const left = $.state[key];
    if (typeof left === "number" && left > 0) {
      $.state[key] = Math.max(0, left - delta);
    }
  }
}`;
}

function getCooldownNames(program: Program): string[] {
  const names = new Set<string>();

  const visitStmt = (stmt: Stmt) => {
    switch (stmt.kind) {
      case 'start_cooldown':
        if (stmt.name) names.add(stmt.name);
        break;
      case 'if':
        stmt.thenBody.forEach(visitStmt);
        stmt.elseBody?.forEach(visitStmt);
        break;
      case 'if_edge':
        stmt.body.forEach(visitStmt);
        break;
      case 'sequence':
        stmt.body.forEach(visitStmt);
        break;
      case 'run_for_seconds':
        stmt.body.forEach(visitStmt);
        break;
    }
  };

  const visitHandler = (handler?: Handler) => {
    handler?.body.forEach(visitStmt);
  };

  visitHandler(program.onStart);
  visitHandler(program.onUpdate);
  visitHandler(program.onInteract);
  visitHandler(program.onCollide);
  visitHandler(program.onGrabStart);
  visitHandler(program.onGrabEnd);
  program.onReceives?.forEach((receive) => visitHandler(receive.handler));

  return Array.from(names).sort();
}

function rideInputHandlersToJS(program: Program): string {
  if (!program.rideTemplate) {
    return '';
  }

  const forwardSpeed = exprToJS(program.rideTemplate.forwardSpeed);
  const upDownSpeed = exprToJS(program.rideTemplate.upDownSpeed);
  const turnSpeed = exprToJS(program.rideTemplate.turnSpeed);

  return `${heading('乗り物ギミック: 乗る・降りる・操作')}
$.onRide((isGetOn, player) => {
  if (isGetOn) {
    $.state["__jpp_ride_active"] = true;
  } else {
    // 降りたら止める
    $.state["__jpp_ride_active"] = false;
    $.state["__jpp_ride_fwd"] = 0;
    $.state["__jpp_ride_upd"] = 0;
    $.state["__jpp_ride_trn"] = 0;
  }
});

// 前後・左右の入力（input.y: 前後、input.x: 左右）
$.onSteer((input, player) => {
  if ($.state["__jpp_ride_active"]) {
    $.state["__jpp_ride_fwd"] = input.y * ${forwardSpeed};
    $.state["__jpp_ride_trn"] = input.x * ${turnSpeed};
  }
});

// 上下の入力
$.onSteerAdditionalAxis((input, player) => {
  if ($.state["__jpp_ride_active"]) {
    $.state["__jpp_ride_upd"] = input * ${upDownSpeed};
  }
});
`;
}

function rideUpdateToJS(program: Program): string {
  if (!program.rideTemplate) {
    return '';
  }

  // Yaw angle of "forward": +Z itself, or the original template's -X (yaw + 270).
  const forwardAngle = program.rideTemplate.forward === 'z' ? 'direction.y' : '((direction.y + 270) % 360)';
  const forwardNote = program.rideTemplate.forward === 'z' ? 'アイテムの前（+Z）' : '従来の向き（アイテムの左 -X）';

  return `// 乗り物ギミック: 乗っている間、入力に合わせて動かす（進む向き: ${forwardNote}）
if ($.state["__jpp_ride_active"]) {
  const pos = $.getPosition() || new Vector3(0, 0, 0);
  const rot = $.getRotation() || new Quaternion();
  const turnAmount = ($.state["__jpp_ride_trn"] || 0) * deltaTime;
  const nextRot = rot.clone().multiply(new Quaternion().setFromEulerAngles(new Vector3(0, turnAmount, 0)));

  const direction = nextRot.clone().createEulerAngles();
  const forwardRadian = ${forwardAngle} * Math.PI / 180;
  const forwardAmount = $.state["__jpp_ride_fwd"] || 0;
  const forwardVec = new Vector3(
    Math.sin(forwardRadian) * forwardAmount * deltaTime,
    0,
    Math.cos(forwardRadian) * forwardAmount * deltaTime
  );
  const upVec = new Vector3(0, 1, 0).multiplyScalar(($.state["__jpp_ride_upd"] || 0) * deltaTime);

  $.setPosition(pos.clone().add(forwardVec).add(upVec));
  $.setRotation(nextRot);
}`;
}

function chaseUpdateToJS(program: Program): string {
  if (!program.chaseTemplate) {
    return '';
  }

  const moveSpeed = exprToJS(program.chaseTemplate.moveSpeed);
  const maxDistance = bare(exprToJS(program.chaseTemplate.maxDistance));
  const minDistance = exprToJS(program.chaseTemplate.minDistance);

  return `// 追いかけるギミック: いちばん近いプレイヤーの方を向いて近づく
{
  const pos = $.getPosition() || new Vector3(0, 0, 0);
  let target = null;
  let nearest = Infinity;
  for (const player of $.getPlayersNear(pos, ${maxDistance})) {
    const playerPos = player.getPosition();
    if (!playerPos) continue;
    const distance = playerPos.clone().sub(pos).length();
    if (distance < nearest) {
      nearest = distance;
      target = player;
    }
  }
  if (target && target.exists()) {
    const targetPos = target.getPosition();
    if (targetPos) {
      const dir = targetPos.clone().sub(pos);
      const length = dir.length();
      if (length > 0) {
        // 前（+Z）がプレイヤーを向くように回す
        const angle = Math.atan2(dir.x, dir.z) * 180 / Math.PI;
        $.setRotation(new Quaternion().setFromEulerAngles(new Vector3(0, angle, 0)));
        if (length > ${minDistance}) {
          $.setPosition(pos.add(dir.normalize().multiplyScalar(${moveSpeed} * deltaTime)));
        }
      }
    }
  }
}`;
}

function grabHandlerToJS(program: Program): string {
  const lines: string[] = [heading('持ったとき / 離したとき'), '$.onGrab((isGrab, isLeftHand, player) => {'];

  if (program.onGrabStart) {
    lines.push('  // 持ったとき', '  if (isGrab) {', bodyToJS(program.onGrabStart.body, 4), '  }');
  }

  if (program.onGrabEnd) {
    lines.push('  // 離したとき', '  if (!isGrab) {', bodyToJS(program.onGrabEnd.body, 4), '  }');
  }

  lines.push('});', '');
  return lines.join('\n');
}

function receiveHandlersToJS(program: Program): string {
  if (!program.onReceives) {
    return '';
  }

  const groups = new Map<string, Handler[]>();
  for (const receive of program.onReceives) {
    if (!groups.has(receive.message)) {
      groups.set(receive.message, []);
    }
    groups.get(receive.message)!.push(receive.handler);
  }

  const lines: string[] = [];
  for (const [message, handlers] of groups) {
    lines.push(`  // メッセージ「${commentText(message)}」を受け取ったとき`);
    lines.push(`  if (msg === ${jsString(message)}) {`);
    for (const handler of handlers) {
      lines.push(bodyToJS(handler.body, 4));
    }
    lines.push('  }');
  }

  return `${heading('メッセージを受け取ったとき')}\n$.onReceive((msg, arg, sender) => {\n${lines.join('\n')}\n}, { item: true, player: true });\n`;
}
