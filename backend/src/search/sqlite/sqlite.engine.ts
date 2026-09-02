import fs from 'node:fs';
import Database from 'better-sqlite3';
import type { Profile, ProfileSummary } from '../../domain/profile.js';
import type {
  DatasetStats,
  FacetField,
  FacetValue,
  SearchEngine,
  SearchExplain,
  SearchQuery,
  SearchResult,
  Suggestion,
} from '../engine.js';
import {
  BM25_WEIGHTS,
  buildFilters,
  buildOrderBy,
  toMatchExpression,
  type WhereClause,
} from './query-builder.js';

/**
 * The indexed FTS5 columns, in schema order (excluding the UNINDEXED id).
 * Kept beside the weights so `explain` can pair each field with its weight.
 */
const FTS_COLUMNS = [
  'name',
  'title',
  'company',
  'skills',
  'education',
  'experience',
  'location',
  'industry',
  'summary',
] as const;

/** Columns the list view needs. `document` is deliberately excluded — it is large. */
const LIST_COLUMNS = `
  p.id, p.full_name, p.job_title, p.company_name, p.industry,
  p.location_name, p.location_country, p.years_experience, p.connections,
  p.linkedin_url, p.skill_count, p.top_school, p.top_degree, p.summary
`;

interface ListRow {
  id: string;
  full_name: string;
  job_title: string | null;
  company_name: string | null;
  industry: string | null;
  location_name: string | null;
  location_country: string | null;
  years_experience: number | null;
  connections: number | null;
  linkedin_url: string | null;
  skill_count: number;
  top_school: string | null;
  top_degree: string | null;
  summary: string | null;
  score: number | null;
  highlight: string | null;
  skills: string | null;
  levels: string | null;
}

/** Maps a facet name to the SQL that produces `(value, count)` pairs. */
const FACET_SOURCES: Record<FacetField, { from: string; column: string }> = {
  skills: {
    from: `profile_skills ps JOIN skills s ON s.id = ps.skill_id`,
    column: `s.name`,
  },
  jobTitle: { from: `profiles p`, column: `p.job_title` },
  company: { from: `profiles p`, column: `p.company_name` },
  industry: { from: `profiles p`, column: `p.industry` },
  country: { from: `profiles p`, column: `p.location_country` },
  level: { from: `profile_levels pl`, column: `pl.level` },
  degree: { from: `profile_degrees pd`, column: `pd.degree` },
  school: { from: `educations ed`, column: `ed.school` },
};

/**
 * SQLite + FTS5 search engine.
 *
 * Keyword matching runs against the FTS5 inverted index and is ranked with
 * BM25; filters run as indexed predicates on the relational tables. The two
 * are combined in one statement, so SQLite plans a single pass instead of the
 * app fetching a candidate set and filtering it in JavaScript.
 */
export class SqliteSearchEngine implements SearchEngine {
  readonly name = 'sqlite-fts5';
  private db!: Database.Database;

  constructor(private readonly dbPath: string) {}

  async init(): Promise<void> {
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(
        `SQLite database not found at ${this.dbPath}\n` +
          `Build it first:  npm run ingest`,
      );
    }
    this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
    this.db.pragma('journal_mode = WAL');

    const { count } = this.db.prepare(`SELECT COUNT(*) AS count FROM profiles`).get() as {
      count: number;
    };
    if (count === 0) {
      throw new Error(`SQLite database at ${this.dbPath} is empty. Run: npm run ingest`);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const started = performance.now();

    const match = query.q ? toMatchExpression(query.q) : null;
    const hasKeyword = match !== null;
    const filters = buildFilters(query);

    // The FTS match is a CTE so BM25 is computed once, then joined to the
    // relational filters. `-bm25()` because FTS5 returns lower = better.
    const cte = hasKeyword
      ? `WITH m AS (
           SELECT profile_id,
                  -bm25(profiles_fts, ${BM25_WEIGHTS.join(', ')}) AS score,
                  snippet(profiles_fts, -1, '<mark>', '</mark>', '…', 14) AS highlight
           FROM profiles_fts
           WHERE profiles_fts MATCH ?
         )`
      : '';
    const join = hasKeyword ? `JOIN m ON m.profile_id = p.id` : '';
    const matchParams = hasKeyword ? [match] : [];

    const whereSql = filters.length > 0 ? `WHERE ${filters.map((c) => c.sql).join(' AND ')}` : '';
    const whereParams = filters.flatMap((c) => c.params);

    const countSql = `${cte} SELECT COUNT(*) AS total FROM profiles p ${join} ${whereSql}`;
    const { total } = this.db.prepare(countSql).get(...matchParams, ...whereParams) as {
      total: number;
    };

    const offset = (query.page - 1) * query.limit;
    const scoreSelect = hasKeyword ? `m.score, m.highlight` : `NULL AS score, NULL AS highlight`;

    // Skills for the list view are aggregated in SQL (capped at 12) rather than
    // by opening each profile's JSON document.
    const listSql = `
      ${cte}
      SELECT ${LIST_COLUMNS}, ${scoreSelect},
        (
          SELECT group_concat(name, '|') FROM (
            SELECT s.name FROM profile_skills ps
            JOIN skills s ON s.id = ps.skill_id
            WHERE ps.profile_id = p.id
            ORDER BY s.name LIMIT 12
          )
        ) AS skills,
        (
          SELECT group_concat(pl.level, '|') FROM profile_levels pl WHERE pl.profile_id = p.id
        ) AS levels
      FROM profiles p
      ${join}
      ${whereSql}
      ORDER BY ${buildOrderBy(query.sort, hasKeyword)}
      LIMIT ? OFFSET ?
    `;

    const rows = this.db
      .prepare(listSql)
      .all(...matchParams, ...whereParams, query.limit, offset) as ListRow[];

    return {
      items: rows.map(toSummary),
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.max(1, Math.ceil(total / query.limit)),
      tookMs: Math.round((performance.now() - started) * 100) / 100,
      engine: this.name,
      ...(query.explain
        ? { explain: this.buildExplain(query, match, filters, listSql) }
        : {}),
    };
  }

  /** Human-readable trace of the statement that was just executed. */
  private buildExplain(
    query: SearchQuery,
    match: string | null,
    filters: WhereClause[],
    sql: string,
  ): SearchExplain {
    const filterValues: Record<string, unknown> = {
      skill: query.filters.skills,
      title: query.filters.jobTitle,
      company: query.filters.company,
      industry: query.filters.industry,
      country: query.filters.country,
      level: query.filters.level,
      degree: query.filters.degree,
      school: query.filters.school,
      minExp: query.filters.minExperience,
      maxExp: query.filters.maxExperience,
    };

    return {
      engine: this.name,
      keyword: query.q
        ? {
            input: query.q,
            parsed: match,
            note: match
              ? 'Tokenised and re-quoted, then matched against the FTS5 index. A trailing * is a prefix match.'
              : 'No searchable term after sanitising; the keyword was ignored and all profiles were considered.',
          }
        : null,
      ranking: {
        function: match ? 'bm25' : 'connections DESC',
        note: match
          ? 'BM25 over the FTS5 index, weighted per column so a name hit outranks the same word in a summary.'
          : 'No keyword, so there is nothing to rank by relevance; results fall back to a deterministic order.',
        ...(match
          ? {
              weights: FTS_COLUMNS.map((field, i) => ({
                field,
                weight: BM25_WEIGHTS[i + 1] ?? 0,
              })),
            }
          : {}),
      },
      filters: filters.map((clause) => ({
        field: clause.field,
        values: (filterValues[clause.field] ?? []) as unknown[],
        predicate: clause.sql.replace(/\s+/g, ' ').trim(),
      })),
      filterLogic:
        'Values inside one filter are OR-ed; filters are AND-ed together.' +
        (query.skillMatch === 'all' ? ' skillMatch=all requires every selected skill.' : ''),
      sort: buildOrderBy(query.sort, match !== null).replace(/\s+/g, ' ').trim(),
      query: sql.replace(/\n\s+/g, '\n').trim(),
    };
  }

  /**
   * Type-ahead for the main search box.
   *
   * Draws from four indexed sources at once so a single keystroke can offer a
   * skill, a job title, an employer and a person. Matching is anchored to word
   * starts (`go%` or `% go%`) rather than a bare substring, because a
   * suggestion list built from mid-word matches reads as noise.
   */
  async suggest(q: string, limit: number): Promise<Suggestion[]> {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];

    const escaped = term.replace(/[%_\\]/g, (c) => `\\${c}`);
    const prefix = `${escaped}%`;
    const wordStart = `% ${escaped}%`;
    const perType = Math.max(2, Math.ceil(limit / 3));

    const sources: { type: Suggestion['type']; sql: string }[] = [
      {
        type: 'skill',
        sql: `SELECT s.name AS value, COUNT(*) AS count
              FROM profile_skills ps JOIN skills s ON s.id = ps.skill_id
              WHERE s.name LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\'
              GROUP BY s.name ORDER BY count DESC, LENGTH(s.name) LIMIT ?`,
      },
      {
        type: 'title',
        sql: `SELECT job_title AS value, COUNT(*) AS count FROM profiles
              WHERE job_title IS NOT NULL AND (job_title LIKE ? ESCAPE '\\' OR job_title LIKE ? ESCAPE '\\')
              GROUP BY job_title ORDER BY count DESC, LENGTH(job_title) LIMIT ?`,
      },
      {
        type: 'company',
        sql: `SELECT company_name AS value, COUNT(*) AS count FROM profiles
              WHERE company_name IS NOT NULL AND (company_name LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\')
              GROUP BY company_name ORDER BY count DESC, LENGTH(company_name) LIMIT ?`,
      },
      {
        type: 'name',
        sql: `SELECT full_name AS value, 1 AS count FROM profiles
              WHERE full_name LIKE ? ESCAPE '\\' OR full_name LIKE ? ESCAPE '\\'
              ORDER BY connections DESC NULLS LAST LIMIT ?`,
      },
    ];

    const out: Suggestion[] = [];
    for (const source of sources) {
      const rows = this.db.prepare(source.sql).all(prefix, wordStart, perType) as {
        value: string;
        count: number;
      }[];
      for (const row of rows) out.push({ ...row, type: source.type });
    }

    // Skills and titles are the most useful things to search for, so they lead.
    const rank: Record<Suggestion['type'], number> = { skill: 0, title: 1, company: 2, name: 3 };
    return out
      .sort((a, b) => rank[a.type] - rank[b.type] || b.count - a.count)
      .slice(0, limit);
  }

  async getProfile(id: string): Promise<Profile | null> {
    const row = this.db.prepare(`SELECT document FROM profiles WHERE id = ?`).get(id) as
      | { document: string }
      | undefined;
    return row ? (JSON.parse(row.document) as Profile) : null;
  }

  async facets(field: FacetField, opts: { q?: string; limit?: number }): Promise<FacetValue[]> {
    const source = FACET_SOURCES[field];
    const limit = Math.min(opts.limit ?? 50, 500);
    const term = opts.q?.trim().toLowerCase();

    const where = [`${source.column} IS NOT NULL`, `${source.column} <> ''`];
    const params: unknown[] = [];
    if (term) {
      where.push(`${source.column} LIKE ?`);
      params.push(`%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    }

    // Ordered by frequency so the most useful filter values surface first.
    const sql = `
      SELECT ${source.column} AS value, COUNT(DISTINCT ${
        field === 'skills'
          ? 'ps.profile_id'
          : field === 'level'
            ? 'pl.profile_id'
            : field === 'degree'
              ? 'pd.profile_id'
              : field === 'school'
                ? 'ed.profile_id'
                : 'p.id'
      }) AS count
      FROM ${source.from}
      WHERE ${where.join(' AND ')}
      GROUP BY value
      ORDER BY count DESC, value ASC
      LIMIT ?
    `;
    return this.db.prepare(sql).all(...params, limit) as FacetValue[];
  }

  async stats(): Promise<DatasetStats> {
    const one = (sql: string): number => (this.db.prepare(sql).get() as { n: number }).n;
    return {
      profiles: one(`SELECT COUNT(*) AS n FROM profiles`),
      skills: one(`SELECT COUNT(*) AS n FROM skills`),
      companies: one(
        `SELECT COUNT(DISTINCT company_name) AS n FROM profiles WHERE company_name IS NOT NULL`,
      ),
      countries: one(
        `SELECT COUNT(DISTINCT location_country) AS n FROM profiles WHERE location_country IS NOT NULL`,
      ),
      experiences: one(`SELECT COUNT(*) AS n FROM experiences`),
      educations: one(`SELECT COUNT(*) AS n FROM educations`),
      engine: this.name,
    };
  }

  async close(): Promise<void> {
    this.db?.close();
  }
}

function toSummary(row: ListRow): ProfileSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    jobTitle: row.job_title,
    company: row.company_name,
    industry: row.industry,
    locationName: row.location_name,
    country: row.location_country,
    yearsExperience: row.years_experience,
    connections: row.connections,
    linkedinUrl: row.linkedin_url,
    jobTitleLevels: row.levels ? row.levels.split('|') : [],
    skills: row.skills ? row.skills.split('|') : [],
    skillCount: row.skill_count,
    topSchool: row.top_school,
    topDegree: row.top_degree,
    summary: row.summary,
    score: row.score,
    highlight: row.highlight,
  };
}
