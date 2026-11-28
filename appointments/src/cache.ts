// Small cache for slow Google API results (Ads and Search Console reports, the working Ads API version).
// Uses the Cloudflare edge cache (caches.default), shared by all worker instances in a data centre, so a
// report fetched once is instant for the next few minutes. Outside Workers (tests) it just calls fn().
const PREFIX = "https://cache.vocalzz.internal/";

type EdgeCache = { match(key: string): Promise<Response | undefined>; put(key: string, res: Response): Promise<void> };
const edge = (): EdgeCache | null => {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return c?.default ?? null;
};

/** The cached JSON value for `key`, or fn()'s result (stored for `ttlSec` seconds). `fresh` skips the read. */
export async function cachedJson<T>(key: string, ttlSec: number, fn: () => Promise<T>, fresh = false): Promise<T> {
  const cache = edge();
  const url = PREFIX + encodeURIComponent(key);
  if (cache && !fresh) {
    try {
      const hit = await cache.match(url);
      if (hit) return (await hit.json()) as T;
    } catch { /* cache unavailable: fall through */ }
  }
  const value = await fn();
  if (cache) {
    try {
      await cache.put(url, new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttlSec}` } }));
    } catch { /* not cached: fine */ }
  }
  return value;
}

/** Seconds to keep a report: short when the range includes today (numbers still moving), longer for past days. */
export const reportTtl = (end: string, today: string) => (end >= today ? 300 : 3600);
