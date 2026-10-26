import { useCallback, useEffect, useState } from 'react';
import { RATE_MAX_AGE_MS, type Rates } from '@/domain/fx';
import { fetchRates, loadCachedRates } from '@/fx';
import { useData } from './DataProvider';

export type RateStatus = 'loading' | 'live' | 'saved' | 'none';

/**
 * Exchange rates for overseas spending: the saved copy right away, then a fresh one when the saved copy is
 * old. Without internet the saved rates keep working; with none at all the person types the rate.
 */
export function useExchangeRates(enabled: boolean) {
  const { db } = useData();
  const [rates, setRates] = useState<Rates | null>(null);
  const [status, setStatus] = useState<RateStatus>('loading');

  const refresh = useCallback(async () => {
    setStatus('loading');
    const fresh = await fetchRates(db);
    if (fresh) {
      setRates(fresh);
      setStatus('live');
    } else {
      setStatus((s) => (s === 'live' ? s : 'saved'));
    }
  }, [db]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadCachedRates(db).then((cached) => {
      if (!alive) return;
      setRates(cached);
      setStatus(cached ? 'saved' : 'none');
      if (!cached || Date.now() - cached.fetchedAt > RATE_MAX_AGE_MS) void refresh();
    });
    return () => { alive = false; };
  }, [enabled, db, refresh]);

  return { rates, status: status === 'saved' && !rates ? ('none' as const) : status, refresh };
}
