import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLiteralOr, parsePythonLiteral } from '../src/etl/python-literal.js';

describe('parsePythonLiteral', () => {
  it('parses a list of single-quoted strings', () => {
    assert.deepEqual(parsePythonLiteral("['go', 'rust']"), ['go', 'rust']);
  });

  it('parses Python constants', () => {
    assert.deepEqual(parsePythonLiteral('[None, True, False]'), [null, true, false]);
  });

  it('keeps apostrophes inside double-quoted strings', () => {
    // The reason a regex quote-swap cannot be used: it would corrupt this.
    assert.deepEqual(parsePythonLiteral(`["bachelor's degree"]`), ["bachelor's degree"]);
  });

  it('handles escaped quotes inside single-quoted strings', () => {
    assert.deepEqual(parsePythonLiteral("['it\\'s fine']"), ["it's fine"]);
  });

  it('parses nested dicts', () => {
    assert.deepEqual(parsePythonLiteral("[{'company': {'name': 'acme'}, 'is_primary': True}]"), [
      { company: { name: 'acme' }, is_primary: true },
    ]);
  });

  it('parses numbers, including negatives and floats', () => {
    assert.deepEqual(parsePythonLiteral("{'a': -1, 'b': 3.5, 'c': 1e3}"), { a: -1, b: 3.5, c: 1000 });
  });

  it('accepts empty collections', () => {
    assert.deepEqual(parsePythonLiteral('[]'), []);
    assert.deepEqual(parsePythonLiteral('{}'), {});
  });

  it('accepts a trailing comma in a tuple', () => {
    assert.deepEqual(parsePythonLiteral("('a',)"), ['a']);
  });

  it('decodes \\x and \\u escapes', () => {
    assert.deepEqual(parsePythonLiteral("['caf\\xe9', '\\u00e9']"), ['café', 'é']);
  });

  it('throws on malformed input rather than guessing', () => {
    assert.throws(() => parsePythonLiteral("['unterminated"), SyntaxError);
    assert.throws(() => parsePythonLiteral('[1, 2] extra'), SyntaxError);
  });
});

describe('parseLiteralOr', () => {
  it('returns the fallback for blank and null-ish cells', () => {
    assert.deepEqual(parseLiteralOr('', []), []);
    assert.deepEqual(parseLiteralOr('   ', []), []);
    assert.deepEqual(parseLiteralOr('None', []), []);
    assert.deepEqual(parseLiteralOr(undefined, []), []);
  });

  it('reports malformed cells instead of throwing', () => {
    const errors: Error[] = [];
    const result = parseLiteralOr("['broken", [], (err) => errors.push(err));
    assert.deepEqual(result, []);
    assert.equal(errors.length, 1);
  });
});
