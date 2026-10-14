/**
 * Small helpers that keep the generated JavaScript readable: parentheses only where needed and
 * constant folding of literal arguments. They never change what the code computes.
 *
 * Convention: exprToJS / boolExprToJS return "embeddable" code (atomic, or wrapped in parentheses),
 * so it can be dropped into any operator context. Where the surrounding syntax already delimits
 * the expression (an if condition, a function argument, the right side of =), use bare().
 */

import type { Expr } from '../ir';

/** Index of the parenthesis closing the one at `open`, or -1. Skips string literals. */
function matchingParen(code: string, open: number): number {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === '"' || c === "'" || c === '`') {
      // Skip a string literal (with escapes).
      for (i++; i < code.length && code[i] !== c; i++) {
        if (code[i] === '\\') i++;
      }
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** True when the whole code is one parenthesized group: "(a + b)" but not "(a) + (b)". */
function isWrapped(code: string): boolean {
  return code.startsWith('(') && matchingParen(code, 0) === code.length - 1;
}

/**
 * Atomic: can be used as an operand without parentheses.
 * Number literals (a leading minus is fine: generated operators always have spaces around them and
 * `**` is never emitted), string literals, identifiers / member access / index access,
 * calls (including method chains), and anything already wrapped in parentheses.
 */
export function isAtomic(code: string): boolean {
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(code)) return true;
  if (/^"(?:[^"\\]|\\.)*"$/.test(code)) return true;
  if (isWrapped(code)) return true;
  // identifier / member / index / call chain: a.b["c"](d).e(...)
  let i = 0;
  const ident = /^[A-Za-z_$][\w$]*/;
  const head = ident.exec(code);
  if (!head) return false;
  i = head[0].length;
  while (i < code.length) {
    const c = code[i];
    if (c === '.') {
      const m = ident.exec(code.slice(i + 1));
      if (!m) return false;
      i += 1 + m[0].length;
    } else if (c === '(') {
      const close = matchingParen(code, i);
      if (close < 0) return false;
      i = close + 1;
    } else if (c === '[') {
      const close = code.indexOf(']', i);
      // Only simple string / number indexes (state keys); no nested brackets.
      if (close < 0 || !/^\[(?:"(?:[^"\\]|\\.)*"|\d+)\]/.test(code.slice(i, close + 1))) return false;
      i = close + 1;
    } else {
      return false;
    }
  }
  return true;
}

/** Wraps in parentheses unless the code is atomic. */
export function group(code: string): string {
  return isAtomic(code) ? code : `(${code})`;
}

/** Removes redundant outer parentheses where the context already delimits the expression. */
export function bare(code: string): string {
  let c = code;
  while (isWrapped(c)) c = c.slice(1, -1);
  return c;
}

/** The value of a number literal expression, or null. */
export function literalNumber(expr: Expr): number | null {
  return expr.kind === 'number_literal' ? expr.value : null;
}

/** JS text for a number computed at generation time (same IEEE result as at run time). */
export function numberJS(value: number): string {
  return String(value);
}

/** `//` comment text: one line, no control characters. */
export function commentText(text: string): string {
  return text.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}
