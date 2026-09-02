import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { DatasetStats } from '../api/types';

/** Dataset totals for the landing-page counters. Fetched once. */
export function useStats() {
  const [stats, setStats] = useState<DatasetStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .stats(controller.signal)
      .then((response) => setStats(response.data))
      .catch(() => setStats(null));
    return () => controller.abort();
  }, []);

  return stats;
}
