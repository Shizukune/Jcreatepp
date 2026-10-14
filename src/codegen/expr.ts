import type { BoolExpr, Expr } from '../ir';
import { jsString, variableKeyJS } from './shared';
import { useHelper } from './helpers';

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
      return `($.state[${variableKeyJS('number', expr.name)}] || 0)`;
    case 'string_var':
      return `($.state[${variableKeyJS('string', expr.name)}] || "")`;
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
      return `(typeof $.state[${variableKeyJS('cooldown', expr.name)}] === "number" ? $.state[${variableKeyJS('cooldown', expr.name)}] : 0)`;
    case 'message_value':
      if (expr.valueType === 'string') {
        return `(typeof arg === "string" ? arg : "")`;
      }
      return `(typeof arg === "number" ? arg : 0)`;
    case 'binary':
      return `(${exprToJS(expr.left)} ${binaryOperatorToJS(expr.operator)} ${exprToJS(expr.right)})`;
  }
}

/**
 * Rounds a computed number to 15 significant digits, removing binary floating-point noise
 * (0.1 + 0.2 -> 0.3) so "=" can stay an exact comparison. Integers up to 1e15 stay exact;
 * Infinity / NaN pass through unchanged.
 */
export function decimalNormalized(numberExpressionJS: string): string {
  return `${useHelper('num')}(${numberExpressionJS})`;
}

/**
 * A number expression as it should be stored, compared or shown. Calculations run at full
 * precision; only the final result of arithmetic is normalized (so 1 / 3 * 3 is still 1).
 */
export function settledNumberToJS(expr: Expr): string {
  return expr.kind === 'binary' ? decimalNormalized(exprToJS(expr)) : exprToJS(expr);
}

export function boolExprToJS(expr: BoolExpr): string {
  switch (expr.kind) {
    case 'raw_bool':
      return expr.code;
    case 'compare':
      return `(${settledNumberToJS(expr.left)} ${compareOperatorToJS(expr.operator)} ${settledNumberToJS(expr.right)})`;
    case 'not':
      return `!(${boolExprToJS(expr.expr)})`;
    case 'and':
      return `(${boolExprToJS(expr.left)} && ${boolExprToJS(expr.right)})`;
    case 'or':
      return `(${boolExprToJS(expr.left)} || ${boolExprToJS(expr.right)})`;
    case 'bool_literal':
      return expr.value ? 'true' : 'false';
    case 'flag':
      return `!!$.state[${variableKeyJS('bool', expr.name)}]`;
    case 'bool_var':
      return `!!$.state[${variableKeyJS('bool', expr.name)}]`;
    case 'cooldown_active':
      return `((typeof $.state[${variableKeyJS('cooldown', expr.name)}] === "number" ? $.state[${variableKeyJS('cooldown', expr.name)}] : 0) > 0)`;
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
