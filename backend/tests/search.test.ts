import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { config } from '../src/config.js';
import { SqliteSearchEngine } from '../src/search/sqlite/sqlite.engine.js';
import type { SearchQuery } from '../src/search/engine.js';

/**
 * End-to-end checks against the real index built by `npm run ingest`.
 *
 * Nothing here hard-codes a value from a particular dataset. The fixtures below
 * are read out of whichever index is present — the supplied file or the
 * committed synthetic sample — so `npm test` passes on a fresh clone and still
 * means something. Assertions are about *relationships* (adding a filter never
 * widens the set, scores descend, pages do not overlap) rather than about
 * specific people.
 */
const dbExists = fs.existsSync(config.sqlitePath);

const NO_FILTERS: SearchQuery['filters'] = {
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
};

/** Builds a complete query from a partial override. Filters merge, not replace. */
const query = (
  overrides: Partial<Omit<SearchQuery, 'filters'>> & { filters?: Partial<SearchQuery['filters']> } = {},
): SearchQuery => ({
  q: null,
  skillMatch: 'any',
  sort: 'relevance',
  page: 1,
  limit: 20,
  explain: false,
  ...overrides,
  filters: { ...NO_FILTERS, ...overrides.filters },
});

describe('SqliteSearchEngine', { skip: dbExists ? false : 'run `npm run ingest` first' }, () => {
  let engine: SqliteSearchEngine;

  /** Values sampled from the index under test, so the suite is dataset-agnostic. */
  let fixtures: {
    totalProfiles: number;
    topSkill: string;
    secondSkill: string;
    /** A word that certainly appears in the corpus. */
    keyword: string;
    /** A strict prefix of `keyword`, for the prefix-matching check. */
    keywordPrefix: string;
    titleFragment: string;
  };

  before(async () => {
    engine = new SqliteSearchEngine(config.sqlitePath);
    await engine.init();

    const stats = await engine.stats();
    const skills = await engine.facets('skills', { limit: 2 });
    const titles = await engine.facets('jobTitle', { limit: 1 });

    // A single word from the most common skill makes a dependable keyword: it
    // is in the index by construction, and long enough to have a real prefix.
    const word =
      skills[0]!.value.split(' ').find((w) => w.length >= 6) ?? skills[0]!.value.split(' ')[0]!;

    fixtures = {
      totalProfiles: stats.profiles,
      topSkill: skills[0]!.value,
      secondSkill: skills[1]?.value ?? skills[0]!.value,
      keyword: word,
      keywordPrefix: word.slice(0, Math.max(3, word.length - 2)),
      titleFragment: titles[0]!.value.split(' ').pop()!,
    };
  });

  after(async () => {
    await engine.close();
  });

  it('returns every profile when nothing is asked for', async () => {
    const result = await engine.search(query());
    assert.equal(result.total, fixtures.totalProfiles);
    assert.equal(result.items.length, Math.min(20, fixtures.totalProfiles));
    assert.equal(result.page, 1);
  });

  it('narrows the result set with a keyword', async () => {
    const all = await engine.search(query());
    const keyword = await engine.search(query({ q: fixtures.keyword }));
    assert.ok(keyword.total > 0, `expected hits for "${fixtures.keyword}"`);
    assert.ok(keyword.total < all.total, 'a keyword must narrow the set');
  });

  it('ranks by relevance and returns a highlight', async () => {
    const result = await engine.search(query({ q: fixtures.keyword }));
    const scores = result.items.map((i) => i.score ?? 0);
    assert.deepEqual(scores, [...scores].sort((a, b) => b - a), 'scores must descend');
    assert.ok(result.items.some((i) => i.highlight?.includes('<mark>')));
  });

  it('prefix-matches, so a partial word still finds the term', async () => {
    const full = await engine.search(query({ q: fixtures.keyword }));
    const partial = await engine.search(query({ q: fixtures.keywordPrefix }));
    assert.ok(partial.total > 0, `expected hits for the prefix "${fixtures.keywordPrefix}"`);
    assert.ok(
      partial.total >= full.total,
      'a prefix must match at least everything the full word matches',
    );
  });

  it('filters by skill', async () => {
    const result = await engine.search(query({ filters: { skills: [fixtures.topSkill] } }));
    assert.ok(result.total > 0);
    // Every returned profile must actually carry the skill.
    for (const item of result.items) {
      const full = await engine.getProfile(item.id);
      assert.ok(full?.skills.includes(fixtures.topSkill), `${item.fullName} is missing the skill`);
    }
  });

  it('combines two filters with AND', async () => {
    const skillOnly = await engine.search(query({ filters: { skills: [fixtures.topSkill] } }));
    const both = await engine.search(
      query({ filters: { skills: [fixtures.topSkill], jobTitle: [fixtures.titleFragment] } }),
    );
    assert.ok(both.total <= skillOnly.total, 'adding a filter must not widen the set');
  });

  it('treats skillMatch=all as an intersection of skillMatch=any', async () => {
    const filters = { skills: [fixtures.topSkill, fixtures.secondSkill] };
    const any = await engine.search(query({ filters, skillMatch: 'any' }));
    const all = await engine.search(query({ filters, skillMatch: 'all' }));
    assert.ok(all.total <= any.total);
  });

  it('respects the experience range', async () => {
    const result = await engine.search(query({ filters: { minExperience: 10, maxExperience: 15 } }));
    assert.ok(result.total > 0);
    for (const item of result.items) {
      assert.ok(item.yearsExperience !== null);
      assert.ok(item.yearsExperience >= 10 && item.yearsExperience <= 15);
    }
  });

  it('sorts by experience on request', async () => {
    const result = await engine.search(query({ sort: 'experience_desc' }));
    const years = result.items.map((i) => i.yearsExperience ?? -1);
    assert.deepEqual(years, [...years].sort((a, b) => b - a));
  });

  it('paginates without repeating a profile across pages', async () => {
    const first = await engine.search(query({ limit: 10, page: 1 }));
    const second = await engine.search(query({ limit: 10, page: 2 }));
    const overlap = first.items.filter((i) => second.items.some((j) => j.id === i.id));
    assert.equal(overlap.length, 0, 'pages must not share rows');
    assert.equal(first.total, second.total);
  });

  it('returns an empty set — not an error — for a keyword nobody matches', async () => {
    const result = await engine.search(query({ q: 'zzzqqqxxnotarealword' }));
    assert.equal(result.total, 0);
    assert.deepEqual(result.items, []);
  });

  it('survives hostile keyword input', async () => {
    for (const q of ['"', '*', 'a OR b', 'NEAR(x y)', "'; DROP TABLE profiles; --", '((']) {
      await assert.doesNotReject(() => engine.search(query({ q })), `crashed on ${q}`);
    }
    // The table is still there.
    assert.ok((await engine.stats()).profiles > 0);
  });

  it('returns facet values with descending counts', async () => {
    const facets = await engine.facets('skills', { limit: 10 });
    assert.ok(facets.length > 0);
    const counts = facets.map((f) => f.count);
    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  });

  it('narrows facets by a typed prefix', async () => {
    const term = fixtures.topSkill.slice(0, 4);
    const facets = await engine.facets('skills', { q: term, limit: 10 });
    assert.ok(facets.length > 0);
    assert.ok(facets.every((f) => f.value.includes(term)));
  });

  it('suggests skills, titles, companies and names for a prefix', async () => {
    const term = fixtures.topSkill.slice(0, 4);
    const suggestions = await engine.suggest(term, 8);
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((s) => s.value.includes(term)));
    // Skills lead the list — they are the most useful thing to search for.
    assert.equal(suggestions[0]!.type, 'skill');
  });

  it('returns no suggestions for a term too short to be useful', async () => {
    assert.deepEqual(await engine.suggest('e', 8), []);
    assert.deepEqual(await engine.suggest('  ', 8), []);
  });

  it('attaches an execution trace only when explain is requested', async () => {
    const plain = await engine.search(query({ q: fixtures.keyword }));
    assert.equal(plain.explain, undefined);

    const explained = await engine.search(
      query({ q: fixtures.keyword, filters: { skills: [fixtures.topSkill] }, explain: true }),
    );
    assert.ok(explained.explain);
    assert.equal(explained.explain.keyword?.parsed, `"${fixtures.keyword}" *`);
    assert.equal(explained.explain.ranking.function, 'bm25');
    assert.deepEqual(
      explained.explain.filters.map((f) => f.field),
      ['skill'],
    );
    assert.match(explained.explain.query, /profiles_fts MATCH/);
  });

  it('returns the full document for a known id, and null otherwise', async () => {
    const [first] = (await engine.search(query({ limit: 1 }))).items;
    const profile = await engine.getProfile(first!.id);
    assert.equal(profile?.id, first!.id);
    assert.ok(Array.isArray(profile?.experience));
    assert.equal(await engine.getProfile('does-not-exist'), null);
  });
});
