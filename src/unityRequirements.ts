import type { Program, Stmt } from './ir';

export type UnityRequirement =
  | { kind: 'movable_item'; reason: string; blockId: string }
  | { kind: 'world_item_reference'; id: string; reason: string; blockId: string }
  | { kind: 'overlap_detector'; reason: string; blockId: string }
  | { kind: 'collision_shape'; reason: string; blockId: string }
  | { kind: 'send_rate_limit'; reason: string; blockId: string }
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
      case 'set_rotation':
      case 'rotate_by':
      case 'add_force':
      case 'continuous_rotation':
      case 'timed_random_warp':
      case 'timed_move_return':
      case 'oscillate':
        add({
          kind: 'movable_item',
          reason: '位置・回転・物理力をスクリプトから変更するため、このアイテムは移動可能/物理操作可能な設定が必要です。',
          blockId: 'blockId' in stmt ? stmt.blockId : '',
        });
        break;

      case 'send_message':
        add({
          kind: 'send_rate_limit',
          reason: 'メッセージ送信にはCluster Scriptのsend頻度制限があります。毎フレームや大量対象への送信ではクールダウンやonce制御を併用してください。',
          blockId: stmt.blockId,
        });
        if (stmt.target.kind === 'near') {
          add({
            kind: 'overlap_detector',
            reason: '近くのアイテムへ送信するには、対象アイテムを取得できるCollider / Shape / Layer設定が必要です。',
            blockId: stmt.blockId,
          });
        } else if (stmt.target.kind === 'world_item') {
          add({
            kind: 'world_item_reference',
            id: stmt.target.itemName,
            reason: '指定アイテムへ送信するには、World Item Reference Listに同じ参照名を登録してください。',
            blockId: stmt.blockId,
          });
        } else if (stmt.target.kind === 'handle') {
          add({
            kind: 'collision_shape',
            reason: '衝突相手へ送信するには、衝突イベントが発火するCollider / Physical Shape設定が必要です。',
            blockId: stmt.blockId,
          });
        }
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

  const lines = ['Unity側で必要な設定'];
  for (const requirement of requirements) {
    switch (requirement.kind) {
      case 'world_item_reference':
        lines.push(`- World Item Reference List に "${requirement.id}" を登録してください。${requirement.reason}`);
        break;
      case 'send_rate_limit':
        lines.push(`- ${requirement.reason}`);
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
