import type { BoolExpr, Expr, MessageTarget, Program, Stmt } from './ir';

export type UnityRequirement =
  | { kind: 'movable_item'; reason: string; blockId: string }
  | { kind: 'world_item_reference'; id: string; reason: string; blockId: string }
  | { kind: 'overlap_detector'; reason: string; blockId: string }
  | { kind: 'collision_shape'; reason: string; blockId: string }
  | { kind: 'send_rate_limit'; reason: string; blockId: string }
  | { kind: 'audio_set'; id: string; reason: string; blockId: string }
  | { kind: 'material_set'; id: string; reason: string; blockId: string }
  | { kind: 'subnode_component'; subNodeName: string; componentType: string; reason: string; blockId: string }
  | { kind: 'player_detection'; reason: string; blockId: string }
  | { kind: 'raycast'; reason: string; blockId: string };

export function collectUnityRequirements(program: Program): UnityRequirement[] {
  const requirements: UnityRequirement[] = [];

  const add = (requirement: UnityRequirement) => {
    const key = JSON.stringify(requirement);
    if (!requirements.some((existing) => JSON.stringify(existing) === key)) {
      requirements.push(requirement);
    }
  };

  const visitExpr = (expr: Expr) => {
    switch (expr.kind) {
      case 'random_number':
        visitExpr(expr.min);
        visitExpr(expr.max);
        break;

      case 'players_near_count':
        add({
          kind: 'player_detection',
          reason: '近くのプレイヤー数を調べるには、Cluster Scriptのプレイヤー検知APIを使います。ワールド上で検知距離や対象の想定を確認してください。',
          blockId: '',
        });
        visitExpr(expr.range);
        break;

      case 'binary':
        visitExpr(expr.left);
        visitExpr(expr.right);
        break;
    }
  };

  const visitBoolExpr = (expr: BoolExpr) => {
    switch (expr.kind) {
      case 'compare':
        visitExpr(expr.left);
        visitExpr(expr.right);
        break;

      case 'not':
        visitBoolExpr(expr.expr);
        break;

      case 'and':
      case 'or':
        visitBoolExpr(expr.left);
        visitBoolExpr(expr.right);
        break;

      case 'players_near':
        add({
          kind: 'player_detection',
          reason: '近くのプレイヤーを調べるには、Cluster Scriptのプレイヤー検知APIを使います。ワールド上で検知距離や対象の想定を確認してください。',
          blockId: '',
        });
        visitExpr(expr.range);
        break;

      case 'raycast_forward':
        add({
          kind: 'raycast',
          reason: '前方レイキャストを使うには、当たり判定対象のColliderやLayer設定が想定どおりになっているか確認してください。',
          blockId: '',
        });
        visitExpr(expr.distance);
        break;
    }
  };

  const visitMessageTarget = (target: MessageTarget) => {
    switch (target.kind) {
      case 'near':
        visitExpr(target.range);
        break;
      case 'handle':
        visitExpr(target.handle);
        break;
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
        if ('x' in stmt) visitExpr(stmt.x);
        if ('y' in stmt) visitExpr(stmt.y);
        if ('z' in stmt) visitExpr(stmt.z);
        if ('dirX' in stmt) visitExpr(stmt.dirX);
        if ('dirY' in stmt) visitExpr(stmt.dirY);
        if ('dirZ' in stmt) visitExpr(stmt.dirZ);
        if ('power' in stmt) visitExpr(stmt.power);
        if ('speed' in stmt) visitExpr(stmt.speed);
        if ('interval' in stmt) visitExpr(stmt.interval);
        if ('duration' in stmt) visitExpr(stmt.duration);
        if ('range' in stmt) visitExpr(stmt.range);
        if ('width' in stmt) visitExpr(stmt.width);
        break;

      case 'send_message':
        add({
          kind: 'send_rate_limit',
          reason: 'メッセージ送信にはCluster Scriptのsend頻度制限とペイロード容量制限があります。毎フレームや大量対象への送信ではクールダウンや「1回だけ」制御を併用してください。',
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
            reason: '衝突相手へ送信するには、衝突イベントが発火するCollider / Physical Shape設定が必要です。衝突相手がアイテム/プレイヤー以外の場合、衝突相手ハンドルはnullになり送信されません。',
            blockId: stmt.blockId,
          });
        }
        visitMessageTarget(stmt.target);
        if (stmt.condition) {
          visitBoolExpr(stmt.condition);
        }
        if (stmt.value) {
          if (stmt.value.valueType === 'boolean') {
            visitBoolExpr(stmt.value.value);
          } else {
            visitExpr(stmt.value.value);
          }
        }
        break;

      case 'play_audio':
        add({
          kind: 'audio_set',
          id: stmt.audioSetId,
          reason: '音を鳴らすには、このアイテムのItem Audio Set Listに同じIDの音を登録してください。',
          blockId: '',
        });
        visitExpr(stmt.volume);
        break;

      case 'set_subnode_text':
        add({
          kind: 'subnode_component',
          subNodeName: stmt.subNodeName,
          componentType: stmt.componentType,
          reason: '文字を変えるには、指定したサブノードに対応するTextView/Text/TextMeshPro系コンポーネントが必要です。',
          blockId: '',
        });
        visitExpr(stmt.value);
        break;

      case 'set_component_enabled':
        add({
          kind: 'subnode_component',
          subNodeName: stmt.subNodeName,
          componentType: stmt.componentType,
          reason: '表示や当たり判定を切り替えるには、指定したサブノードに対応するUnityコンポーネントが必要です。',
          blockId: '',
        });
        visitBoolExpr(stmt.enabled);
        break;

      case 'set_number_var':
        visitExpr(stmt.value);
        break;

      case 'change_number_var':
        visitExpr(stmt.delta);
        break;

      case 'set_string_var':
        visitExpr(stmt.value);
        break;

      case 'set_bool_var':
        visitBoolExpr(stmt.value);
        break;

      case 'start_cooldown':
        visitExpr(stmt.seconds);
        break;

      case 'if':
        visitBoolExpr(stmt.condition);
        stmt.thenBody.forEach(visitStmt);
        stmt.elseBody?.forEach(visitStmt);
        break;

      case 'if_edge':
        visitBoolExpr(stmt.condition);
        stmt.body.forEach(visitStmt);
        break;

      case 'sequence':
        stmt.body.forEach(visitStmt);
        break;

      case 'run_for_seconds':
        visitExpr(stmt.seconds);
        stmt.body.forEach(visitStmt);
        break;

      case 'wait_seconds':
        visitExpr(stmt.seconds);
        break;

      case 'wait_until':
        visitBoolExpr(stmt.condition);
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
      reason: '衝突イベントを動かすには、衝突判定用のCollider / Physical Shapeなどの設定が必要です。相手がアイテム/プレイヤー以外の場合、衝突相手ハンドルはnullになります。',
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
      case 'subnode_component':
        lines.push(`- サブノード "${requirement.subNodeName}" に ${requirement.componentType} コンポーネントを付けてください。${requirement.reason}`);
        break;
      case 'player_detection':
      case 'raycast':
        lines.push(`- ${requirement.reason}`);
        break;
    }
  }

  return lines.join('\n');
}
