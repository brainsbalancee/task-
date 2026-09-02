import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildFilters, buildOrderBy, toMatchExpression } from '../src/search/sqlite/query-builder.js';
import type { SearchQuery } from '../src/search/engine.js';

const query = (overrides: Partial<SearchQuery['filters']> = {}, rest: Partial<SearchQuery> = {}): SearchQuery => ({
  q: null,
  filters: {
    skills: [],
    jobTitle: [],
    company: [],
    industry: [],
    country: [],
    level: [],
    degree: [],
    school: [],
    minExperience: null,
    maxExperience: null,
    ...overrides,
  },
  skillMatch: 'any',
  sort: 'relevance',
  page: 1,
  limit: 20,
  explain: false,
  ...rest,
});

describe('toMatchExpression', () => {
  it('ANDs terms and prefix-matches each one', () => {
    assert.equal(toMatchExpression('golang engineer'), '"golang" * AND "engineer" *');
  });

  it('keeps a quoted phrase intact', () => {
    assert.equal(toMatchExpression('"product manager"'), '"product manager"');
  });

  it('turns a leading minus into an exclusion', () => {
    assert.equal(toMatchExpression('go -recruiter'), '"go" * NOT ("recruiter")');
  });

  it('neutralises FTS5 operators so user input cannot steer the query', () => {
    // `NEAR`, `*` and `:` become literal, quoted terms.
    assert.equal(toMatchExpression('foo* NEAR bar:'), '"foo" * AND "near" * AND "bar" *');

    // An unbalanced quote is read as a phrase delimiter — ` OR ` here — and the
    // operator inside it ends up quoted, i.e. inert, which is the point.
    const injected = toMatchExpression('a" OR "b');
    assert.equal(injected, '"or" AND "a" * AND "b" *');
    // No bare (unquoted) operator survives anywhere in the expression.
    assert.doesNotMatch(injected!.replace(/"[^"]*"/g, ''), /\b(OR|NOT|NEAR)\b/);
  });

  it('returns null when there is nothing positive to match', () => {
    assert.equal(toMatchExpression(''), null);
    assert.equal(toMatchExpression('   '), null);
    assert.equal(toMatchExpression('***'), null);
    // Excluding without including has no candidate set to subtract from.
    assert.equal(toMatchExpression('-only'), null);
  });
});

describe('buildFilters', () => {
  it('produces no clauses when nothing is filtered', () => {
    assert.equal(buildFilters(query()).length, 0);
  });

  it('binds every value as a parameter, never inlining it', () => {
    const [clause] = buildFilters(query({ skills: ["o'brien; drop table"] }));
    assert.ok(clause);
    assert.ok(!clause.sql.includes('drop table'), 'value must not appear in the SQL text');
    assert.deepEqual(clause.params, ["o'brien; drop table"]);
  });

  it('emits one placeholder per skill', () => {
    const [clause] = buildFilters(query({ skills: ['go', 'rust', 'sql'] }));
    assert.equal(clause!.sql.match(/\?/g)?.length, 3);
  });

  it('switches to a count predicate for skillMatch=all', () => {
    const [clause] = buildFilters(query({ skills: ['go', 'rust'] }, { skillMatch: 'all' }));
    assert.match(clause!.sql, /COUNT\(DISTINCT s\.name\)/);
    // Values plus the required-match count.
    assert.deepEqual(clause!.params, ['go', 'rust', 2]);
  });

  it('escapes LIKE wildcards so a literal search stays literal', () => {
    const [clause] = buildFilters(query({ jobTitle: ['100%_dev'] }));
    assert.deepEqual(clause!.params, ['%100\\%\\_dev%']);
  });

  it('ANDs across different fields', () => {
    const clauses = buildFilters(query({ skills: ['go'], country: ['germany'], minExperience: 5 }));
    assert.equal(clauses.length, 3);
  });

  it('labels each clause with the parameter it came from, for explain output', () => {
    const clauses = buildFilters(query({ skills: ['go'], country: ['germany'], maxExperience: 20 }));
    assert.deepEqual(
      clauses.map((c) => c.field),
      ['skill', 'country', 'maxExp'],
    );
  });

  it('omits a range bound that was not supplied', () => {
    const clauses = buildFilters(query({ minExperience: 5 }));
    assert.equal(clauses.length, 1);
    assert.match(clauses[0]!.sql, />=/);
  });
});

describe('buildOrderBy', () => {
  it('ranks by score only when a keyword was given', () => {
    assert.match(buildOrderBy('relevance', true), /m\.score DESC/);
    assert.doesNotMatch(buildOrderBy('relevance', false), /m\.score/);
  });

  it('always ends with a unique tiebreaker so pages cannot repeat a row', () => {
    for (const sort of ['relevance', 'experience_desc', 'connections_desc', 'name_asc'] as const) {
      assert.match(buildOrderBy(sort, false), /p\.id$/);
    }
  });
});
