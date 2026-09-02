import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { ProfileSummary, SearchMeta, SearchParams } from '../api/types';

interface SearchState {
  items: ProfileSummary[];
  meta: SearchMeta | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: SearchState = { items: [], meta: null, loading: true, error: null };

/**
 * Runs a search whenever `params` changes.
 *
 * Two details matter for a type-as-you-search UI:
 *
 *  - **Cancellation.** Each run aborts the previous request, so a slow response
 *    for "eng" can never overwrite the results for "engineer".
 *  - **Sticky results.** The previous result list stays on screen while the next
 *    one loads (dimmed by the caller), instead of flashing an empty state
 *    between every keystroke.
 */
export function useSearch(params: SearchParams) {
  const [state, setState] = useState<SearchState>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    api
      .search(params, controller.signal)
      .then((response) => {
        setState({ items: response.data, meta: response.meta, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return; // superseded by a newer search
        setState({ items: [], meta: null, loading: false, error: err.message });
      });

    return () => controller.abort();
    // `params` is rebuilt as a new object only when its contents actually change.
  }, [params, reloadToken]);

  return { ...state, retry };
}
