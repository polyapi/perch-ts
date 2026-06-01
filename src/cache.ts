const ALL_CACHES = new Map<string, Map<string, any>>();

export function expireCache(names?: string[], paths?: string[]) {
  names = names || Array.from(ALL_CACHES.keys());
  for (const name of names) {
    const cache = ALL_CACHES.get(name);
    if (!cache) continue;
    for (const key of cache.keys()) {
      if (!paths || paths.includes(key)) {
        cache.delete(key);
      }
    }
  }
}

export function createCache(name: string) {
  const cache = ALL_CACHES.get(name) || new Map<string, any>();
  ALL_CACHES.set(name, cache);

  return {
    get(key: string) {
      return cache.get(key);
    },

    set(key: string, value: any) {
      cache.set(key, value);
    },
  };
}
