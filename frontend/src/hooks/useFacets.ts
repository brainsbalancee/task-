import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FacetField, FacetValue } from '../api/types';
import { useDebounced } from './useDebounced';

/**
 * Loads the values for one filter, narrowed by what the user has typed.
 *
 * Options come from the API's facet counts rather than a hard-coded list, so a
 * filter can only ever offer a value that exists in the data — you cannot pick
 * a combination that returns nothing.
 */
export function useFacets(field: FacetField, term: string, enabled: boolean, limit = 40) {
  const [values, setValues] = useState<FacetValue[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedTerm = useDebounced(term, 200);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    setLoading(true);

    api
      .facets(field, { q: debouncedTerm || undefined, limit }, controller.signal)
      .then((response) => {
        setValues(response.data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setValues([]);
        setLoading(false);
      });

    return () => controller.abort();
  }, [field, debouncedTerm, enabled, limit]);

  return { values, loading };
}
