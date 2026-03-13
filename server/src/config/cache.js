import NodeCache from "node-cache";

// Create a shared cache instance
const cache = new NodeCache({ checkperiod: 60 });

// Cache keys and their TTLs
export const CACHE_KEYS = {
  STANDINGS: "standings",
  DAILY_REPORT: "daily_report",
  LEADERS: "leaders",
  SCORES: "scores",
};

export const CACHE_TTL = {
  STANDINGS: 300,       // 5 minutes
  DAILY_REPORT: 900,    // 15 minutes
  LEADERS: 900,
  SCORES: 900,
  BOXSCORE_RECENT: 60,  // 1 minute for in-progress games
  BOXSCORE_FINAL: 3600, // 1 hour for completed games
};

// Track last-updated timestamps and error state per key
const meta = {};

export function getCacheEntry(key) {
  return cache.get(key);
}

export function setCacheEntry(key, value, ttl) {
  meta[key] = { updatedAt: new Date().toISOString(), error: null };
  cache.set(key, value, ttl);
}

export function getCacheMeta(key) {
  return meta[key] || { updatedAt: null, error: null };
}

export function markCacheError(key, error) {
  if (!meta[key]) meta[key] = {};
  meta[key].error = error;
}

export function getCacheStatus() {
  const keys = Object.values(CACHE_KEYS);
  return keys.reduce((acc, key) => {
    const ttl = cache.getTtl(key);
    const m = getCacheMeta(key);
    acc[key] = {
      cached: cache.has(key),
      updatedAt: m.updatedAt,
      expiresAt: ttl ? new Date(ttl).toISOString() : null,
      error: m.error,
    };
    return acc;
  }, {});
}

export default cache;
