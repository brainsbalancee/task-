import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildSearchQuery } from '../api/client';
import { EMPTY_FILTERS, type Filters, type SearchParams, type SortKey } from '../api/types';
import { useDebounced } from './useDebounced';

const ARRAY_KEYS = [
  'skill',
  'title',
  'company',
  'industry',
  'country',
  'level',
  'degree',
  'school',
] as const satisfies readonly (keyof Filters)[];

const SORT_KEYS: SortKey[] = [
  'relevance',
  'experience_desc',
  'experience_asc',
  'connections_desc',
  'name_asc',
];

/** Restores search state from `?q=…&skill=…` so a search can be shared as a link. */
function readUrl(): { q: string; filters: Filters; skillMatch: 'any' | 'all'; sort: SortKey; page: number } {
  const params = new URLSearchParams(window.location.search);
  const filters: Filters = { ...EMPTY_FILTERS };

  for (const key of ARRAY_KEYS) {
    const raw = params.get(key);
    filters[key] = raw ? raw.split(',').filter(Boolean) : [];
  }
  filters.minExp = params.get('minExp') ?? '';
  filters.maxExp = params.get('maxExp') ?? '';

  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    filters,
    skillMatch: params.get('skillMatch') === 'all' ? 'all' : 'any',
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'relevance',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

/**
 * Owns every input that makes up a search.
 *
 * Three responsibilities live here so the components stay presentational:
 *
 *  - **Debouncing.** `q` updates instantly for the input, but the `params`
 *    object only changes once typing settles.
 *  - **Page reset.** Changing a filter or the sort order returns to page 1;
 *    leaving the user on page 7 of a different result set is a classic bug.
 *  - **URL mirroring.** The current search is written back to the address bar,
 *    so refreshing or sharing the link reproduces it exactly.
 */
export function useSearchState() {
  const initial = useRef(readUrl()).current;

  const [q, setQ] = useState(initial.q);
  const [filters, setFilters] = useState<Filters>(initial.filters);
  const [skillMatch, setSkillMatch] = useState<'any' | 'all'>(initial.skillMatch);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(20);

  const debouncedQ = useDebounced(q, 280);

  // Any change to what is being searched (rather than which page of it) resets
  // pagination. `debouncedQ` is used so the reset lands with the request.
  const isFirstRun = useRef(true);
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setPage(1);
  }, [debouncedQ, filters, skillMatch, sort, limit]);

  const params = useMemo<SearchParams>(
    () => ({ q: debouncedQ, filters, skillMatch, sort, page, limit, explain: true }),
    [debouncedQ, filters, skillMatch, sort, page, limit],
  );

  // Mirror into the URL without adding a history entry per keystroke.
  useEffect(() => {
    const query = buildSearchQuery(params);
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', next);
  }, [params]);

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  /** Adds or removes one skill — used by the chips on each result card. */
  const toggleSkill = useCallback((skill: string) => {
    setFilters((current) => ({
      ...current,
      skill: current.skill.includes(skill)
        ? current.skill.filter((s) => s !== skill)
        : [...current.skill, skill],
    }));
  }, []);

  const reset = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
    setSkillMatch('any');
  }, []);

  const resetAll = useCallback(() => {
    reset();
    setQ('');
    setSort('relevance');
  }, [reset]);

  const activeFilterCount = useMemo(
    () =>
      ARRAY_KEYS.reduce((sum, key) => sum + filters[key].length, 0) +
      (filters.minExp ? 1 : 0) +
      (filters.maxExp ? 1 : 0),
    [filters],
  );

  return {
    q,
    setQ,
    filters,
    setFilter,
    toggleSkill,
    skillMatch,
    setSkillMatch,
    sort,
    setSort,
    page,
    setPage,
    limit,
    setLimit,
    params,
    reset,
    resetAll,
    activeFilterCount,
    /** True while the debounce timer is still pending. */
    typing: q !== debouncedQ,
  };
}
