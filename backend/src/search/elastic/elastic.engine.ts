import { Client, type estypes } from '@elastic/elasticsearch';
import { config } from '../../config.js';
import type { Profile, ProfileSummary } from '../../domain/profile.js';
import { toIndexDocument } from '../../etl/normalize.js';
import type {
  DatasetStats,
  FacetField,
  FacetValue,
  SearchEngine,
  SearchQuery,
  SearchResult,
  SortKey,
  Suggestion,
} from '../engine.js';
import { FIELD_BOOSTS, INDEX_SETTINGS } from './mapping.js';

/** Keyword field backing each facet / exact filter. */
const FACET_FIELD: Record<FacetField, string> = {
  skills: 'skillList',
  jobTitle: 'jobTitle',
  company: 'companyName',
  industry: 'industryName',
  country: 'country',
  level: 'levels',
  degree: 'degrees',
  school: 'schools',
};

function makeClient(): Client {
  return new Client({ node: config.elastic.node, requestTimeout: 10_000 });
}

/** Profile -> indexable document (analysed text + filter/sort fields + payload). */
function toEsDocument(p: Profile) {
  return {
    ...toIndexDocument(p),
    skillList: p.skills,
    jobTitle: p.jobTitle,
    companyName: p.company.name,
    industryName: p.industry,
    country: p.location.country,
    levels: p.jobTitleLevels,
    degrees: [...new Set(p.education.flatMap((e) => e.degrees))],
    schools: p.education.map((e) => e.school).filter((s): s is string => s !== null),
    companies: p.experience.map((e) => e.company).filter((c): c is string => c !== null),
    yearsExperience: p.yearsExperience,
    connections: p.connections,
    skillCount: p.skills.length,
    fullNameSort: p.fullName,
    document: p,
  };
}

/** Drops and recreates the index, then bulk-loads every profile. */
export async function rebuildElasticIndex(profiles: Profile[]): Promise<void> {
  const client = makeClient();
  const index = config.elastic.index;

  if (await client.indices.exists({ index })) {
    await client.indices.delete({ index });
  }
  await client.indices.create({ index, ...INDEX_SETTINGS });

  const operations = profiles.flatMap((p) => [{ index: { _index: index, _id: p.id } }, toEsDocument(p)]);
  const result = await client.bulk({ refresh: true, operations });
  if (result.errors) {
    const firstError = result.items.find((i) => i.index?.error)?.index?.error;
    throw new Error(`Bulk index failed: ${JSON.stringify(firstError)}`);
  }

  await client.close();
}

/**
 * Elasticsearch search engine — the drop-in alternative to `SqliteSearchEngine`.
 *
 * Same query object in, same `SearchResult` out. Enable it with
 * `SEARCH_ENGINE=elastic`; nothing above `src/search` changes.
 */
export class ElasticSearchEngine implements SearchEngine {
  readonly name = 'elasticsearch';
  private client = makeClient();

  async init(): Promise<void> {
    try {
      await this.client.ping();
    } catch {
      throw new Error(
        `Cannot reach Elasticsearch at ${config.elastic.node}\n` +
          `Start it with "npm run es:up" from the repo root, or set SEARCH_ENGINE=sqlite.`,
      );
    }
    const exists = await this.client.indices.exists({ index: config.elastic.index });
    if (!exists) {
      throw new Error(
        `Elasticsearch index "${config.elastic.index}" does not exist.\n` +
          `Build it first:  npm run ingest -- --elastic`,
      );
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const started = performance.now();
    const { filters } = query;

    // `must` scores, `filter` only narrows (no scoring, and cacheable).
    const must: estypes.QueryDslQueryContainer[] = [];
    const filter: estypes.QueryDslQueryContainer[] = [];
    const mustNot: estypes.QueryDslQueryContainer[] = [];

    if (query.q?.trim()) {
      must.push({
        bool: {
          should: [
            // Whole-term matches carry the field boosts.
            { multi_match: { query: query.q, fields: FIELD_BOOSTS, type: 'best_fields' } },
            // Type-ahead: the last word may still be a prefix. Scored lower.
            {
              multi_match: {
                query: query.q,
                fields: ['name^4', 'title^3', 'skills^2', 'company'],
                type: 'phrase_prefix',
              },
            },
          ],
          minimum_should_match: 1,
        },
      });
    }

    if (filters.skills.length > 0) {
      if (query.skillMatch === 'all') {
        for (const skill of filters.skills) filter.push({ term: { skillList: skill } });
      } else {
        filter.push({ terms: { skillList: filters.skills } });
      }
    }

    // Substring-style filters use `match_phrase` on the analysed field, which is
    // the ES equivalent of the SQL `LIKE %value%` used by the SQLite engine.
    if (filters.jobTitle.length > 0) {
      filter.push({
        bool: {
          should: filters.jobTitle.map((t) => ({ match_phrase: { title: t } })),
          minimum_should_match: 1,
        },
      });
    }
    if (filters.company.length > 0) {
      filter.push({
        bool: {
          should: filters.company.map((c) => ({ match_phrase: { company: c } })),
          minimum_should_match: 1,
        },
      });
    }
    if (filters.school.length > 0) {
      filter.push({
        bool: {
          should: filters.school.map((s) => ({ match_phrase: { education: s } })),
          minimum_should_match: 1,
        },
      });
    }

    if (filters.industry.length > 0) filter.push({ terms: { industryName: filters.industry } });
    if (filters.country.length > 0) filter.push({ terms: { country: filters.country } });
    if (filters.level.length > 0) filter.push({ terms: { levels: filters.level } });
    if (filters.degree.length > 0) filter.push({ terms: { degrees: filters.degree } });

    if (filters.minExperience !== null || filters.maxExperience !== null) {
      filter.push({
        range: {
          yearsExperience: {
            ...(filters.minExperience !== null ? { gte: filters.minExperience } : {}),
            ...(filters.maxExperience !== null ? { lte: filters.maxExperience } : {}),
          },
        },
      });
    }

    const from = (query.page - 1) * query.limit;
    const response = await this.client.search({
      index: config.elastic.index,
      from,
      size: query.limit,
      track_total_hits: true,
      query: { bool: { must, filter, must_not: mustNot } },
      sort: this.buildSort(query.sort),
      highlight: {
        pre_tags: ['<mark>'],
        post_tags: ['</mark>'],
        fields: { summary: { fragment_size: 160, number_of_fragments: 1 }, title: {}, skills: {} },
      },
      // The stored payload is fetched separately per hit only for the fields the
      // list view needs; `document` is excluded to keep responses small.
      _source_excludes: ['document.experience', 'document.education', 'document.interests'],
    });

    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    const items: ProfileSummary[] = response.hits.hits.map((hit) => {
      const src = hit._source as Record<string, unknown>;
      const doc = (src.document ?? {}) as Partial<Profile>;
      const highlightField = hit.highlight?.summary?.[0] ?? hit.highlight?.title?.[0] ?? null;
      return {
        id: hit._id!,
        fullName: (src.fullNameSort as string) ?? doc.fullName ?? 'unknown',
        jobTitle: (src.jobTitle as string | null) ?? null,
        company: (src.companyName as string | null) ?? null,
        industry: (src.industryName as string | null) ?? null,
        locationName: doc.location?.name ?? null,
        country: (src.country as string | null) ?? null,
        yearsExperience: (src.yearsExperience as number | null) ?? null,
        connections: (src.connections as number | null) ?? null,
        linkedinUrl: doc.linkedinUrl ?? null,
        jobTitleLevels: (src.levels as string[]) ?? [],
        skills: ((src.skillList as string[]) ?? []).slice(0, 12),
        skillCount: (src.skillCount as number) ?? 0,
        topSchool: ((src.schools as string[]) ?? [])[0] ?? null,
        topDegree: ((src.degrees as string[]) ?? [])[0] ?? null,
        summary: doc.summary ?? null,
        score: hit._score ?? null,
        highlight: highlightField,
      };
    });

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      tookMs: Math.round((performance.now() - started) * 100) / 100,
      engine: this.name,
      ...(query.explain
        ? {
            explain: {
              engine: this.name,
              keyword: query.q
                ? {
                    input: query.q,
                    parsed: JSON.stringify(must),
                    note: 'best_fields for whole terms plus phrase_prefix for the trailing word.',
                  }
                : null,
              ranking: {
                function: query.sort === 'relevance' ? '_score (BM25)' : query.sort,
                note: 'Field boosts mirror the SQLite BM25 column weights.',
                weights: FIELD_BOOSTS.map((boost) => {
                  const [field, weight] = boost.split('^');
                  return { field: field!, weight: Number(weight ?? 1) };
                }),
              },
              filters: filter.map((clause, i) => ({
                field: `filter[${i}]`,
                values: [],
                predicate: JSON.stringify(clause),
              })),
              filterLogic:
                'Filters run in filter context (no scoring, cacheable); the keyword scores in must context.',
              sort: JSON.stringify(this.buildSort(query.sort)),
              query: JSON.stringify({ bool: { must, filter, must_not: mustNot } }, null, 2),
            },
          }
        : {}),
    };
  }

  /**
   * Type-ahead across the same four sources as the SQLite engine, using terms
   * aggregations for the keyword fields and a phrase-prefix match for names.
   */
  async suggest(q: string, limit: number): Promise<Suggestion[]> {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];

    const perType = Math.max(2, Math.ceil(limit / 3));
    const include = `${escapeRegex(term)}.*|.* ${escapeRegex(term)}.*`;

    const res = await this.client.search({
      index: config.elastic.index,
      size: perType,
      _source: ['fullNameSort'],
      query: { match_phrase_prefix: { name: term } },
      aggs: {
        skill: { terms: { field: 'skillList', size: perType, include } },
        title: { terms: { field: 'jobTitle', size: perType, include } },
        company: { terms: { field: 'companyName', size: perType, include } },
      },
    });

    const out: Suggestion[] = [];
    for (const type of ['skill', 'title', 'company'] as const) {
      const buckets =
        (res.aggregations?.[type] as { buckets: { key: string; doc_count: number }[] })?.buckets ??
        [];
      for (const b of buckets) out.push({ value: b.key, type, count: b.doc_count });
    }
    for (const hit of res.hits.hits) {
      const name = (hit._source as { fullNameSort?: string })?.fullNameSort;
      if (name) out.push({ value: name, type: 'name', count: 1 });
    }

    const rank: Record<Suggestion['type'], number> = { skill: 0, title: 1, company: 2, name: 3 };
    return out.sort((a, b) => rank[a.type] - rank[b.type] || b.count - a.count).slice(0, limit);
  }

  private buildSort(sort: SortKey): estypes.SortCombinations[] {
    switch (sort) {
      case 'experience_desc':
        return [{ yearsExperience: { order: 'desc', missing: '_last' } }];
      case 'experience_asc':
        return [{ yearsExperience: { order: 'asc', missing: '_last' } }];
      case 'connections_desc':
        return [{ connections: { order: 'desc', missing: '_last' } }];
      case 'name_asc':
        return [{ fullNameSort: { order: 'asc' } }];
      default:
        return [{ _score: { order: 'desc' } }, { connections: { order: 'desc', missing: '_last' } }];
    }
  }

  async getProfile(id: string): Promise<Profile | null> {
    try {
      const res = await this.client.get({ index: config.elastic.index, id });
      return ((res._source as Record<string, unknown>).document as Profile) ?? null;
    } catch {
      return null;
    }
  }

  async facets(field: FacetField, opts: { q?: string; limit?: number }): Promise<FacetValue[]> {
    const esField = FACET_FIELD[field];
    const limit = Math.min(opts.limit ?? 50, 500);
    const term = opts.q?.trim().toLowerCase();

    const res = await this.client.search({
      index: config.elastic.index,
      size: 0,
      aggs: {
        values: {
          terms: {
            field: esField,
            size: limit,
            order: { _count: 'desc' },
            ...(term ? { include: `.*${escapeRegex(term)}.*` } : {}),
          },
        },
      },
    });

    const buckets = (res.aggregations?.values as { buckets: { key: string; doc_count: number }[] })
      ?.buckets ?? [];
    return buckets.map((b) => ({ value: b.key, count: b.doc_count }));
  }

  async stats(): Promise<DatasetStats> {
    const res = await this.client.search({
      index: config.elastic.index,
      size: 0,
      track_total_hits: true,
      aggs: {
        skills: { cardinality: { field: 'skillList' } },
        companies: { cardinality: { field: 'companyName' } },
        countries: { cardinality: { field: 'country' } },
        schools: { cardinality: { field: 'schools' } },
      },
    });
    const card = (k: string) => Math.round((res.aggregations?.[k] as { value: number })?.value ?? 0);
    const total =
      typeof res.hits.total === 'number' ? res.hits.total : (res.hits.total?.value ?? 0);
    return {
      profiles: total,
      skills: card('skills'),
      companies: card('companies'),
      countries: card('countries'),
      experiences: 0,
      educations: card('schools'),
      engine: this.name,
    };
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

/** ES `include` takes a Lucene regex; neutralise user-supplied metacharacters. */
function escapeRegex(value: string): string {
  return value.replace(/[.?+*|{}[\]()"\\#@&<>~^$]/g, (c) => `\\${c}`);
}
