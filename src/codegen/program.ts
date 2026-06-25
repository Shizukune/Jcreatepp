import type { Handler, Program } from '../ir';
import { exprToJS } from './expr';
import type { Stmt } from '../ir';
import { generateSequenceStateMachine } from './sequence';
import { getAllSequences, indent, jsString } from './shared';
import { stmtToJS } from './stmt';

const EVENT_PARAMS: Record<string, string> = {
  onStart: '',
  onUpdate: 'deltaTime',
  onInteract: 'player',
  onCollide: 'collision',
};

export function programToJS(program: Program): string {
  const parts: string[] = [];
  const allSequences = getAllSequences(program);

  if (program.onStart) {
    parts.push(handlerToJS('onStart', program.onStart));
  }

  const updateBodyLines: string[] = [];
  if (program.onUpdate) {
    updateBodyLines.push(...program.onUpdate.body.map((stmt) => indent(stmtToJS(stmt), 2)));
  }

  for (const sequence of allSequences) {
    updateBodyLines.push(indent(generateSequenceStateMachine(sequence), 2));
  }

  const cooldownNames = getCooldownNames(program);
  if (cooldownNames.length > 0) {
    updateBodyLines.push(indent(cooldownTickToJS(cooldownNames), 2));
  }

  if (program.rideTemplate) {
    parts.push(rideInputHandlersToJS(program));
    updateBodyLines.push(indent(rideUpdateToJS(program), 2));
  }

  if (program.chaseTemplate) {
    updateBodyLines.push(indent(chaseUpdateToJS(program), 2));
  }

  if (updateBodyLines.length > 0) {
    parts.push(`$.onUpdate((deltaTime) => {\n${updateBodyLines.join('\n')}\n});\n`);
  }

  if (program.onInteract) {
    parts.push(handlerToJS('onInteract', program.onInteract));
  }

  if (program.onCollide) {
    parts.push(handlerToJS('onCollide', program.onCollide));
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

function handlerToJS(event: string, handler: Handler): string {
  const params = EVENT_PARAMS[event] ?? '';
  const body = handler.body.map((stmt) => indent(stmtToJS(stmt), 2)).join('\n');

  return `$.${event}((${params}) => {\n${body}\n});\n`;
}

function cooldownTickToJS(names: string[]): string {
  const lines = names.map((name) => {
    const key = jsString(`__jpp_cd_${name}`);
    return `$.state[${key}] = Math.max(0, ($.state[${key}] || 0) - deltaTime);`;
  });
  return `// Jcreate++ cooldown timers\n${lines.join('\n')}`;
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

  return `$.onRide((isGetOn, player) => {
  if (isGetOn) {
    $.state["__jpp_ride_active"] = true;
  } else {
    $.state["__jpp_ride_active"] = false;
    $.state["__jpp_ride_fwd"] = 0;
    $.state["__jpp_ride_upd"] = 0;
    $.state["__jpp_ride_trn"] = 0;
  }
});

$.onSteer((input, player) => {
  if ($.state["__jpp_ride_active"]) {
    $.state["__jpp_ride_fwd"] = input.y * (${forwardSpeed});
    $.state["__jpp_ride_trn"] = input.x * (${turnSpeed});
  }
});

$.onSteerAdditionalAxis((input, player) => {
  if ($.state["__jpp_ride_active"]) {
    $.state["__jpp_ride_upd"] = input * (${upDownSpeed});
  }
});
`;
}

function rideUpdateToJS(program: Program): string {
  if (!program.rideTemplate) {
    return '';
  }

  return `if ($.state["__jpp_ride_active"]) {
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
}`;
}

function chaseUpdateToJS(program: Program): string {
  if (!program.chaseTemplate) {
    return '';
  }

  const moveSpeed = exprToJS(program.chaseTemplate.moveSpeed);
  const maxDistance = exprToJS(program.chaseTemplate.maxDistance);
  const minDistance = exprToJS(program.chaseTemplate.minDistance);

  return `{
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
}`;
}

function grabHandlerToJS(program: Program): string {
  const lines: string[] = ['$.onGrab((isGrab, isLeftHand, player) => {'];

  if (program.onGrabStart) {
    lines.push('  if (isGrab) {');
    lines.push(...program.onGrabStart.body.map((stmt) => indent(stmtToJS(stmt), 4)));
    lines.push('  }');
  }

  if (program.onGrabEnd) {
    lines.push('  if (!isGrab) {');
    lines.push(...program.onGrabEnd.body.map((stmt) => indent(stmtToJS(stmt), 4)));
    lines.push('  }');
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
    lines.push(`  if (msg === ${jsString(message)}) {`);
    for (const handler of handlers) {
      for (const stmt of handler.body) {
        lines.push(indent(stmtToJS(stmt), 4));
      }
    }
    lines.push('  }');
  }

  return `$.onReceive((msg, arg, sender) => {\n${lines.join('\n')}\n}, { item: true, player: true });\n`;
}
