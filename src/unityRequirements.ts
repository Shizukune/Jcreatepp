import type { Program, Stmt } from './ir';

export type UnityRequirement =
  | { kind: 'movable_item'; reason: string; blockId: string }
  | { kind: 'world_item_reference'; id: string; reason: string; blockId: string }
  | { kind: 'overlap_detector'; reason: string; blockId: string }
  | { kind: 'collision_shape'; reason: string; blockId: string }
  | { kind: 'audio_set'; id: string; reason: string; blockId: string }
  | { kind: 'material_set'; id: string; reason: string; blockId: string };

export function collectUnityRequirements(program: Program): UnityRequirement[] {
  const requirements: UnityRequirement[] = [];

  const add = (requirement: UnityRequirement) => {
    const key = JSON.stringify(requirement);
    if (!requirements.some((existing) => JSON.stringify(existing) === key)) {
      requirements.push(requirement);
    }
  };

  const visitStmt = (stmt: Stmt) => {
    switch (stmt.kind) {
      case 'set_position':
      case 'move_by':
      case 'timed_move_return':
      case 'oscillate':
        add({
          kind: 'movable_item',
          reason: '位置をスクリプトから変更するため、このアイテムは移動可能な設定が必要です。',
          blockId: 'blockId' in stmt ? stmt.blockId : '',
        });
        break;

      case 'send_message_near_once':
        add({
          kind: 'overlap_detector',
          reason: '近くのアイテムへ送信するには、対象アイテムが取得可能なCollider / Shape / Layer設定になっている必要があります。',
          blockId: stmt.blockId,
        });
        break;

      case 'send_message_to_item_once':
        add({
          kind: 'world_item_reference',
          id: stmt.itemName,
          reason: '指定アイテムへ送信するには、World Item Reference List に同じ参照名を登録してください。',
          blockId: stmt.blockId,
        });
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

  const visitHandler = (body?: Stmt[]) => body?.forEach(visitStmt);

  visitHandler(program.onStart?.body);
  visitHandler(program.onUpdate?.body);
  visitHandler(program.onInteract?.body);
  visitHandler(program.onGrabStart?.body);
  visitHandler(program.onGrabEnd?.body);
  visitHandler(program.onCollide?.body);
  program.onReceives?.forEach((receive) => visitHandler(receive.handler.body));

  if (program.onCollide) {
    add({
      kind: 'collision_shape',
      reason: '衝突イベントを動かすには、衝突判定用のCollider / Physical Shapeなどの設定が必要です。',
      blockId: '',
    });
  }

  if (program.rideTemplate || program.chaseTemplate) {
    add({
      kind: 'movable_item',
      reason: '移動系テンプレートを使うため、このアイテムは移動可能な設定が必要です。',
      blockId: '',
    });
  }

  return requirements;
}

export function formatUnityRequirements(requirements: UnityRequirement[]): string {
  if (requirements.length === 0) {
    return '';
  }

  const lines = ['Unity側で必要な設定:'];
  for (const requirement of requirements) {
    switch (requirement.kind) {
      case 'world_item_reference':
        lines.push(`- World Item Reference List に "${requirement.id}" を登録してください。${requirement.reason}`);
        break;
      case 'movable_item':
      case 'overlap_detector':
      case 'collision_shape':
        lines.push(`- ${requirement.reason}`);
        break;
      case 'audio_set':
        lines.push(`- Item Audio Set List に "${requirement.id}" を登録してください。${requirement.reason}`);
        break;
      case 'material_set':
        lines.push(`- Item Material Set List に "${requirement.id}" を登録してください。${requirement.reason}`);
        break;
    }
  }

  return lines.join('\n');
}
