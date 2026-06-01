import { polyCustom } from './polyCustom';

export function createCache(ttl = process.env.SDK_CACHE_MS ? parseInt(process.env.SDK_CACHE_MS) : 300_000) {
  const cache = new Map<
    string,
    {
      value: any;
      expires: number;
      executionId?: string;
    }
  >();

  return {
    get(key: string) {
      const record = cache.get(key);
      if (!record) return undefined;

      if (
        record.expires >= Date.now() ||
        record.executionId === polyCustom.executionId
      ) {
        return record.value;
      }

      return undefined;
    },

    set(key: string, value: any) {
      const executionId = polyCustom.executionId;
      cache.set(key, {
        value,
        expires: Date.now() + ttl,
        executionId,
      });
    },
  };
}
