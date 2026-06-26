/**
 * Jcreate++ IR (Intermediate Representation)
 *
 * Blockly blocks are converted into this small typed model before codegen.
 * Keep user-facing behavior out of this file; codegen owns Cluster Script syntax.
 */

export type Program = {
  onStart?: Handler;
  onUpdate?: Handler;
  onInteract?: Handler;
  onCollide?: Handler;
  onGrabStart?: Handler;
  onGrabEnd?: Handler;
  onReceives?: ReceiveHandler[];
  rideTemplate?: {
    forwardSpeed: Expr;
    upDownSpeed: Expr;
    turnSpeed: Expr;
  };
  chaseTemplate?: {
    moveSpeed: Expr;
    maxDistance: Expr;
    minDistance: Expr;
  };
};

export type Handler = {
  body: Stmt[];
};

export type ReceiveHandler = {
  message: string;
  handler: Handler;
};

export type Stmt =
  | { kind: 'set_position'; x: Expr; y: Expr; z: Expr }
  | { kind: 'move_by'; x: Expr; y: Expr; z: Expr }
  | { kind: 'set_rotation'; x: Expr; y: Expr; z: Expr }
  | { kind: 'rotate_by'; x: Expr; y: Expr; z: Expr }
  | { kind: 'random_warp'; rangeX: Expr; rangeZ: Expr }
  | { kind: 'save_position' }
  | { kind: 'load_position' }
  | { kind: 'add_force'; dirX: Expr; dirY: Expr; dirZ: Expr; power: Expr }
  | { kind: 'continuous_rotation'; axis: 'X' | 'Y' | 'Z'; speed: Expr }
  | { kind: 'timed_random_warp'; interval: Expr; range: Expr; blockId: string }
  | { kind: 'timed_move_return'; dirX: Expr; dirY: Expr; dirZ: Expr; speed: Expr; duration: Expr; blockId: string }
  | { kind: 'set_move_speed'; rate: Expr }
  | { kind: 'set_jump_speed'; rate: Expr }
  | { kind: 'set_flag'; name: string; operation: 'true' | 'false' | 'toggle' }
  | { kind: 'set_number_var'; name: string; value: Expr }
  | { kind: 'change_number_var'; name: string; delta: Expr }
  | { kind: 'set_string_var'; name: string; value: Expr }
  | { kind: 'set_bool_var'; name: string; value: BoolExpr }
  | { kind: 'start_cooldown'; name: string; seconds: Expr }
  | { kind: 'send_message'; target: MessageTarget; message: string; condition?: BoolExpr; edgeOnce?: boolean; value?: MessageSendValue; blockId: string }
  | { kind: 'if_edge'; condition: BoolExpr; body: Stmt[]; blockId: string }
  | { kind: 'if'; condition: BoolExpr; thenBody: Stmt[]; elseBody?: Stmt[] }
  | { kind: 'sequence'; id: string; body: Stmt[] }
  | { kind: 'wait_seconds'; seconds: Expr }
  | { kind: 'wait_until'; condition: BoolExpr }
  | { kind: 'run_for_seconds'; seconds: Expr; body: Stmt[] }
  | { kind: 'oscillate'; axis: 'X' | 'Y' | 'Z'; width: Expr; speed: Expr; blockId: string };

export type MessageTarget =
  | { kind: 'near'; range: Expr }
  | { kind: 'world_item'; itemName: string }
  | { kind: 'sender' }
  | { kind: 'handle'; handle: Expr };

export type Expr =
  | RawExpr
  | NumberLiteralExpr
  | StringLiteralExpr
  | DeltaTimeExpr
  | PlayerRefExpr
  | CollisionHandleExpr
  | NumberVarExpr
  | StringVarExpr
  | RandomNumberExpr
  | CooldownRemainingExpr
  | MessageValueExpr
  | BinaryExpr;

export type BoolExpr =
  | { kind: 'raw_bool'; code: string }
  | { kind: 'compare'; operator: 'EQ' | 'NEQ' | 'LT' | 'LTE' | 'GT' | 'GTE'; left: Expr; right: Expr }
  | { kind: 'not'; expr: BoolExpr }
  | { kind: 'and'; left: BoolExpr; right: BoolExpr }
  | { kind: 'or'; left: BoolExpr; right: BoolExpr }
  | { kind: 'flag'; name: string }
  | { kind: 'bool_var'; name: string }
  | { kind: 'cooldown_active'; name: string }
  | { kind: 'message_value_bool' };

export type MessageSendValue =
  | { valueType: 'number' | 'string' | 'handle'; value: Expr }
  | { valueType: 'boolean'; value: BoolExpr };

export type RawExpr = {
  kind: 'raw';
  code: string;
};

export type NumberLiteralExpr = {
  kind: 'number_literal';
  value: number;
};

export type StringLiteralExpr = {
  kind: 'string_literal';
  value: string;
};

export type DeltaTimeExpr = {
  kind: 'delta_time';
};

export type PlayerRefExpr = {
  kind: 'player_ref';
};

export type CollisionHandleExpr = {
  kind: 'collision_handle';
};

export type NumberVarExpr = {
  kind: 'number_var';
  name: string;
};

export type StringVarExpr = {
  kind: 'string_var';
  name: string;
};

export type RandomNumberExpr = {
  kind: 'random_number';
  min: Expr;
  max: Expr;
  mode: 'float' | 'integer';
};

export type CooldownRemainingExpr = {
  kind: 'cooldown_remaining';
  name: string;
};

export type MessageValueExpr = {
  kind: 'message_value';
  valueType: 'number' | 'string';
};

export type BinaryExpr = {
  kind: 'binary';
  operator: 'ADD' | 'SUB' | 'MUL' | 'DIV';
  left: Expr;
  right: Expr;
};

export function raw(code: string): RawExpr {
  return { kind: 'raw', code };
}

export function numberLiteral(value: number): NumberLiteralExpr {
  return { kind: 'number_literal', value };
}

export function stringLiteral(value: string): StringLiteralExpr {
  return { kind: 'string_literal', value };
}

export function deltaTime(): DeltaTimeExpr {
  return { kind: 'delta_time' };
}

export function playerRef(): PlayerRefExpr {
  return { kind: 'player_ref' };
}

export function collisionHandle(): CollisionHandleExpr {
  return { kind: 'collision_handle' };
}

export function numberVar(name: string): NumberVarExpr {
  return { kind: 'number_var', name };
}

export function stringVar(name: string): StringVarExpr {
  return { kind: 'string_var', name };
}

export function randomNumber(min: Expr, max: Expr, mode: RandomNumberExpr['mode']): RandomNumberExpr {
  return { kind: 'random_number', min, max, mode };
}

export function cooldownRemaining(name: string): CooldownRemainingExpr {
  return { kind: 'cooldown_remaining', name };
}

export function messageValue(valueType: MessageValueExpr['valueType']): MessageValueExpr {
  return { kind: 'message_value', valueType };
}

export function binary(operator: BinaryExpr['operator'], left: Expr, right: Expr): BinaryExpr {
  return { kind: 'binary', operator, left, right };
}

export function not(expr: BoolExpr): BoolExpr {
  return { kind: 'not', expr };
}

export function and(left: BoolExpr, right: BoolExpr): BoolExpr {
  return { kind: 'and', left, right };
}

export function or(left: BoolExpr, right: BoolExpr): BoolExpr {
  return { kind: 'or', left, right };
}
