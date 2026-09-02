import type { Profile, ProfileSummary } from '../domain/profile.js';

/**
 * The one query object every engine understands.
 *
 * `q` is the free-text keyword. Everything else is a *filter*: filters narrow
 * the candidate set, the keyword ranks what is left. Array filters are OR
 * within a field and AND across fields — the behaviour people expect from a
 * faceted search UI:
 *
 *   skill=[go, rust] & country=[germany]
 *   -> (go OR rust) AND (germany)
 */
export interface SearchQuery {
  q: string | null;
  filters: {
    skills: string[];
    jobTitle: string[];
    company: string[];
    industry: string[];
    country: string[];
    level: string[];
    degree: string[];
    school: string[];
    minExperience: number | null;
    maxExperience: number | null;
  };
  /** `all` requires every listed skill, `any` requires at least one. */
  skillMatch: 'any' | 'all';
  sort: SortKey;
  page: number;
  limit: number;
  /** When true, the response carries a breakdown of how the query was executed. */
  explain: boolean;
}

export type SortKey = 'relevance' | 'experience_desc' | 'experience_asc' | 'connections_desc' | 'name_asc';

export interface SearchResult {
  items: ProfileSummary[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  tookMs: number;
  engine: string;
  /** Present only when `SearchQuery.explain` was set. */
  explain?: SearchExplain;
}

/**
 * A readable trace of how one search was executed.
 *
 * Search relevance is the easiest thing in an app like this to get subtly wrong
 * and never notice. Returning the parsed keyword expression, the exact filter
 * predicates and the ranking weights makes the behaviour inspectable from the
 * outside — during development, in review, and from the UI's API playground.
 */
export interface SearchExplain {
  engine: string;
  keyword: {
    input: string;
    /** The expression actually handed to the index. */
    parsed: string | null;
    note: string;
  } | null;
  ranking: {
    function: string;
    note: string;
    weights?: { field: string; weight: number }[];
  };
  filters: { field: string; values: unknown[]; predicate: string }[];
  filterLogic: string;
  sort: string;
  /** The statement the engine ran (SQL, or the Elasticsearch query DSL). */
  query: string;
}

export interface FacetValue {
  value: string;
  count: number;
}

/** One entry in the search box's type-ahead dropdown. */
export interface Suggestion {
  value: string;
  /** Which part of the index produced it, so the UI can label and route it. */
  type: 'skill' | 'title' | 'company' | 'name';
  count: number;
}

export type FacetField = 'skills' | 'jobTitle' | 'company' | 'industry' | 'country' | 'level' | 'degree' | 'school';

export interface DatasetStats {
  profiles: number;
  skills: number;
  companies: number;
  countries: number;
  experiences: number;
  educations: number;
  engine: string;
}

/**
 * Port implemented by every search backend (SQLite FTS5, Elasticsearch).
 * Controllers depend on this interface only — never on a concrete engine.
 */
export interface SearchEngine {
  readonly name: string;
  /** Throws a descriptive error when the index is missing or unreachable. */
  init(): Promise<void>;
  search(query: SearchQuery): Promise<SearchResult>;
  getProfile(id: string): Promise<Profile | null>;
  /** Values for a filter dropdown, optionally narrowed by a typed prefix. */
  facets(field: FacetField, opts: { q?: string; limit?: number }): Promise<FacetValue[]>;
  /** Mixed type-ahead suggestions for the main search box. */
  suggest(q: string, limit: number): Promise<Suggestion[]>;
  stats(): Promise<DatasetStats>;
  close(): Promise<void>;
}
