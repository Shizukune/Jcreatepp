import type { BoolExpr, Expr } from '../ir';
import { stateKey } from './shared';

type CompareOperator = Extract<BoolExpr, { kind: 'compare' }>['operator'];

export function exprToJS(expr: Expr): string {
  switch (expr.kind) {
    case 'raw':
      return expr.code;
    case 'number_literal':
      return String(expr.value);
    case 'delta_time':
      return 'deltaTime';
    case 'player_ref':
      return 'player';
    case 'number_var':
      return `($.state[${stateKey('var.', expr.name)}] || 0)`;
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
    case 'flag':
      return `!!$.state[${stateKey('__jpp_flag_', expr.name)}]`;
    default:
      return 'false';
  }
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
