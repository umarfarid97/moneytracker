import type { Db } from '@/db/types';
import { ratesFromResponse, type Rates } from '@/domain/fx';

/** Free, key-less daily rates. `rates` holds units of each currency per RM 1. */
const RATES_URL = 'https://open.er-api.com/v6/latest/MYR';
const CACHE_KEY = 'fx_rates';

/** The last rates saved on this device (so prices still convert offline), or null. */
export async function loadCachedRates(db: Db): Promise<Rates | null> {
  const row = await db.get<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', [CACHE_KEY]);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as Rates;
    return parsed && typeof parsed.fetchedAt === 'number' && parsed.perUnit ? parsed : null;
  } catch {
    return null;
  }
}

/** Fetches today's rates and saves them. Returns null (leaving the saved rates alone) when offline or the service fails. */
export async function fetchRates(db: Db, now: number = Date.now()): Promise<Rates | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(RATES_URL, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const rates = ratesFromResponse(await res.json(), now);
    if (!rates) return null;
    await db.run('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [CACHE_KEY, JSON.stringify(rates)]);
    return rates;
  } catch {
    return null;
  }
}
