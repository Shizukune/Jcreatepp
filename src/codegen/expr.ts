import type { BoolExpr, Expr } from '../ir';
import { jsString, variableKeyJS } from './shared';
import { useHelper } from './helpers';
import { bare, group, literalNumber, numberJS } from './format';

type CompareOperator = Extract<BoolExpr, { kind: 'compare' }>['operator'];

/** Embeddable JS for a number / string / handle expression (atomic or parenthesized). */
export function exprToJS(expr: Expr): string {
  switch (expr.kind) {
    case 'raw':
      return group(expr.code);
    case 'number_literal':
      return group(String(expr.value));
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
    case 'random_number':
      return randomNumberToJS(expr);
    case 'players_near_count':
      return `$.getPlayersNear($.getPosition() || new Vector3(0, 0, 0), ${nonNegativeJS(expr.range)}).length`;
    case 'cooldown_remaining':
      return `${useHelper('getCooldown')}(${jsString(expr.name)})`;
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
 * Random number in [min, max] (integer) or [min, max) (decimal), whichever order min / max are
 * given in. With literal bounds the range is computed here, so the script reads
 * `Math.floor(1 + Math.random() * 6)`; the result is identical (one Math.random() call, same math).
 */
function randomNumberToJS(expr: Extract<Expr, { kind: 'random_number' }>): string {
  const a = literalNumber(expr.min);
  const b = literalNumber(expr.max);
  if (a !== null && b !== null) {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const span = expr.mode === 'integer' ? high - low + 1 : high - low;
    const sum = low === 0 ? `Math.random() * ${group(numberJS(span))}` : `${numberJS(low)} + Math.random() * ${group(numberJS(span))}`;
    return expr.mode === 'integer' ? `Math.floor(${sum})` : `(${sum})`;
  }
  const min = exprToJS(expr.min);
  const max = exprToJS(expr.max);
  const low = `Math.min(${bare(min)}, ${bare(max)})`;
  const high = `Math.max(${bare(min)}, ${bare(max)})`;
  if (expr.mode === 'integer') {
    return `Math.floor(${low} + Math.random() * (${high} - ${low} + 1))`;
  }
  return `(${low} + Math.random() * (${high} - ${low}))`;
}

/** `Math.max(0, x)` for a distance or duration; folded when x is a literal. */
export function nonNegativeJS(expr: Expr): string {
  return atLeastJS(0, expr);
}

/** `Math.max(min, x)`, folded when x is a literal. */
export function atLeastJS(min: number, expr: Expr): string {
  const value = literalNumber(expr);
  if (value !== null) return group(numberJS(Math.max(min, value)));
  return `Math.max(${numberJS(min)}, ${bare(exprToJS(expr))})`;
}

/**
 * Rounds a computed number to 15 significant digits, removing binary floating-point noise
 * (0.1 + 0.2 -> 0.3) so "=" can stay an exact comparison. Integers up to 1e15 stay exact;
 * Infinity / NaN pass through unchanged.
 */
export function decimalNormalized(numberExpressionJS: string): string {
  return `${useHelper('roundDecimal')}(${bare(numberExpressionJS)})`;
}

/**
 * A number expression as it should be stored, compared or shown. Calculations run at full
 * precision; only the final result of arithmetic is normalized (so 1 / 3 * 3 is still 1).
 */
export function settledNumberToJS(expr: Expr): string {
  return expr.kind === 'binary' ? decimalNormalized(exprToJS(expr)) : exprToJS(expr);
}

/** Embeddable JS for a condition (atomic or parenthesized). */
export function boolExprToJS(expr: BoolExpr): string {
  switch (expr.kind) {
    case 'raw_bool':
      return group(expr.code);
    case 'compare':
      return `(${settledNumberToJS(expr.left)} ${compareOperatorToJS(expr.operator)} ${settledNumberToJS(expr.right)})`;
    case 'not':
      return `!${group(boolExprToJS(expr.expr))}`;
    case 'and':
      return `(${boolExprToJS(expr.left)} && ${boolExprToJS(expr.right)})`;
    case 'or':
      return `(${boolExprToJS(expr.left)} || ${boolExprToJS(expr.right)})`;
    case 'bool_literal':
      return expr.value ? 'true' : 'false';
    case 'flag':
    case 'bool_var':
      // Unary ! binds tighter than every operator we emit, so no parentheses are needed here.
      return `!!$.state[${variableKeyJS('bool', expr.name)}]`;
    case 'cooldown_active':
      return `(${useHelper('getCooldown')}(${jsString(expr.name)}) > 0)`;
    case 'message_value_bool':
      return `(typeof arg === "boolean" ? arg : false)`;
    case 'players_near':
      return `($.getPlayersNear($.getPosition() || new Vector3(0, 0, 0), ${nonNegativeJS(expr.range)}).length > 0)`;
    case 'raycast_forward':
      return raycastForwardToJS(expr);
    default:
      return 'false';
  }
}

function raycastForwardToJS(expr: Extract<BoolExpr, { kind: 'raycast_forward' }>): string {
  const hit = `$.raycast($.getPosition() || new Vector3(0, 0, 0), new Vector3(0, 0, 1).applyQuaternion($.getRotation() || new Quaternion()).normalize(), ${nonNegativeJS(expr.distance)})`;

  if (expr.target === 'item' || expr.target === 'player') {
    return `((() => { const hit = ${hit}; return !!(hit && hit.handle && hit.handle.type === "${expr.target}"); })())`;
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
