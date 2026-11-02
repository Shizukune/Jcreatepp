import type { Handler, Program } from '../ir';
import { exprToJS } from './expr';
import type { Stmt } from '../ir';
import { generateSequenceStateMachine } from './sequence';
import { getAllSequences, indent, jsString } from './shared';
import { bodyToJS } from './stmt';
import { withTrace } from './trace';
import { withHelpers } from './helpers';
import { bare, commentText } from './format';
import { forgetPose, placeAt, positionNow, rotationNow, turnTo, withPose } from './pose';
import { smoothUpdatesToJS } from './smooth';

export type CodegenOptions = {
  /** Emit __jpp_trace() calls for the 3D preview. Never use for code sent to Cluster. */
  trace?: boolean;
};

export function programToJS(program: Program, options: CodegenOptions = {}): string {
  return withTrace(options.trace === true, () => withHelpers(() => withPose(program, () => programToJSCore(program))));
}

/**
 * First line of onUpdate when the frame time is used: every timer and movement then gets a usable
 * number (Cluster passes seconds; a missing, negative, NaN or infinite value would break timers).
 */
const CLEAN_DELTA_TIME = 'deltaTime = typeof deltaTime === "number" && isFinite(deltaTime) ? Math.max(0, deltaTime) : 0; // このフレームの経過時間（秒）。おかしな値は 0 として扱う';

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

  const smoothUpdates = smoothUpdatesToJS(program);
  if (smoothUpdates) {
    updateSections.push(indent(smoothUpdates, 2));
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
    const body = updateSections.join('\n\n');
    const clean = /\bdeltaTime\b/.test(body) ? `  ${CLEAN_DELTA_TIME}\n\n` : '';
    parts.push(`${heading('毎フレーム')}\n$.onUpdate((deltaTime) => {\n${clean}${body}\n});\n`);
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

function handlerToJS(title: string, event: string, params: string, handler: Handler): string {
  return `${heading(title)}\n$.${event}((${params}) => {\n${bodyToJS(handler.body, 2)}\n});\n`;
}

function cooldownTickToJS(names: string[]): string {
  const keys = names.map((name) => jsString(`__jpp_cd_${name}`)).join(', ');
  return `// クールダウンの残り秒数を減らす
{
  for (const key of [${keys}]) {
    const left = $.state[key];
    if (typeof left === "number" && left > 0) {
      $.state[key] = Math.max(0, left - deltaTime);
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
  const pos = ${bare(positionNow())};
  const rot = ${bare(rotationNow())};
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

  ${placeAt('pos.clone().add(forwardVec).add(upVec)')}
  ${turnTo('nextRot')}
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
  const pos = ${bare(positionNow())};
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
        ${turnTo('new Quaternion().setFromEulerAngles(new Vector3(0, angle, 0))')}
        if (length > ${minDistance}) {
          ${placeAt(`pos.add(dir.normalize().multiplyScalar(${moveSpeed} * deltaTime))`)}
        }
      }
    }
  }
}`;
}

function grabHandlerToJS(program: Program): string {
  const lines: string[] = [heading('持ったとき / 離したとき'), '$.onGrab((isGrab, isLeftHand, player) => {'];
  const forget = forgetPose();
  if (forget.length > 0) {
    // The hand moves the item while it is held, so the remembered pose is out of date.
    lines.push('  // 手で持つとアイテムが動くので、覚えている位置・向きを捨てて、次に動かすときは今の位置・向きから始める');
    lines.push(...forget.map((line) => `  ${line}`));
  }

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
