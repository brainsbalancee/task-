import type {
  DatasetStats,
  FacetField,
  FacetValue,
  Profile,
  SearchParams,
  SearchResponse,
  Suggestion,
} from './types';

/**
 * The single place the frontend talks to the backend.
 *
 * Defaults to the same-origin `/api` prefix, which Vite proxies to the API in
 * development and a reverse proxy serves in production. `VITE_API_BASE_URL`
 * overrides it when the two are deployed to different hosts.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

/** An API error carrying the backend's structured `error` payload. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = 'error',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    // An aborted request is a normal part of debounced search, not a failure.
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'network_unreachable', 'network');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: { message?: string; code?: string } }
      | null;
    throw new ApiError(
      response.status,
      body?.error?.message ?? response.statusText,
      body?.error?.code ?? 'error',
    );
  }

  return (await response.json()) as T;
}

/**
 * Serialises search state into a query string.
 *
 * Empty values are omitted entirely, so the URL stays readable and two
 * equivalent searches always produce the same string (which keeps the
 * browser-history entries and any future caching well-behaved).
 */
export function buildSearchQuery(params: SearchParams): string {
  const query = new URLSearchParams();

  if (params.q.trim()) query.set('q', params.q.trim());

  for (const [key, value] of Object.entries(params.filters)) {
    if (Array.isArray(value)) {
      if (value.length > 0) query.set(key, value.join(','));
    } else if (value) {
      query.set(key, value);
    }
  }

  if (params.filters.skill.length > 1 && params.skillMatch === 'all') {
    query.set('skillMatch', 'all');
  }
  if (params.explain) query.set('explain', '1');
  if (params.sort !== 'relevance') query.set('sort', params.sort);
  if (params.page > 1) query.set('page', String(params.page));
  if (params.limit !== 20) query.set('limit', String(params.limit));

  return query.toString();
}

export const api = {
  search(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse> {
    return request<SearchResponse>(`/search?${buildSearchQuery(params)}`, signal);
  },

  facets(
    field: FacetField,
    options: { q?: string; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<{ data: FacetValue[] }> {
    const query = new URLSearchParams({ field });
    if (options.q) query.set('q', options.q);
    if (options.limit) query.set('limit', String(options.limit));
    return request<{ data: FacetValue[] }>(`/facets?${query}`, signal);
  },

  profile(id: string, signal?: AbortSignal): Promise<{ data: Profile }> {
    return request<{ data: Profile }>(`/profiles/${encodeURIComponent(id)}`, signal);
  },

  suggest(q: string, limit = 8, signal?: AbortSignal): Promise<{ data: Suggestion[] }> {
    const query = new URLSearchParams({ q, limit: String(limit) });
    return request<{ data: Suggestion[] }>(`/suggest?${query}`, signal);
  },

  stats(signal?: AbortSignal): Promise<{ data: DatasetStats }> {
    return request<{ data: DatasetStats }>('/stats', signal);
  },

  /** Raw passthrough used by the in-app API playground. */
  async raw(path: string, signal?: AbortSignal): Promise<{ status: number; body: unknown; ms: number }> {
    const started = performance.now();
    const response = await fetch(`${BASE_URL}${path}`, { signal, headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => null);
    return { status: response.status, body, ms: Math.round((performance.now() - started) * 10) / 10 };
  },
};

/** The API origin the client is talking to — shown in the playground. */
export const apiBaseUrl = BASE_URL;
