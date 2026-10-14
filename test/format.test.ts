/**
 * Generated-code formatting helpers (src/codegen/format.ts): parentheses are only removed or
 * omitted where that cannot change the meaning.
 */

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { bare, commentText, group, isAtomic } from '../src/codegen/format';

test('isAtomic: literals, member / index access and calls are atomic', () => {
  for (const code of ['0', '1.5', '-2', '1e-7', '"a(b"', 'deltaTime', '$.state["var.x"]', 'Math.floor(1 + Math.random() * 6)', 'a.b(c).d', '(a + b)', 'getCooldown("t)")']) {
    assert.ok(isAtomic(code), code);
  }
});

test('isAtomic: operators, unary and ternaries are not atomic', () => {
  for (const code of ['a + b', '(a) + (b)', '!x', '!!$.state["b"]', 'a ? b : c', '$.state["x"] || 0', 'f(a) * 2', '"a" + "b"']) {
    assert.ok(!isAtomic(code), code);
  }
});

test('group wraps only non-atomic code', () => {
  assert.equal(group('a + b'), '(a + b)');
  assert.equal(group('x'), 'x');
  assert.equal(group('(a + b)'), '(a + b)');
});

test('bare removes only parentheses that wrap the whole expression', () => {
  assert.equal(bare('((a + b))'), 'a + b');
  assert.equal(bare('(a) + (b)'), '(a) + (b)', 'two groups: nothing to strip');
  assert.equal(bare('("(" + x)'), '"(" + x', 'parenthesis inside a string is ignored');
  assert.equal(bare('(a + ")")'), 'a + ")"');
  assert.equal(bare('f(x)'), 'f(x)');
});

test('commentText keeps comments on one line', () => {
  assert.equal(commentText('a\nb\r\nc d'), 'a b c d');
});
