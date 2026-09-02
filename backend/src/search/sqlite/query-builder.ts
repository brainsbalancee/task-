import type { SearchQuery, SortKey } from '../engine.js';

/**
 * Turns raw user input into a safe FTS5 MATCH expression.
 *
 * Why this exists: FTS5 has its own query language (`AND`, `OR`, `NOT`, `NEAR`,
 * `*`, `:`, `^`). Passing user text straight into MATCH means a stray quote or
 * a bare `AND` throws a parse error at the caller, and hostile input can steer
 * the query. So the input is tokenised, every token is re-quoted (which makes
 * operators inert), and the expression is rebuilt from scratch.
 *
 * Semantics produced:
 *   golang engineer   ->  "golang" * AND "engineer" *   (all terms, prefix-matched)
 *   "product manager" ->  "product manager"             (exact phrase, kept intact)
 *   go -recruiter     ->  "go" * NOT "recruiter"        (leading - excludes)
 *
 * Prefix matching (`*`) is what makes the UI feel like type-ahead: "engin"
 * already matches "engineer" / "engineering".
 */
export function toMatchExpression(raw: string): string | null {
  const clauses: string[] = [];
  const excluded: string[] = [];

  // Pull out "quoted phrases" first, then whatever is left becomes single terms.
  const phraseRe = /(-?)"([^"]+)"/g;
  let rest = raw;
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(raw)) !== null) {
    const phrase = sanitizeToken(m[2]!);
    if (!phrase) continue;
    (m[1] === '-' ? excluded : clauses).push(`"${phrase}"`);
  }
  rest = raw.replace(phraseRe, ' ');

  for (const word of rest.split(/[\s,]+/)) {
    const negated = word.startsWith('-');
    const token = sanitizeToken(negated ? word.slice(1) : word);
    if (!token) continue;
    if (negated) excluded.push(`"${token}"`);
    // Trailing `*` = prefix match, backed by the prefix index declared in schema.sql.
    else clauses.push(`"${token}" *`);
  }

  if (clauses.length === 0 && excluded.length === 0) return null;
  // A query that only excludes terms has no positive set to subtract from.
  if (clauses.length === 0) return null;

  const positive = clauses.join(' AND ');
  return excluded.length > 0 ? `${positive} NOT (${excluded.join(' OR ')})` : positive;
}

/** Strips FTS5 syntax and double quotes, leaving a literal token. */
function sanitizeToken(input: string): string {
  return input
    .replace(/"/g, ' ')
    .replace(/[*^:(){}[\]~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * BM25 column weights, in the column order declared in `schema.sql`.
 * A name hit is worth ~10x the same word appearing in a free-text summary.
 */
export const BM25_WEIGHTS = [
  0.0, // profile_id (UNINDEXED)
  10.0, // name
  8.0, // title
  4.0, // company
  6.0, // skills
  3.0, // education
  3.0, // experience
  2.0, // location
  2.0, // industry
  1.0, // summary
] as const;

export interface WhereClause {
  /** Query-parameter name this predicate came from, used by `explain`. */
  field: string;
  sql: string;
  params: unknown[];
}

/**
 * Builds the filter predicates.
 *
 * Every value is bound as a parameter — no user input is ever concatenated into
 * SQL. Placeholders are generated from array *lengths*, which is data we
 * control, not data the user supplies.
 *
 * Filter semantics:
 *   - OR inside one field  (skill=go&skill=rust  -> go OR rust)
 *   - AND across fields    (skill + country      -> both must hold)
 *   - `skillMatch=all` flips skills to AND via a HAVING count.
 */
export function buildFilters(query: SearchQuery): WhereClause[] {
  const { filters } = query;
  const clauses: WhereClause[] = [];

  const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

  // --- Skills: link-table semi-join, index-backed ---------------------------
  if (filters.skills.length > 0) {
    if (query.skillMatch === 'all') {
      clauses.push({
        field: 'skill',
        sql: `(
          SELECT COUNT(DISTINCT s.name)
          FROM profile_skills ps JOIN skills s ON s.id = ps.skill_id
          WHERE ps.profile_id = p.id AND s.name IN (${placeholders(filters.skills.length)})
        ) = ?`,
        params: [...filters.skills, filters.skills.length],
      });
    } else {
      clauses.push({
        field: 'skill',
        sql: `EXISTS (
          SELECT 1 FROM profile_skills ps JOIN skills s ON s.id = ps.skill_id
          WHERE ps.profile_id = p.id AND s.name IN (${placeholders(filters.skills.length)})
        )`,
        params: [...filters.skills],
      });
    }
  }

  // --- Job title: substring match, so "engineer" catches "software engineer" -
  if (filters.jobTitle.length > 0) {
    clauses.push({
      field: 'title',
      sql: `(${filters.jobTitle.map(() => `p.job_title LIKE ?`).join(' OR ')})`,
      params: filters.jobTitle.map((t) => `%${escapeLike(t)}%`),
    });
  }

  // --- Company: current employer OR anywhere in the work history ------------
  if (filters.company.length > 0) {
    const ors = filters.company.map(() => `p.company_name LIKE ?`).join(' OR ');
    clauses.push({
      field: 'company',
      sql: `((${ors}) OR EXISTS (
        SELECT 1 FROM experiences ex
        WHERE ex.profile_id = p.id AND (${filters.company.map(() => `ex.company LIKE ?`).join(' OR ')})
      ))`,
      params: [
        ...filters.company.map((c) => `%${escapeLike(c)}%`),
        ...filters.company.map((c) => `%${escapeLike(c)}%`),
      ],
    });
  }

  // --- Controlled vocabularies: exact match --------------------------------
  if (filters.industry.length > 0) {
    clauses.push({
      field: 'industry',
      sql: `(p.industry IN (${placeholders(filters.industry.length)})
             OR p.company_industry IN (${placeholders(filters.industry.length)}))`,
      params: [...filters.industry, ...filters.industry],
    });
  }

  if (filters.country.length > 0) {
    clauses.push({
      field: 'country',
      sql: `p.location_country IN (${placeholders(filters.country.length)})`,
      params: [...filters.country],
    });
  }

  if (filters.level.length > 0) {
    clauses.push({
      field: 'level',
      sql: `EXISTS (
        SELECT 1 FROM profile_levels pl
        WHERE pl.profile_id = p.id AND pl.level IN (${placeholders(filters.level.length)})
      )`,
      params: [...filters.level],
    });
  }

  if (filters.degree.length > 0) {
    clauses.push({
      field: 'degree',
      sql: `EXISTS (
        SELECT 1 FROM profile_degrees pd
        WHERE pd.profile_id = p.id AND pd.degree IN (${placeholders(filters.degree.length)})
      )`,
      params: [...filters.degree],
    });
  }

  if (filters.school.length > 0) {
    clauses.push({
      field: 'school',
      sql: `EXISTS (
        SELECT 1 FROM educations ed
        WHERE ed.profile_id = p.id AND (${filters.school.map(() => `ed.school LIKE ?`).join(' OR ')})
      )`,
      params: filters.school.map((s) => `%${escapeLike(s)}%`),
    });
  }

  // --- Numeric range -------------------------------------------------------
  if (filters.minExperience !== null) {
    clauses.push({ field: 'minExp', sql: `p.years_experience >= ?`, params: [filters.minExperience] });
  }
  if (filters.maxExperience !== null) {
    clauses.push({ field: 'maxExp', sql: `p.years_experience <= ?`, params: [filters.maxExperience] });
  }

  return clauses;
}

/** `%` and `_` are LIKE wildcards; escape them so a literal search stays literal. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/**
 * ORDER BY fragment. `relevance` only means anything when a keyword was given;
 * without one it degrades to a stable, deterministic ordering (connections then
 * id) so pagination never shows the same profile on two pages.
 */
export function buildOrderBy(sort: SortKey, hasKeyword: boolean): string {
  switch (sort) {
    case 'experience_desc':
      return `p.years_experience DESC NULLS LAST, p.id`;
    case 'experience_asc':
      return `p.years_experience ASC NULLS LAST, p.id`;
    case 'connections_desc':
      return `p.connections DESC NULLS LAST, p.id`;
    case 'name_asc':
      return `p.full_name ASC, p.id`;
    case 'relevance':
    default:
      return hasKeyword
        ? `m.score DESC, p.connections DESC NULLS LAST, p.id`
        : `p.connections DESC NULLS LAST, p.id`;
  }
}
