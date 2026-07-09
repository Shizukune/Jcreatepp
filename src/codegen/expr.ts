import type { BoolExpr, Expr } from '../ir';
import { jsString, stateKey } from './shared';

type CompareOperator = Extract<BoolExpr, { kind: 'compare' }>['operator'];

export function exprToJS(expr: Expr): string {
  switch (expr.kind) {
    case 'raw':
      return expr.code;
    case 'number_literal':
      return String(expr.value);
    case 'string_literal':
      return jsString(expr.value);
    case 'delta_time':
      return 'deltaTime';
    case 'player_ref':
      return 'player';
    case 'collision_handle':
      return '(collision && collision.handle ? collision.handle : null)';
    case 'number_var':
      return `($.state[${stateKey('var.', expr.name)}] || 0)`;
    case 'string_var':
      return `($.state[${stateKey('str.', expr.name)}] || "")`;
    case 'random_number': {
      const min = exprToJS(expr.min);
      const max = exprToJS(expr.max);
      const low = `Math.min((${min}), (${max}))`;
      const high = `Math.max((${min}), (${max}))`;
      if (expr.mode === 'integer') {
        return `Math.floor((${low}) + Math.random() * ((${high}) - (${low}) + 1))`;
      }
      return `((${low}) + Math.random() * ((${high}) - (${low})))`;
    }
    case 'players_near_count':
      return `($.getPlayersNear(($.getPosition() || new Vector3(0,0,0)), Math.max(0, (${exprToJS(expr.range)}))).length)`;
    case 'cooldown_remaining':
      return `($.state[${stateKey('__jpp_cd_', expr.name)}] || 0)`;
    case 'message_value':
      if (expr.valueType === 'string') {
        return `(typeof arg === "string" ? arg : "")`;
      }
      return `(typeof arg === "number" ? arg : 0)`;
    case 'binary':
      return `(${exprToJS(expr.left)} ${binaryOperatorToJS(expr.operator)} ${exprToJS(expr.right)})`;
  }
}

export function boolExprToJS(expr: BoolExpr): string {
  switch (expr.kind) {
    case 'raw_bool':
      return expr.code;
    case 'compare':
      return `(${exprToJS(expr.left)} ${compareOperatorToJS(expr.operator)} ${exprToJS(expr.right)})`;
    case 'not':
      return `!(${boolExprToJS(expr.expr)})`;
    case 'and':
      return `(${boolExprToJS(expr.left)} && ${boolExprToJS(expr.right)})`;
    case 'or':
      return `(${boolExprToJS(expr.left)} || ${boolExprToJS(expr.right)})`;
    case 'bool_literal':
      return expr.value ? 'true' : 'false';
    case 'flag':
      return `!!$.state[${stateKey('__jpp_flag_', expr.name)}]`;
    case 'bool_var':
      return `!!$.state[${stateKey('bool.', expr.name)}]`;
    case 'cooldown_active':
      return `(($.state[${stateKey('__jpp_cd_', expr.name)}] || 0) > 0)`;
    case 'message_value_bool':
      return `(typeof arg === "boolean" ? arg : false)`;
    case 'players_near':
      return `($.getPlayersNear(($.getPosition() || new Vector3(0,0,0)), Math.max(0, (${exprToJS(expr.range)}))).length > 0)`;
    case 'raycast_forward':
      return raycastForwardToJS(expr);
    default:
      return 'false';
  }
}

function raycastForwardToJS(expr: Extract<BoolExpr, { kind: 'raycast_forward' }>): string {
  const hit = `$.raycast(($.getPosition() || new Vector3(0,0,0)), new Vector3(0,0,1).applyQuaternion(($.getRotation() || new Quaternion())).normalize(), Math.max(0, (${exprToJS(expr.distance)})))`;

  if (expr.target === 'item') {
    return `((() => { const __jpp_hit = ${hit}; return !!(__jpp_hit && __jpp_hit.handle && __jpp_hit.handle.type === "item"); })())`;
  }

  if (expr.target === 'player') {
    return `((() => { const __jpp_hit = ${hit}; return !!(__jpp_hit && __jpp_hit.handle && __jpp_hit.handle.type === "player"); })())`;
  }

  return `(${hit} !== null)`;
}

function compareOperatorToJS(operator: CompareOperator): string {
  switch (operator) {
    case 'EQ':
      return '===';
    case 'NEQ':
      return '!==';
    case 'LT':
      return '<';
    case 'LTE':
      return '<=';
    case 'GT':
      return '>';
    case 'GTE':
      return '>=';
  }
}

function binaryOperatorToJS(operator: Extract<Expr, { kind: 'binary' }>['operator']): string {
  switch (operator) {
    case 'ADD':
      return '+';
    case 'SUB':
      return '-';
    case 'MUL':
      return '*';
    case 'DIV':
      return '/';
  }
}
